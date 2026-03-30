import psycopg2
from psycopg2.extras import RealDictCursor

def diagnose_projects():
    try:
        conn = psycopg2.connect(
            host="localhost",
            user="postgres",
            password="password",
            dbname="qone",
            port=5432
        )
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        print("--- Projects in DB ---")
        cur.execute("SELECT id, name FROM project")
        for r in cur.fetchall():
            print(f"ID: {r['id']} | Name: {r['name']}")
            
        print("\n--- Failed AI-Enabled Scripts (enable_ai_test=True) ---")
        cur.execute("""
            SELECT s.id, s.name, s.project_id, s.enable_ai_test,
                   (SELECT count(*) FROM testhistory h WHERE h.script_id = s.id AND h.status = 'failed') as fail_count
            FROM testscript s
            WHERE s.enable_ai_test = True
        """)
        for r in cur.fetchall():
            print(f"Script: {r['name']} | ID: {r['id']} | Proj: {r['project_id']} | Fails: {r['fail_count']}")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    diagnose_projects()
