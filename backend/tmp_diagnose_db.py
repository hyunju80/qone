from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
import sys

# Add project path to sys.path
sys.path.append(os.path.abspath("backend"))

from app.models.test import TestScript, TestHistory

def diagnose():
    engine = create_engine("postgresql://postgres:password@localhost/qone")
    Session = sessionmaker(bind=engine)
    db = Session()
    
    print("--- Diagnostic: Failed Histories with AI Support ---")
    
    # Check total history
    total_failed = db.query(TestHistory).filter(TestHistory.status == "failed").count()
    print(f"Total failed histories: {total_failed}")
    
    # Check histories joined with scripts
    joined = db.query(TestHistory).join(TestScript).filter(
        TestHistory.status == "failed"
    ).all()
    print(f"Failed histories with linked scripts: {len(joined)}")
    
    # Details of top 10 failed histories
    latest_failures = db.query(TestHistory).filter(TestHistory.status == "failed").order_by(TestHistory.run_date.desc()).limit(10).all()
    for h in latest_failures:
        script = db.query(TestScript).filter(TestScript.id == h.script_id).first()
        print(f"ID: {h.id} | Script: {h.scriptName} (ID: {h.script_id}) | Project: {h.project_id}")
        if script:
            print(f"  > Script found. enable_ai_test: {script.enable_ai_test} | script_project: {script.projectId}")
        else:
            print(f"  > No script found for ID {h.script_id}")

    # Check for the specific project from screenshot (likely 'TMEMBERSHIP' or similar)
    # The screenshot shows "PROJECT: TMEMBERSHIP"
    # Search for project with name containing membership
    # Actually let's just list all projects in histories
    projects = db.query(TestHistory.project_id).distinct().all()
    print(f"Active project IDs in history: {[p[0] for p in projects]}")

    db.close()

if __name__ == "__main__":
    diagnose()
