import requests
import sys

# API URL
API_URL = "http://localhost:8001/api/v1"

def login(email, password):
    url = f"{API_URL}/login/access-token"
    payload = {"username": email, "password": password}
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    
    print(f"Logging in with {email}...")
    response = requests.post(url, data=payload, headers=headers)
    
    if response.status_code != 200:
        print(f"Login failed: {response.text}")
        sys.exit(1)
        
    token = response.json()["access_token"]
    print(f"Login successful. Token: {token[:10]}...")
    return token

def test_update_schedule(token):
    headers = {"Authorization": f"Bearer {token}"}
    
    # 0. Get Projects
    print("Fetching projects...")
    proj_resp = requests.get(f"{API_URL}/projects/", headers=headers)
    if proj_resp.status_code != 200:
        print("Failed to fetch projects")
        return
    projects = proj_resp.json()
    if not projects:
        print("No projects found.")
        return
    pid = projects[0]['id']
    print(f"Using Project: {pid}")

    # 1. Get Schedules
    print(f"Fetching schedules for project {pid}...")
    resp = requests.get(f"{API_URL}/schedules/?project_id={pid}", headers=headers)
    if resp.status_code != 200:
        print(f"Get failed: {resp.text}")
        sys.exit(1)
        
    schedules = resp.json()
    if not schedules:
        print("No schedules found. Creating one...")
        create_payload = {
            "name": "Test Schedule Repro",
            "project_id": pid,
            "cron_expression": "* * * * *",
            "frequency_label": "Minutely",
            "is_active": True,
            "script_ids": []
        }
        c_resp = requests.post(f"{API_URL}/schedules/", json=create_payload, headers=headers)
        if c_resp.status_code == 200:
            target = c_resp.json()
            print(f"Created schedule: {target['id']}")
        else:
            print(f"Failed to create: {c_resp.text}")
            return
    else:
        target = schedules[0]
    print(f"Found schedule: {target['id']} ({target['name']})")
    
    # 2. Update Schedule
    print(f"Updating schedule {target['id']}...")
    update_payload = {
        "name": target["name"] + " Updated",
        "is_active": not target["is_active"]
    }
    
    resp = requests.put(f"{API_URL}/schedules/{target['id']}", json=update_payload, headers=headers)
    
    if resp.status_code == 200:
        print("Update SUCCESS!")
        print(resp.json())
    else:
        print(f"Update FAILED: {resp.status_code}")
        print(resp.text)

if __name__ == "__main__":
    email = "admin@example.com" # Default admin from initial_data?
    # Or "qone-admin@q-one.com"?
    # checking debug_login_direct.py for credentials
    password = "password" 
    
    # Read credentials from debug_login_direct content if visible
    # But I see standard login usually.
    # Let's try admin@example.com / password first.
    
    token = login("admin@qone.ai", "password12")
    test_update_schedule(token)
