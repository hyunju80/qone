import sys
import os
import traceback
from sqlalchemy.orm import configure_mappers

# Ensure current directory is in path
sys.path.append(os.getcwd())

try:
    print("Importing app.db.base...")
    from app.db.base import Base
    print("Base imported. Triggering mapper configuration...")
    configure_mappers()
    print("SUCCESS: Mappers configured successfully.")
except Exception as e:
    print(f"FAILED: {e}")
    traceback.print_exc()
    sys.exit(1)
