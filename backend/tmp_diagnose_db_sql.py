import psycopg2
from psycopg2.extras import RealDictCursor

def diagnose():
    try:
        conn = psycopg2.connect(
            host="localhost",
            user="postgres",
            password="password",
            dbname="qone",
            port=5432
        )
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        print("--- Diagnostic: Top 10 Latest Failed Histories ---")
        cur.execute("""
            SELECT h.id, h.script_id, h.script_name, h.project_id, h.status, h.run_date,
                   s.name as script_table_name, s.enable_ai_test, s.project_id as script_project_id
            FROM testhistory h
            LEFT JOIN testscript s ON h.script_id = s.id
            WHERE h.status = 'failed'
            ORDER BY h.run_date DESC
            LIMIT 10
        """)
        rows = cur.fetchall()
        for r in rows:
            print(f"H_ID: {r['id']} | ScriptName: {r['script_name']} | H_Proj: {r['project_id']} | S_Proj: {r['script_project_id']}")
            print(f"  > AI Enabled: {r['enable_ai_test']}")
            
        print("\n--- Distinct Project IDs in History ---")
        cur.execute("SELECT DISTINCT project_id FROM testhistory")
        print([r['project_id'] for r in cur.fetchall()])
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    diagnose()
