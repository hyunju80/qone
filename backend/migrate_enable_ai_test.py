from sqlalchemy import create_engine, text
import sys
import os

# Add backend to path to import config
sys.path.append(os.getcwd())

from app.core.config import settings

def migrate():
    engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))
    
    with engine.connect() as conn:
        print("Migrating testscript table...")
        conn.execute(text("ALTER TABLE testscript ADD COLUMN IF NOT EXISTS enable_ai_test BOOLEAN DEFAULT FALSE;"))
        
        print("Migrating scenario table...")
        conn.execute(text("ALTER TABLE scenario ADD COLUMN IF NOT EXISTS enable_ai_test BOOLEAN DEFAULT FALSE;"))
        
        conn.commit()
        print("Migration completed successfully.")

if __name__ == "__main__":
    migrate()
