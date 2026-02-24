import os
import time
import uuid
import logging
from typing import List, Dict, Any, Optional

from appium import webdriver
from appium.options.common import AppiumOptions
from appium.webdriver.common.appiumby import AppiumBy
from selenium.common.exceptions import WebDriverException, NoSuchElementException

logger = logging.getLogger(__name__)

class AppStepRunner:
    def __init__(self, command_executor: str = "http://127.0.0.1:4723/wd/hub"):
        self.command_executor = command_executor
        self.driver = None
        self.current_device_id = None
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
            self.current_device_id = None

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
            self.current_device_id = capabilities.get("udid") or capabilities.get("deviceName")
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
            self.current_device_id = None
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
        try:
            return self.driver.find_element(by=by, value=selector_value)
        except NoSuchElementException:
            # Robust fallback for ID on Android: try partial match via XPath if it's a simple name
            if selector_type.upper() == "ID" and ":" not in selector_value:
                xpath_fallback = f"//*[contains(@resource-id, 'id/{selector_value}') or @resource-id='{selector_value}']"
                logger.info(f"ID lookup failed, trying XPath fallback: {xpath_fallback}")
                try:
                    return self.driver.find_element(by=AppiumBy.XPATH, value=xpath_fallback)
                except:
                    pass
            raise

    def execute_step(self, step: Dict[str, Any], db: Optional[Any] = None) -> Dict[str, Any]:
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

        action_name = step.get("action", "").lower()
        
        # 1. Check for Custom Action in DB
        if db and action_name not in ["click", "tap", "send_keys", "type", "swipe", "app_start", "app_close", "wait"]:
            from app.models.test import TestAction
            custom_action = db.query(TestAction).filter(TestAction.name == action_name, TestAction.platform == "APP").first()
            if custom_action:
                return self.execute_custom_action(custom_action, step)

        action = action_name
        
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
                element = None
                try:
                    element = self.find_element(selector_type, selector_value)
                    # Try standard click first
                    element.click()
                except Exception as e:
                    logger.warning(f"Standard click failed: {e}")
                    if element:
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
                            return {"success": False, "error": f"Element found but not clickable: {selector_value}"}
                    else:
                        return {"success": False, "error": f"Element not found: {selector_value} ({selector_type})"}
            elif action == "tap":
                # Expecting option as "x,y"
                coords = [int(val) for val in option.split(",")]
                self.driver.tap([(coords[0], coords[1])])
            elif action == "send_keys" or action == "type":
                element = self.find_element(selector_type, selector_value)
                try:
                    # Often necessary to click before typing to gain focus
                    element.click()
                    time.sleep(0.5)
                    element.clear()
                    element.send_keys(option)
                except Exception as e:
                    logger.warning(f"Standard send_keys failed ({e}), trying set_text...")
                    try:
                        # Fallback for some Appium drivers / element states
                        self.driver.execute_script('mobile: type', {'text': option, 'elementId': element.id})
                    except Exception as e2:
                        logger.error(f"Text input failed: {e2}")
                        return {"success": False, "error": f"Failed to input text: {str(e2)}"}
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

    def execute_custom_action(self, custom_action: Any, step: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes a custom action script from the DB.
        """
        logger.info(f"Executing custom action: {custom_action.name}")
        
        # Prepare execution context
        # The user's example: def action(find_element, by, value): ...
        # We'll support both direct code and functions if possible, 
        # but usually it's a function definition that needs to be called.
        
        ctx = {
            "driver": self.driver,
            "find_element": self.find_element,
            "By": AppiumBy, # Standard for Appium
            "AppiumBy": AppiumBy,
            "logger": logger,
            "time": time,
            "selector_type": step.get("selector_type") or step.get("selectorType"),
            "selector_value": step.get("selector_value") or step.get("selectorValue"),
            "option": step.get("option", ""),
            "success": True,
            "message": ""
        }
        
        try:
            # We assume the code_content defines a function with the same name as the action
            # and we call it, or it's just a script where we provide vars.
            # Let's support the user's snippet style: definition + calling it.
            
            # If the code defines the function, we need to call it.
            # Example: "def my_click(find_element, by, val): ..."
            
            # To be flexible, let's just exec the code and then if a function exists, call it.
            # Or better: Provide the vars and let the code use them.
            
            # User example: 
            # def click_action(find_element, by, value): ...
            
            # Let's wrap it? 
            full_code = custom_action.code_content
            
            # If it's a function definition, we need a call line
            if f"def {custom_action.name}" in full_code:
                # Append call
                # We need to map selector_type to AppiumBy enum if it's a string
                by_map = {
                    "XPATH": AppiumBy.XPATH,
                    "ACCESSIBILITY_ID": AppiumBy.ACCESSIBILITY_ID,
                    "ID": AppiumBy.ID,
                    "ANDROID_UIAUTOMATOR": AppiumBy.ANDROID_UIAUTOMATOR,
                    "IOS_PREDICATE": AppiumBy.IOS_PREDICATE,
                    "CLASS_NAME": AppiumBy.CLASS_NAME,
                    "NAME": AppiumBy.NAME
                }
                s_type = (step.get("selector_type") or step.get("selectorType") or "XPATH").upper()
                by_val = by_map.get(s_type, AppiumBy.XPATH)
                s_value = step.get("selector_value") or step.get("selectorValue")
                
                # Add call line
                # Note: The user's example names parameters as (find_element, by, value)
                call_line = f"\nret_val = {custom_action.name}(find_element, '{by_val}', '{s_value}')"
                # Wait, if we pass AppiumBy enum, we shouldn't quote it in the call if we want to pass the object.
                # But the user's snippet might expect strings or the object.
                # Let's pass the object.
                ctx["by_obj"] = by_val
                call_line = f"\nret_val = {custom_action.name}(find_element, by_obj, '{s_value}')"
                
                exec(full_code + call_line, ctx)
                
                ret_val = ctx.get("ret_val")
                if isinstance(ret_val, tuple):
                    res_success, res_msg = ret_val
                    return {"success": res_success, "error": None if res_success else res_msg}
                return {"success": True}
            else:
                # Just execute as a script
                exec(full_code, ctx)
                return {"success": ctx.get("success", True), "error": ctx.get("error") if not ctx.get("success") else None}

        except Exception as e:
            logger.error(f"Custom action {custom_action.name} failed: {e}")
            return {"success": False, "error": str(e)}

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

    def get_screenshot(self) -> Optional[str]:
        if not self.driver:
            return None
        try:
            return self.driver.get_screenshot_as_base64()
        except Exception as e:
            logger.error(f"Failed to capture screenshot: {e}")
            return None

app_step_runner = AppStepRunner()
