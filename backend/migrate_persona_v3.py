from sqlalchemy import create_engine, text, inspect
import sys
import os

# Add backend to path to import config
sys.path.append(os.getcwd())

from app.core.config import settings

def migrate():
    engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))
    inspector = inspect(engine)
    columns = [c['name'] for c in inspector.get_columns('persona')]
    
    with engine.connect() as conn:
        print(f"Current columns in persona: {columns}")
        
        new_columns = {
            'motivation': "ALTER TABLE persona ADD COLUMN motivation TEXT;",
            'current_state': "ALTER TABLE persona ADD COLUMN current_state TEXT;",
            'type': "ALTER TABLE persona ADD COLUMN type TEXT DEFAULT 'USER';",
            'domain': "ALTER TABLE persona ADD COLUMN domain TEXT DEFAULT 'General';"
        }
        
        for col, sql in new_columns.items():
            if col not in columns:
                print(f"Adding '{col}' column...")
                try:
                    conn.execute(text(sql))
                    print(f"Successfully added '{col}' column.")
                except Exception as e:
                    print(f"Error adding '{col}' column: {e}")
            else:
                print(f"'{col}' column already exists.")
            
        conn.commit()
        print("Migration process finished.")

if __name__ == "__main__":
    migrate()
