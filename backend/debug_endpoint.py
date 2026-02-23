import requests
import json

def test_endpoint():
    url = "http://localhost:8001/api/v1/scenarios/analyze-url"
    payload = {"url": "https://example.com"}
    
    print(f"Sending POST to {url}...")
    try:
        response = requests.post(url, json=payload)
        
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("Response JSON:")
            print(json.dumps(response.json(), indent=2, ensure_ascii=False))
        else:
            print("Error Response:")
            print(response.text)
            
    except Exception as e:
        print(f"Request Failed: {e}")

if __name__ == "__main__":
    test_endpoint()
