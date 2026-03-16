from typing import Any, List, Dict, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel
import asyncio
import os
from pathlib import Path
from app.services.runner import runner_service
import base64
import tempfile

# Match logic in runner.py
RUNS_DIR = Path(tempfile.gettempdir()) / "qone_runs"

router = APIRouter()

from app.services.app_runner import app_step_runner
from app.services.web_runner import web_step_runner
from app.services.device_service import device_service
from app.models.project import Project
from app.models.test import TestHistory, TestScript
from app.api import deps
from sqlalchemy.orm import Session
from fastapi import Depends
import json

class DryRunRequest(BaseModel):
    code: str
    project_id: Optional[str] = None
    script_id: Optional[str] = None
    script_name: Optional[str] = None
    persona_name: Optional[str] = "Default"
    try_count: int = 1

class RunStepsRequest(BaseModel):
    steps: List[Dict[str, Any]]
    project_id: str
    device_id: Optional[str] = None
    platform: str = "Android"
    script_id: Optional[str] = None
    script_name: Optional[str] = None
    trigger: str = "manual"
    persona_name: Optional[str] = "Default"
    capture_screenshots: bool = False
    dataset: Optional[List[Dict[str, Any]]] = None
    try_count: int = 1
    enable_ai_test: bool = False

class DryRunResponse(BaseModel):
    run_id: str

@router.post("/dry-run", response_model=DryRunResponse)
async def start_dry_run(request: DryRunRequest):
    """
    Start a standard string-based code execution run (default Playwright).
    """
    print(f"Starting dry run with code length: {len(request.code)}")
    run_id = runner_service.execute_dry_run(request.code)

    if request.script_id and request.project_id:
        async def poll_and_save():
            from app.db.session import SessionLocal
            from datetime import datetime, timezone
            import uuid
            from app.models.test import TestHistory, TestScript
            
            run_dir = RUNS_DIR / run_id
            exit_code_file = run_dir / "exit_code.txt"
            log_file = run_dir / "output.log"
            
            timeout = 600
            elapsed = 0
            while not exit_code_file.exists() and elapsed < timeout:
                await asyncio.sleep(2)
                elapsed += 2
                
            status = "failed"
            error_msg = "Execution Timed Out"
            if exit_code_file.exists():
                try:
                    code = int(exit_code_file.read_text().strip())
                    status = "passed" if code == 0 else "failed"
                    error_msg = None if code == 0 else "Test Executed with Failures"
                except: pass
                
            execution_logs = []
            if log_file.exists():
                try:
                    lines = log_file.read_text(encoding="utf-8", errors="ignore").splitlines()
                    for line in lines:
                        if line.strip():
                            msg_type = "error" if "fail" in line.lower() or "error" in line.lower() else "info"
                            execution_logs.append({"msg": line, "type": msg_type})
                except Exception as e:
                    execution_logs.append({"msg": f"Failed to read logs: {e}", "type": "error"})

            db_history = SessionLocal()
            try:
                h_id = str(uuid.uuid4())
                new_history = TestHistory(
                    id=h_id,
                    project_id=request.project_id,
                    script_id=request.script_id,
                    script_name=request.script_name or "Playwright Script",
                    status=status,
                    duration=f"{elapsed}s",
                    failure_reason=error_msg,
                    trigger="manual",
                    persona_name=request.persona_name,
                    step_results=[],
                    logs=execution_logs,
                    run_date=datetime.now(timezone.utc)
                )
                db_history.add(new_history)
                db_history.commit()

                script = db_history.query(TestScript).filter(TestScript.id == request.script_id).first()
                if script:
                    total_runs = db_history.query(TestHistory).filter(TestHistory.script_id == request.script_id).count()
                    passed_runs = db_history.query(TestHistory).filter(
                        TestHistory.script_id == request.script_id,
                        TestHistory.status == "passed"
                    ).count()
                    
                    script.run_count = total_runs
                    script.success_rate = round((passed_runs / total_runs) * 100, 1) if total_runs > 0 else 0
                    script.last_run = datetime.now(timezone.utc)
                    db_history.commit()
            except Exception as e:
                print(f"Error saving history for dry-run {run_id}: {e}")
                db_history.rollback()
            finally:
                db_history.close()

        asyncio.create_task(poll_and_save())

    return DryRunResponse(run_id=run_id)

@router.post("/active-steps", response_model=DryRunResponse)
async def start_active_steps_run(
    request: RunStepsRequest,
    db: Session = Depends(deps.get_db)
):
    """
    Run a list of steps directly (e.g. from the Inspector staging area).
    """
    import uuid
    run_id = str(uuid.uuid4())
    
    # Auto-discover device if not provided (Only for mobile)
    device_id = request.device_id
    if not device_id and request.platform.upper() != "WEB":
        connected = device_service.get_connected_devices()
        if connected:
            device_id = connected[0]["id"]
            print(f"DEBUG: Auto-discovered device {device_id}")
        else:
            raise HTTPException(400, "No device connected and no device_id provided")
    elif not device_id:
        device_id = "WEB_BROWSER"

    # Fetch project for mobile_config
    project = db.query(Project).filter(Project.id == request.project_id).first()
    mobile_config = project.mobile_config if project else {}

    async def run_task():
        from app.db.session import SessionLocal
        run_dir = RUNS_DIR / run_id
        run_dir.mkdir(parents=True, exist_ok=True)
        log_file = run_dir / "output.log"
        exit_code_file = run_dir / "exit_code.txt"
        img_file = run_dir / "latest.jpg"
        
        step_results = []
        execution_logs = []
        overall_status = "passed"
        start_time = asyncio.get_event_loop().time()

        # Group Dataset by Field to support Parallel Index iterations
        iterations_data = []
        if request.dataset:
            field_groups = {}
            for row in request.dataset:
                f = row.get("field")
                if f not in field_groups: field_groups[f] = []
                field_groups[f].append(row)
            
            # Determine max iterations
            max_iters = max([len(v) for v in field_groups.values()]) if field_groups else 0
            
            for idx in range(max_iters):
                current_iter_data = {}
                iter_expected_result = None
                for f, rows in field_groups.items():
                    # Pick idx-th row, or last row if out of bounds
                    r_idx = min(idx, len(rows) - 1)
                    row = rows[r_idx]
                    # Pass the full row information to the runner for smart mapping (value + expected result)
                    current_iter_data[f] = {
                        "value": row.get("value"),
                        "expected_result": row.get("expected_result")
                    }
                    # If this row has an expected result, keep it (last one wins if multiple fields)
                    if row.get("expected_result"):
                        iter_expected_result = row.get("expected_result")
                
                iterations_data.append({
                    "data": current_iter_data,
                    "expected_result": iter_expected_result,
                    "iteration_index": idx + 1
                })
        else:
            # Single iteration with no data
            iterations_data = [{"data": None, "expected_result": None, "iteration_index": 1}]

        try:
            with open(log_file, "w", encoding="utf-8") as lf:
                def log(msg, level="INFO"):
                    log_line = f"[{level}] {msg}"
                    lf.write(f"{log_line}\n")
                    lf.flush()
                    execution_logs.append({"msg": msg, "type": level.lower()})

                for attempt in range(request.try_count):
                    if request.try_count > 1:
                        log(f"--- ATTEMPT {attempt + 1} / {request.try_count} ---")
                    
                    # Reset status and results for each attempt
                    step_results = []
                    overall_status = "passed"
                    
                    try:
                        if request.platform.upper() != "WEB":
                            log(f"Starting execution for project {request.project_id} on {device_id}...")
                            
                            # Setup capabilities
                            platform_name = "Android" if request.platform.upper() in ["APP", "ANDROID"] else "iOS"
                            caps = {
                                "platformName": platform_name,
                                "automationName": "UiAutomator2" if platform_name == "Android" else "XCUITest",
                                "deviceName": device_id,
                                "udid": device_id,
                            }
                            # Merge mobile_config
                            if mobile_config:
                                for k, v in mobile_config.items():
                                    if not k.startswith("appium:"):
                                        caps[f"appium:{k}"] = v
                                    else:
                                        caps[k] = v
                            
                            log(f"Connecting to Appium with caps: {platform_name} / {device_id}")
                            success, err = app_step_runner.start_session(caps)
                            if not success:
                                log(f"Failed to start session: {err}", "ERROR")
                                overall_status = "failed"
                                _save_history_record(overall_status, "Setup Failure: " + str(err), step_results, execution_logs=execution_logs)
                                with open(exit_code_file, "w") as ef: ef.write("1")
                                return
                            log("Appium session established successfully.")
                        else:
                            log(f"Starting WEB execution for project {request.project_id}...")
                            success, err = await web_step_runner.start_session()
                            if not success:
                                log(f"Failed to start Playwright session: {err}", "ERROR")
                                overall_status = "failed"
                                _save_history_record(overall_status, "Setup Failure: " + str(err), step_results, execution_logs=execution_logs)
                                with open(exit_code_file, "w") as ef: ef.write("1")
                                return
                            log("Playwright session established successfully.")
                        
                        log("Session established successfully.")
                                        
                        runner = web_step_runner if request.platform.upper() == "WEB" else app_step_runner

                        # Initial screenshot
                        async def update_screen(label="screenshot"):
                            try:
                                log(f"Capturing {label}...")
                                screenshot_b64 = await runner.get_screenshot() if request.platform.upper() == "WEB" else runner.get_screenshot()
                                if screenshot_b64:
                                    with open(img_file, "wb") as f:
                                        f.write(base64.b64decode(screenshot_b64))
                                    log(f"Successfully updated image stream ({label})")
                                    return screenshot_b64 # Return for history
                            except Exception as e:
                                log(f"Failed to capture {label}: {str(e)}", "WARNING")
                            return None

                        await update_screen("initial state")

                        try:
                            for iter_info in iterations_data:
                                iter_idx = iter_info["iteration_index"]
                                iter_data = iter_info["data"]
                                iter_expected = iter_info["expected_result"]
                                
                                if len(iterations_data) > 1:
                                    log(f"--- Starting Iteration {iter_idx}/{len(iterations_data)} ---")
                                    # log(f"[DEBUG] Iteration data: {iter_data}")
                                
                                iteration_success = True

                                for i, step_orig in enumerate(request.steps):
                                    # Create a fresh copy for this iteration to avoid in-place modification leakage
                                    step = step_orig.copy()
                                    
                                    orig_val = step.get("inputValue") or step.get("option") or step.get("value")
                                    # log(f"[DEBUG] Step {i+1} FULL (Raw): {step}")
                                    
                                    # Perform Variable Substitution early so logs and results are accurate
                                    if iter_data:
                                        # Use first iteration as a reference for literal value replacement in Smart Mapping
                                        ref_data = iterations_data[0]["data"] if iterations_data else None
                                        step = runner.apply_data_to_step(step, iter_data, reference_data=ref_data)

                                    replaced_val = step.get("inputValue") or step.get("option") or step.get("value")
                                    # log(f"[DEBUG] Step {i+1} Result: Value='{replaced_val}', Assertion='{step.get('assertText')}', Desc='{step.get('description')}'")
                                    
                                    step_name = step.get("stepName") or step.get("name") or step.get("action")
                                    action = step.get("action")
                                    # Support both camelCase (from UI) and snake_case (from DB)
                                    target = step.get("selectorValue") or step.get("selector_value") or step.get("target")
                                    value = step.get("inputValue") or step.get("option") or step.get("value")
                                    description = step.get("description")
                                    
                                    log_msg = f"Step {i+1}: [{action}]"
                                    if target: log_msg += f" target={target}"
                                    if value: log_msg += f" value={value}"
                                    log(log_msg)
                                    
                                    step_start = asyncio.get_event_loop().time()
                                    # Pass data=None as we already substituted above
                                    res = await runner.execute_step(step, data=None) if request.platform.upper() == "WEB" else runner.execute_step(step, db=db, data=None)
                                    step_end = asyncio.get_event_loop().time()
                                    
                                    # Always capture for the live execution stream
                                    current_screen_b64 = await update_screen(f"stream update Iter{iter_idx} Step {i+1}")
                                    
                                    # Record logic: attach to DB history if requested OR failure
                                    should_capture = request.capture_screenshots or step.get("screenshot") is True or not res["success"]
                                    screen_data = current_screen_b64 if should_capture else None
            
                                    result_entry = {
                                        "step_number": i + 1,
                                        "name": f"[Iter{iter_idx}] {step_name}",
                                        "status": "passed" if res["success"] else "failed",
                                        "duration": f"{round(step_end - step_start, 1)}s",
                                        "error_message": res.get("error"),
                                        "screenshot_data": screen_data,
                                        "metadata": {
                                            "action": action,
                                            "target": target,
                                            "value": value,
                                            "iteration": iter_idx,
                                            "description": description,
                                            "assertText": step.get("assertText")
                                        }
                                    }
                                    step_results.append(result_entry)
            
                                    if not res["success"]:
                                        log(f"Step {i+1} FAILED: {res.get('error')}", "ERROR")
                                        iteration_success = False
                                        overall_status = "failed"
                                        # with open(exit_code_file, "w") as ef: ef.write("1") <- Removed for race condition
                                        break # Stop execution on failure
                                    
                                    log(f"Step {i+1} PASSED ({round(step_end - step_start, 1)}s)")
                                    await asyncio.sleep(1.0) # Added delay to allow the live view to keep up visually

                                # After all steps in iteration, check row-level expected_result if provided
                                if iteration_success and iter_expected:
                                    log(f"Verifying row-level expected result: '{iter_expected}'")
                                    await asyncio.sleep(1.5) # Wait for final state reflection
                                    # Simple screen content check
                                    try:
                                        # Use robust verification logic similar to step assertions
                                        content = ""
                                        if request.platform.upper() == "WEB":
                                            # Get rendered innerText to ignore HTML tags
                                            content = await runner.page.evaluate("document.body.innerText")
                                        else:
                                            # Extract all text/description attributes from XML
                                            import re
                                            raw_xml = runner.get_page_source() or ""
                                            text_values = re.findall(r'text="([^"]*)"', raw_xml)
                                            desc_values = re.findall(r'content-desc="([^"]*)"', raw_xml)
                                            content = " ".join(text_values + desc_values) + " " + raw_xml
                                        
                                        def _normalize(t):
                                            import re
                                            # Remove HTML-like tags and all whitespace
                                            t = re.sub(r'<[^>]*>', '', str(t or ""))
                                            return "".join(t.split())

                                        clean_content = _normalize(content)
                                        clean_expected = _normalize(iter_expected)

                                        if clean_expected in clean_content:
                                            log(f"Iteration {iter_idx} Expected Result Verified.")
                                        else:
                                            log(f"Iteration {iter_idx} FAILED: Expected result '{iter_expected}' not found on screen.", "ERROR")
                                            iteration_success = False
                                            overall_status = "failed"
                                    except Exception as e:
                                        log(f"Failed to verify iteration expected result: {e}", "WARNING")

                                if not iteration_success:
                                    break # Stop further iterations if one fails

                            if overall_status == "passed":
                                log("All steps completed successfully.")
                            
                            try:
                                await asyncio.sleep(0.5) # Wait for final UI transition
                                await update_screen("final state")
                            except: pass
                        except Exception as e:
                            log(f"Execution error: {str(e)}", "ERROR")
                            overall_status = "failed"
                    finally:
                        if request.platform.upper() == "WEB":
                            await web_step_runner.stop_session()
                        else:
                            app_step_runner.stop_session()
                    
                    if overall_status == "passed":
                        break
                    
                    if attempt < request.try_count - 1:
                        log(f"Attempt {attempt + 1} failed. Re-trying...", "WARNING")
                        await asyncio.sleep(2)

                # --- 3. AI Fallback (If all attempts failed) ---
                if overall_status != "passed" and request.enable_ai_test:
                    log(f"--- All {request.try_count} attempts failed. Initiating AI Autonomous Testing (Fallback) ---")
                    
                    from app.services.fallback_service import fallback_service
                    
                    # Determine Goal
                    goal = request.script_name or f"Achieve the goal of scenario: {request.script_name or 'Manual Run'}"
                    
                    try:
                        # Credentials from standard placeholders if available in mobile_config or project
                        # For now, we take basic context
                        persona_desc = None
                        # (In a real scenario, we might fetch persona from DB here)

                        ai_history = await fallback_service.run_ai_fallback(
                            platform=request.platform,
                            goal=goal,
                            initial_url=None, # Already in session
                            app_package=mobile_config.get("appPackage"),
                            persona_context=None 
                        )
                        
                        ai_passed = False
                        for step in ai_history:
                            step_num = step.get("step_number", "?")
                            log(f"[AI Fallback Step {step_num}] {step.get('description', '')} -> {step.get('thought', '')}")
                            
                            # Stream screenshot if available
                            if step.get("screenshot_data"):
                                try:
                                    with open(img_file, "wb") as f:
                                        f.write(base64.b64decode(step["screenshot_data"]))
                                except: pass

                            if step.get("status") == "Completed":
                                ai_passed = True
                        
                        if ai_passed:
                            log("--- AI Autonomous Testing SUCCEEDED. Goal achieved. ---")
                            overall_status = "passed"
                        else:
                            log("--- AI Autonomous Testing FAILED. ---", "ERROR")
                    except Exception as ai_e:
                        log(f"AI Fallback Error: {str(ai_e)}", "ERROR")

                # --- OUTSIDE RETRY & FALLBACK LOOP ---
                # Final History Save (Keep results of the last/successful attempt)
                duration_str = f"{round(asyncio.get_event_loop().time() - start_time, 1)}s"
                _save_history_record(
                    overall_status, 
                    None if overall_status=="passed" else "Step failure", 
                    step_results, 
                    duration=duration_str,
                    execution_logs=execution_logs
                )
                # FINAL COMPLETION SIGNAL (after history is saved and stats updated)
                with open(exit_code_file, "w") as ef:
                    ef.write("0" if overall_status == "passed" else "1")

        except Exception as e:
            print(f"Error in step run task: {e}")

    def _save_history_record(status, failure_reason, steps_data, duration="0s", execution_logs=[]):
        from app.db.session import SessionLocal
        from datetime import datetime, timezone
        import uuid
        db_history = SessionLocal()
        try:
            # Skip DB persistence for ad-hoc runs (e.g. from Step Flow Inspector)
            is_adhoc = not request.script_id or request.script_id == "adhoc_run"
            
            if not is_adhoc:
                h_id = str(uuid.uuid4())
                new_history = TestHistory(
                    id=h_id,
                    project_id=request.project_id,
                    script_id=request.script_id,
                    script_name=request.script_name or f"Asset Run ({request.project_id})",
                    status=status,
                    duration=duration,
                    failure_reason=failure_reason,
                    trigger=request.trigger,
                    persona_name=request.persona_name,
                    step_results=steps_data,
                    logs=execution_logs,
                    run_date=datetime.now(timezone.utc)
                )
                db_history.add(new_history)
                db_history.commit()
                print(f"DEBUG: Saved history record {h_id} for run {run_id}")
            else:
                print(f"DEBUG: Skipping history persistence for ad-hoc run {run_id}")

            # Update Script stats
            script_id = request.script_id
            if not is_adhoc:
                from app.models.test import TestScript
                script = db_history.query(TestScript).filter(TestScript.id == script_id).first()
                
                if script:
                    # Calculate new stats
                    total_runs = db_history.query(TestHistory).filter(TestHistory.script_id == script_id).count()
                    passed_runs = db_history.query(TestHistory).filter(
                        TestHistory.script_id == script_id,
                        TestHistory.status == "passed"
                    ).count()
                    
                    print(f"DEBUG: STATS_CALC [{script_id}] total={total_runs}, passed={passed_runs}")
                    script.run_count = total_runs
                    script.success_rate = round((passed_runs / total_runs) * 100, 1) if total_runs > 0 else 0
                    script.last_run = datetime.now(timezone.utc)
                        
                    db_history.commit()
                    print(f"DEBUG: STATS_UPDATE_SUCCESS [{script_id}] total={total_runs}, passed={passed_runs}, rate={script.success_rate}%")

        except Exception as e:
            print(f"Failed to save history or update stats: {e}")
            db_history.rollback()
        finally:
            db_history.close()

    asyncio.create_task(run_task())
    return DryRunResponse(run_id=run_id)

@router.websocket("/ws/{run_id}")
async def websocket_endpoint(websocket: WebSocket, run_id: str):
    await websocket.accept()
    run_dir = RUNS_DIR / run_id
    
    if not run_dir.exists():
        await websocket.close(code=4004, reason="Run ID not found")
        return

    log_file = run_dir / "output.log"
    img_file = run_dir / "latest.jpg"
    
    # Wait for log file to appear
    retries = 0
    while not log_file.exists():
        if retries > 20: # 2 seconds
             await websocket.send_json({"type": "log", "data": "Waiting for process start..."})
        await asyncio.sleep(0.1)
        retries += 1

    offset = 0
    last_img_mtime = 0
    
    status_sent = False
    
    try:
        while True:
            # 1. Read Logs
            if log_file.exists():
                with open(log_file, "r", encoding="utf-8", errors="ignore") as f:
                    f.seek(offset)
                    new_lines = f.read()
                    if new_lines:
                        offset = f.tell()
                        await websocket.send_json({"type": "log", "data": new_lines})
            
            # 2. Read Image (Screen Stream)
            if img_file.exists():
                mtime = os.path.getmtime(img_file)
                if mtime > last_img_mtime:
                    last_img_mtime = mtime
                    try:
                        with open(img_file, "rb") as f:
                            img_data = f.read()
                            b64 = base64.b64encode(img_data).decode("utf-8")
                            await websocket.send_json({"type": "screen", "data": b64})
                    except:
                        pass # Ignore read errors during write
            
            # Check for exit code
            exit_code_file = run_dir / "exit_code.txt"
            if not status_sent and exit_code_file.exists():
                try:
                    content = exit_code_file.read_text().strip()
                    if content:
                        code = int(content)
                        status = "success" if code == 0 else "error"
                        print(f"DEBUG WS: Found exit code {code}, sending status {status}")
                        await websocket.send_json({"type": "status", "data": status})
                        status_sent = True
                    else:
                        print(f"DEBUG WS: exit_code.txt exists but empty")
                except Exception as e:
                    print(f"DEBUG WS: Failed to read exit_code.txt: {e}")
                    # Keep trying in next loop iteration
                    pass

            await asyncio.sleep(0.1)
            
    except WebSocketDisconnect:
        print(f"DEBUG WS: Client disconnected from run {run_id} (Connection closed)")
        # Do NOT terminate run here. Let it finish in background.
        # This handles page refreshes or Strict Mode double-mounts gracefully.
    except Exception as e:
        print(f"WS Error: {e}")
    finally:
        print(f"DEBUG WS: WebSocket handler finished for {run_id}")
        # runner_service.terminate_run(run_id) <-- REMOVED to prevent killing tests on disconnect
