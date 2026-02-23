
try:
    from google import genai
    print("SUCCESS: google.genai imported")
except ImportError as e:
    print(f"ERROR: {e}")
except Exception as e:
    print(f"ERROR: {e}")
