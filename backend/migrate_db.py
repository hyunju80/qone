import psycopg2
import os
from dotenv import load_dotenv

# Load env from parent backend dir
load_dotenv('d:/03_Aiworkx/01_Q-ONE/prj/qone/backend/.env')

def migrate():
    try:
        conn = psycopg2.connect(
            host=os.getenv("POSTGRES_SERVER", "localhost"),
            database=os.getenv("POSTGRES_DB", "qone"),
            user=os.getenv("POSTGRES_USER", "postgres"),
            password=os.getenv("POSTGRES_PASSWORD", "password"),
            port=os.getenv("POSTGRES_PORT", "5432")
        )
        cur = conn.cursor()
        
        print("Checking for run_id column in testhistory table...")
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='testhistory' AND column_name='run_id';")
        if not cur.fetchone():
            print("Adding run_id column...")
            cur.execute("ALTER TABLE testhistory ADD COLUMN run_id VARCHAR;")
            conn.commit()
            print("Success: run_id column added.")
        else:
            print("Column 'run_id' already exists.")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Migration Error: {e}")

if __name__ == "__main__":
    migrate()
