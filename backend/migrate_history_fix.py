import sys
import os
from sqlalchemy import text
sys.path.append(os.getcwd())
from app.db.session import engine

def migrate():
    with engine.connect() as conn:
        print("Checking for project_id in testhistory...")
        result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='testhistory' AND column_name='project_id';"))
        if result.fetchone() is None:
            print("Adding project_id to testhistory...")
            conn.execute(text("ALTER TABLE testhistory ADD COLUMN project_id VARCHAR;"))
            conn.execute(text("CREATE INDEX ix_testhistory_project_id ON testhistory (project_id);"))
            print("project_id added.")
        else:
            print("project_id already exists.")

        print("Checking for script_id foreign key...")
        # Get the constraint name
        result = conn.execute(text("""
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'testhistory'::regclass
            AND confrelid = 'testscript'::regclass;
        """))
        row = result.fetchone()
        if row:
            const_name = row[0]
            print(f"Dropping foreign key constraint {const_name} from testhistory...")
            conn.execute(text(f"ALTER TABLE testhistory DROP CONSTRAINT {const_name};"))
            print("Constraint dropped.")
        else:
            print("No foreign key constraint found between testhistory and testscript.")

        conn.commit()

if __name__ == "__main__":
    migrate()
