import psycopg2
from psycopg2.extras import RealDictCursor

def diagnose_script_histories():
    try:
        conn = psycopg2.connect(
            host="localhost",
            user="postgres",
            password="password",
            dbname="qone",
            port=5432
        )
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        script_name_pattern = "%로밍%"
        cur.execute("SELECT id, name, enable_ai_test FROM testscript WHERE name LIKE %s", (script_name_pattern,))
        scripts = cur.fetchall()
        
        for s in scripts:
            print(f"--- Script: {s['name']} (ID: {s['id']}) ---")
            print(f"AI Enabled: {s['enable_ai_test']}")
            
            cur.execute("""
                SELECT id, status, run_date, project_id 
                FROM testhistory 
                WHERE script_id = %s 
                ORDER BY run_date DESC 
                LIMIT 5
            """, (s['id'],))
            histories = cur.fetchall()
            
            for h in histories:
                cur.execute("SELECT status FROM selfhealinglog WHERE history_id = %s", (h['id'],))
                logs = cur.fetchall()
                log_statuses = [l['status'] for l in logs]
                print(f"  H_ID: {h['id']} | Status: {h['status']} | Date: {h['run_date']} | Proj: {h['project_id']} | HealingLogs: {log_statuses}")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    diagnose_script_histories()
