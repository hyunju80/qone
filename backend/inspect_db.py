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
        tables_to_check = {
            'testscript': ['try_count', 'enable_ai_test', 'category'],
            'scenario': ['try_count', 'enable_ai_test', 'category'],
            'persona': ['name', 'description', 'system_prompt'] # Assuming these are the required columns for 'persona'
        }

        for table_name, required_columns in tables_to_check.items():
            f.write(f"\nChecking table: {table_name}\n")
            try:
                columns = [col['name'] for col in inspector.get_columns(table_name)]
                f.write(f"Existing columns: {columns}\n")
                
                missing = [col for col in required_columns if col not in columns]
                
                if missing:
                    f.write(f"!!! MISSING COLUMNS in {table_name}: {missing}\n")
                else:
                    f.write(f"All required columns present in {table_name}.\n")
            except Exception as e:
                f.write(f"!!! ERROR checking table {table_name}: {e}\n")

if __name__ == "__main__":
    check_schema()
