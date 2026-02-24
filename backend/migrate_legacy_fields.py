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
        
        columns_to_add = [
            ("visible_if_type", "VARCHAR"),
            ("visible_if", "VARCHAR"),
            ("true_jump_no", "INTEGER"),
            ("false_jump_no", "INTEGER")
        ]
        
        for col_name, col_type in columns_to_add:
            # Check if column exists
            cur.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name='teststep' AND column_name='{col_name}';")
            if cur.fetchone():
                print(f"Column '{col_name}' already exists.")
            else:
                print(f"Adding column '{col_name}'...")
                cur.execute(f'ALTER TABLE teststep ADD COLUMN {col_name} {col_type};')
                conn.commit()
                print(f"Column '{col_name}' added successfully.")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate()
