import os
import time
import re
import uuid
import logging
from typing import List, Dict, Any, Optional

from appium import webdriver
from appium.options.common import AppiumOptions
from appium.webdriver.common.appiumby import AppiumBy
from selenium.common.exceptions import WebDriverException, NoSuchElementException, InvalidSessionIdException

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
        except InvalidSessionIdException:
            logger.error("Appium session lost during screenshot capture.")
            self.driver = None
            return None
        except:
            return None

    def get_page_source(self) -> Optional[str]:
        if not self.driver:
            return None
        
        source = None
        
        # Retry up to 3 times if we get a '<loading />' stub
        for i in range(3):
            try:
                source = self.driver.page_source
                if source and "<loading />" not in source:
                    return source
                
                logger.warning(f"Appium returned loading stub, retrying {i+1}/3...")
                time.sleep(1) # Wait a bit for the UI to stabilize
            except Exception as e:
                if isinstance(e, InvalidSessionIdException):
                    logger.error("Appium session lost during page source capture.")
                    self.driver = None
                    return None
                logger.error(f"Failed to capture page source: {e}")
                
        return source # Return whatever we have at the end

    def get_clean_source(self) -> str:
        """Returns a simplified XML source for LLM consumption."""
        source = self.get_page_source()
        if not source:
            return ""
        
        try:
            from bs4 import BeautifulSoup
            
            # Use xml parser for Android UI Automator dump
            soup = BeautifulSoup(source, 'xml')
            
            allowed_attrs = ['resource-id', 'text', 'content-desc', 'hint', 'class', 'clickable', 'scrollable', 'focused', 'checked', 'selected', 'bounds']
            
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
            if isinstance(e, InvalidSessionIdException):
                raise e
            logger.error(f"Error cleaning XML source: {e}")
            return source

    def _normalize_text(self, text: str) -> str:
        """Removes all whitespace and converts to lowercase for fuzzy comparison."""
        if not text: return ""
        return "".join(text.split()).lower()

    def _log_ui_state(self, stage_name: str):
        """Helper to log visible text and content-desc for debugging."""
        if not self.driver: return
        try:
            src = self.driver.page_source
            if not src: return
            txts = re.findall(r'text="([^"]+)"', src)
            dscs = re.findall(r'content-desc="([^"]+)"', src)
            vis = list(set([t.strip() for t in (txts + dscs) if t.strip()]))
            log_msg = f"[DEBUG] {stage_name} UI 텍스트: " + (", ".join(vis[:30]) if vis else "(없음)")
            logger.info(log_msg)         
            
        except Exception as e:
            # Change to info/warning so user can see failures in UI state logging
            logger.warning(f"UI state logging failed ({stage_name}): {e}")

    def find_element(self, selector_type: str, selector_value: str, timeout: int = 8):
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
        scrolled_once = False  
        last_defib_time = 0
        last_hard_defib_time = 0
        webview_stabilized = False
        target_norm = self._normalize_text(selector_value)
        cache_reset_done = False

        #self._log_ui_state("탐색 시작 시점")
        
        while time.time() - start_time < timeout:
            target_el = None
            elapsed = time.time() - start_time
            
            try:
                target_el = self.driver.find_element(by=by, value=actual_value)
            except Exception:
                pass
                
            # 1. If it was ID, try XPath partial match
            if not target_el and selector_type.upper() == "ID" and ":" not in selector_value:
                xpath_fallback = f"//*[contains(@resource-id, 'id/{selector_value}') or @resource-id='{selector_value}']"
                try:
                    target_el = self.driver.find_element(by=AppiumBy.XPATH, value=xpath_fallback)
                except Exception: pass

            # 1.5. If it was ANDROID_UIAUTOMATOR with resourceId, try wildcard match
            if not target_el and selector_type.upper() == "ANDROID_UIAUTOMATOR" and "resourceId" in selector_value and "resourceIdMatches" not in selector_value:
                res_match = re.search(r'resourceId\("([^"]+)"\)', selector_value)
                if res_match:
                    res_id = res_match.group(1)
                    if ":" not in res_id:
                        fallback_uiauto = selector_value.replace(f'resourceId("{res_id}")', f'resourceIdMatches(".*:id/{res_id}")')
                        try:
                            target_el = self.driver.find_element(by=AppiumBy.ANDROID_UIAUTOMATOR, value=fallback_uiauto)
                        except Exception: pass
                        if not target_el:
                            xpath_fallback = f"//*[contains(@resource-id, 'id/{res_id}') or @resource-id='{res_id}']"
                            try:
                                target_el = self.driver.find_element(by=AppiumBy.XPATH, value=xpath_fallback)
                            except Exception: pass
                            
            # 1.6. If it was ANDROID_UIAUTOMATOR with text, try wildcard match
            if not target_el and selector_type.upper() == "ANDROID_UIAUTOMATOR" and ".text(" in selector_value and ".textContains(" not in selector_value:
                txt_match = re.search(r'\.text\("([^"]+)"\)', selector_value)
                if txt_match:
                    txt_val = txt_match.group(1)
                    fallback_uiauto_txt = selector_value.replace(f'.text("{txt_val}")', f'.textContains("{txt_val}")')
                    try:
                        target_el = self.driver.find_element(by=AppiumBy.ANDROID_UIAUTOMATOR, value=fallback_uiauto_txt)
                    except Exception: pass
                    if not target_el:
                        xpath_fallback = f"//*[contains(@text, '{txt_val}') or contains(@content-desc, '{txt_val}')]"
                        try:
                            target_el = self.driver.find_element(by=AppiumBy.XPATH, value=xpath_fallback)
                        except Exception: pass
                    
            # 2-4. Pure/Partial/Fuzzy text match
            if not target_el and selector_type.upper() in ["ACCESSIBILITY_ID", "ID", "XPATH", "TEXT"] and not selector_value.startswith("//"):
                text_xpath = f"//*[@text='{selector_value}' or @content-desc='{selector_value}']"
                try: target_el = self.driver.find_element(by=AppiumBy.XPATH, value=text_xpath)
                except Exception: pass
                
                if not target_el:
                    partial_xpath = f"//*[contains(@text, '{selector_value}') or contains(@content-desc, '{selector_value}')]"
                    try: target_el = self.driver.find_element(by=AppiumBy.XPATH, value=partial_xpath)
                    except Exception: pass
                
                if not target_el:
                    words = selector_value.split()
                    if len(words) > 1:
                        longest_word = sorted(words, key=len, reverse=True)[0]
                        if len(longest_word) >= 2:
                            fuzzy_xpath = f"//*[contains(@text, '{longest_word}') or contains(@content-desc, '{longest_word}')]"
                            try: target_el = self.driver.find_element(by=AppiumBy.XPATH, value=fuzzy_xpath)
                            except Exception: pass

            # 5-6. UI Automator match
            if not target_el and selector_type.upper() in ["ACCESSIBILITY_ID", "ID", "XPATH", "TEXT"] and not selector_value.startswith("//"):
                try: target_el = self.driver.find_element(by=AppiumBy.ANDROID_UIAUTOMATOR, value=f'new UiSelector().text("{selector_value}")')
                except Exception: pass
                if not target_el:
                    try: target_el = self.driver.find_element(by=AppiumBy.ANDROID_UIAUTOMATOR, value=f'new UiSelector().description("{selector_value}")')
                    except Exception: pass
                
                if not target_el:
                    words = selector_value.split()
                    if len(words) > 1:
                        longest_word = sorted(words, key=len, reverse=True)[0]
                        if len(longest_word) >= 2:
                            try: target_el = self.driver.find_element(by=AppiumBy.ANDROID_UIAUTOMATOR, value=f'new UiSelector().textContains("{longest_word}")')
                            except Exception: pass
                            if not target_el:
                                try: target_el = self.driver.find_element(by=AppiumBy.ANDROID_UIAUTOMATOR, value=f'new UiSelector().descriptionContains("{longest_word}")')
                                except Exception: pass

            # 7. Last Resort: Whitespace-Agnostic Regex Match (ANDROID_UIAUTOMATOR)
            if not target_el and selector_type.upper() in ["ACCESSIBILITY_ID", "ID", "XPATH", "TEXT"]:
                # Escape 특수문자 및 공백을 정규식의 \s* (0개 이상의 공백)로 치환
                safe_val = re.escape(selector_value.strip())
                regex_val = re.sub(r'\\ ', r'\\s*', safe_val)
                regex_val = re.sub(r'(\\s\*)+', r'\\s*', regex_val) # 중복 \s* 정리
                
                uiauto_regex = f'new UiSelector().textMatches("(?i).*{regex_val}.*")'
                try:
                    target_el = self.driver.find_element(by=AppiumBy.ANDROID_UIAUTOMATOR, value=uiauto_regex)
                except Exception: pass

            if target_el:
                logger.info(f"✅ 요소 탐색 성공: {selector_value}")
                return target_el
            
            time.sleep(0.5)

            elapsed = time.time() - start_time
            
            print("****현재 컨텍스트:", self.driver.current_context)

            # # 1. 페이지 안정화 대기 (최초 1회)
            # if not webview_stabilized:
            #     try:
            #         src = self.driver.page_source
            #         txts = re.findall(r'text="([^"]+)"', src)
            #         descs = re.findall(r'content-desc="([^"]+)"', src)
            #         all_texts = set(t.strip() for t in txts + descs if t.strip())
                    
            #         system_ui_keywords = {
            #             "뒤로가기", "홈", "최근 앱", "Android 시스템 알림", "배터리",
            #             "Wi-Fi", "휴대전화의 신호", "오전", "오후"
            #         }
                    
            #         content_texts = [t for t in all_texts if not any(k in t for k in system_ui_keywords) and not re.match(r'^\d{1,2}:\d{2}$', t)]
                    
            #         if len(content_texts) < 3:
            #             logger.info("시스템 UI만 감지 → 페이지 전환 대기")
            #             wait_start = time.time()
            #             time.sleep(1.0)
            #             start_time += (time.time() - wait_start)
            #     except Exception as e:
            #         logger.debug(f"안정화 확인 실패: {e}")
            #     webview_stabilized = True


            # # 2. 주기적 심폐소생술 (Tier 1: Jitter-Swipe, Tier 2: Hard Reactivation)
            # if elapsed - last_defib_time > 3.0:
            #     try:
            #         # [Tier 1] Soft Refresh: Jitter-Swipe (3초마다)
            #         logger.info(f"UI 트리 갱신 트리거 (Jitter-Swipe 100px) 수행 @ {elapsed:.1f}s")
            #         cx, cy = self.window_size['width'] // 2, self.window_size['height'] // 2
            #         self.driver.swipe(cx, cy, cx, cy - 100, 200)
            #         self.driver.swipe(cx, cy - 100, cx, cy, 200)
                    
            #         # [Tier 2] Hard Refresh: Focus Reactivation (결과가 stale한 경우 원천 파괴, 5초 간격)
            #         if elapsed - last_hard_defib_time > 5.0:
            #             package = self.driver.capabilities.get('appPackage') or self.driver.capabilities.get('appium:appPackage')
            #             if not package:
            #                 try: package = self.driver.current_package
            #                 except: pass
                        
            #             if package:
            #                 logger.warning(f"요소 탐색 지연 → 하드 리프레시(Background 1s -> Activate) 수행: {package}")
            #                 try:
            #                     # [Tier 2.5] Background Dance: 앱을 내렸다 올리는 것이 가장 확실한 트리 재건 방법
            #                     self.driver.background_app(1) 
            #                     time.sleep(1.0)
            #                     self.driver.activate_app(package)
            #                 except Exception as bg_e:
            #                     logger.debug(f"Background dance failed, falling back to simple activate: {bg_e}")
            #                     self.driver.activate_app(package)
                            
            #                 last_hard_defib_time = elapsed
            #                 time.sleep(3.0) 
                        
            #             # [Tier 4] Screenshot-Triggered Sync (화면 버퍼 강제 동기화)
            #             try:
            #                 logger.info("스크린샷 기반 렌더링/액세스빌리티 동기화 강제 시도")
            #                 self.driver.get_screenshot_as_base64()
            #             except: pass
                    
            #         # [Tier 3] Context Pulse: WebView bridge wake-up (3초마다 주기적 시도)
            #         try:
            #             contexts = self.driver.contexts
            #             webview = next((c for c in contexts if "WEBVIEW" in c), None)
            #             if webview:
            #                 logger.info(f"WebView 브릿지 동기화(Pulse) 수행: {webview}")
            #                 current_ctx = self.driver.current_context
            #                 self.driver.switch_to.context(webview)
            #                 _ = self.driver.page_source 
            #                 self.driver.switch_to.context(current_ctx if current_ctx else "NATIVE_APP")
            #         except Exception as pulse_e:
            #             logger.debug(f"WebView context pulse failed: {pulse_e}")
            #             try: self.driver.switch_to.context("NATIVE_APP")
            #             except: pass

            #         # 강제 동기화 후 소스 재캡처 (디버그 로그용)
            #         time.sleep(1.0) 
            #         src = self.driver.page_source
            #         txts = re.findall(r'text="([^"]+)"', src)
            #         dscs = re.findall(r'content-desc="([^"]+)"', src)
            #         all_vis = list(set([t for t in (txts + dscs) if t.strip()]))
            #         if all_vis:
            #             logger.info(f"[DEBUG] 복구(Defib) 직후 UI 텍스트: {', '.join(all_vis[:30])} ...")
            #     except Exception as e:
            #         logger.debug(f"Defibrillator failed: {e}")
            #     last_defib_time = elapsed
            #     continue


            #Auto-scroll fallback if halfway through timeout and not found
            if elapsed > timeout / 2 and not scrolled_once:

                logger.warning(f"Element {selector_value} not found after {timeout/2}s. Attempting auto-scroll to trigger lazy loading...")
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
                        
                    time.sleep(0.5) # Wait for WebView to render new items
                except Exception as e:
                    if isinstance(e, InvalidSessionIdException):
                        logger.error("Appium session lost during auto-scroll.")
                        self.driver = None
                        raise e
                    logger.warning(f"Auto-scroll fallback failed completely: {e}")
                scrolled_once = True
                continue
                        
            # # find_element에서 탐색 실패 시 1회 시도
            # if not target_el and scrolled_once and not cache_reset_done:
            #     # ✅ 초기화 전 UI 상태
            #     try:
            #         src = self.driver.page_source
            #         txts = re.findall(r'text="([^"]+)"', src)
            #         dscs = re.findall(r'content-desc="([^"]+)"', src)
            #         vis = list(set([t.strip() for t in (txts + dscs) if t.strip()]))
            #         logger.info(f"[DEBUG] cache 초기화 전 UI: {', '.join(vis[:30])}")
            #     except: pass
                
            #     self._reset_accessibility_cache()
            #     cache_reset_done = True                
                
            #     # ✅ 초기화 후 UI 상태
            #     time.sleep(1.0)
            #     try:
            #         src = self.driver.page_source
            #         txts = re.findall(r'text="([^"]+)"', src)
            #         dscs = re.findall(r'content-desc="([^"]+)"', src)
            #         vis = list(set([t.strip() for t in (txts + dscs) if t.strip()]))
            #         logger.info(f"[DEBUG] cache 초기화 후 UI: {', '.join(vis[:30])}")
            #     except: pass
                
                

        err_msg = f"Could not find element using {selector_type}={selector_value} or any fallbacks."
        
        # Collect available text on screen for debugging
        try:
            src = self.driver.page_source
            txts = re.findall(r'text="([^"]+)"', src)
            dscs = re.findall(r'content-desc="([^"]+)"', src)
            vis = list(set([t for t in (txts + dscs) if t.strip()]))
            if vis:
                sample = ", ".join(vis[:15])
                err_msg += f"\n[DEBUG] Available text on screen: {sample} ..."
        except Exception:
            pass
            
        logger.error(f"❌ Failed to find element after {timeout}s: {selector_type}={selector_value}")
        # # ✅ 실패 시점 UI 상태 로그
        # try:
        #     src = self.driver.page_source
        #     txts = re.findall(r'text="([^"]+)"', src)
        #     dscs = re.findall(r'content-desc="([^"]+)"', src)
        #     vis = list(set([t.strip() for t in (txts + dscs) if t.strip()]))
        #     logger.info(f"[DEBUG] 실패 시점 UI 텍스트: {', '.join(vis[:30])}")
        # except Exception as e:
        #     logger.debug(f"실패 시점 UI 로그 오류: {e}")        
        raise NoSuchElementException(err_msg)

    def apply_data_to_step(self, step: Dict[str, Any], data: Dict[str, Any], reference_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Replaces {{key}} in step fields with values from data, using Smart Mapping fallbacks."""
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
        # If the dataset key (e.g., '검색창') is found in the description, override the input value.
        if not used_placeholders and data:
            action = str(new_step.get("action", "")).lower()
            val_field = "inputValue" if "inputValue" in new_step else ("option" if "option" in new_step else "value")
                
            desc = str(new_step.get("description", ""))
            name = str(new_step.get("stepName", "") or new_step.get("name", ""))

            for key, data_item in data.items():
                if key in desc or key in name:
                    actual_val = data_item.get("value") if isinstance(data_item, dict) else data_item
                    
                    if actual_val is not None:
                        if action in ["type", "input", "send_keys", "navigate", "wait"]:
                            # Only override if the value is different (avoid infinite loops/redundant sets)
                            if new_step.get(val_field) != str(actual_val):
                                new_step[val_field] = str(actual_val)
                    break
        
        # 3. Tertiary: Value-based Smart Mapping (Literal Replacement based on Row 1)
        # Identify literal values from the first row of data and replace them in ALL fields.
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

    def execute_step(self, step: Dict[str, Any], db: Optional[Any] = None, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
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

        # Perform Variable Substitution if data is provided
        if data:
            step = self.apply_data_to_step(step, data)

        action_name = step.get("action", "").lower()
        
        # 1. Check for Custom Action in DB
        if db and action_name not in ["click", "tap", "send_keys", "type", "swipe", "scroll", "app_start", "activateapp", "app_open", "app_close", "close_app", "wait", "swipe(하)", "swipe(상)", "back", "find"]:
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
                    #before_source_len = len(self.driver.page_source)                
                    element.click()
                    time.sleep(1)  # 페이지 전환 최소 대기
                    self._scroll_to_top()
                    # after_source_len = len(self.driver.page_source)

                    # dom_changed = abs(after_source_len - before_source_len) > 1000

                    # if dom_changed:
                    #     self._scroll_to_top()               

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
            elif action == "find":
                try:
                    element = self.find_element(selector_type, selector_value)
                    logger.info(f"find 성공: {selector_value}")
                    return {"success": True, "error": None}
                except Exception as e:                    
                    return {"success": False, "error": str(e)}

            elif action == "swipe(하)":
                logger.info(f"Executing swipe(하) to find {selector_type}={selector_value}")
                max_swipes = 5
                element_found = False
                size = self.driver.get_window_size()
                start_x = size['width'] // 2
                start_y = int(size['height'] * 0.8)
                end_y = int(size['height'] * 0.2)
                
                for attempt in range(max_swipes):
                    try:
                        # Use a very short timeout to check if element is on current screen
                        element = self.find_element(selector_type, selector_value, timeout=2)
                        if element:
                            try:
                                location = element.location
                                e_size = element.size
                                center_y = location['y'] + (e_size['height'] / 2)
                                
                                # Check if element is in a very comfortable clickable zone (30% - 70% of viewport)
                                if (size['height'] * 0.30) <= center_y <= (size['height'] * 0.70):
                                    logger.info(f"Element found in safe zone at center_y={center_y} on swipe attempt {attempt + 1}")
                                    element_found = True
                                    break
                                else:
                                    logger.info(f"Element in DOM but near edge (center_y={center_y}). Centering... ({attempt + 1}/{max_swipes})")
                                    # Calculate swipe to bring it to center (50%)
                                    target_y = size['height'] // 2
                                    offset = center_y - target_y
                                    
                                    # Smoothly drag the screen by exactly 'offset'.
                                    # If the element is technically off-screen but registered in DOM,
                                    # center_y might be huge (e.g. 2500) making offset huge.
                                    # If offset is too large, cap it to a normal full-page swipe to avoid crashes
                                    max_swipe_dist = size['height'] * 0.6
                                    if abs(offset) > max_swipe_dist:
                                        logger.info(f"Offset {offset} is too large. Falling back to default swipe.")
                                        self.driver.swipe(start_x, start_y, start_x, end_y, 1500)
                                        time.sleep(1.0)
                                        continue
                                        
                                    s_y = size['height'] * 0.7 if offset > 0 else size['height'] * 0.3
                                    e_y = s_y - offset
                                    
                                    # Clamp e_y to safe screen bounds (10% to 90%)
                                    max_y = size['height'] * 0.9
                                    min_y = size['height'] * 0.1
                                    if e_y > max_y: e_y = max_y
                                    if e_y < min_y: e_y = min_y
                                    
                                    self.driver.swipe(start_x, int(s_y), start_x, int(e_y), 1500)
                                    time.sleep(1.5)
                                    continue # Skip the default swipe below
                            except Exception as loc_err:
                                logger.warning(f"Could not check element location: {loc_err}. Swiping down to try to reveal it.")
                                # DO NOT BREAK. It might be totally hidden. Fall through to default swipe.
                    except Exception:
                        logger.info(f"Element not found in DOM, scrolling down... ({attempt + 1}/{max_swipes})")
                        
                    # Default slow swipe down (moves screen up) to search
                    self.driver.swipe(start_x, start_y, start_x, end_y, 1500)
                    time.sleep(1.0) # Wait for page to settle

                if not element_found:
                    return {"success": False, "error": f"Failed to find element after {max_swipes} swipes: {selector_value}"}
            elif action == "app_start" or action == "activateapp" or action == "app_open":
                app_id = option or selector_value
                if app_id:
                    try:
                        self.driver.activate_app(app_id)
                        logger.info(f"Activated app via core method: {app_id}")
                    except Exception as e:
                        logger.warning(f"Core activate_app failed for {app_id}: {e}")
                        
                    time.sleep(4) # Implicit wait for app to load its main UI
                    #self._scroll_to_top()
                else:
                    pass # Already handled by session start usually if no specific ID given
            elif action == "app_close" or action == "close_app":
                app_id = option or selector_value
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
            elif action == "back":
                logger.info("Executing device BACK action")
                self.driver.back()
                time.sleep(1) # wait for page transition
                self._scroll_to_top()
            elif action == "wait":
                time.sleep(float(option) if option else 1.0)
            elif action == "finish":
                logger.info("Test finished (no-op action)")
            else:
                return {"success": False, "error": f"Unsupported action: {action}"}

            # Apply post-action Step Assertion if configured
            assert_text = step.get("assertText")
            if assert_text and str(assert_text).strip() != "":
                logger.info(f"Verifying step assertion: '{assert_text}'")
                time.sleep(2) # Wait for page transition / UI to settle
                try:
                    raw_xml = self.get_page_source() or ""
                    
                    # Extract all text/content-desc attributes to form a "visible" text buffer
                    text_values = re.findall(r'text="([^"]*)"', raw_xml)
                    desc_values = re.findall(r'content-desc="([^"]*)"', raw_xml)
                    # Join all text to simulate what a human sees as continuous strings
                    joined_text = " ".join(text_values + desc_values)

                    if assert_text in joined_text or assert_text in raw_xml:
                        logger.info("Exact Assertion Passed.")
                    else:
                        # Fuzzy match: remove whitespace/newlines and check
                        def _normalize(t):
                            t = str(t or "")
                            # Standardize spaces and remove all whitespace
                            return "".join(t.split())
                        
                        clean_joined = _normalize(joined_text)
                        clean_xml = _normalize(raw_xml)
                        clean_target = _normalize(assert_text)
                        
                        if clean_target in clean_joined or clean_target in clean_xml:
                            logger.info(f"Fuzzy Assertion Passed (matched after space normalization).")
                        else:
                            return {"success": False, "error": f"Assertion Failed: Expected text '{assert_text}' not found on screen."}
                except Exception as e:
                    logger.error(f"Assertion execution crashed: {e}")
                    return {"success": False, "error": f"Assertion Framework Error: {str(e)}"}
                    return {"success": False, "error": f"Assertion execution failed: {e}"}

            logger.info(f"Step {action} executed successfully.")
            return {"success": True, "error": None}
        except Exception as e:
            if isinstance(e, InvalidSessionIdException):
                logger.error("Appium session lost during step execution.")
                self.driver = None
                return {"success": False, "error": "Appium session has been terminated or not started. Please restart the session."}
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

    def scroll(self, delta_y: int) -> Dict[str, Any]:
        """
        Native scroll/swipe down or up based on delta_y.
        Positive delta_y (scroll wheel down) means view lower content -> requires swipe UP.
        """
        if not self.driver:
            return {"success": False, "error": "No active session"}
            
        try:
            size = self.driver.get_window_size()
            start_x = size['width'] // 2
            
            if delta_y > 0:
                start_y = int(size['height'] * 0.8)
                end_y = int(size['height'] * 0.2)
            else:
                start_y = int(size['height'] * 0.2)
                end_y = int(size['height'] * 0.8)

            self.driver.swipe(start_x, start_y, start_x, end_y, 300)
            logger.info(f"Scrolled app with delta_y={delta_y}")
            return {"success": True}
        except Exception as e:
            logger.error(f"Failed to scroll app: {e}")
            return {"success": False, "error": str(e)}

 

    def _scroll_to_top(self):
        try:
            size = self.driver.get_window_size()
            start_x = size['width'] // 2
            screen_height = size['height']

            previous_source = ""
            for i in range(5):
                src = self.driver.page_source
                if src == previous_source:
                    logger.info(f"최상단 도달 (화면 변화 없음, {i}회 스와이프)")
                    return True
                previous_source = src

                logger.info(f"최상단 이동 스와이프 {i+1}회")
                self.driver.swipe(
                    start_x, int(screen_height * 0.3),
                    start_x, int(screen_height * 0.8),
                    300
                )
                time.sleep(0.5) # 스와이프 후 UI 안정화 대기

            logger.info("🔍 최대 스와이프 횟수 도달 (최상단 이동)")
            return True

        except Exception as e:
            logger.debug(f"_scroll_to_top 실패: {e}")
            return False


    # def _wait_for_page_content(self, timeout=15):
    #     """
    #     시스템 UI만 있는 과도기 상태가 끝나고
    #     실제 페이지 콘텐츠가 로드될 때까지 대기
    #     """
    #     system_ui_keywords = {
    #         "뒤로가기", "홈", "최근 앱", "홈 화면",
    #         "Android 시스템 알림", "Google 알림", "Appium Settings 알림", 
    #         "소프트웨어 업데이트", "알림:", "알림,", "배터리",
    #         "Wi-Fi", "벨소리", "휴대전화의 신호", "오전", "오후"
    #     }
        
    #     start = time.time()
    #     while time.time() - start < timeout:
    #         try:
    #             src = self.driver.page_source
                
    #             txts = re.findall(r'text="([^"]+)"', src)
    #             descs = re.findall(r'content-desc="([^"]+)"', src)
    #             all_texts = set(t.strip() for t in txts + descs if t.strip())
                
    #             # 시스템 UI 키워드 및 시간 형식 제외
    #             content_texts = []
    #             for t in all_texts:
    #                 if not t.strip(): continue
    #                 if any(k in t for k in system_ui_keywords): continue
    #                 if re.match(r'^\d{1,2}:\d{2}$', t): continue # ignore pure time like "10:06"
    #                 content_texts.append(t)
                
    #             elapsed = time.time() - start
    #             logger.info(f"페이지 로드 대기 {elapsed:.1f}s | "
    #                     f"콘텐츠 텍스트 수: {len(content_texts)} | "
    #                     f"샘플: {content_texts[:3]}")
                
    #             # 실제 콘텐츠가 있으면 완료 (조건 최소화: 1개 이상이면 통과)
    #             if len(content_texts) >= 1:
    #                 logger.info(f"✅ 페이지 콘텐츠 로드 확인: {content_texts[:5]}")
    #                 return True
                    
    #         except Exception as e:
    #             logger.debug(f"페이지 로드 확인 오류: {e}")
                
    #         time.sleep(0.5)
        
    #     logger.warning("페이지 콘텐츠 로드 타임아웃")
    #     return False


    # def _wait_for_next_page_ready(self, timeout=15):
    #     """
    #     페이지 전환 후 WebView 콘텐츠가
    #     Accessibility Tree에 통합될 때까지 대기
    #     통합 안 되면 앱 재활성화로 강제 트리거
    #     """
    #     system_ui_keywords = {
    #         "뒤로가기", "홈", "최근 앱", "Android 시스템 알림",
    #         "Google 알림", "Appium Settings 알림", "소프트웨어 업데이트",
    #         "배터리", "Wi-Fi", "벨소리", "휴대전화의 신호", "오전", "오후",
    #         "삼성 캡처 알림"
    #     }
        
    #     start = time.time()
    #     prev_count = 0
    #     stable_count = 0
        
    #     while time.time() - start < timeout:
    #         try:
    #             src = self.driver.page_source
    #             txts = re.findall(r'text="([^"]+)"', src)
    #             descs = re.findall(r'content-desc="([^"]+)"', src)
    #             all_texts = set(t.strip() for t in txts + descs if t.strip())
                
    #             content_texts = [
    #                 t for t in all_texts
    #                 if not any(k in t for k in system_ui_keywords)
    #                 and not re.match(r'^\d{1,2}:\d{2}$', t)
    #                 and len(t.strip()) > 1
    #             ]
                
    #             current_count = len(content_texts)
    #             elapsed = time.time() - start
    #             logger.info(f"{elapsed:.1f}s | 콘텐츠 수: {current_count} | "
    #                     f"샘플: {content_texts[:3]}")
                
    #             # 콘텐츠가 충분하고 3회 연속 안정화되면 완료
    #             if current_count >= 5:
    #                 if current_count == prev_count:
    #                     stable_count += 1
    #                     if stable_count >= 3:
    #                         logger.info(f"✅ 페이지 완전 로드 확인 ({current_count}개)")
    #                         return True
    #                 else:
    #                     stable_count = 0
                
    #             prev_count = current_count
                
    #             # ✅ 3초 이상 콘텐츠가 안 올라오면 앱 재활성화로 강제 트리거
    #             if elapsed > 3.0 and current_count < 5:
    #                 logger.warning("WebView 미통합 → 앱 재활성화로 강제 트리거")
    #                 try:
    #                     package = (self.driver.capabilities.get('appPackage') or 
    #                             self.driver.capabilities.get('appium:appPackage') or
    #                             self.driver.current_package)
    #                     if package:
    #                         self.driver.background_app(1)
    #                         time.sleep(0.5)
    #                         self.driver.activate_app(package)
    #                         time.sleep(1.0)
    #                         logger.info("앱 재활성화 완료")
    #                 except Exception as e:
    #                     logger.debug(f"앱 재활성화 실패: {e}")
                        
    #         except Exception as e:
    #             logger.debug(f"오류: {e}")
                
    #         time.sleep(0.3)
        
    #     logger.warning("페이지 로드 타임아웃")
    #     return False      
            
    # def _reset_accessibility_cache(self):
    #     try:
    #         self.driver.execute_script('mobile: resetAccessibilityCache')
    #         logger.info("✅ Accessibility Cache 초기화")
    #         time.sleep(0.5)
    #         return True
    #     except Exception as e:
    #         logger.warning(f"resetAccessibilityCache 실패: {e}")
    #         return False

app_step_runner = AppStepRunner()
