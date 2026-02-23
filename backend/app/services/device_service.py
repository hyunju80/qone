import subprocess
import re
from typing import List, Dict, Any, Optional

class DeviceService:
    def get_connected_devices(self) -> List[Dict[str, Any]]:
        """
        Runs 'adb devices -l' and parses the output to get connected Android devices.
        Returns a list of dicts with id, model, and other info.
        """
        try:
            # -l flag provides more details like model and product
            result = subprocess.run(['adb', 'devices', '-l'], capture_output=True, text=True, check=True)
            lines = result.stdout.strip().split('\n')
            
            devices = []
            # Skip the first line: "List of devices attached"
            for line in lines[1:]:
                if not line.strip():
                    continue
                
                # Format: "emulator-5554          device product:sdk_gphone64_arm64 model:sdk_gphone64_arm64 device:emulator64_arm64 transport_id:1"
                parts = re.split(r'\s+', line)
                if len(parts) < 2 or parts[1] != 'device':
                    continue
                
                udid = parts[0]
                device_info = {
                    "id": udid,
                    "status": parts[1],
                    "details": line
                }
                
                # Extract specific properties
                for part in parts[2:]:
                    if ':' in part:
                        key, val = part.split(':', 1)
                        device_info[key] = val
                
                # Friendly alias
                device_info["alias"] = device_info.get("model", udid)
                devices.append(device_info)
                
            return devices
        except Exception as e:
            print(f"Error listing devices: {e}")
            return []

    def get_launcher_activity(self, udid: str, package_name: str) -> Optional[str]:
        """
        Attempts to find the launcher activity for a given package on a device.
        """
        try:
            # Method 1: resolve-activity (Cleaner, works on modern Android)
            cmd = ['adb', '-s', udid, 'shell', 'cmd package resolve-activity --brief', package_name]
            result = subprocess.run(cmd, capture_output=True, text=True, check=False)
            if result.returncode == 0 and package_name in result.stdout:
                line = result.stdout.strip().split('\n')[-1]
                if '/' in line:
                    # com.example.app/.MainActivity
                    return line.split('/')[-1]

            # Method 2: Fallback to monkey (drastic but usually works)
            cmd = ['adb', '-s', udid, 'shell', 'monkey', '-p', package_name, '-c', 'android.intent.category.LAUNCHER', '-v', '0']
            result = subprocess.run(cmd, capture_output=True, text=True, check=False)
            if result.returncode == 0:
                # Look for "Using main activity com.example.app/.MainActivity"
                match = re.search(r'Using main activity ([^\s]+)', result.stdout)
                if match:
                    full_activity = match.group(1)
                    if '/' in full_activity:
                        return full_activity.split('/')[-1]
            
            return None
        except Exception as e:
            print(f"Error finding launcher activity: {e}")
            return None

device_service = DeviceService()
