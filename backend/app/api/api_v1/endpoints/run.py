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

class RunStepsRequest(BaseModel):
    steps: List[Dict[str, Any]]
    project_id: str
    device_id: Optional[str] = None
    platform: str = "Android"
    script_id: Optional[str] = None
    script_name: Optional[str] = None
    trigger: str = "manual"
    persona_name: Optional[str] = "Default"

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

        try:
            with open(log_file, "w", encoding="utf-8") as lf:
                def log(msg, level="INFO"):
                    log_line = f"[{level}] {msg}"
                    lf.write(f"{log_line}\n")
                    lf.flush()
                    execution_logs.append({"msg": msg, "type": level.lower()})

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
                    for i, step in enumerate(request.steps):
                        step_name = step.get("stepName") or step.get("name") or step.get("action")
                        action = step.get("action")
                        # Support both camelCase (from UI) and snake_case (from DB)
                        target = step.get("selectorValue") or step.get("selector_value") or step.get("target")
                        value = step.get("option")
                        
                        log_msg = f"Step {i+1}: [{action}]"
                        if target: log_msg += f" target={target}"
                        if value: log_msg += f" value={value}"
                        log(log_msg)
                        
                        step_start = asyncio.get_event_loop().time()
                        res = await runner.execute_step(step) if request.platform.upper() == "WEB" else runner.execute_step(step, db=db)
                        step_end = asyncio.get_event_loop().time()
                        
                        # Capture logic: screen option OR failure
                        should_capture = step.get("screenshot") is True or not res["success"]
                        screen_data = None
                        if should_capture:
                            screen_data = await update_screen(f"result of Step {i+1}")

                        result_entry = {
                            "step_number": i + 1,
                            "name": step_name,
                            "status": "passed" if res["success"] else "failed",
                            "duration": f"{round(step_end - step_start, 1)}s",
                            "error_message": res.get("error"),
                            "screenshot_data": screen_data,
                            "metadata": {
                                "action": action,
                                "target": target,
                                "value": value
                            }
                        }
                        step_results.append(result_entry)

                        if not res["success"]:
                            log(f"Step {i+1} FAILED: {res.get('error')}", "ERROR")
                            overall_status = "failed"
                            # with open(exit_code_file, "w") as ef: ef.write("1") <- Removed for race condition
                            break # Stop execution on failure
                        
                        log(f"Step {i+1} PASSED ({round(step_end - step_start, 1)}s)")
                        await asyncio.sleep(0.3)

                    if overall_status == "passed":
                        log("All steps completed successfully.")
                        # with open(exit_code_file, "w") as ef: ef.write("0") <- Moved to finally
                    
                    try:
                        await asyncio.sleep(0.5) # Wait for final UI transition
                        await update_screen("final state")
                    except: pass
                finally:
                    if request.platform.upper() == "WEB":
                        await web_step_runner.stop_session()
                    else:
                        app_step_runner.stop_session()
                    
                    # Final History Save
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
