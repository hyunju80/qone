import asyncio
import os
import sys

# Add backend directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from app.core.config import settings

def apply_migrations():
    uri = str(settings.SQLALCHEMY_DATABASE_URI)
    print(f"Connecting to database: {uri}")
    
    if uri.startswith("postgresql"):
        import psycopg2
        
        # Parse simple postgres uri like postgresql://user:pass@host:port/db
        uri_clean = uri.replace("postgresql+psycopg2://", "postgresql://")
        
        conn = psycopg2.connect(uri_clean)
        conn.autocommit = True
        cur = conn.cursor()
        
        try:
            cur.execute("ALTER TABLE project ADD COLUMN categories JSON DEFAULT '[\"Common\"]';")
            print("Successfully added 'categories' to project table.")
        except Exception as e:
            print(f"Skipping project table or 'categories' already exists: {e}")
            
        try:
            cur.execute("ALTER TABLE scenario ADD COLUMN category VARCHAR;")
            print("Successfully added 'category' to scenario table.")
        except Exception as e:
            print(f"Skipping scenario table or 'category' already exists: {e}")
            
        try:
            cur.execute("ALTER TABLE testscript ADD COLUMN category VARCHAR DEFAULT 'Common';")
            print("Successfully added 'category' to testscript table.")
        except Exception as e:
            print(f"Skipping testscript table or 'category' already exists: {e}")
            
        cur.close()
        conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    apply_migrations()
