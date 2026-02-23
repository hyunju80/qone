import sys
import os
sys.path.append(os.getcwd())

from app.db.session import SessionLocal
from sqlalchemy import text

def migrate():
    db = SessionLocal()
    try:
        # Check if column exists
        check_sql = text("SELECT column_name FROM information_schema.columns WHERE table_name='aiexplorationsession' AND column_name='generated_scenario_id'")
        result = db.execute(check_sql).fetchone()
        
        if not result:
            print("Adding columns to AiExplorationSession...")
            db.execute(text("ALTER TABLE aiexplorationsession ADD COLUMN generated_scenario_id VARCHAR"))
            db.execute(text("ALTER TABLE aiexplorationsession ADD COLUMN generated_script_id VARCHAR"))
            db.commit()
            print("Migration successful.")
        else:
            print("Columns already exist. Skipping.")
            
    except Exception as e:
        print(f"Migration failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
