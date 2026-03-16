from sqlalchemy import create_engine, inspect
import sys
import os

# Add backend to path to import config
sys.path.append(os.getcwd())

from app.core.config import settings

def check_schema():
    engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))
    inspector = inspect(engine)
    
    with open("db_inspect_results.txt", "w") as f:
        for table_name in ['testscript', 'scenario']:
            f.write(f"\nChecking table: {table_name}\n")
            columns = [col['name'] for col in inspector.get_columns(table_name)]
            f.write(f"Existing columns: {columns}\n")
            
            required_columns = ['try_count', 'enable_ai_test', 'category']
            missing = [col for col in required_columns if col not in columns]
            
            if missing:
                f.write(f"!!! MISSING COLUMNS in {table_name}: {missing}\n")
            else:
                f.write(f"All required columns present in {table_name}.\n")

if __name__ == "__main__":
    check_schema()
