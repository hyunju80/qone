from sqlalchemy import create_engine, text
import os
import sys

# Add backend to path to import config
sys.path.append(os.path.join(os.getcwd()))

from app.core.config import settings

def migrate():
    print(f"Connecting to database: {settings.POSTGRES_SERVER}...")
    engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))
    
    with engine.connect() as conn:
        try:
            print("Checking if 'golden_script_id' column exists in 'scenario' table...")
            result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='scenario' AND column_name='golden_script_id'"))
            if result.fetchone():
                print("Column 'golden_script_id' already exists.")
            else:
                print("Adding 'golden_script_id' column to 'scenario' table...")
                conn.execute(text("ALTER TABLE scenario ADD COLUMN golden_script_id VARCHAR"))
                conn.execute(text("COMMIT"))
                print("Column added successfully.")
        except Exception as e:
            print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate()
