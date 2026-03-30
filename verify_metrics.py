import sys
import os

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.test import TestScript, TestHistory
from datetime import datetime, timedelta

# Database URL from env or use a default if it's local
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:postgres@localhost/qone"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def verify():
    db = SessionLocal()
    try:
        # Get a project ID
        project = db.query(TestScript).first()
        if not project:
            print("No scripts found to test.")
            return
        
        project_id = project.project_id
        print(f"Verifying Summary for Project: {project_id}")
        
        # Total Assets
        total_assets = db.query(TestScript).filter(TestScript.project_id == project_id).count()
        print(f"Total Assets: {total_assets}")
        
        # Weekly Growth
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        weekly_growth = db.query(TestScript).filter(
            TestScript.project_id == project_id,
            TestScript.created_at >= seven_days_ago
        ).count()
        print(f"Weekly Growth: {weekly_growth}")
        
        # Active Defects
        all_recent = db.query(TestHistory).filter(
            TestHistory.project_id == project_id
        ).order_by(TestHistory.run_date.desc()).all()
        
        seen_scripts = set()
        active_defects = 0
        for h in all_recent:
            if h.script_id and h.script_id not in seen_scripts:
                seen_scripts.add(h.script_id)
                if h.status == 'failed':
                    active_defects += 1
        print(f"Active Defects: {active_defects}")
        
        if total_assets > 0:
            stability = round(((total_assets - active_defects) / total_assets) * 100)
            print(f"Calculated Stability: {stability}%")
            
    finally:
        db.close()

if __name__ == "__main__":
    verify()
