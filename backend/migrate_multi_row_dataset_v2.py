from sqlalchemy import create_engine, text, inspect
import sys
import os

# Add backend to path to import config
sys.path.append(os.getcwd())

from app.core.config import settings

def migrate():
    engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))
    inspector = inspect(engine)
    columns = [c['name'] for c in inspector.get_columns('testdataset')]
    
    with engine.connect() as conn:
        print(f"Current columns in testdataset: {columns}")
        
        if 'fields' not in columns:
            print("Adding 'fields' column...")
            conn.execute(text("ALTER TABLE testdataset ADD COLUMN fields JSON DEFAULT '[]';"))
            print("Successfully added 'fields' column.")
        else:
            print("'fields' column already exists.")
            
        if 'records' not in columns:
            print("Adding 'records' column...")
            conn.execute(text("ALTER TABLE testdataset ADD COLUMN records JSON DEFAULT '[]';"))
            print("Successfully added 'records' column.")
        else:
            print("'records' column already exists.")
            
        conn.commit()
        print("Migration process finished.")

if __name__ == "__main__":
    migrate()
