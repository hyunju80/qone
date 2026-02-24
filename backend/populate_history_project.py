import sys
import os
from sqlalchemy import text
sys.path.append(os.getcwd())
from app.db.session import engine

def populate_project_id():
    with engine.connect() as conn:
        print("Populating project_id in testhistory from testscript...")
        # Update records that have a matching testscript
        conn.execute(text("""
            UPDATE testhistory
            SET project_id = testscript.project_id
            FROM testscript
            WHERE testhistory.script_id = testscript.id
            AND testhistory.project_id IS NULL;
        """))
        
        print("Populating project_id in testhistory from stepasset...")
        # Update records that have a matching stepasset
        conn.execute(text("""
            UPDATE testhistory
            SET project_id = stepasset.project_id
            FROM stepasset
            WHERE testhistory.script_id = stepasset.id
            AND testhistory.project_id IS NULL;
        """))
        
        conn.commit()
        print("Data population completed.")

if __name__ == "__main__":
    populate_project_id()
