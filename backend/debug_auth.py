import requests

BASE_URL = "http://localhost:8001/api/v1"

def debug_auth(email, password):
    # 1. Login
    resp = requests.post(f"{BASE_URL}/login/access-token", data={"username": email, "password": password})
    if resp.status_code != 200:
        print(f"Login failed for {email}: {resp.text}")
        return

    token = resp.json()["access_token"]
    print(f"Login success for {email}. Token obtained.")

    # 2. Me
    headers = {"Authorization": f"Bearer {token}"}
    me_resp = requests.get(f"{BASE_URL}/users/me", headers=headers)
    if me_resp.status_code != 200:
         print(f"Me failed: {me_resp.text}")
         return
    
    data = me_resp.json()
    print(f"User Data for {email}:")
    print(f"  ID: {data.get('id')}")
    print(f"  Role: {data.get('role')}")
    print(f"  SuperAdmin (DB field): {data.get('is_saas_super_admin')}")

if __name__ == "__main__":
    print("--- Debugging admin@skt.ai ---")
    debug_auth("admin@skt.ai", "password12")
    print("\n--- Debugging admin@qone.ai ---")
    debug_auth("admin@qone.ai", "password12")
