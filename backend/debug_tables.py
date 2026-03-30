import sys
import os

sys.path.append(os.getcwd())

import app.models
from app.db.base import Base
from app.db.session import engine

def debug_tables():
    print("Models found in metadata:")
    for table in Base.metadata.tables.keys():
        print(f" - {table}")
    
    try:
        print("\nAttempting create_all...")
        Base.metadata.create_all(bind=engine)
        print("Done.")
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_tables()
