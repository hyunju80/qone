import requests
import sys

API_URL = "http://127.0.0.1:8001/api/v1"

def test_login():
    print(f"Testing Login API at {API_URL}...")
    try:
        # 1. Health Check
        print("Checking /health...")
        try:
            r = requests.get("http://127.0.0.1:8001/health", timeout=2)
            print(f"Health Status: {r.status_code} - {r.text}")
        except Exception as e:
            print(f"Health Check Failed: {e}")
            return

        # 2. Login
        print("Attempting Login...")
        payload = {
            "username": "admin@qone.ai",
            "password": "password12"
        }
        r = requests.post(f"{API_URL}/login/access-token", data=payload, timeout=5)
        
        print(f"Login Status: {r.status_code}")
        if r.status_code == 200:
            print("Login Success!")
            print(r.json())
        else:
            print(f"Login Failed: {r.text}")
            
    except Exception as e:
        print(f"Fatal Error: {e}")

if __name__ == "__main__":
    test_login()
