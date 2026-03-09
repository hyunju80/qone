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
    def apply_data_to_step(self, step: Dict[str, Any], data: Dict[str, Any], reference_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Replaces {{key}} in step fields with values from data, using Smart Mapping fallbacks."""
        import re
        new_step = step.copy()
        
        # 1. Primary: Standard Placeholder Substitution {{key}} and {{key_expected}}
        look_in = ["selector_value", "selectorValue", "option", "inputValue", "value", "assertText", "description", "stepName", "name"]
        used_placeholders = False
        
        for field in look_in:
            if field in new_step and isinstance(new_step[field], str):
                val = new_step[field]
                placeholders = re.findall(r"\{\{([^}]+)\}\}", val)
                for ph in placeholders:
                    clean_ph = ph.strip()
                    is_expected = clean_ph.endswith("_expected")
                    key = clean_ph.replace("_expected", "") if is_expected else clean_ph
                    
                    if key in data:
                        data_item = data[key]
                        if is_expected:
                            actual_val = data_item.get("expected_result") if isinstance(data_item, dict) else None
                        else:
                            actual_val = data_item.get("value") if isinstance(data_item, dict) else data_item
                        
                        if actual_val is not None:
                            val = val.replace(f"{{{{{ph}}}}}", str(actual_val))
                            used_placeholders = True
                new_step[field] = val
        
        # 2. Secondary: Smart Mapping (Implicit Field Matching via description/name for Input Values)
        if not used_placeholders and data:
            action = str(new_step.get("action", "")).lower()
            val_field = "inputValue" if "inputValue" in new_step else ("option" if "option" in new_step else "value")
                
            desc = str(new_step.get("description", ""))
            name = str(new_step.get("stepName", "") or new_step.get("name", ""))

            for key, data_item in data.items():
                if key in desc or key in name:
                    actual_val = data_item.get("value") if isinstance(data_item, dict) else data_item
                    
                    if actual_val is not None and new_step.get(val_field) != str(actual_val):
                        if action in ["type", "input", "send_keys", "navigate", "wait"]:
                            new_step[val_field] = str(actual_val)
                    break

        # 3. Tertiary: Value-based Smart Mapping (Literal Replacement based on Row 1)
        if not used_placeholders and reference_data and data:
            for key, data_item in data.items():
                new_val = data_item.get("value") if isinstance(data_item, dict) else data_item
                new_exp = data_item.get("expected_result") if isinstance(data_item, dict) else None
                
                # Get reference value for Row 1
                ref_item = reference_data.get(key)
                old_val_ref = ref_item.get("value") if isinstance(ref_item, dict) else ref_item
                old_exp_ref = ref_item.get("expected_result") if isinstance(ref_item, dict) else ref_item
                
                # Replace input/general literal values
                if old_val_ref and isinstance(old_val_ref, str) and len(old_val_ref) > 1:
                    if old_val_ref != str(new_val):
                        for field in look_in:
                            if field in new_step and isinstance(new_step[field], str):
                                if old_val_ref in new_step[field]:
                                    new_step[field] = new_step[field].replace(old_val_ref, str(new_val))
                                    
                # Replace literal expected_result if present in Row 1's expected_result
                if old_exp_ref and isinstance(old_exp_ref, str) and len(old_exp_ref) > 1:
                    if old_exp_ref != str(new_exp) and new_exp is not None:
                        for field in look_in:
                            if field in new_step and isinstance(new_step[field], str):
                                if old_exp_ref in new_step[field]:
                                    new_step[field] = new_step[field].replace(old_exp_ref, str(new_exp))
        
        return new_step

    async def execute_step(self, step: Dict[str, Any], data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self._run_in_bg(self._execute_step_impl(step, data))

    async def _execute_step_impl(self, step: Dict[str, Any], data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if not self.page:
            return {"success": False, "error": "No active web session"}

        # Perform Variable Substitution if data is provided
        if data:
            step = self.apply_data_to_step(step, data)

        action = step.get("action", "").lower()
        selector_type = (step.get("selector_type") or step.get("selectorType") or "").lower()
        selector_value = step.get("selector_value") or step.get("selectorValue")
        option = step.get("inputValue") or step.get("option") or step.get("value", "")

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
            elif action == "finish":
                logger.info("WebStepRunner: Test finished (no-op action)")
            else:
                return {"success": False, "error": f"Unsupported web action: {action}"}

            # Apply post-action Step Assertion if configured
            assert_text = step.get("assertText")
            if assert_text and str(assert_text).strip() != "":
                logger.info(f"WebStepRunner: Verifying step assertion: '{assert_text}'")
                await asyncio.sleep(2) # Wait for page transition / UI to settle
                try:
                    # Get rendered innerText to ignore HTML tags
                    content = await self.page.evaluate("document.body.innerText")
                    if assert_text in content:
                        logger.info("Exact Assertion Passed.")
                    else:
                        # Fuzzy match: remove whitespace/newlines and check
                        def _normalize(t):
                             import re
                             # Remove HTML-like tags just in case, and all whitespace
                             t = re.sub(r'<[^>]*>', '', t)
                             return "".join(t.split())
                        
                        clean_page = _normalize(content)
                        clean_target = _normalize(assert_text)
                        
                        if clean_target in clean_page:
                            logger.info("WebStepRunner: Fuzzy Assertion Passed.")
                        else:
                            # Final fallback: check raw content too in case of hidden attributes
                            raw_content = await self.page.content()
                            if _normalize(assert_text) in _normalize(raw_content):
                                logger.info("WebStepRunner: Raw content match Passed.")
                            else:
                                return {"success": False, "error": f"Assertion Failed: Expected text '{assert_text}' not found on screen."}
                except Exception as e:
                    return {"success": False, "error": f"Assertion execution failed: {e}"}

            return {"success": True}
        except Exception as e:
            logger.error(f"WebStepRunner: Action failed: {e}")
            return {"success": False, "error": str(e)}

web_step_runner = WebStepRunner()
