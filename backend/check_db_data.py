import sys
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, configure_mappers

# Ensure current directory is in path
sys.path.append(os.getcwd())

from app.db.base import Base
from app.db.session import SessionLocal
from app.models.test import TestScript, StepAsset, TestStep

def check_data():
    configure_mappers()
    db = SessionLocal()
    with open("db_check_results.txt", "w", encoding="utf-8") as f:
        try:
            # All Scripts
            scripts = db.query(TestScript).all()
            f.write(f"Total Scripts (TestScript table): {len(scripts)}\n")
            for s in scripts[:10]:
                f.write(f"  - ID: {s.id}, Name: {s.name}, Project: {s.project_id}, Origin: {s.origin}\n")
                
            # Step Assets
            assets = db.query(StepAsset).all()
            f.write(f"Total Step Assets (StepAsset table): {len(assets)}\n")
            for a in assets:
                f.write(f"  - ID: {a.id}, Name: {a.name}, Project: {a.project_id}, Platform: {a.platform}\n")
                
            # Legacy Step Scripts
            legacy = db.query(TestScript).filter(TestScript.origin == "STEP").all()
            f.write(f"Legacy Step Scripts (origin='STEP' in TestScript): {len(legacy)}\n")
            for l in legacy:
                f.write(f"  - ID: {l.id}, Name: {l.name}, Project: {l.project_id}, Platform: {l.platform}\n")
            
            # Check Projects
            from app.models.project import Project
            projs = db.query(Project).all()
            f.write(f"Projects in DB: {[(p.id, p.name) for p in projs]}\n")

        except Exception as e:
            f.write(f"Error during query: {e}\n")
        finally:
            db.close()

if __name__ == "__main__":
    check_data()
