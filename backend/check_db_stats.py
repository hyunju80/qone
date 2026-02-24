from app.db.session import SessionLocal
from app.models.test import TestScript, StepAsset, TestHistory

def check():
    db = SessionLocal()
    try:
        print("--- TestScripts ---")
        scripts = db.query(TestScript).all()
        for s in scripts:
            history_count = db.query(TestHistory).filter(TestHistory.script_id == s.id).count()
            print(f"ID: {s.id}, Name: {s.name}, DB_Runs: {s.run_count}, Actual_History: {history_count}, Rate: {s.success_rate}%")

        print("\n--- StepAssets ---")
        assets = db.query(StepAsset).all()
        for a in assets:
            history_count = db.query(TestHistory).filter(TestHistory.script_id == a.id).count()
            print(f"ID: {a.id}, Name: {a.name}, DB_Runs: {a.run_count}, Actual_History: {history_count}, Rate: {a.success_rate}%")
    finally:
        db.close()

if __name__ == "__main__":
    check()
