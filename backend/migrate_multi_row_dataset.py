from sqlalchemy import create_engine, text
import sys
import os

# Add backend to path to import config
sys.path.append(os.getcwd())

from app.core.config import settings

def migrate():
    engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))
    
    with engine.connect() as conn:
        print("Migrating testdataset table for multi-row support...")
        
        # Add fields column
        try:
            conn.execute(text("ALTER TABLE testdataset ADD COLUMN IF NOT EXISTS fields JSON DEFAULT '[]';"))
            print("Successfully added 'fields' column.")
        except Exception as e:
            print(f"Error adding 'fields' column: {e}")
            
        # Add records column
        try:
            conn.execute(text("ALTER TABLE testdataset ADD COLUMN IF NOT EXISTS records JSON DEFAULT '[]';"))
            print("Successfully added 'records' column.")
        except Exception as e:
            print(f"Error adding 'records' column: {e}")
            
        conn.commit()
        print("Migration completed successfully.")

if __name__ == "__main__":
    migrate()
