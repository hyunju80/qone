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
            processed_caps["appium:disableWindowAnimation"] = True
            processed_caps["appium:ignoreUnimportantViews"] = False
            
            # Prevent app data from being cleared and prevent force-stopping the app
            if "appium:noReset" not in processed_caps:
                processed_caps["appium:noReset"] = True
            if "appium:dontStopAppOnReset" not in processed_caps:
                processed_caps["appium:dontStopAppOnReset"] = True

            logger.info(f"Starting Appium session with capabilities: {processed_caps}")
            options = AppiumOptions()
            options.load_capabilities(processed_caps)
            self.driver = webdriver.Remote(self.command_executor, options=options)
            self.driver.implicitly_wait(0) # Disable implicit wait to use rapid explicit polling
            self.current_device_id = capabilities.get("udid") or capabilities.get("deviceName")
            logger.info("Appium session started successfully with 0s implicit wait.")
            
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
                
        return source # Return whatever we have at the end

    def get_clean_source(self) -> str:
        """Returns a simplified XML source for LLM consumption."""
        source = self.get_page_source()
        if not source:
            return ""
        
        try:
            from bs4 import BeautifulSoup
            import re
            
            # Use xml parser for Android UI Automator dump
            soup = BeautifulSoup(source, 'xml')
            
            allowed_attrs = ['resource-id', 'text', 'content-desc', 'class', 'clickable', 'scrollable', 'focused', 'checked', 'selected', 'bounds']
            
            for tag in soup.find_all(True):
                # Remove generic layout wrappers that have no identity and aren't interactive
                if tag.name.endswith('Layout') or tag.name.endswith('View'):
                    has_identity = tag.get('resource-id') or (tag.get('text') and tag.get('text').strip()) or tag.get('content-desc')
                    is_interactive = tag.get('clickable') == 'true' or tag.get('scrollable') == 'true' or tag.get('checkable') == 'true'
                    if not has_identity and not is_interactive and not tag.find_all(True, recursive=False):
                        # Empty generic view with no properties -> decompose
                        tag.decompose()
                        continue
                        
                attrs = list(tag.attrs.keys())
                for attr in attrs:
                    if attr not in allowed_attrs:
                        del tag.attrs[attr]
                        
            clean_xml = soup.prettify()
            clean_xml = re.sub(r'\n\s*\n', '\n', clean_xml)
            
            if len(clean_xml) > 100000:
                clean_xml = clean_xml[:100000] + "...(truncated)"
                
            return clean_xml
            
        except Exception as e:
            logger.error(f"Error cleaning XML source: {e}")
            return source

    def find_element(self, selector_type: str, selector_value: str, timeout: int = 20):
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
        actual_value = selector_value
        if selector_type.upper() == "TEXT":
            by = AppiumBy.XPATH
            actual_value = f"//*[@text='{selector_value}' or @content-desc='{selector_value}']"
            
        start_time = time.time()
        logged_3s = False
        logged_6s = False
        scrolled_once = False
        
        # [WEBVIEW ACCESSIBILITY BRIDGE DEFIBRILLATOR]
        # Android's Native UIAutomator often drops WebView nodes after navigation.
        # By briefly attaching ChromeDriver (switching context) and switching back, 
        # we force the OS to rebuild the accessibility tree including the HTML DOM.
        try:
            contexts = self.driver.contexts
            webview = next((c for c in contexts if "WEBVIEW" in c), None)
            if webview:
                self.driver.switch_to.context(webview)
                # Forcing a read of the page source here acts as a defibrillator, 
                # making Chrome actually evaluate the DOM and pass it to Android Accessibility.
                _ = self.driver.page_source 
                self.driver.switch_to.context("NATIVE_APP")
                logger.info("Woke up Chromium Accessibility Bridge via context evaluate.")
        except Exception as e:
            logger.debug(f"Failed to pulse WebView bridge: {e}")
            # Ensure we are back in NATIVE
            try:
                self.driver.switch_to.context("NATIVE_APP")
            except:
                pass
        
        while time.time() - start_time < timeout:
            try:
                return self.driver.find_element(by=by, value=actual_value)
            except Exception:
                pass
                
            # 1. If it was ID, try XPath partial match
            if selector_type.upper() == "ID" and ":" not in selector_value:
                xpath_fallback = f"//*[contains(@resource-id, 'id/{selector_value}') or @resource-id='{selector_value}']"
                try:
                    return self.driver.find_element(by=AppiumBy.XPATH, value=xpath_fallback)
                except Exception:
                    pass
                    
            # 2. Try as pure text match
            if selector_type.upper() in ["ACCESSIBILITY_ID", "ID", "XPATH", "TEXT"] and not selector_value.startswith("//"):
                text_xpath = f"//*[@text='{selector_value}' or @content-desc='{selector_value}']"
                try:
                    return self.driver.find_element(by=AppiumBy.XPATH, value=text_xpath)
                except Exception:
                    pass
                    
            # 3. Try partial text match
            if selector_type.upper() in ["ACCESSIBILITY_ID", "ID", "XPATH", "TEXT"] and not selector_value.startswith("//"):
                partial_xpath = f"//*[contains(@text, '{selector_value}') or contains(@content-desc, '{selector_value}')]"
                try:
                    return self.driver.find_element(by=AppiumBy.XPATH, value=partial_xpath)
                except Exception:
                    pass
                    
            # 4. Try fuzzy word match (tolerate space/newline differences)
            if selector_type.upper() in ["ACCESSIBILITY_ID", "ID", "XPATH", "TEXT"] and not selector_value.startswith("//"):
                words = selector_value.split()
                if len(words) > 1:
                    longest_word = sorted(words, key=len, reverse=True)[0]
                    if len(longest_word) >= 2:
                        fuzzy_xpath = f"//*[contains(@text, '{longest_word}') or contains(@content-desc, '{longest_word}')]"
                        try:
                            return self.driver.find_element(by=AppiumBy.XPATH, value=fuzzy_xpath)
                        except Exception:
                            pass
                            
            # 5. Try precise UI Automator match
            if selector_type.upper() in ["ACCESSIBILITY_ID", "ID", "XPATH", "TEXT"] and not selector_value.startswith("//"):
                uiauto_exact_text = f'new UiSelector().text("{selector_value}")'
                uiauto_exact_desc = f'new UiSelector().description("{selector_value}")'
                try:
                    return self.driver.find_element(by=AppiumBy.ANDROID_UIAUTOMATOR, value=uiauto_exact_text)
                except Exception:
                    try:
                        return self.driver.find_element(by=AppiumBy.ANDROID_UIAUTOMATOR, value=uiauto_exact_desc)
                    except Exception:
                        pass
                        
            # 6. Try fuzzy UI Automator match
            if selector_type.upper() in ["ACCESSIBILITY_ID", "ID", "XPATH", "TEXT"] and not selector_value.startswith("//"):
                words = selector_value.split()
                if len(words) > 1:
                    longest_word = sorted(words, key=len, reverse=True)[0]
                    if len(longest_word) >= 2:
                        uiauto_fuzzy_text = f'new UiSelector().textContains("{longest_word}")'
                        uiauto_fuzzy_desc = f'new UiSelector().descriptionContains("{longest_word}")'
                        try:
                            return self.driver.find_element(by=AppiumBy.ANDROID_UIAUTOMATOR, value=uiauto_fuzzy_text)
                        except Exception:
                            try:
                                return self.driver.find_element(by=AppiumBy.ANDROID_UIAUTOMATOR, value=uiauto_fuzzy_desc)
                            except Exception:
                                pass
            
            time.sleep(0.5)
            elapsed = time.time() - start_time
            
            # Auto-scroll fallback if halfway through timeout and not found
            if elapsed > timeout / 2 and not scrolled_once:
                logger.info(f"Element {selector_value} not found after {timeout/2}s. Attempting auto-scroll to trigger lazy loading...")
                try:
                    # Switch to native to perform swipe reliably
                    contexts = self.driver.contexts
                    if any("WEBVIEW" in c for c in contexts):
                        self.driver.switch_to.context('NATIVE_APP')
                    size = self.driver.get_window_size()
                    start_x = size['width'] // 2
                    start_y = int(size['height'] * 0.2)
                    end_y = int(size['height'] * 0.8)
                    
                    try:
                        from selenium.webdriver.common.actions.action_builder import ActionBuilder
                        from selenium.webdriver.common.actions.pointer_input import PointerInput
                        from selenium.webdriver.common.actions import interaction
                        
                        pointer = PointerInput(interaction.POINTER_TOUCH, "touch")
                        actions = ActionBuilder(self.driver, mouse=pointer)
                        actions.pointer_action.move_to_location(start_x, start_y)
                        actions.pointer_action.pointer_down()
                        actions.pointer_action.pause(0.2)
                        # Drag down to scroll page UP
                        actions.pointer_action.move_to_location(start_x, end_y)
                        actions.pointer_action.release()
                        actions.perform()
                    except Exception as inner_e:
                        logger.warning(f"W3C SwipeDown failed: {inner_e}")
                        
                    time.sleep(1.5) # Wait for WebView to render new items
                except Exception as e:
                    logger.warning(f"Auto-scroll fallback failed completely: {e}")
                scrolled_once = True
                
            # Diagnostic periodic logging
            if elapsed > 3.0 and not logged_3s:
                try:
                    import re
                    src = self.driver.page_source
                    txts = re.findall(r'text="([^"]+)"', src)
                    dscs = re.findall(r'content-desc="([^"]+)"', src)
                    vis = list(set([t for t in (txts + dscs) if t.strip()]))
                    if vis:
                        msg = f"[DEBUG 3s] UI text available: {', '.join(vis[:15])} ..."
                        print(msg, flush=True)
                        logger.info(msg)
                except:
                    pass
                logged_3s = True
                
            if elapsed > 6.0 and not logged_6s:
                try:
                    import re
                    src = self.driver.page_source
                    txts = re.findall(r'text="([^"]+)"', src)
                    dscs = re.findall(r'content-desc="([^"]+)"', src)
                    vis = list(set([t for t in (txts + dscs) if t.strip()]))
                    if vis:
                        msg = f"[DEBUG 6s] UI text available: {', '.join(vis[:15])} ..."
                        print(msg, flush=True)
                        logger.info(msg)
                except:
                    pass
                logged_6s = True
            
        err_msg = f"Could not find element using {selector_type}={selector_value} or any fallbacks."
        
        # Collect available text on screen for debugging
        try:
            import re
            
            src = self.driver.page_source
            txts = re.findall(r'text="([^"]+)"', src)
            dscs = re.findall(r'content-desc="([^"]+)"', src)
            vis = list(set([t for t in (txts + dscs) if t.strip()]))
            if vis:
                sample = ", ".join(vis[:15])
                err_msg += f"\n[DEBUG] Available text on screen: {sample} ..."
        except Exception:
            pass
            
        logger.error(f"Failed to find element after {timeout}s: {selector_type}={selector_value}")
        raise NoSuchElementException(err_msg)

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
        if db and action_name not in ["click", "tap", "send_keys", "type", "swipe", "scroll", "app_start", "activateapp", "app_close", "close_app", "wait"]:
            from app.models.test import TestAction
            custom_action = db.query(TestAction).filter(TestAction.name == action_name, TestAction.platform == "APP").first()
            if custom_action:
                return self.execute_custom_action(custom_action, step)

        action = action_name
        
        # Support both snake_case (DB/Backend) and camelCase (Frontend recording)
        selector_type = step.get("selector_type") or step.get("selectorType", "")
        selector_value = step.get("selector_value") or step.get("selectorValue", "")
        
        # Failsafe for legacy assets that erroneously saved mobile selectors as CSS
        if selector_type.upper() == "CSS":
            if ":id/" in selector_value or selector_value.startswith("id/"):
                selector_type = "ID"
            else:
                selector_type = "XPATH"
        
        option = step.get("option") or step.get("inputValue") or step.get("value", "")
        sleep_time = step.get("sleep", 0)

        try:
            logger.info(f"Executing step: {action} with {selector_type}={selector_value}, option={option}")
            if sleep_time > 0:
                time.sleep(sleep_time)

            if action == "click":
                element = None
                try:
                    element = self.find_element(selector_type, selector_value)
                    
                    # Pre-fetch coordinates in case fallback is needed, avoiding stale reference errors later
                    try:
                        location = element.location
                        size = element.size
                        center_x = location['x'] + (size['width'] / 2)
                        center_y = location['y'] + (size['height'] / 2)
                    except Exception:
                        center_x, center_y = None, None
                        
                    # Try standard click first
                    element.click()
                except Exception as e:
                    err_str = str(e).lower()
                    logger.warning(f"Standard click failed: {err_str}")
                    
                    # If element is stale or detached, the click likely succeeded & caused instant navigation
                    if "stale" in err_str or "detached" in err_str or "not attached" in err_str:
                        logger.info("Element became stale during click. Assuming click succeeded and page transitioned.")
                    elif element and center_x is not None:
                        try:
                            # Fallback: Get element center and tap
                            self.driver.tap([(center_x, center_y)])
                            logger.info(f"Fallback tap at ({center_x}, {center_y}) succeeded.")
                        except Exception as e2:
                            err2_str = str(e2).lower()
                            if "stale" in err2_str or "detached" in err2_str or "not attached" in err2_str:
                                logger.info("Element became stale during fallback tap. Assuming tap succeeded.")
                            else:
                                logger.error(f"Fallback tap also failed: {e2}")
                                return {"success": False, "error": f"Element found but not clickable: {selector_value}"}
                    else:
                        # FALLBACK: Execute click directly in WEBVIEW Javascript
                        try:
                            contexts = self.driver.contexts
                            webview = next((c for c in contexts if "WEBVIEW" in c), None)
                            if webview and selector_type.upper() in ["TEXT", "XPATH", "CSS", "ID"]:
                                logger.info(f"NATIVE search failed for {selector_value}. Falling back to WEBVIEW JS execution.")
                                self.driver.switch_to.context(webview)
                                
                                success = False
                                if selector_type.upper() == "TEXT":
                                    js_script = """
                                    var target = arguments[0];
                                    var els = document.querySelectorAll('*');
                                    for (var i=0; i<els.length; i++) {
                                        if (els[i].innerText && (els[i].innerText.trim() === target || els[i].textContent.trim() === target)) {
                                            els[i].scrollIntoView({block: 'center'});
                                            els[i].click(); return true;
                                        }
                                    }
                                    for (var i=0; i<els.length; i++) {
                                        if (els[i].innerText && els[i].innerText.includes(target)) {
                                            els[i].scrollIntoView({block: 'center'});
                                            els[i].click(); return true;
                                        }
                                    }
                                    var words = target.split(' ').filter(w => w.length >= 2).sort((a,b) => b.length - a.length);
                                    if (words.length > 0) {
                                        for (var i=0; i<els.length; i++) {
                                            if (els[i].innerText && els[i].innerText.includes(words[0])) {
                                                els[i].scrollIntoView({block: 'center'});
                                                els[i].click(); return true;
                                            }
                                        }
                                    }
                                    return false;
                                    """
                                    success = self.driver.execute_script(js_script, selector_value)
                                elif selector_type.upper() == "XPATH":
                                    js_script = """
                                    try {
                                        var el = document.evaluate(arguments[0], document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                                        if (el) { el.scrollIntoView({block: 'center'}); el.click(); return true; }
                                    } catch(e) {}
                                    return false;
                                    """
                                    success = self.driver.execute_script(js_script, selector_value)
                                elif selector_type.upper() == "CSS" or selector_type.upper() == "ID":
                                    js_script = """
                                    try {
                                        var sel = arguments[1] === 'ID' ? '#' + arguments[0] : arguments[0];
                                        var el = document.querySelector(sel);
                                        if (el) { el.scrollIntoView({block: 'center'}); el.click(); return true; }
                                    } catch(e) {}
                                    return false;
                                    """
                                    success = self.driver.execute_script(js_script, selector_value, selector_type.upper())
                                
                                self.driver.switch_to.context("NATIVE_APP")
                                if success:
                                    logger.info(f"Successfully performed WEBVIEW JS click on '{selector_value}'")
                                    return {"success": True}
                                    
                        except Exception as web_e:
                            logger.warning(f"WEBVIEW JS fallback failed: {web_e}")
                            try:
                                self.driver.switch_to.context("NATIVE_APP")
                            except:
                                pass
                                
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
                
                # Attempt to hide the keyboard after typing to ensure the screen isn't blocked for the next action
                try:
                    self.driver.hide_keyboard()
                except Exception:
                    pass
                    
            elif action == "scroll":
                size = self.driver.get_window_size()
                start_x = size['width'] // 2
                start_y = int(size['height'] * 0.8)
                end_x = start_x
                end_y = int(size['height'] * 0.2)
                
                # Default is down (sliding finger up). Adjust if option specifies direction.
                if option and isinstance(option, str):
                    if option.lower() == "up":
                        start_y, end_y = end_y, start_y
                    elif option.lower() == "left":
                        start_x = int(size['width'] * 0.8)
                        end_x = int(size['width'] * 0.2)
                        start_y = end_y = size['height'] // 2
                    elif option.lower() == "right":
                        start_x = int(size['width'] * 0.2)
                        end_x = int(size['width'] * 0.8)
                        start_y = end_y = size['height'] // 2
                        
                self.driver.swipe(start_x, start_y, end_x, end_y, 500)
                time.sleep(1) # wait for settling
            elif action == "swipe":
                # Expecting option as "start_x,start_y,end_x,end_y,duration"
                coords = [int(x) for x in option.split(",")]
                self.driver.swipe(*coords)
            elif action == "app_start" or action == "activateapp":
                app_id = option or selector_value
                if app_id:
                    try:
                        self.driver.activate_app(app_id)
                        logger.info(f"Activated app via core method: {app_id}")
                    except Exception as e:
                        logger.warning(f"Core activate_app failed for {app_id}: {e}")
                        
                    time.sleep(4) # Implicit wait for app to load its main UI
                else:
                    pass # Already handled by session start usually if no specific ID given
            elif action == "app_close" or action == "close_app":
                app_id = option
                if not app_id:
                    caps = self.driver.capabilities
                    app_id = caps.get("appPackage") or caps.get("appium:appPackage") or caps.get("bundleId") or caps.get("appium:bundleId")
                    
                    # If still not found (e.g., app launched via click instead of session caps)
                    if not app_id:
                        try:
                            # Try to get the currently running package directly from the device (Android specific)
                            app_id = self.driver.current_package
                            logger.info(f"Retrieved current package from device: {app_id}")
                        except Exception as e:
                            logger.warning(f"Could not retrieve current package from device: {e}")

                if app_id:
                    try:
                        self.driver.terminate_app(app_id)
                        logger.info(f"Terminated app via core method: {app_id}")
                    except Exception as e:
                        logger.warning(f"Standard terminate_app failed for {app_id}: {e}")
                else:
                    return {"success": False, "error": "No appPackage/bundleId provided or found in caps definition to close"}
            elif action == "wait":
                time.sleep(float(option) if option else 1.0)
            else:
                return {"success": False, "error": f"Unsupported action: {action}"}

            # Apply post-action Step Assertion if configured
            assert_text = step.get("assertText")
            if assert_text and str(assert_text).strip() != "":
                logger.info(f"Verifying step assertion: '{assert_text}'")
                time.sleep(2) # Wait for page transition / UI to settle
                try:
                    page_text = self.get_clean_source()
                    if assert_text not in page_text:
                        return {"success": False, "error": f"Assertion Failed: Expected text '{assert_text}' not found on screen."}
                    logger.info("Assertion Passed.")
                except Exception as e:
                    return {"success": False, "error": f"Assertion execution failed: {e}"}

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
