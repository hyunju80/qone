import os
import sys

# Add backend directory to sys.path
sys.path.append(os.getcwd())

from app.db.session import SessionLocal
from app.models.user import User
from app.core.security import verify_password
from app.core.config import settings

def check_user():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "admin@qone.ai").first()
        if user:
            print(f"User found: {user.email}")
            print(f"Is Active: {user.is_active}")
            print(f"Role: {user.role}")
        else:
            print("User 'admin@qone.ai' NOT FOUND.")
            
    except Exception as e:
        print(f"Error checking user: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_user()
