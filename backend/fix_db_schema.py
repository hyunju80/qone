import os
import sys

# Add backend directory to sys.path
sys.path.append(os.getcwd())

from app.db.session import SessionLocal, engine
from sqlalchemy import text, inspect

def fix_schema():
    print("Checking DB Schema...")
    inspector = inspect(engine)
    
    # 1. Check Scenario table
    columns = [c['name'] for c in inspector.get_columns('scenario')]
    print(f"Scenario Columns: {columns}")
    
    if 'golden_script_id' not in columns:
        print("Missing 'golden_script_id' in scenario table. Adding it...")
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE scenario ADD COLUMN golden_script_id VARCHAR"))
            conn.execute(text("ALTER TABLE scenario ADD CONSTRAINT fk_scenario_testscript FOREIGN KEY (golden_script_id) REFERENCES testscript(id)"))
            conn.commit()
        print("Added 'golden_script_id'.")
    else:
        print("'golden_script_id' exists.")

    # 2. Check if is_approved exists
    if 'is_approved' not in columns:
        print("Missing 'is_approved' in scenario table. Adding it...")
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE scenario ADD COLUMN is_approved BOOLEAN DEFAULT FALSE"))
            conn.commit()
        print("Added 'is_approved'.")
    else:
        print("'is_approved' exists.")

    # 3. Check TestScript Platform
    ts_columns = [c['name'] for c in inspector.get_columns('testscript')]
    if 'platform' not in ts_columns:
        print("Missing 'platform' in testscript table. Adding it...")
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE testscript ADD COLUMN platform VARCHAR"))
            conn.commit()
        print("Added 'platform'.")

    # 4. Check TestStep Table
    if not inspector.has_table("teststep"):
        print("Missing 'teststep' table. Creating it...")
        # Since using Base.metadata.create_all might be tricky if mixed, let's try standard create
        from app.db.base import Base
        Base.metadata.create_all(bind=engine)
        print("Created tables (including teststep if missing).")
    else:
        print("'teststep' table exists.")

if __name__ == "__main__":
    fix_schema()
