import os
import shutil
import subprocess
import uuid
import asyncio
import tempfile
from pathlib import Path
import sys

# Use system temp directory to avoid triggering Uvicorn reloads
RUNS_DIR = Path(tempfile.gettempdir()) / "qone_runs"
RUNS_DIR.mkdir(exist_ok=True)

CONFTEST_CONTENT = """
import pytest
import base64
import os
import json

@pytest.fixture(scope="function", autouse=True)
def setup_screencast(page):
    # Create CDP Session for low-level access
    try:
        client = page.context.new_cdp_session(page)
        client.send("Page.startScreencast", {"format": "jpeg", "quality": 60, "everyNthFrame": 1})
        
        def on_screencast_frame(event):
            try:
                data = event.get("data")
                metadata = event.get("metadata", {})
                session_id = event.get("sessionId")
                
                # Write to latest.jpg for the runner to pick up
                if data:
                    with open("latest.jpg.tmp", "wb") as f:
                        f.write(base64.b64decode(data))
                    os.replace("latest.jpg.tmp", "latest.jpg")
                
                # Acknowledge frame
                client.send("Page.screencastFrameAck", {"sessionId": session_id})
            except Exception as e:
                pass # Ignore write errors during race conditions

        client.on("Page.screencastFrame", on_screencast_frame)
        print("CDP Screencast started.")
    except Exception as e:
        print(f"Failed to start screencast: {e}")
        
    yield
"""

class TestRunner:
    def execute_dry_run(self, code: str) -> str:
        run_id = str(uuid.uuid4())
        run_dir = RUNS_DIR / run_id
        run_dir.mkdir()

        # 1. Write Test File
        # Ensure code has necessary imports
        final_code = code
        if "import pytest" not in code:
            final_code = "import pytest\n" + final_code
        if "from playwright.sync_api" not in code and "async_api" not in code:
             # Basic playwright import might be needed if user code doesn't have it
             final_code = "from playwright.sync_api import Page, expect\n" + final_code

        (run_dir / "test_script.py").write_text(final_code, encoding="utf-8")
        
        # 2. Write conftest.py for Screencast
        (run_dir / "conftest.py").write_text(CONFTEST_CONTENT, encoding="utf-8")
        
        # 3. Start Subprocess (Async wrapper needed later, but here we just launch)
        # We don't wait for completion here if we want streaming?
        # Actually, for the API "start" endpoint, we just return the ID.
        # The background worker or valid polling triggers execution.
        # But to keep it simple, let's launch a background task or just assume
        # the WS connection will drive it?
        # Better: Launch process immediately, output to log file.
        
        # Prepare wrapper script to capture exit code
        wrapper_content = f"""
import subprocess
import sys
import os

# Ensure UTF-8 for subprocess
os.environ["PYTHONIOENCODING"] = "utf-8"
os.environ["PYTHONUTF8"] = "1"

cmd = [sys.executable, "-m", "pytest", "test_script.py", "--slowmo=1000"]

# Open log file in write mode
try:
    with open("output.log", "w", encoding="utf-8") as log_file:
        try:
            # Run pytest with timeout to prevent hanging processes
            result = subprocess.run(cmd, stdout=log_file, stderr=subprocess.STDOUT, text=True, timeout=600)
            return_code = result.returncode
        except subprocess.TimeoutExpired:
            log_file.write("\\n\\n[Runner Error] Execution timed out after 600s.\\n")
            return_code = 124
        except Exception as e:
            log_file.write(f"\\n\\n[Runner Error] Subprocess failed: {{e}}\\n")
            return_code = 1

    # Write exit code
    try:
        with open("exit_code.txt", "w") as f:
            f.write(str(return_code))
    except Exception as e:
        # If exit_code fails, append to log so frontend sees it (though frontend relies on exit_code.txt...)
        with open("output.log", "a", encoding="utf-8") as log_file:
            log_file.write(f"\\n\\n[Runner System Error] Failed to write exit code: {{e}}\\n")
            
except Exception as outer_e:
    # Catastrophic failure of wrapper
    with open("output.log", "a", encoding="utf-8") as log_file:
        log_file.write(f"\\n\\n[Runner Critical Failure] Wrapper crashed: {{outer_e}}\\n")
    # Try to write error code anyway
    try:
        with open("exit_code.txt", "w") as f:
            f.write("1")
    except:
        pass
"""
        (run_dir / "run_wrapper.py").write_text(wrapper_content, encoding="utf-8")

        # Prepare environment with UTF-8 enforcement for Windows
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        env["PYTHONUTF8"] = "1"

        # Launch the wrapper
        # We don't need to redirect stdout here because the wrapper handles it internally for the inner process
        # But we might want to catch wrapper errors?
        # For simplicity, let's just run it.
        cmd = [sys.executable, "run_wrapper.py"]

        process = subprocess.Popen(
            cmd,
            cwd=str(run_dir),
            text=True,
            env=env
        )
        
        # Save PID to allow stopping?
        (run_dir / "pid").write_text(str(process.pid))
        
        return run_id

    def terminate_run(self, run_id: str):
        run_dir = RUNS_DIR / run_id
        pid_file = run_dir / "pid"
        if pid_file.exists():
            try:
                pid = int(pid_file.read_text())
                import signal
                os.kill(pid, signal.SIGTERM) 
                print(f"Terminated process {pid} for run {run_id}")
            except Exception as e:
                print(f"Failed to terminate run {run_id}: {e}")

    def run_script(self, script) -> dict:
        """
        Synchronously run a script and return the report.
        Used by the Scheduler.
        """
        import time
        import asyncio
        import base64
        
        if getattr(script, 'origin', '') == 'STEP' and getattr(script, 'steps', []):
            return self._run_steps_headless(script)
        
        run_id = str(uuid.uuid4())
        run_dir = RUNS_DIR / run_id
        run_dir.mkdir()
        
        # Prepare Code
        code = script.code
        if "import pytest" not in code:
            code = "import pytest\n" + code
        if "from playwright.sync_api" not in code and "async_api" not in code:
            code = "from playwright.sync_api import Page, expect\n" + code
            
        (run_dir / "test_script.py").write_text(code, encoding="utf-8")
        
        # We don't need screencast for scheduled runs usually, but good for debugging artifacts
        # For now, skip screencast to save overhead or keep it if needed. 
        # let's keep it simple.
        
        start_time = time.time()
        
        # Run Pytest
        cmd = [sys.executable, "-m", "pytest", "test_script.py"]
        
        # Env
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        
        try:
            result = subprocess.run(
                cmd, 
                cwd=str(run_dir), 
                capture_output=True, 
                text=True, 
                env=env,
                timeout=300 # 5 min timeout
            )
            duration = time.time() - start_time
            passed = result.returncode == 0
            
            logs = []
            if result.stdout:
                logs.append({"msg": result.stdout, "type": "info"})
            if result.stderr:
                logs.append({"msg": result.stderr, "type": "error"})
                
            return {
                "passed": passed,
                "duration": f"{duration:.2f}s",
                "logs": logs,
                "error": None if passed else "Test Executed with Failures"
            }
            
        except subprocess.TimeoutExpired:
            return {
                "passed": False,
                "duration": "300s+",
                "logs": [{"msg": "Execution Timed Out", "type": "error"}],
                "error": "Timeout"
            }
        except Exception as e:
            return {
                "passed": False,
                "duration": "0s",
                "logs": [{"msg": str(e), "type": "error"}],
                "error": str(e),
                "step_results": []
            }

    def _run_steps_headless(self, script) -> dict:
        import time
        import asyncio
        import base64
        
        start_time = time.time()
        logs = []
        step_results = []
        passed = True
        error_msg = None
        
        def log(msg, level="info"):
            logs.append({"msg": msg, "type": level})

        async def _execute():
            nonlocal passed, error_msg
            runner = None
            is_web = script.platform.upper() == 'WEB'
            
            try:
                if is_web:
                    from app.services.web_runner import WebStepRunner
                    runner = WebStepRunner()
                    success, err = await runner.start_session()
                else:
                    from app.services.app_runner import AppStepRunner
                    runner = AppStepRunner()
                    
                    from app.db.session import SessionLocal
                    db_session = SessionLocal()
                    mobile_config = {}
                    device_id = "DefaultDevice"
                    try:
                        from app.models.project import Project
                        from app.models.device import Device
                        proj = db_session.query(Project).filter(Project.id == getattr(script, 'project_id', None)).first()
                        if proj and proj.mobile_config:
                            mobile_config = proj.mobile_config
                            
                        # Try to find a connected device live
                        from app.services.device_service import device_service
                        connected_devices = device_service.get_connected_devices()
                        if connected_devices:
                            device_id = connected_devices[0]["id"]
                        else:
                            dev = db_session.query(Device).filter(Device.status == "connected").first()
                            if dev:
                                device_id = dev.id
                    finally:
                        db_session.close()
                        
                    caps = {
                        "platformName": "Android",
                        "automationName": "UiAutomator2",
                        "deviceName": device_id,
                        "udid": device_id,
                    }
                    for k, v in mobile_config.items():
                        if not k.startswith("appium:"):
                            caps[f"appium:{k}"] = v
                        else:
                            caps[k] = v
                            
                    success, err = runner.start_session(caps)
                
                if not success:
                    passed = False
                    error_msg = f"Setup Failed: {err}"
                    log(error_msg, "error")
                    return
                
                log(f"Session established successfully for {script.name}.")
                
                for i, step in enumerate(script.steps):
                    step_name = step.get("stepName") or step.get("name") or step.get("action")
                    action = step.get("action")
                    target = step.get("selectorValue") or step.get("selector_value") or step.get("target")
                    value = step.get("option")
                    
                    log(f"Step {i+1}: [{action}] target={target} value={value}")
                    
                    # Ensure DB dependency if needed for mobile execution
                    if not is_web:
                        from app.db.session import SessionLocal
                        db_session = SessionLocal()
                    else:
                        db_session = None

                    step_start = time.time()
                    try:
                        if is_web:
                            res = await runner.execute_step(step)
                        else:
                            res = runner.execute_step(step, db=db_session)
                    finally:
                        if db_session: db_session.close()
                        
                    step_end = time.time()
                    
                    # Capture screenshot
                    screen_data = None
                    should_capture = step.get("screenshot") is True or not res["success"]
                    if should_capture:
                        try:
                            if is_web:
                                screen_data = await runner.get_screenshot()
                            else:
                                screen_data = runner.get_screenshot()
                        except:
                            pass

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
                        log(f"Step {i+1} FAILED: {res.get('error')}", "error")
                        passed = False
                        error_msg = res.get('error')
                        break
                        
                    log(f"Step {i+1} PASSED ({round(step_end - step_start, 1)}s)")

            except Exception as ex:
                passed = False
                error_msg = str(ex)
                log(f"Fatal error during step execution: {ex}", "error")
            finally:
                if runner:
                    if is_web:
                        await runner.stop_session()
                    else:
                        runner.stop_session()
                        
        asyncio.run(_execute())
        
        duration = time.time() - start_time
        return {
            "passed": passed,
            "duration": f"{duration:.2f}s",
            "logs": logs,
            "error": error_msg,
            "step_results": step_results
        }

runner_service = TestRunner()
