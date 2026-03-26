import asyncio
import sys
import threading
import uuid
import time
from typing import Dict, Any, List
from playwright.async_api import async_playwright

class ActionMapper:
    def __init__(self):
        self._bg_thread = None
        self._bg_loop = None
        self._loop_ready = threading.Event()

    def _start_background_loop(self):
        try:
            if sys.platform == 'win32':
                asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
            self._bg_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self._bg_loop)
            self._loop_ready.set()
            self._bg_loop.run_forever()
        except Exception as e:
            print(f"ActionMapper Event Loop Error: {e}")

    def _ensure_background_thread(self):
        if self._bg_thread is None or not self._bg_thread.is_alive():
            self._loop_ready.clear()
            self._bg_thread = threading.Thread(target=self._start_background_loop, daemon=True, name="ActionMapperThread")
            self._bg_thread.start()
            self._loop_ready.wait()

    def _run_in_bg(self, coro):
        self._ensure_background_thread()
        future = asyncio.run_coroutine_threadsafe(coro, self._bg_loop)
        return asyncio.wrap_future(future)

    def _ensure_protocol(self, url: str) -> str:
        if not url: return ""
        if "://" not in url:
            return f"https://{url}"
        return url

    def _normalize_url(self, url: str) -> str:
        if not url: return ""
        # Aggressive normalization: remove protocol, www, and trailing slash
        # e.g. https://www.google.com/ -> google.com
        u = url.lower()
        if "://" in u:
            u = u.split("://")[1]
        u = u.replace("www.", "")
        return u.rstrip('/')

    async def map_url(self, url: str, max_depth: int = 1, max_siblings: int = 15, 
                exclude_selectors: List[str] = None, include_selector: str = None, 
                content_selector: str = None) -> Dict[str, Any]:
        return await self._run_in_bg(self._map_url_impl(url, max_depth, max_siblings, exclude_selectors, include_selector, content_selector))
    async def _get_active_page(self, context, default_page):
        """
        Detects if a new tab or window has been opened and returns the most relevant active page.
        """
        if not context.pages:
            return default_page
            
        # The last page in context.pages is typically the most recent one opened
        latest_page = context.pages[-1]
        
        # If it's the same as default, no change
        if latest_page == default_page:
            return default_page
            
        # Wait a bit for the URL to settle (avoid about:blank if possible)
        try:
            # Short wait for any immediate redirection
            await latest_page.wait_for_timeout(500)
            if latest_page.url == "about:blank":
                # Try waiting one more time for slow popups
                await latest_page.wait_for_timeout(1000)
        except:
            pass
            
        return latest_page

    async def _map_url_impl(self, url: str, max_depth: int = 1, max_siblings: int = 30, 
                           exclude_selectors: List[str] = None, include_selector: str = None, 
                           content_selector: str = None) -> Dict[str, Any]:
        normalized_root_url = self._normalize_url(url)
        full_root_url = self._ensure_protocol(url)
        print(f"DEBUG: Starting map_url for {url} (full: {full_root_url}, normalized: {normalized_root_url})")
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080}
            )
            page = await context.new_page()
            
            # Anti-bot: Hide webdriver flag
            await page.add_init_script("delete Object.getPrototypeOf(navigator).webdriver")
            
            try:
                # SKT/Security Heuristic: Visit the main page first to get initial cookies/session
                # especially important for 'mypage' sub-URLs that depend on base cookies.
                base_domain_url = "https://sktmembership.tworld.co.kr/mps/pc-bff/sktmembership/main.do"
                if normalized_root_url != self._normalize_url(base_domain_url):
                    print(f"DEBUG: Initializing session via main page: {base_domain_url}")
                    await page.goto(base_domain_url, wait_until="domcontentloaded", timeout=15000)
                    await page.wait_for_timeout(1000)

                print(f"DEBUG: Navigating to target: {full_root_url}")
                await page.goto(full_root_url, wait_until="load", timeout=25000)
                try: await page.wait_for_load_state("networkidle", timeout=5000)
                except: pass
                await self._clear_overlays(page)
                await page.wait_for_timeout(2500)
            except Exception as e:
                print(f"Warning: Map root goto timeout: {e}")
            
            # Use the ACTUAL loaded URL as the base for normalization
            normalized_root_url = self._normalize_url(page.url)
            print(f"DEBUG: Normalized root URL settled as: {normalized_root_url}")
            
            # Heuristic: Detect if we were redirected to a login or error page
            lowered_url = page.url.lower()
            if "error" in lowered_url or "login" in lowered_url or "auth" in lowered_url:
                print(f"WARNING: The crawler may have been redirected to an error or login page: {page.url}")
                print("HINT: Ensure the URL is accessible without login or provide a session if supported.")
            
            root_elements = await self._extract_elements(page, exclude_selectors, include_selector, max_siblings)
            root_node = {
                "node_id": f"node_{uuid.uuid4().hex[:8]}",
                "depth": 0,
                "title": await page.title(),
                "url": normalized_root_url,
                "interactable_elements": root_elements,
                "children": []
            }
            
            if max_depth > 0:
                elements_to_explore = root_elements[:max_siblings]
                for element in elements_to_explore:
                    selector = element["selector"]
                    print(f"Mapping depth 1: clicking '{element['text']}' using {selector}")
                    try:
                        # Detect both new tabs and same-tab navigation
                        active_page = None
                        is_new_page = False
                        
                        try:
                            # Start expecting a new page (popup/tab)
                            # Increased timeout significantly for slow popups/redirects
                            async with context.expect_page(timeout=8000) as info:
                                try:
                                    await page.click(selector, timeout=5000, force=True)
                                except Exception as click_err:
                                    print(f"DEBUG: Playwright click failed for {selector}, attempting JS fallback...")
                                    safe_selector = selector.replace('`', '\\`')
                                    await page.evaluate(f"document.querySelector(`{safe_selector}`)?.click()")
                            
                            active_page = await info.value
                            is_new_page = True
                            print(f"DEBUG: New page/tab detected for '{element['text']}' (URL: {active_page.url})")
                        except Exception:
                            # Fallback: Check if any new page appeared in the context despite timeout
                            all_pages = context.pages
                            if len(all_pages) > 1 and all_pages[-1] != page:
                                active_page = all_pages[-1]
                                is_new_page = True
                                print(f"DEBUG: New page detected via fallback for '{element['text']}' (URL: {active_page.url})")
                            else:
                                active_page = page
                                is_new_page = False
                                print(f"DEBUG: No new page detected, assuming same-tab interaction for '{element['text']}'")
                        
                        # 2. Wait for content to settle and URL to move from about:blank or root
                        try:
                            if is_new_page:
                                # New tab: wait for URL to move from about:blank
                                start_time = time.time()
                                while active_page.url == "about:blank" and time.time() - start_time < 8:
                                    await active_page.wait_for_timeout(500)
                            else:
                                # Same tab: wait for URL to change from root (if we expect a move)
                                # We give it 4 seconds to start the move
                                start_time = time.time()
                                while self._normalize_url(active_page.url) == normalized_root_url and time.time() - start_time < 4:
                                    await active_page.wait_for_timeout(500)
                                
                            await active_page.wait_for_load_state("domcontentloaded", timeout=7000)
                            await self._clear_overlays(active_page)
                            await active_page.wait_for_timeout(1500)
                        except: pass
                        
                        current_url = self._normalize_url(active_page.url)
                        current_title = await active_page.title()
                        
                        # Skip empty nodes (usually failed loads or transient about:blank)
                        if current_url == "about:blank" or not current_url:
                            print(f"DEBUG: Skipping empty child node at about:blank for '{element['text']}'")
                            if is_new_page: await active_page.close()
                            continue

                        # extraction Logic: 
                        # If a content_selector is provided, use it for children.
                        # Else, use the whole page but EXCLUDE redundant layout areas.
                        step_include_selector = content_selector
                        step_exclude_selectors = (exclude_selectors or []).copy()
                        
                        if not step_include_selector:
                            # Broaden auto-excludes to hide all repetitive layout areas
                            auto_excludes = [
                                'header', 'footer', 'nav', 
                                '#header', '#footer', '#myGnb', '#accessibility', '#skip',
                                '.header', '.footer', '.gnb', '.accessibility'
                            ]
                            if include_selector:
                                auto_excludes.append(include_selector)
                                
                            for ae in auto_excludes:
                                if ae not in step_exclude_selectors:
                                    step_exclude_selectors.append(ae)

                        child_elements = await self._extract_elements(active_page, step_exclude_selectors, step_include_selector, max_siblings)
                        print(f"DEBUG: Found {len(child_elements)} child elements on {active_page.url}")

                        # Smart Layer Detection: 
                        # Skip ONLY if it's the SAME tab AND URL/Title haven't changed AND content is highly similar.
                        # New tabs (is_new_page) should ALWAYS produce a node if the URL is different or content is meaningful.
                        is_redundant_layer = False
                        if not is_new_page and current_url == normalized_root_url and current_title == root_node["title"]:
                            root_selectors = set(e["selector"] for e in root_elements)
                            child_selectors = set(e["selector"] for e in child_elements)
                            
                            if child_selectors:
                                intersection = root_selectors.intersection(child_selectors)
                                similarity = len(intersection) / len(child_selectors)
                                # Lowered to 70% to allow pages with large shared headers/footers or modals
                                if similarity > 0.7:
                                    print(f"DEBUG: Skipping redundant UI layer (Sim: {similarity:.2f}) for '{element['text']}'")
                                    is_redundant_layer = True
                                else:
                                    print(f"DEBUG: Keeping same-URL node due to content change (Sim: {similarity:.2f}) for '{element['text']}'")
                            elif not child_elements:
                                print(f"DEBUG: Skipping empty same-URL node for '{element['text']}'")
                                is_redundant_layer = True

                        if is_redundant_layer:
                            if is_new_page: await active_page.close()
                            continue
                        
                        child_node = {
                            "trigger_element_id": element["id"],
                            "trigger_text": element["text"],
                            "node": {
                                "node_id": f"node_{uuid.uuid4().hex[:8]}",
                                "depth": 1,
                                "title": await active_page.title(),
                                "url": current_url,
                                "interactable_elements": child_elements,
                                "children": []
                            }
                        }
                        root_node["children"].append(child_node)
                        
                        # 3. Cleanup: Return to root state
                        if is_new_page:
                            await active_page.close()
                            # Original page 'page' is already at root
                        else:
                            try:
                                await page.go_back(wait_until="domcontentloaded", timeout=10000)
                            except Exception:
                                await page.goto(full_root_url, wait_until="domcontentloaded", timeout=15000)
                            await page.wait_for_timeout(1500)
                        
                    except Exception as e:
                        print(f"Failed to expand node for '{element['text']}': {e}")
                        try:
                            # Clean up popups if we were mid-failure
                            for p_item in context.pages:
                                if p_item != page: await p_item.close()
                            await page.goto(full_root_url, wait_until="domcontentloaded", timeout=15000)
                            await page.wait_for_timeout(1500)
                        except: pass
                        
            await browser.close()
            return root_node

    async def _clear_overlays(self, page):
        """
        Injects JavaScript to find and hide common overlay elements (popups, modals, notices)
        that frequently block automated crawlers.
        """
        script = """
        () => {
            const popupSelectors = [
                'div[id*="notice"]', 'div[class*="notice"]', 
                'div[id*="popup"]', 'div[class*="popup"]',
                'div[id*="layer"]', 'div[class*="layer"]',
                'div[id*="modal"]', 'div[class*="modal"]',
                '.layer-wrap', '.pop-layer', '.dimmed',
                '#lyr-notice-main' // Specifically reported for atomy.com
            ];
            
            let clearedCount = 0;
            popupSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    // Only hide if it's likely an overlay (e.g. has high z-index or fixed/absolute position)
                    const style = window.getComputedStyle(el);
                    if (style.position === 'fixed' || style.position === 'absolute' || parseInt(style.zIndex) > 10) {
                        el.style.display = 'none';
                        el.style.visibility = 'hidden';
                        el.style.opacity = '0';
                        el.style.pointerEvents = 'none';
                        clearedCount++;
                    }
                });
            });
            return clearedCount;
        }
        """
        try:
            count = await page.evaluate(script)
            if count > 0:
                print(f"DEBUG: Cleared {count} potential blocking overlays.")
        except Exception as e:
            print(f"Warning: Failed to clear overlays: {e}")
            
    async def _extract_elements(self, page, exclude_selectors: List[str] = None, include_selector: str = None, limit: int = 30) -> List[Dict[str, Any]]:
        script = """
        (params) => {
            const { excludeSelectors, includeSelector, limit } = params;
            function getCssSelector(el) {
                if (!(el instanceof Element)) return;
                var path = [];
                while (el.nodeType === Node.ELEMENT_NODE) {
                    var selector = el.nodeName.toLowerCase();
                    if (el.id) {
                        selector += '#' + el.id;
                        path.unshift(selector);
                        break;
                    } else {
                        var sib = el, nth = 1;
                        while (sib = sib.previousElementSibling) {
                            if (sib.nodeName.toLowerCase() == selector)
                                nth++;
                        }
                        if (nth != 1) selector += ":nth-of-type("+nth+")";
                    }
                    path.unshift(selector);
                    el = el.parentNode;
                }
                return path.join(" > ");
            }
            
            // Inclusion filtering
            let root = document;
            if (includeSelector) {
                const found = document.querySelector(includeSelector);
                if (found) {
                    root = found;
                } else {
                    // If includeSelector is provided but not found, 
                    // return empty to signal that the focus region is missing/invalid.
                    return [];
                }
            }

            const elements = root.querySelectorAll('a, button, [role="button"], input[type="submit"]');
            const result = [];
            
            // Exclusion filtering
            const isExcluded = (el) => {
                if (!excludeSelectors || excludeSelectors.length === 0) return false;
                const focalRoot = includeSelector ? document.querySelector(includeSelector) : null;
                
                for (const sel of excludeSelectors) {
                    if (!sel) continue;
                    const exclusionTarget = el.closest(sel);
                    if (exclusionTarget) {
                        // If we have a focus region, and this exclusion is a parent of it, 
                        // ignore the exclusion (Focus takes precedence over Parent Exclusion).
                        if (focalRoot && exclusionTarget.contains(focalRoot) && exclusionTarget !== focalRoot) {
                            continue;
                        }
                        return true;
                    }
                }
                return false;
            };

            const seenTexts = new Set();
            
            let count = 0;
            for (let i = 0; i < elements.length; i++) {
                // Limit to X top interactable elements
                if (count >= limit) break; 
                const el = elements[i];
                
                // Skip if in an excluded region
                if (isExcluded(el)) continue;

                const rect = el.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) continue; // Skip invisible elements
                
                let text = el.innerText || el.textContent || el.getAttribute('aria-label') || el.value || '';
                text = text.trim();
                
                // Skip empty text or massive blocks of text
                if (!text || text.length > 50) continue; 
                
                // Deduplicate by text (e.g. multiple "Buy" buttons, just keep the first)
                if (seenTexts.has(text)) continue;
                seenTexts.add(text);
                
                result.push({
                    id: `node_elem_${result.length}`,
                    text: text,
                    tag: el.tagName.toLowerCase(),
                    selector: getCssSelector(el)
                });
                count++;
            }
            return result;
        }
        """
        try:
            # Playwright Python evaluate only takes ONE argument for the function.
            # So we pass them as a dictionary.
            return await page.evaluate(script, {
                "excludeSelectors": exclude_selectors or [],
                "includeSelector": include_selector,
                "limit": limit
            })
        except Exception as e:
            print(f"Failed to extract elements via JS: {e}")
            return []

action_mapper = ActionMapper()
