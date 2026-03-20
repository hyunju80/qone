import os
import sys

# Add the current directory and backend to sys.path
sys.path.append(os.getcwd())
if os.path.basename(os.getcwd()) != 'backend':
    sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from app.core.config import settings
    print(f"DEBUG: GOOGLE_API_KEY value: '{settings.GOOGLE_API_KEY[:5]}...' if settings.GOOGLE_API_KEY else 'EMPTY'")
    print(f"DEBUG: GOOGLE_API_KEY length: {len(settings.GOOGLE_API_KEY)}")
    print(f"DEBUG: CWD: {os.getcwd()}")
    print(f"DEBUG: .env exists in CWD: {os.path.exists('.env')}")
except Exception as e:
    print(f"DEBUG: Error importing settings: {e}")
