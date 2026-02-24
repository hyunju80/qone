import base64
import logging
import re
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException
from app.services.app_runner import app_step_runner
from app.services.device_service import device_service
from sqlalchemy.orm import Session
from app.api import deps
from app.models.project import Project
import lxml.etree as ET

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/devices")
def list_devices() -> Dict[str, Any]:
    """
    List physically connected Android devices via ADB.
    """
    devices = device_service.get_connected_devices()
    return {"success": True, "devices": devices}

@router.post("/connect")
def connect_device(
    payload: Dict[str, Any],
    db: Session = Depends(deps.get_db)
) -> Dict[str, Any]:
    """
    Start an Appium session for a specific device.
    Payload: {"device_id": "...", "project_id": "...", "platform": "Android"}
    """
    device_id = payload.get("device_id")
    project_id = payload.get("project_id")
    platform = payload.get("platform", "Android")
    
    logger.info(f"Connecting to device {device_id} for project {project_id} on {platform}")
    
    # Define base capabilities
    capabilities = {
        "platformName": platform,
        "automationName": "UiAutomator2" if platform == "Android" else "XCUITest",
        "deviceName": device_id,
        "udid": device_id,
        "newCommandTimeout": 3600,
        "settings[ignoreUnimportantViews]": False,
        "settings[allowWindowOcclusion]": True,
        "settings[waitForIdleTimeout]": 100 # ms, very low to avoid hung loading stubs
    }
    
    # Fetch project-specific mobile config if project_id is provided
    if project_id:
        project = db.query(Project).filter(Project.id == project_id).first()
        if project and project.mobile_config:
            m_config = project.mobile_config
            logger.info(f"Using mobile_config: {m_config}")
            
            # Helper to find values regardless of case/format
            def get_val(keys):
                for k in keys:
                    for cfg_k, cfg_v in m_config.items():
                        if cfg_k.lower().replace("_", "") == k.lower():
                            return cfg_v
                return None

            if platform == "Android":
                pkg = get_val(["appPackage", "packageName"])
                act = get_val(["appActivity", "activityName"])
                if pkg: 
                    capabilities["appPackage"] = pkg
                    # If activity is missing, try to discover it
                    if not act:
                        logger.info(f"Activity missing for {pkg}, attempting discovery...")
                        act = device_service.get_launcher_activity(device_id, pkg)
                        if act:
                            logger.info(f"Discovered activity: {act}")
                    
                    if act:
                        capabilities["appActivity"] = act
                    
                    # Always good to have a broad wait activity fallback for Android
                    capabilities["appWaitActivity"] = "*"
            else:
                 bundle = get_val(["bundleId", "bundleName"])
                 if bundle: capabilities["bundleId"] = bundle
        else:
            logger.warning(f"Project {project_id} not found or has no mobile_config")

    success, error = app_step_runner.start_session(capabilities)
    if success:
        return {
            "success": True, 
            "message": f"Connected to {device_id} with app configuration",
            "window_size": app_step_runner.window_size
        }
    else:
        return {"success": False, "error": f"Appium Session Error: {error}"}


@router.get("/screenshot")
def get_screenshot() -> Dict[str, Any]:
    """
    Get live screenshot from the active Appium session.
    """
    screenshot = app_step_runner.get_screenshot()
    if not screenshot:
        return {"success": False, "error": "No active session or failed to capture screenshot"}
    return {"success": True, "data": screenshot}

@router.get("/source")
def get_source() -> Dict[str, Any]:
    """
    Get current XML page source.
    """
    source = app_step_runner.get_page_source()
    if not source:
        return {"success": False, "error": "No active session or failed to capture source"}
    return {"success": True, "data": source}

@router.get("/contexts")
def get_contexts() -> Dict[str, Any]:
    """
    List available Appium contexts (NATIVE_APP, WEBVIEW_...).
    """
    contexts = app_step_runner.get_contexts()
    return {"success": True, "contexts": contexts}

@router.post("/switch-context")
def switch_context(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Switch Appium context.
    """
    context_name = payload.get("context_name")
    if not context_name:
        return {"success": False, "error": "context_name is required"}
    
    success = app_step_runner.switch_context(context_name)
    if success:
        return {"success": True, "message": f"Switched to {context_name}"}
    return {"success": False, "error": f"Failed to switch to {context_name}"}

@router.post("/identify")
def identify_element(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Identify element at (x, y) coordinates with improved selector ranking and highlighting support.
    Payload: {"x": 100, "y": 200, "display_width": 300, "display_height": 533}
    Returns best selector and element bounds.
    """
    x = payload.get("x")
    y = payload.get("y")
    display_w = payload.get("display_width", 1080)
    display_h = payload.get("display_height", 1920)
    
    # Use actual device window size for mapping if available
    window_size = app_step_runner.window_size
    win_w = window_size.get("width", 1080)
    win_h = window_size.get("height", 1920)
    
    # Mapping to XML coordinate space happens inside the try block below
    logger.info(f"Identify request: Display({payload.get('x')}, {payload.get('y')}) on {display_w}x{display_h}")
    
    source = app_step_runner.get_page_source()
    if not source:
        return {"success": False, "error": "No active session"}

    try:
        root = ET.fromstring(source.encode('utf-8'))
        
        # 1. First pass: Detect actual coordinate space from high-level bounds
        # (Appium sometimes reports window_size differently than XML bounds)
        # We look for the first element that covers a significant part of the screen
        xml_w = win_w
        xml_h = win_h
        all_elements = list(root.iter())
        
        for el in all_elements:
            bounds_str = el.get("bounds")
            if bounds_str:
                m = re.search(r"(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\D+(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)", bounds_str)
                if m:
                    try:
                        _, _, x2, y2 = map(lambda v: int(float(v)), m.groups())
                        # If we find a large container near root, use it as our scale anchor
                        # This avoids scale inflation from off-screen scrollable children
                        if x2 > 100 and y2 > 100:
                            xml_w = x2
                            xml_h = y2
                            logger.info(f"Detected XML Coordinate Space: {xml_w}x{xml_h} from root container")
                            break 
                    except: continue
        
        # 2. Rescale click to this detected space
        x = int((payload.get("x", 0) / display_w) * xml_w)
        y = int((payload.get("y", 0) / display_h) * xml_h)
        
        logger.info(f"Mapping: Display({payload.get('x')}, {payload.get('y')}) / {display_w}x{display_h} -> XML({x}, {y}) / {xml_w}x{xml_h}")

        matches = []
        for el in all_elements:
            bounds_str = el.get("bounds")
            if bounds_str:
                m = re.search(r"(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\D+(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)", bounds_str)
                if m:
                    try:
                        coords = list(map(lambda v: int(float(v)), m.groups()))
                        x1, y1, x2, y2 = coords
                        if x1 <= x <= x2 and y1 <= y <= y2:
                            area = (x2 - x1) * (y2 - y1)
                            # Penalty for container classes to prioritize specific elements
                            class_name = el.get("class", "").lower()
                            # WebView/View should be treated as a shell in native context
                            is_shell = any(c in class_name for c in ["scrollview", "framelayout", "linearlayout", "viewgroup", "decorview", "webview", "android.view.view"])
                            is_clickable = el.get("clickable") == "true" or el.get("focusable") == "true"
                            
                            # Preferred elements (buttons, images, inputs, etc.)
                            is_likely_leaf = any(c in class_name for c in ["button", "image", "text", "check", "radio", "edit"])
                            
                            # Metadata preference: Prefer things that have actual info
                            has_metadata = any(el.get(a) for a in ["resource-id", "content-desc", "text"])
                            
                            # Weighting logic:
                            # 1. Start with area
                            weight = float(area)
                            
                            # 2. Prefer clickable leaf-like nodes heavily
                            if is_clickable:
                                weight *= 0.1
                            if is_likely_leaf:
                                weight *= 0.5
                                # Extra boost for actual input fields on Android/iOS
                                if "edittext" in class_name or "textfield" in class_name:
                                    weight *= 0.1
                            if has_metadata:
                                weight *= 0.01 # STRONG preference for anything with a name/ID
                                
                            # 3. Penalize large shell containers
                            if is_shell:
                                # If it's a shell and clickable, it's often a custom button, so less penalty
                                weight *= 100.0 if not is_clickable else 5.0
                            
                            # 4. Leaf node bonus (check if it has child matching same coords)
                            has_child_match = False
                            for child in el:
                                c_bounds = child.get("bounds")
                                if c_bounds:
                                    cm = re.search(r"(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\D+(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)", c_bounds)
                                    if cm:
                                        try:
                                            cx_coords = list(map(lambda v: int(float(v)), cm.groups()))
                                            cx1, cy1, cx2, cy2 = cx_coords
                                            if cx1 <= x <= cx2 and cy1 <= y <= cy2:
                                                has_child_match = True
                                                break
                                        except: continue
                            if not has_child_match:
                                weight *= 0.1 # Leaf nodes (most specific) are strongly preferred
                                
                            matches.append((weight, el, (x1, y1, x2, y2)))
                    except: continue

        if not matches:
            return {"success": False, "error": "No element found at coordinates"}

        # Pick the element with the lowest weight (smallest/most specific/clickable/leaf)
        matches.sort(key=lambda x: x[0])
        _, best_element, bounds = matches[0]

        # Extract possible selectors
        resource_id = best_element.get("resource-id")
        accessibility_id = best_element.get("content-desc")
        class_name = best_element.get("class", "")
        text = (best_element.get("text") or "").strip()
        
        # Recursive text discovery: if best_element has no text, look at its children
        if not text and not resource_id and not accessibility_id:
            for child in best_element.iter():
                c_text = (child.get("text") or "").strip()
                if c_text:
                    text = c_text
                    break
                c_desc = (child.get("content-desc") or "").strip()
                if c_desc:
                    accessibility_id = c_desc
                    break
        
        # Update res window_size to match detected space
        detected_window_size = {"width": xml_w, "height": xml_h}
        
        # Find line number (IMPORTANT: use best_element's bounds)
        best_bounds_str = best_element.get("bounds")
        line_no = 1
        source_lines = source.splitlines()
        for i, line in enumerate(source_lines):
            if best_bounds_str in line:
                line_no = i + 1
                break
        
        result = {
            "success": True,
            "bounds": {
                "x1": bounds[0], "y1": bounds[1],
                "x2": bounds[2], "y2": bounds[3]
            },
            "window_size": detected_window_size,
            "class": class_name,
            "line_number": line_no,
            "resource_id": resource_id,
            "text": text
        }

        # Select the best selector type/value
        if accessibility_id:
            result.update({
                "selector_type": "ACCESSIBILITY_ID",
                "selector_value": accessibility_id,
                "name": accessibility_id
            })
        elif resource_id:
            result.update({
                "selector_type": "ID",
                "selector_value": resource_id,
                "name": resource_id.split("/")[-1]
            })
        elif text and len(text) < 50:
            # Check if text is directly on best_element or a descendant
            direct_text = (best_element.get("text") or "").strip()
            
            if direct_text == text:
                xpath = f"//{class_name if class_name else '*'}[@text='{text}']"
            else:
                # Text was found in a child, use descendant match inside the selected container
                # This is common in WebViews/Compose where a View wraps a sister TextView
                xpath = f"//{class_name if class_name else '*'}[.//*[contains(@text, '{text}')]]"
                # If the class is generic or we want maximum stability, prefer just the text match
                if "view" in class_name.lower() or class_name == "*":
                    xpath = f"//*[@text='{text}']"
            
            result.update({
                "selector_type": "XPATH",
                "selector_value": xpath,
                "name": text
            })
        else:
            # Fallback to absolute or descriptive XPath
            short_class = class_name.split('.')[-1] if class_name else "*"
            tree = ET.ElementTree(root)
            abs_xpath = tree.getpath(best_element)
            
            # Try to build a descriptive relative XPath
            # Format: //Class[@attr='val'] or //Class[idx]
            rel_xpath = f"//{class_name if class_name else '*'}"
            
            # Try to find a unique attribute among siblings
            parent = None
            for p in root.iter():
                if any(child is best_element for child in p):
                    parent = p
                    break
            
            if parent is not None:
                # 1. Try to find a sibling-unique class+attribute combination
                attrs_to_try = ["resource-id", "content-desc", "text", "index", "checkable", "clickable", "enabled", "focusable", "focused", "scrollable", "long-clickable", "password", "selected"]
                found_unique_attr = False
                for attr in attrs_to_try:
                    val = best_element.get(attr)
                    if val and val.strip() and val != "false":
                        # Check if this attribute is unique among siblings with same class
                        siblings_with_attr = [c for c in parent if c.get("class") == class_name and c.get(attr) == val]
                        if len(siblings_with_attr) == 1:
                            rel_xpath += f"[@{attr}='{val}']"
                            found_unique_attr = True
                            break
                
                if not found_unique_attr:
                    # 2. Fallback to index if no unique attribute found
                    siblings = [c for c in parent if c.get("class") == class_name]
                    if len(siblings) > 1:
                        idx = siblings.index(best_element) + 1
                        rel_xpath += f"[{idx}]"
                
                result.update({
                    "selector_type": "XPATH",
                    "selector_value": rel_xpath,
                    "name": val if found_unique_attr and len(val) < 20 else short_class
                })
            else:
                result.update({
                    "selector_type": "XPATH",
                    "selector_value": abs_xpath,
                    "name": short_class
                })

        return result
    except Exception as e:
        logger.error(f"Identify failed: {e}")
        return {"success": False, "error": str(e)}

@router.post("/action")
def perform_action(step: Dict[str, Any]) -> Dict[str, Any]:
    """
    Perform a direct action on the device (for recording/live interaction).
    """
    result = app_step_runner.execute_step(step)
    return result
@router.post("/disconnect")
def disconnect_device() -> Dict[str, Any]:
    """
    Terminate the current Appium session.
    """
    app_step_runner.stop_session()
    return {"success": True, "message": "Disconnected and session terminated"}
