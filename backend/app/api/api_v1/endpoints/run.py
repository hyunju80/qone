from typing import Any, List, Dict, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends, BackgroundTasks
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
import json
import uuid
from datetime import datetime, timezone
from app.models.project import Project
from app.models.test import TestHistory, TestScript, SelfHealingLog
from app.api import deps
from sqlalchemy.orm import Session
# from fastapi import Depends (Moved to top)
from app.services.fallback_service import fallback_service

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
            from app.services.ai_analysis_service import ai_analysis_service
            
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

                # AI Failure Analysis
                if status == "failed":
                    try:
                        screenshot_b64 = None
                        screenshot_path = run_dir / "latest.jpg"
                        if screenshot_path.exists():
                            with open(screenshot_path, "rb") as sf:
                                screenshot_b64 = base64.b64encode(sf.read()).decode("utf-8")
                        
                        analysis = await ai_analysis_service.analyze_failure(
                            logs=execution_logs,
                            screenshot_b64=screenshot_b64,
                            platform="WEB",
                            script_name=request.script_name or "Dry Run",
                            failure_reason=error_msg or "Execution Failure"
                        )
                        new_history.failure_analysis = analysis
                    except Exception as ai_e:
                        print(f"AI Analysis failed for dry-run: {ai_e}")

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

        # Resolve target_url for potential AI Fallback
        target_url = None
        if request.platform.upper() == "WEB":
            if request.steps:
                for step in request.steps:
                    if step.get("action") == "navigate":
                        target_url = step.get("inputValue") or step.get("option")
                        break
            if not target_url and request.script_id:
                # Fallback to scenario target or project envs (logic similar to self-heal)
                db_tmp = SessionLocal()
                try:
                    from app.models.test import Scenario, TestScript
                    from app.models.project import Project
                    script_tmp = db_tmp.query(TestScript).filter(TestScript.id == request.script_id).first()
                    if script_tmp:
                        scenario_tmp = db_tmp.query(Scenario).filter(Scenario.golden_script_id == script_tmp.id).first()
                        if scenario_tmp and scenario_tmp.target and scenario_tmp.target.startswith("http"):
                            target_url = scenario_tmp.target
                        if not target_url:
                            proj_tmp = db_tmp.query(Project).filter(Project.id == script_tmp.project_id).first()
                            if proj_tmp and proj_tmp.environments:
                                envs = proj_tmp.environments
                                target_url = envs.get("Prod") or envs.get("Stage") or envs.get("Dev") or (list(envs.values())[0] if envs else None)
                finally:
                    db_tmp.close()

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
                                await _save_history_record(overall_status, "Setup Failure: " + str(err), step_results, execution_logs=execution_logs)
                                with open(exit_code_file, "w") as ef: ef.write("1")
                                return
                            log("Appium session established successfully.")
                        else:
                            log(f"Starting WEB execution for project {request.project_id}...")
                            success, err = await web_step_runner.start_session()
                            if not success:
                                log(f"Failed to start Playwright session: {err}", "ERROR")
                                overall_status = "failed"
                                await _save_history_record(overall_status, "Setup Failure: " + str(err), step_results, execution_logs=execution_logs)
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
                # DISABLED: Self-healing should be triggered manually from Defect Management
                """
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
                            initial_url=target_url, # Pass the resolved target URL
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
                """

                # --- OUTSIDE RETRY & FALLBACK LOOP ---
                # Final History Save (Keep results of the last/successful attempt)
                duration_str = f"{round(asyncio.get_event_loop().time() - start_time, 1)}s"
                await _save_history_record(
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

    async def _save_history_record(status, failure_reason, steps_data, duration="0s", execution_logs=[]):
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
                    run_id=run_id,
                    run_date=datetime.now(timezone.utc)
                )

                # AI Failure Analysis
                if status == "failed":
                    try:
                        from app.services.ai_analysis_service import ai_analysis_service
                        screenshot_b64 = None
                        if steps_data:
                            for step_res in reversed(steps_data):
                                if step_res.get("screenshot_data"):
                                    screenshot_b64 = step_res["screenshot_data"]
                                    break
                        
                        if not screenshot_b64:
                            img_file = RUNS_DIR / run_id / "latest.jpg"
                            if img_file.exists():
                                with open(img_file, "rb") as sf:
                                    screenshot_b64 = base64.b64encode(sf.read()).decode("utf-8")

                        analysis = await ai_analysis_service.analyze_failure(
                            logs=execution_logs,
                            screenshot_b64=screenshot_b64,
                            platform=request.platform,
                            script_name=request.script_name or f"Asset Run ({request.project_id})",
                            failure_reason=failure_reason or "Step Failure"
                        )
                        new_history.failure_analysis = analysis
                    except Exception as ai_e:
                        print(f"AI Analysis failed for run {run_id}: {ai_e}")

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

@router.get("/status/{run_id}", response_model=Dict[str, Any])
async def get_run_status(run_id: str):
    """
    Check the current status of a run by monitoring exit_code.txt
    """
    run_dir = RUNS_DIR / run_id
    if not run_dir.exists():
        raise HTTPException(status_code=404, detail="Run not found")
    
    exit_code_file = run_dir / "exit_code.txt"
    log_file = run_dir / "output.log"
    
    status = "running"
    exit_code = None
    
    if exit_code_file.exists():
        try:
            content = exit_code_file.read_text().strip()
            if content:
                exit_code = int(content)
                status = "success" if exit_code == 0 else "failed"
        except:
            pass

    return {
        "run_id": run_id,
        "status": status,
        "exit_code": exit_code,
        "log_exists": log_file.exists()
    }

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
                        try:
                            await websocket.send_json({"type": "status", "data": status})
                            status_sent = True
                            await asyncio.sleep(0.5) # Give it time to flush
                            break # EXIT LOOP AFTER FINAL STATUS
                        except:
                            print("DEBUG WS: Failed to send final status, connection likely closed.")
                            break
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
@router.post("/retry/{history_id}", response_model=DryRunResponse)
async def retry_run(
    history_id: str,
    db: Session = Depends(deps.get_db)
):
    """
    Retry a specific test run from history.
    """
    history = db.query(TestHistory).filter(TestHistory.id == history_id).first()
    if not history:
        raise HTTPException(status_code=404, detail="History not found")
    
    script = db.query(TestScript).filter(TestScript.id == history.script_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")
        
    # Prepare RunStepsRequest similar to active-steps
    request = RunStepsRequest(
        steps=script.steps,
        project_id=script.project_id,
        platform=script.platform or "Android",
        script_id=script.id,
        script_name=script.name,
        trigger="manual",
        persona_name=history.persona_name or "Default",
        capture_screenshots=script.capture_screenshots or False,
        dataset=script.dataset,
        try_count=script.try_count or 1,
        enable_ai_test=script.enable_ai_test or False
    )
    
    return await start_active_steps_run(request, db)

@router.post("/self-heal/{history_id}", response_model=Dict[str, Any])
async def self_heal_run(
    history_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(deps.get_db)
):
    """
    Trigger autonomous self-healing for a failed test.
    """
    history = db.query(TestHistory).filter(TestHistory.id == history_id).first()
    if not history:
        raise HTTPException(status_code=404, detail="History not found")
        
    script = db.query(TestScript).filter(TestScript.id == history.script_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")
        
    # 1. Create Log Entry
    log_id = str(uuid.uuid4())
    new_log = SelfHealingLog(
        id=log_id,
        history_id=history_id,
        script_id=script.id,
        status="started",
        error_detected=history.failure_reason
    )
    db.add(new_log)
    db.commit()
    
    # 2. Run Fallback Service as a Background Task
    async def run_healing():
        h_session = SessionLocal()
        try:
            # Determine Goal: Achive the result of the script
            goal = f"Successfully execute the test script: {script.name}. {script.description or ''}"
            
            # Extract target from script if available
            target_url = None
            if script.platform == "WEB":
                if script.steps:
                    # Often first step is 'navigate' or similar
                    for step in script.steps:
                        if step.get("action") == "navigate":
                            target_url = step.get("inputValue") or step.get("option")
                            break
                
                # If still no URL, check associated scenario
                if not target_url:
                    from app.models.test import Scenario
                    scenario = h_session.query(Scenario).filter(Scenario.golden_script_id == script.id).first()
                    if scenario and scenario.target and scenario.target.startswith("http"):
                        target_url = scenario.target
                
                # If still no URL, check project settings
                if not target_url and project:
                    envs = project.environments or {}
                    # Try to get Prod or just first value
                    target_url = envs.get("Prod") or envs.get("Stage") or envs.get("Dev") or (list(envs.values())[0] if envs else None)
            
            print(f"DEBUG: Self-healing resolved target_url: {target_url}")
            
            # Execute Autonomous Fallback
            results = await fallback_service.run_ai_fallback(
                platform=script.platform or "WEB",
                goal=goal,
                initial_url=target_url,
                max_steps=15,
                failure_analysis=history.failure_analysis,
                original_steps=script.steps
            )
            
            final_status = "failed"
            modified_steps = []
            if results and results[-1].get("status") == "Completed":
                final_status = "success"
                
                # 1. Always prepend the initial navigation step to ensure script integrity
                if target_url:
                    modified_steps.append({
                        "id": str(uuid.uuid4()),
                        "stepName": "Initial Navigation",
                        "action": "navigate",
                        "selectorType": "",
                        "selectorValue": "",
                        "inputValue": target_url,
                        "description": f"Navigate to {target_url}",
                        "assertText": ""
                    })
                
                # Update script immediately if navigate was the only thing? 
                # No, wait for AI results.

                # 2. Convert fallback results to TestScript steps
                for res in results:
                    # Skip if the AI suggested a navigate to the same initial URL (to avoid duplicates)
                    if res.get("action_type") == "navigate" and res.get("action_value") == target_url:
                        continue
                        
                    # Determine selector type
                    s_target = res.get("action_target") or ""
                    s_type = ""
                    if s_target:
                        if s_target.startswith("/") or s_target.startswith("("): s_type = "XPATH"
                        elif "." in s_target or "#" in s_target or "[" in s_target: s_type = "CSS"
                        else: s_type = "ID"

                    modified_steps.append({
                        "id": str(uuid.uuid4()),
                        "stepName": res.get("description", "AI Step"),
                        "action": res.get("action_type"),
                        "selectorType": s_type,
                        "selectorValue": s_target,
                        "inputValue": res.get("action_value", ""),
                        "description": res.get("thought", ""),
                        "assertText": res.get("assert_text", "")
                    })
                
                # Update the original script with healed steps
                orig_script = h_session.query(TestScript).filter(TestScript.id == script.id).first()
                if orig_script:
                    orig_script.steps = modified_steps
                    h_session.add(orig_script)
                    h_session.commit()
                    h_session.refresh(orig_script)
                    print(f"DEBUG: Script {script.id} updated with {len(modified_steps)} healed steps.")

            # Update Log
            healing_log = h_session.query(SelfHealingLog).filter(SelfHealingLog.id == log_id).first()
            if healing_log:
                healing_log.status = final_status
                healing_log.healing_steps = results
                healing_log.modified_steps = modified_steps
                h_session.add(healing_log)
                h_session.commit()
                print(f"DEBUG: Healing log {log_id} updated with status {final_status}.")
                
        except Exception as e:
            print(f"Self-healing error: {e}")
            healing_log = h_session.query(SelfHealingLog).filter(SelfHealingLog.id == log_id).first()
            if healing_log:
                healing_log.status = "failed"
                h_session.commit()
        finally:
            h_session.close()

    from app.db.session import SessionLocal
    background_tasks.add_task(run_healing)
    
    return {"status": "started", "log_id": log_id}
