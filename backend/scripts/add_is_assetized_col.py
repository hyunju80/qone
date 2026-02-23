
from app.db.session import SessionLocal
from sqlalchemy import text

def migrate():
    db = SessionLocal()
    try:
        # Check if column exists first (PostgreSQL specific check, but generic enough for now)
        # Or just try-catch the alter table
        
        sql = "ALTER TABLE aiexplorationsession ADD COLUMN is_assetized BOOLEAN DEFAULT FALSE;"
        db.execute(text(sql))
        db.commit()
        print("Successfully added is_assetized column.")
    except Exception as e:
        print(f"Migration failed (might already exist): {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
