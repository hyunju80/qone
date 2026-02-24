import sys
import os
from sqlalchemy import create_engine, text
from app.core.config import settings

def migrate():
    engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))
    
    columns_to_add = [
        ("deployment_version", "String", "ALTER TABLE testhistory ADD COLUMN deployment_version VARCHAR;"),
        ("commit_hash", "String", "ALTER TABLE testhistory ADD COLUMN commit_hash VARCHAR;"),
        ("schedule_id", "String", "ALTER TABLE testhistory ADD COLUMN schedule_id VARCHAR;"),
        ("schedule_name", "String", "ALTER TABLE testhistory ADD COLUMN schedule_name VARCHAR;"),
        ("step_results", "JSON", "ALTER TABLE testhistory ADD COLUMN step_results JSON DEFAULT '[]';")
    ]
    
    with engine.connect() as conn:
        for col_name, col_type, sql in columns_to_add:
            print(f"Checking for {col_name}...")
            result = conn.execute(text(f"""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='testhistory' AND column_name='{col_name}';
            """))
            
            if result.fetchone() is None:
                print(f"Adding {col_name}...")
                try:
                    conn.execute(text(sql))
                    conn.commit()
                    print(f"{col_name} added.")
                except Exception as e:
                    print(f"Error adding {col_name}: {e}")
            else:
                print(f"{col_name} already exists.")

        # Create stepasset table if not exists
        print("Checking for stepasset table...")
        result = conn.execute(text("SELECT to_regclass('public.stepasset');"))
        if result.fetchone()[0] is None:
            print("Creating stepasset table...")
            conn.execute(text("""
                CREATE TABLE stepasset (
                    id VARCHAR PRIMARY KEY,
                    project_id VARCHAR REFERENCES project(id),
                    name VARCHAR,
                    description VARCHAR,
                    platform VARCHAR DEFAULT 'APP',
                    steps JSON DEFAULT '[]',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    is_favorite BOOLEAN DEFAULT FALSE,
                    is_active BOOLEAN DEFAULT TRUE,
                    success_rate FLOAT DEFAULT 0.0,
                    run_count INTEGER DEFAULT 0
                );
                CREATE INDEX ix_stepasset_id ON stepasset (id);
                CREATE INDEX ix_stepasset_name ON stepasset (name);
            """))
            conn.commit()
            print("stepasset table created.")
        else:
            print("stepasset table already exists.")

if __name__ == "__main__":
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))
    migrate()
