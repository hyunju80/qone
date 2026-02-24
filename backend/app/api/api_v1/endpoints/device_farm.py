from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List
from app.services.device_service import device_service
from app.services.app_runner import app_step_runner
import asyncio
import subprocess

router = APIRouter()

@router.get("/devices")
async def get_devices():
    """
    Get a list of currently connected Android devices via ADB.
    Maps the ADB output to the frontend Device interface structure.
    """
    adb_devices = device_service.get_connected_devices()
    mapped_devices = []
    
    # Check if there is an active Appium session
    active_device_id = app_step_runner.current_device_id

    for dev in adb_devices:
        # device_service returns dicts with id, status, alias, model, etc.
        # adb status: 'device' means Available, 'offline' means Offline.
        status = "Available" if dev.get("status") == "device" else "Offline"
        
        # Override status if this device is currently strictly "In-Use" by our Appium runner
        if status == "Available" and active_device_id == dev["id"]:
            status = "In-Use"
        
        # Determine OS version (optional, we could fetch via getprop, but keeping it fast for now or mock if not fetched)
        os_version = "Unknown"
        cpu = "ARM"
        ram = "Unknown"
        resolution = "Unknown"
        
        # Optional: Deep dive to get actual specs per device if status is device
        if status == "Available":
             try:
                 # Fetch OS version example:
                 res = subprocess.run(['adb', '-s', dev["id"], 'shell', 'getprop', 'ro.build.version.release'], capture_output=True, text=True, timeout=2)
                 if res.returncode == 0 and res.stdout.strip():
                     os_version = f"Android {res.stdout.strip()}"
                     
                 # Fetch Resolution
                 res_wm = subprocess.run(['adb', '-s', dev["id"], 'shell', 'wm', 'size'], capture_output=True, text=True, timeout=2)
                 if res_wm.returncode == 0 and "Physical size:" in res_wm.stdout:
                     resolution = res_wm.stdout.split("Physical size:")[1].strip()
             except Exception:
                 pass
                 
        mapped_devices.append({
            "id": dev["id"],
            "alias": dev.get("alias", dev["id"]),
            "model": dev.get("model", "Android Device"),
            "os": "Android",
            "status": status,
            "protocol": "ADB",
            "currentProject": None,
            "specs": {
                "cpu": cpu,
                "ram": ram,
                "resolution": resolution,
                "osVersion": os_version
            }
        })
        
    return mapped_devices

@router.websocket("/logs/{device_id}")
async def device_logs(websocket: WebSocket, device_id: str):
    """
    WebSocket endpoint that streams adb logcat output for a specific device.
    """
    await websocket.accept()
    
    # Start logcat process
    process = None
    try:
        print(f"Starting logcat stream for device: {device_id}")
        # -v time: timestamp format
        # -T 100: show last 100 lines then follow
        process = await asyncio.create_subprocess_exec(
            'adb', '-s', device_id, 'logcat', '-v', 'time', '-T', '100',
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        # Read lines asynchronously
        while True:
            line = await process.stdout.readline()
            if not line:
                break
                
            decoded_line = line.decode('utf-8', errors='replace').strip()
            if not decoded_line:
                continue
                
            # Log format usually: 02-24 15:00:22.123 D/Tag  ( 1234): Message
            level = "INFO"
            tag = "ADB"
            msg = decoded_line
            timestamp = "00:00:00.000"
            
            # More robust parsing
            try:
                parts = decoded_line.split()
                if len(parts) >= 3 and ':' in parts[1]: # 15:00:22.123
                    timestamp = parts[1]
                    level_tag_part = parts[2]
                    if '/' in level_tag_part:
                        lvl_char = level_tag_part[0]
                        tag = level_tag_part.split('/')[1].split('(')[0] if '/' in level_tag_part else "ADB"
                        if lvl_char == 'E': level = "ERROR"
                        elif lvl_char == 'W': level = "ERROR"
                        elif lvl_char == 'D': level = "DEBUG"
                        elif lvl_char == 'I': level = "INFO"
                    
                    # Message is everything after the first 3 parts
                    # We need to find the index in original line to preserve spaces
                    # or just join parts[3:]
                    msg = " ".join(parts[3:])
            except Exception:
                # Fallback to full line if parsing crashes
                pass
            
            log_data = {
                "timestamp": timestamp,
                "level": level,
                "tag": tag[:10],
                "message": msg
            }
            
            await websocket.send_json(log_data)
            # print(f"Sent log level {level} to {device_id}")
            
    except WebSocketDisconnect:
        print(f"Client disconnected from log stream for {device_id}")
    except Exception as e:
        print(f"Error in log stream for {device_id}: {e}")
        try:
            await websocket.send_json({
                "timestamp": "System", 
                "level": "SYSTEM", 
                "tag": "ERR", 
                "message": f"Logstream error: {str(e)}"
            })
        except:
             pass
    finally:
        if process and process.returncode is None:
            process.terminate()
            try:
                await process.wait()
            except:
                pass
