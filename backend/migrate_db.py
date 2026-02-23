import psycopg2
from app.core.config import settings

def migrate():
    try:
        conn = psycopg2.connect(
            host=settings.POSTGRES_SERVER,
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            dbname=settings.POSTGRES_DB,
            port=settings.POSTGRES_PORT
        )
        cur = conn.cursor()
        print("Connected to DB")
        
        # Check if column exists
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='user' AND column_name='is_active';")
        if cur.fetchone():
            print("Column 'is_active' already exists.")
        else:
            print("Adding column 'is_active'...")
            cur.execute('ALTER TABLE "user" ADD COLUMN is_active BOOLEAN DEFAULT TRUE;')
            conn.commit()
            print("Column added successfully.")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate()
