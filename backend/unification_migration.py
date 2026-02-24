import sys
import os
import json

sys.path.append(os.path.dirname(__file__))

from app.db.session import SessionLocal
from sqlalchemy import text

def migrate_db():
    db = SessionLocal()
    try:
        # 1. Fetch all StepAssets
        step_assets_result = db.execute(text("SELECT id, name, description, platform, steps, created_at, updated_at, is_favorite, is_active, success_rate, run_count, project_id FROM stepasset")).fetchall()
        
        # 2. Fetch all TestScripts
        test_scripts_result = db.execute(text("SELECT id, origin FROM testscript")).fetchall()
        test_script_ids = {r[0] for r in test_scripts_result}
        
        # 3. For each StepAsset, we insert or update TestScript
        for r in step_assets_result:
            sid, name, description, platform, steps, created_at, updated_at, is_fav, is_act, sr, rc, pid = r
            
            # steps is likely a JSON string or dict depending on driver. Convert to JSON string if needed.
            steps_json = str(json.dumps(steps)) if isinstance(steps, (list, dict)) else (steps or "[]")
            
            if sid in test_script_ids:
                # Update existing TestScript (it was an overlap)
                print(f"Updating overlapping TestScript ID: {sid}")
                update_query = text("""
                    UPDATE testscript 
                    SET steps = :steps, 
                        run_count = :rc, 
                        success_rate = :sr, 
                        platform = :platform 
                    WHERE id = :id
                """)
                db.execute(update_query, {"steps": steps_json, "rc": rc, "sr": sr, "platform": platform, "id": sid})
            else:
                # Insert new TestScript
                print(f"Inserting new StepAsset as TestScript ID: {sid}")
                insert_query = text("""
                    INSERT INTO testscript (id, project_id, name, description, platform, steps, is_favorite, is_active, success_rate, run_count, origin, status)
                    VALUES (:id, :pid, :name, :description, :platform, :steps, :is_fav, :is_act, :sr, :rc, 'STEP', 'CERTIFIED')
                """)
                db.execute(insert_query, {
                    "id": sid, "pid": pid, "name": name, "description": description, "platform": platform, 
                    "steps": steps_json, "is_fav": is_fav, "is_act": is_act, "sr": sr, "rc": rc
                })
        
        # 4. Drop old tables
        print("Dropping legacy 'stepasset' and 'teststep' tables...")
        db.execute(text("DROP TABLE IF EXISTS stepasset CASCADE"))
        db.execute(text("DROP TABLE IF EXISTS teststep CASCADE"))
        
        db.commit()
        print("Migration complete!")
        
    except Exception as e:
        db.rollback()
        print(f"Migration failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    migrate_db()
