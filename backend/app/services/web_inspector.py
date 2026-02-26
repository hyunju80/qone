import base64
import logging
import os
import tempfile
import asyncio
import sys
import threading
import concurrent.futures
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
from playwright.async_api import async_playwright, Page, Browser, BrowserContext

logger = logging.getLogger(__name__)

# Use system temp directory for screencast frames
SCREENCAST_DIR = Path(tempfile.gettempdir()) / "qone_web_inspector"
SCREENCAST_DIR.mkdir(exist_ok=True)

class WebInspectorService:
    def __init__(self):
        self._bg_thread = None
        self._bg_loop = None
        self._loop_ready = threading.Event()
        
        self.playwright = None
        self.browser = None
        self.context = None
        self.page = None
        self.session_id = None
        self.cdp_client = None
        self.last_frame_path = None

    def _start_background_loop(self):
        """Runs in the new background thread."""
        try:
            if sys.platform == 'win32':
                asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
            
            self._bg_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self._bg_loop)
            self._loop_ready.set()
            logger.info("WebInspectorService: Dedicated Playwright background thread started")
            self._bg_loop.run_forever()
        except Exception as e:
            logger.error(f"Failed to start dedicated Playwright loop: {e}")

    def _ensure_background_thread(self):
        if self._bg_thread is None or not self._bg_thread.is_alive():
            self._loop_ready.clear()
            self._bg_thread = threading.Thread(target=self._start_background_loop, daemon=True, name="PlaywrightThread")
            self._bg_thread.start()
            self._loop_ready.wait()

    def _run_in_bg(self, coro):
        self._ensure_background_thread()
        future = asyncio.run_coroutine_threadsafe(coro, self._bg_loop)
        return asyncio.wrap_future(future)

    async def start_session(self, url: str) -> Tuple[bool, Optional[str]]:
        return await self._run_in_bg(self._start_session_impl(url))

    async def _start_session_impl(self, url: str) -> Tuple[bool, Optional[str]]:
        try:
            if self.browser:
                await self._stop_session_impl()

            p = await async_playwright().start()
            self.playwright = p
            
            self.browser = await self.playwright.chromium.launch(headless=True)
            self.context = await self.browser.new_context(viewport={"width": 1280, "height": 800})
            self.page = await self.context.new_page()
            self.session_id = "web-inspector-session"
            self.last_frame_path = SCREENCAST_DIR / f"{self.session_id}_latest.jpg"

            # 1. Setup CDP Screencast
            self.cdp_client = await self.context.new_cdp_session(self.page)
            await self.cdp_client.send("Page.startScreencast", {"format": "jpeg", "quality": 60, "everyNthFrame": 1})
            
            async def on_screencast_frame(event):
                try:
                    data = event.get("data")
                    session_id = event.get("sessionId")
                    if data:
                        with open(self.last_frame_path, "wb") as f:
                            f.write(base64.b64decode(data))
                    await self.cdp_client.send("Page.screencastFrameAck", {"sessionId": session_id})
                except:
                    pass

            self.cdp_client.on("Page.screencastFrame", on_screencast_frame)

            # 2. Navigate
            logger.info(f"Navigating Web Inspector to {url}")
            await self.page.goto(url, wait_until="domcontentloaded", timeout=30000)
            
            # 3. Capture initial screenshot immediately to fix white screen/loading issue
            try:
                base64_data = await self.page.screenshot(type='jpeg', quality=60)
                with open(self.last_frame_path, "wb") as f:
                    f.write(base64_data)
                logger.info("Initial screenshot captured for Web Inspector")
            except Exception as se:
                logger.warning(f"Failed to capture initial screenshot: {se}")

            return True, None
        except Exception as e:
            logger.error(f"Failed to start Web Inspector session: {e}")
            await self._stop_session_impl()
            return False, str(e)

    async def stop_session(self):
        if self._bg_thread and self._bg_thread.is_alive():
            await self._run_in_bg(self._stop_session_impl())

    async def _stop_session_impl(self):
        try:
            if self.cdp_client:
                try: await self.cdp_client.send("Page.stopScreencast")
                except: pass
                self.cdp_client = None
            if self.browser:
                await self.browser.close()
            if self.playwright:
                await self.playwright.stop()
        except Exception as e:
            logger.warning(f"Error closing Web Inspector session: {e}")
        finally:
            self.browser = None
            self.playwright = None
            self.context = None
            self.page = None
            self.session_id = None

    async def get_screenshot(self) -> Optional[str]:
        return await self._run_in_bg(self._get_screenshot_impl())

    async def _get_screenshot_impl(self) -> Optional[str]:
        if not self.page:
            return None
        
        if self.last_frame_path and self.last_frame_path.exists():
            try:
                with open(self.last_frame_path, "rb") as f:
                    return base64.b64encode(f.read()).decode('utf-8')
            except:
                pass
        
        try:
            data = await self.page.screenshot(type='jpeg', quality=60)
            return base64.b64encode(data).decode('utf-8')
        except:
            return None

    async def get_page_source(self) -> Optional[str]:
        return await self._run_in_bg(self._get_page_source_impl())

    async def _get_page_source_impl(self) -> Optional[str]:
        if not self.page:
            return None
        try:
            return await self.page.content()
        except:
            return None

    async def identify_element(self, x: int, y: int, display_w: int, display_h: int) -> Dict[str, Any]:
        return await self._run_in_bg(self._identify_element_impl(x, y, display_w, display_h))

    async def _identify_element_impl(self, x: int, y: int, display_w: int, display_h: int) -> Dict[str, Any]:
        if not self.page:
            return {"success": False, "error": "No active web session"}

        try:
            viewport = self.page.viewport_size
            if not viewport or display_w <= 0 or display_h <= 0:
                return {"success": False, "error": "Invalid viewport or display dimensions"}
                
            v_w = viewport["width"]
            v_h = viewport["height"]
            
            mapped_x = (x / display_w) * v_w
            mapped_y = (y / display_h) * v_h
            
            import math
            if not (math.isfinite(mapped_x) and math.isfinite(mapped_y)):
                logger.error(f"Non-finite coordinates: mapped({mapped_x}, {mapped_y}) from display({x}, {y})/{display_w}x{display_h}")
                return {"success": False, "error": "Calculated coordinates are non-finite"}

            logger.info(f"Identifying web element at ({mapped_x}, {mapped_y})")

            js_script = """
            (args) => {
                const x = args[0];
                const y = args[1];
                
                if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
                    return null;
                }

                const el = document.elementFromPoint(x, y);
                if (!el) return null;

                const getXPath = (element) => {
                    if (element.id !== '') return 'id("' + element.id + '")';
                    if (element === document.body) return element.tagName;
                    let ix = 0;
                    const siblings = element.parentNode.childNodes;
                    for (let i = 0; i < siblings.length; i++) {
                        const sibling = siblings[i];
                        if (sibling === element) return getXPath(element.parentNode) + '/' + element.tagName + '[' + (ix + 1) + ']';
                        if (sibling.nodeType === 1 && sibling.tagName === element.tagName) ix++;
                    }
                };

                const getLineNumber = (element) => {
                    try {
                        // A rough approximation by finding the element's start tag in the overall HTML
                        const fullHtml = document.documentElement.outerHTML;
                        // Get the string representation of the element's start tag
                        const clone = element.cloneNode(false);
                        const startTag = clone.outerHTML.split('>')[0] + '>';
                        
                        // We might have multiple matching tags, so we can only do a rough estimate based on index
                        // A better way is counting the lines of the text content *before* this element.
                        // However, a simple search for the tag name is often enough for the viewer.
                        const tagName = element.tagName.toLowerCase();
                        
                        // Let's create a TreeWalker to count elements before this one to find its structural line
                        const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_ELEMENT, null, false);
                        let count = 0;
                        while(walker.nextNode()) {
                            count++;
                            if (walker.currentNode === element) break;
                        }
                        
                        // Since standard HTML serializers like outerHTML add indentation and newlines, 
                        // matching the exact line is tricky.
                        // For a better approximation, let's just find the index of the start tag 
                        // in the whole page HTML and count the newlines up to that index.
                        // Playwright's page.content() is used for the source.
                        
                    } catch (e) {
                        return null;
                    }
                    return null;
                };

                const rect = el.getBoundingClientRect();
                
                // Let's use a simpler heuristic: we assign a unique temporary ID, 
                // serialize the HTML, find the ID, count newlines, and remove the ID.
                let tempId = null;
                if (!el.id) {
                    tempId = 'qone-temp-id-' + Math.random().toString(36).substr(2, 9);
                    el.id = tempId;
                }
                const htmlStr = document.documentElement.outerHTML;
                const searchStr = 'id="' + (el.id) + '"';
                const charIndex = htmlStr.indexOf(searchStr);
                let lineNumber = null;
                if (charIndex !== -1) {
                    const substring = htmlStr.substring(0, charIndex);
                    lineNumber = (substring.match(/\\n/g) || []).length + 1;
                }
                
                if (tempId) {
                    el.removeAttribute('id');
                }

                return {
                    tagName: el.tagName,
                    id: el.id || '',
                    className: el.className,
                    name: el.getAttribute('name'),
                    placeholder: el.getAttribute('placeholder'),
                    text: el.innerText ? el.innerText.trim().substring(0, 50) : '',
                    xpath: getXPath(el),
                    lineNumber: lineNumber,
                    bounds: {
                        x: rect.left,
                        y: rect.top,
                        width: rect.width,
                        height: rect.height
                    }
                };
            }
            """
            
            result = await self.page.evaluate(js_script, [mapped_x, mapped_y])
            if not result:
                return {"success": False, "error": "No element found at coordinates"}

            res_bounds = {
                "x1": int((result["bounds"]["x"] / v_w) * display_w),
                "y1": int((result["bounds"]["y"] / v_h) * display_h),
                "x2": int(((result["bounds"]["x"] + result["bounds"]["width"]) / v_w) * display_w),
                "y2": int(((result["bounds"]["y"] + result["bounds"]["height"]) / v_h) * display_h)
            }

            selector_type = "xpath"
            selector_value = result["xpath"]
            name = result["tagName"]

            if result["id"]:
                selector_type = "id"
                selector_value = result["id"]
                name = result["id"]
            elif result["name"]:
                selector_type = "name"
                selector_value = result["name"]
                name = result["name"]
            elif result["text"]:
                name = result["text"]
            return {
                "success": True,
                "selector_type": selector_type,
                "selector_value": selector_value,
                "name": name,
                "bounds": res_bounds,
                "tag": result["tagName"],
                "text": result["text"],
                "line_number": result.get("lineNumber")
            }

        except Exception as e:
            logger.error(f"Web identification failed: {e}")
            return {"success": False, "error": str(e)}

    async def execute_step(self, step: Dict[str, Any]) -> Dict[str, Any]:
        return await self._run_in_bg(self._execute_step_impl(step))

    async def _execute_step_impl(self, step: Dict[str, Any]) -> Dict[str, Any]:
        if not self.page:
            return {"success": False, "error": "No active web session"}

        action = step.get("action", "").lower()
        selector_type = (step.get("selector_type") or step.get("selectorType") or "").lower()
        selector_value = step.get("selector_value") or step.get("selectorValue")
        option = step.get("option", "")

        try:
            pw_selector = selector_value
            if selector_type == "id":
                pw_selector = f"id={selector_value}"
            elif selector_type == "name":
                pw_selector = f"[name='{selector_value}']"
            elif selector_type == "text":
                pw_selector = f"text={selector_value}"
            elif selector_type == "css":
                pw_selector = f"css={selector_value}"
            elif selector_type == "xpath":
                pw_selector = f"xpath={selector_value}"

            if action == "click":
                await self.page.click(pw_selector, timeout=5000)
            elif action in ["input", "type", "send_keys"]:
                await self.page.fill(pw_selector, option, timeout=5000)
            elif action == "hover":
                await self.page.hover(pw_selector, timeout=5000)
            elif action == "scroll":
                await self.page.evaluate("window.scrollBy(0, 500)")
            elif action == "wait":
                await asyncio.sleep(float(option) if option else 1)
            elif action == "navigate":
                await self.page.goto(option, timeout=30000)
            else:
                return {"success": False, "error": f"Unsupported web action: {action}"}

            return {"success": True}
        except Exception as e:
            logger.error(f"Web action failed: {e}")
            return {"success": False, "error": str(e)}

    async def scroll(self, delta_y: int) -> Dict[str, Any]:
        return await self._run_in_bg(self._scroll_impl(delta_y))

    async def _scroll_impl(self, delta_y: int) -> Dict[str, Any]:
        if not self.page:
            return {"success": False, "error": "No active web session"}
        try:
            await self.page.evaluate(f"window.scrollBy(0, {delta_y})")
            return {"success": True}
        except Exception as e:
            logger.error(f"Web scroll failed: {e}")
            return {"success": False, "error": str(e)}

web_inspector_service = WebInspectorService()
