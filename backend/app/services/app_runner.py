import os
import time
import uuid
import logging
from typing import List, Dict, Any, Optional
from app.models.test import TestStep
from appium import webdriver
from appium.options.common import AppiumOptions
from appium.webdriver.common.appiumby import AppiumBy
from selenium.common.exceptions import WebDriverException

logger = logging.getLogger(__name__)

class AppStepRunner:
    def __init__(self, command_executor: str = "http://127.0.0.1:4723/wd/hub"):
        self.command_executor = command_executor
        self.driver = None
        self.window_size = {"width": 1080, "height": 1920} # Default fallback

    def start_session(self, capabilities: Dict[str, Any]):
        """
        Starts an Appium session with the given capabilities.
        Returns a tuple (success, error_message).
        """
        if self.driver:
            try:
                self.driver.quit()
            except:
                pass
            self.driver = None

        try:
            # For Appium 2.0+, many capabilities need the 'appium:' prefix
            # AppiumOptions.load_capabilities should handle most, but let's ensure core ones
            processed_caps = {}
            for k, v in capabilities.items():
                if k in ["platformName", "automationName", "deviceName", "udid", "newCommandTimeout"]:
                    processed_caps[k] = v
                else:
                    if not k.startswith("appium:"):
                        processed_caps[f"appium:{k}"] = v
                    else:
                        processed_caps[k] = v

            # Ensure Chromedriver autodownload is enabled for WebViews
            processed_caps["appium:chromedriver_autodownload"] = True
            
            # WebLayer / WebView socket matching improvements
            processed_caps["appium:androidWebviewNext"] = True
            processed_caps["appium:fullContextList"] = True
            processed_caps["appium:enableMultiWindows"] = True
            processed_caps["appium:allowInvisibleElements"] = True

            logger.info(f"Starting Appium session with capabilities: {processed_caps}")
            options = AppiumOptions()
            options.load_capabilities(processed_caps)
            self.driver = webdriver.Remote(self.command_executor, options=options)
            logger.info("Appium session started successfully.")
            
            # Fetch and store window size
            try:
                size = self.driver.get_window_size()
                self.window_size = size
                logger.info(f"Device window size: {size}")
            except Exception as e:
                logger.warning(f"Failed to fetch window size: {e}")
                
            return True, None
        except Exception as e:
            err_msg = str(e)
            logger.error(f"Failed to start Appium session: {err_msg}")
            return False, err_msg

    def stop_session(self):
        if self.driver:
            self.driver.quit()
            self.driver = None
            logger.info("Appium session stopped.")

    def get_screenshot(self) -> Optional[str]:
        """Returns base64 encoded screenshot."""
        if not self.driver:
            return None
        try:
            return self.driver.get_screenshot_as_base64()
        except:
            return None

    def get_page_source(self) -> Optional[str]:
        if not self.driver:
            return None
        
        # Retry up to 3 times if we get a '<loading />' stub
        for i in range(3):
            try:
                source = self.driver.page_source
                if source and "<loading />" not in source:
                    return source
                
                logger.warning(f"Appium returned loading stub, retrying {i+1}/3...")
                time.sleep(1) # Wait a bit for the UI to stabilize
            except Exception as e:
                logger.error(f"Failed to capture page source: {e}")
                return None
        
        return source # Return whatever we have at the end

    def find_element(self, selector_type: str, selector_value: str):
        if not self.driver:
            return None
        
        by_map = {
            "XPATH": AppiumBy.XPATH,
            "ACCESSIBILITY_ID": AppiumBy.ACCESSIBILITY_ID,
            "ID": AppiumBy.ID,
            "ANDROID_UIAUTOMATOR": AppiumBy.ANDROID_UIAUTOMATOR,
            "IOS_PREDICATE": AppiumBy.IOS_PREDICATE,
            "CLASS_NAME": AppiumBy.CLASS_NAME,
            "NAME": AppiumBy.NAME
        }
        
        by = by_map.get(selector_type.upper(), AppiumBy.XPATH)
        return self.driver.find_element(by=by, value=selector_value)

    def execute_step(self, step: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes a single step.
        Step format: {
            "action": "click",
            "selector_type": "XPATH",
            "selector_value": "//...",
            "option": "text to send",
            "sleep": 0
        }
        """
        if not self.driver:
            return {"success": False, "error": "No active session"}

        action = step.get("action", "").lower()
        
        # Support both snake_case (DB/Backend) and camelCase (Frontend recording)
        selector_type = step.get("selector_type") or step.get("selectorType", "")
        selector_value = step.get("selector_value") or step.get("selectorValue", "")
        option = step.get("option", "")
        sleep_time = step.get("sleep", 0)

        try:
            logger.info(f"Executing step: {action} with {selector_type}={selector_value}, option={option}")
            if sleep_time > 0:
                time.sleep(sleep_time)

            if action == "click":
                try:
                    element = self.find_element(selector_type, selector_value)
                    # Try standard click first
                    element.click()
                except WebDriverException as e:
                    logger.warning(f"Standard click failed, attempting coordinate tap fallback: {e}")
                    try:
                        # Fallback: Get element center and tap
                        location = element.location
                        size = element.size
                        center_x = location['x'] + (size['width'] / 2)
                        center_y = location['y'] + (size['height'] / 2)
                        self.driver.tap([(center_x, center_y)])
                        logger.info(f"Fallback tap at ({center_x}, {center_y}) succeeded.")
                    except Exception as e2:
                        logger.error(f"Fallback tap also failed: {e2}")
                        return {"success": False, "error": f"Element not found or not clickable: {selector_value}"}
            elif action == "tap":
                # Expecting option as "x,y"
                coords = [int(val) for val in option.split(",")]
                self.driver.tap([(coords[0], coords[1])])
            elif action == "send_keys" or action == "type":
                element = self.find_element(selector_type, selector_value)
                element.send_keys(option)
            elif action == "swipe":
                # Expecting option as "start_x,start_y,end_x,end_y,duration"
                coords = [int(x) for x in option.split(",")]
                self.driver.swipe(*coords)
            elif action == "app_start":
                # Option could be the app package or bundle ID if not already started
                pass # Already handled by session start usually
            elif action == "app_close":
                self.driver.terminate_app(option)
            elif action == "wait":
                time.sleep(float(option) if option else 1.0)
            else:
                return {"success": False, "error": f"Unsupported action: {action}"}

            logger.info(f"Step {action} executed successfully.")
            return {"success": True, "error": None}
        except Exception as e:
            err_msg = str(e)
            logger.error(f"Step execution failed: {err_msg}")
            return {"success": False, "error": err_msg}

    def get_contexts(self) -> List[str]:
        if not self.driver:
            return []
        try:
            return self.driver.contexts
        except:
            return []

    def switch_context(self, context_name: str) -> bool:
        if not self.driver:
            return False
        try:
            self.driver.switch_to.context(context_name)
            logger.info(f"Switched to context: {context_name}")
            return True
        except Exception as e:
            logger.error(f"Failed to switch context: {e}")
            return False

    def run_steps(self, steps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        results = []
        for step in steps:
            result = self.execute_step(step)
            results.append(result)
            if not result["success"] and not step.get("skip_on_error", False):
                break
        return results

app_step_runner = AppStepRunner()
