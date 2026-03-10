import asyncio
import sys
import threading
import uuid
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

    async def map_url(self, url: str, max_depth: int = 1, max_siblings: int = 15, exclude_selectors: List[str] = None, include_selector: str = None) -> Dict[str, Any]:
        return await self._run_in_bg(self._map_url_impl(url, max_depth, max_siblings, exclude_selectors, include_selector))

    async def _map_url_impl(self, url: str, max_depth: int = 1, max_siblings: int = 15, exclude_selectors: List[str] = None, include_selector: str = None) -> Dict[str, Any]:
        normalized_root_url = self._normalize_url(url)
        full_root_url = self._ensure_protocol(url)
        print(f"DEBUG: Starting map_url for {url} (full: {full_root_url}, normalized: {normalized_root_url})")
        print(f"DEBUG: include_selector: '{include_selector}', exclude_selectors: {exclude_selectors}")

        """
        Crawls the target URL to the specified depth, gathering interactable elements
        and building an Action Flow Map JSON tree.
        """
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(viewport={"width": 1280, "height": 800})
            page = await context.new_page()
            try:
                # Use full_root_url for goto (it ensures protocol)
                print(f"DEBUG: Navigating to root URL: {full_root_url}")
                await page.goto(full_root_url, wait_until="load", timeout=25000)
                try:
                    await page.wait_for_load_state("networkidle", timeout=5000)
                except: pass
                await page.wait_for_timeout(3000) # Final settled wait
            except Exception as e:
                print(f"Warning: Map root goto timeout: {e}")
            
            # Extract root elements - Universal strict filtering
            print(f"DEBUG: Extracting root elements with excludes={exclude_selectors}, include={include_selector}")
            root_elements = await self._extract_elements(page, exclude_selectors, include_selector)
            print(f"DEBUG: Found {len(root_elements)} root elements on {page.url}")
            
            root_node = {
                "node_id": f"node_{uuid.uuid4().hex[:8]}",
                "depth": 0,
                "title": await page.title(),
                "url": self._normalize_url(page.url),
                "interactable_elements": root_elements,
                "children": []
            }
            
            if max_depth > 0:
                # Limit to max_siblings to avoid taking hours
                elements_to_explore = root_elements[:max_siblings]
                print(f"DEBUG: Exploring {len(elements_to_explore)} elements for depth 1...")
                
                for element in elements_to_explore:
                    selector = element["selector"]
                    print(f"Mapping depth 1: clicking '{element['text']}' using {selector}")
                    try:
                        # Click the element
                        await page.click(selector, timeout=5000)
                        # Wait for potential navigation or JS updates
                        try:
                            await page.wait_for_load_state("load", timeout=5000)
                            await page.wait_for_timeout(1000)
                        except: pass
                        
                        # URL-based Deduplication
                        current_url = self._normalize_url(page.url)
                        if current_url == normalized_root_url and max_depth > 1:
                            print(f"Skipping child node for '{element['text']}' - URL matches root: {current_url}")
                            continue

                        child_elements = await self._extract_elements(page, exclude_selectors, include_selector)
                        print(f"DEBUG: Found {len(child_elements)} child elements on {page.url} (trigger: '{element['text']}')")
                        
                        child_node = {
                            "trigger_element_id": element["id"],
                            "trigger_text": element["text"],
                            "node": {
                                "node_id": f"node_{uuid.uuid4().hex[:8]}",
                                "depth": 1,
                                "title": await page.title(),
                                "url": current_url,
                                "interactable_elements": child_elements,
                                "children": []
                            }
                        }
                        root_node["children"].append(child_node)
                        
                        # Return to root state
                        try:
                            # Try going back through browser history first
                            await page.go_back(wait_until="domcontentloaded", timeout=10000)
                        except Exception:
                            # If go_back fails, reload the root URL explicitly
                            await page.goto(full_root_url, wait_until="domcontentloaded", timeout=15000)
                            
                        await page.wait_for_timeout(2000) # Stabilize after return
                        
                    except Exception as e:
                        print(f"Failed to expand node for '{element['text']}': {e}")
                        # Ensure we always return to the root URL for the next iteration
                        try:
                            await page.goto(full_root_url, wait_until="domcontentloaded", timeout=15000)
                            await page.wait_for_timeout(2000)
                        except:
                            pass
                        
            await browser.close()
            return root_node
            
    async def _extract_elements(self, page, exclude_selectors: List[str] = None, include_selector: str = None) -> List[Dict[str, Any]]:
        script = """
        (params) => {
            const { excludeSelectors, includeSelector } = params;
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
                if (found) root = found;
            }

            const elements = root.querySelectorAll('a, button, [role="button"], input[type="submit"]');
            const result = [];
            
            // Exclusion filtering
            const isExcluded = (el) => {
                if (!excludeSelectors || excludeSelectors.length === 0) return false;
                for (const sel of excludeSelectors) {
                    if (sel && el.closest(sel)) return true;
                }
                return false;
            };

            const seenTexts = new Set();
            
            let count = 0;
            for (let i = 0; i < elements.length; i++) {
                // Limit to 15 top interactable elements to keep LLM context reasonable
                if (count >= 15) break; 
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
                "includeSelector": include_selector
            })
        except Exception as e:
            print(f"Failed to extract elements via JS: {e}")
            return []

action_mapper = ActionMapper()
