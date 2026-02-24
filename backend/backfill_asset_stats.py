from app.db.session import SessionLocal
from sqlalchemy import text

def backfill_stats():
    db = SessionLocal()
    try:
        # Get all distinct script_ids from test_history
        script_ids_result = db.execute(text("SELECT DISTINCT script_id FROM testhistory")).fetchall()
        script_ids = [r[0] for r in script_ids_result if r[0] and r[0] != "adhoc_run"]
        print(f"Found {len(script_ids)} scripts/assets in history.")

        for s_id in script_ids:
            # Calculate stats using raw SQL
            stats = db.execute(text("""
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed,
                    MAX(run_date) as last_run
                FROM testhistory 
                WHERE script_id = :s_id
            """), {"s_id": s_id}).fetchone()
            
            if stats and stats[0] > 0:
                total = stats[0]
                passed = stats[1] or 0
                last_run = stats[2]
                rate = round((passed / total) * 100, 1)
                
                # Update TestScript
                res_script = db.execute(text("""
                    UPDATE testscript 
                    SET run_count = :total, success_rate = :rate, last_run = :last_run
                    WHERE id = :s_id
                """), {"total": total, "rate": rate, "last_run": last_run, "s_id": s_id})
                
                # Update StepAsset
                res_asset = db.execute(text("""
                    UPDATE stepasset 
                    SET run_count = :total, success_rate = :rate
                    WHERE id = :s_id
                """), {"total": total, "rate": rate, "s_id": s_id})
                
                print(f"Updated {s_id}: total={total}, rate={rate}% (S:{res_script.rowcount}, A:{res_asset.rowcount})")
        
        db.commit()
        print("Backfill completed successfully.")
    except Exception as e:
        print(f"Error during backfill: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    backfill_stats()
