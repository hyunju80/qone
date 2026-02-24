import sys
import os
from sqlalchemy.orm import configure_mappers
sys.path.append(os.getcwd())
from app.db.base import Base
from app.db.session import SessionLocal
from app.models.test import TestHistory

def check_history():
    configure_mappers()
    db = SessionLocal()
    try:
        histories = db.query(TestHistory).order_by(TestHistory.run_date.desc()).limit(10).all()
        print(f"Latest 10 histories:")
        for h in histories:
            print(f"  - ID: {h.id}, ScriptID: {h.script_id}, Name: {h.script_name}, Status: {h.status}, Date: {h.run_date}")
            
        step_histories = db.query(TestHistory).filter(TestHistory.script_id.notin_(
            db.query(Base.metadata.tables['testscript'].c.id)
        )).all()
        print(f"Histories with script_id NOT in testscript: {len(step_histories)}")
        for h in step_histories:
            print(f"  - ID: {h.id}, ScriptID: {h.script_id}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_history()
