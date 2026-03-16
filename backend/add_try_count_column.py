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
        
        # Add try_count to testscript table
        try:
            print("Adding 'try_count' to testscript table...")
            cur.execute("ALTER TABLE testscript ADD COLUMN try_count INTEGER DEFAULT 1;")
            print("Successfully added 'try_count' to testscript table.")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("'try_count' already exists in testscript table.")
            else:
                print(f"Error adding 'try_count' to testscript table: {e}")
            
        # Add try_count to scenario table
        try:
            print("Adding 'try_count' to scenario table...")
            cur.execute("ALTER TABLE scenario ADD COLUMN try_count INTEGER DEFAULT 1;")
            print("Successfully added 'try_count' to scenario table.")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("'try_count' already exists in scenario table.")
            else:
                print(f"Error adding 'try_count' to scenario table: {e}")
            
        cur.close()
        conn.close()
    
    # Also check if there's a local sqlite db for dry runs or dev
    if os.path.exists("app.db") or os.path.exists("sql_app.db"):
        import sqlite3
        for db_file in ["app.db", "sql_app.db"]:
            if not os.path.exists(db_file): continue
            print(f"Checking SQLite database: {db_file}")
            try:
                conn = sqlite3.connect(db_file)
                cur = conn.cursor()
                
                # TestScript
                try:
                    cur.execute("ALTER TABLE testscript ADD COLUMN try_count INTEGER DEFAULT 1;")
                    print(f"Successfully added 'try_count' to testscript table in {db_file}.")
                except sqlite3.OperationalError as e:
                    if "duplicate column name" in str(e).lower():
                        print(f"'try_count' already exists in testscript table in {db_file}.")
                    else:
                        print(f"Error updating testscript in {db_file}: {e}")
                
                # Scenario
                try:
                    cur.execute("ALTER TABLE scenario ADD COLUMN try_count INTEGER DEFAULT 1;")
                    print(f"Successfully added 'try_count' to scenario table in {db_file}.")
                except sqlite3.OperationalError as e:
                    if "duplicate column name" in str(e).lower():
                        print(f"'try_count' already exists in scenario table in {db_file}.")
                    else:
                        print(f"Error updating scenario in {db_file}: {e}")
                
                conn.commit()
                conn.close()
            except Exception as e:
                print(f"Error accessing {db_file}: {e}")

    print("Migration complete.")

if __name__ == "__main__":
    apply_migrations()
