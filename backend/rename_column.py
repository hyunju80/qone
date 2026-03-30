import psycopg2
from app.core.config import settings

def rename_column():
    print(f"Connecting to DB...")
    
    try:
        conn = psycopg2.connect(
            host=settings.POSTGRES_SERVER,
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            database=settings.POSTGRES_DB,
            port=settings.POSTGRES_PORT
        )
        cur = conn.cursor()
        
        sql = "ALTER TABLE projectinsight RENAME COLUMN metadata TO insight_metadata;"
        
        cur.execute(sql)
        conn.commit()
        print("Column renamed to 'insight_metadata' successfully.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    rename_column()
