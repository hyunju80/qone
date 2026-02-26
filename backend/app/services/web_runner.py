import asyncio
import base64
import logging
import sys
import threading
from typing import Dict, Any, Optional, List, Tuple
from playwright.async_api import async_playwright, Page, Browser, BrowserContext

logger = logging.getLogger(__name__)

class WebStepRunner:
    def __init__(self):
        self._bg_thread = None
        self._bg_loop = None
        self._loop_ready = threading.Event()
        
        self.playwright = None
        self.browser = None
        self.context = None
        self.page = None

    def _start_background_loop(self):
        """Runs in a dedicated background thread to handle Playwright on Windows."""
        try:
            if sys.platform == 'win32':
                asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
            
            self._bg_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self._bg_loop)
            self._loop_ready.set()
            logger.info("WebStepRunner: Dedicated Playwright background thread started")
            self._bg_loop.run_forever()
        except Exception as e:
            logger.error(f"WebStepRunner: Failed to start background loop: {e}")

    def _ensure_background_thread(self):
        if self._bg_thread is None or not self._bg_thread.is_alive():
            self._loop_ready.clear()
            self._bg_thread = threading.Thread(target=self._start_background_loop, daemon=True, name="WebRunnerThread")
            self._bg_thread.start()
            self._loop_ready.wait()

    def _run_in_bg(self, coro):
        self._ensure_background_thread()
        future = asyncio.run_coroutine_threadsafe(coro, self._bg_loop)
        return asyncio.wrap_future(future)

    async def start_session(self, url: Optional[str] = None) -> Tuple[bool, Optional[str]]:
        return await self._run_in_bg(self._start_session_impl(url))

    async def _start_session_impl(self, url: Optional[str] = None) -> Tuple[bool, Optional[str]]:
        try:
            if self.playwright is None:
                self.playwright = await async_playwright().start()
            
            if self.browser:
                await self.browser.close()

            self.browser = await self.playwright.chromium.launch(headless=True)
            self.context = await self.browser.new_context(viewport={"width": 1280, "height": 800})
            self.page = await self.context.new_page()
            
            if url:
                await self.page.goto(url, wait_until="domcontentloaded")
            
            return True, None
        except Exception as e:
            logger.error(f"WebStepRunner: Failed to start session: {e}")
            return False, str(e)

    async def stop_session(self):
        if self._bg_thread and self._bg_thread.is_alive():
            await self._run_in_bg(self._stop_session_impl())

    async def _stop_session_impl(self):
        try:
            if self.browser:
                await self.browser.close()
            if self.playwright:
                await self.playwright.stop()
        except:
            pass
        finally:
            self.browser = None
            self.playwright = None
            self.context = None
            self.page = None

    async def get_screenshot(self) -> Optional[str]:
        return await self._run_in_bg(self._get_screenshot_impl())

    async def _get_screenshot_impl(self) -> Optional[str]:
        if not self.page:
            return None
        try:
            data = await self.page.screenshot(type='jpeg', quality=60)
            return base64.b64encode(data).decode('utf-8')
        except:
            return None

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
                await self.page.click(pw_selector, timeout=10000)
            elif action in ["input", "type", "send_keys"]:
                await self.page.fill(pw_selector, option, timeout=10000)
            elif action == "hover":
                await self.page.hover(pw_selector, timeout=5000)
            elif action == "scroll":
                await self.page.evaluate("window.scrollBy(0, 500)")
            elif action == "wait":
                await asyncio.sleep(float(option) if option else 1)
            elif action == "navigate":
                await self.page.goto(option, timeout=30000)
            elif action == "verify exists":
                await self.page.wait_for_selector(pw_selector, state="visible", timeout=5000)
            else:
                return {"success": False, "error": f"Unsupported web action: {action}"}

            return {"success": True}
        except Exception as e:
            logger.error(f"WebStepRunner: Action failed: {e}")
            return {"success": False, "error": str(e)}

web_step_runner = WebStepRunner()
