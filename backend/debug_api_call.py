import requests
import json

BASE_URL = "http://127.0.0.1:8001/api/v1"
EMAIL = "admin@qone.ai"
PASSWORD = "password12"

def main():
    session = requests.Session()
    
    # 1. Login
    print("Logging in...")
    try:
        resp = session.post(f"{BASE_URL}/login/access-token", data={"username": EMAIL, "password": PASSWORD})
        if resp.status_code != 200:
            print(f"Login failed: {resp.text}")
            return
        
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("Login success.")
    except Exception as e:
        print(f"Login connection error: {e}")
        return

    # 2. Get Projects
    print("Fetching Projects...")
    resp = session.get(f"{BASE_URL}/projects/", headers=headers)
    if resp.status_code != 200:
        print(f"Get Projects failed: {resp.text}")
        return
    
    projects = resp.json()
    print(f"Found {len(projects)} projects.")
    
    if not projects:
        print("No projects found.")
        return

    # 3. Get History for each project
    for p in projects:
        pid = p['id']
        pname = p['name']
        print(f"\nChecking History for Project: {pname} ({pid})")
        
        resp = session.get(f"{BASE_URL}/history/", headers=headers, params={"project_id": pid})
        if resp.status_code == 200:
            history = resp.json()
            print(f"  -> Found {len(history)} history records.")
            if history:
                 print(f"  -> Sample: {history[0]['id']} / {history[0]['status']}")
        else:
            print(f"  -> Failed to fetch history: {resp.status_code} {resp.text}")

if __name__ == "__main__":
    main()
