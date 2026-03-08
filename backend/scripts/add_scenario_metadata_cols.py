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
            # Add platform column
            print("Checking if 'platform' column exists in 'scenario' table...")
            result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='scenario' AND column_name='platform'"))
            if result.fetchone():
                print("Column 'platform' already exists.")
            else:
                print("Adding 'platform' column to 'scenario' table...")
                conn.execute(text("ALTER TABLE scenario ADD COLUMN platform VARCHAR"))
                conn.execute(text("UPDATE scenario SET platform = 'WEB' WHERE platform IS NULL"))
                conn.execute(text("COMMIT"))
                print("Column 'platform' added successfully.")

            # Add target column
            print("Checking if 'target' column exists in 'scenario' table...")
            result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='scenario' AND column_name='target'"))
            if result.fetchone():
                print("Column 'target' already exists.")
            else:
                print("Adding 'target' column to 'scenario' table...")
                conn.execute(text("ALTER TABLE scenario ADD COLUMN target VARCHAR"))
                conn.execute(text("COMMIT"))
                print("Column 'target' added successfully.")
                
        except Exception as e:
            print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate()
