import sys
import os

# Add current dir to path
sys.path.append(os.getcwd())

from app.db.base import Base
from app.db.session import engine

def create_tables():
    print("Creating tables...")
    try:
        Base.metadata.create_all(bind=engine)
        print("Tables created successfully.")
    except Exception as e:
        print(f"Error creating tables: {e}")

if __name__ == "__main__":
    create_tables()
