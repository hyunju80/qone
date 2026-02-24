import sys
import os
import json
from sqlalchemy.orm import configure_mappers

# Ensure current directory is in path
sys.path.append(os.getcwd())

from app.db.base import Base
from app.db.session import SessionLocal
from app.models.test import TestScript, StepAsset, TestStep

def migrate_legacy_steps():
    configure_mappers()
    db = SessionLocal()
    try:
        # 1. Find legacy step scripts
        legacy_scripts = db.query(TestScript).filter(TestScript.origin == "STEP").all()
        print(f"Found {len(legacy_scripts)} legacy step scripts.")
        
        for script in legacy_scripts:
            # Check if already migrated (id exists in StepAsset)
            existing = db.query(StepAsset).filter(StepAsset.id == script.id).first()
            if existing:
                print(f"  - {script.name} ({script.id}) already migrated. Skipping.")
                continue
                
            print(f"  - Migrating {script.name} ({script.id})...")
            
            # Fetch steps from TestStep table
            db_steps = db.query(TestStep).filter(TestStep.script_id == script.id).order_by(TestStep.step_number).all()
            
            # Map to JSON format
            json_steps = []
            for s in db_steps:
                json_steps.append({
                    "step_number": s.step_number,
                    "action": s.action,
                    "selector_type": s.selector_type,
                    "selector_value": s.selector_value,
                    "option": s.option,
                    "step_name": s.step_name,
                    "description": s.description,
                    "mandatory": s.mandatory,
                    "skip_on_error": s.skip_on_error,
                    "screenshot": s.screenshot,
                    "sleep": s.sleep,
                    "visible_if_type": s.visible_if_type,
                    "visible_if": s.visible_if,
                    "true_jump_no": s.true_jump_no,
                    "false_jump_no": s.false_jump_no
                })
            
            # Create StepAsset
            asset = StepAsset(
                id=script.id,
                project_id=script.project_id,
                name=script.name,
                description=script.description,
                platform=script.platform or "APP",
                steps=json_steps,
                is_favorite=script.is_favorite,
                is_active=script.is_active,
                success_rate=script.success_rate,
                run_count=script.run_count,
                created_at=script.last_run # Approximate
            )
            db.add(asset)
            print(f"    -> Successfully created StepAsset with {len(json_steps)} steps.")
        
        db.commit()
        print("Migration completed successfully.")
        
    except Exception as e:
        db.rollback()
        print(f"Migration failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    migrate_legacy_steps()
