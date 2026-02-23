from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.crud.crud_user import user
from app.core.security import verify_password
from app.core.config import settings

db = SessionLocal()
try:
    print(f"Checking user: admin@qone.ai")
    u = user.get_by_email(db, email="admin@qone.ai")
    if not u:
        print("User NOT FOUND")
    else:
        print(f"User found: {u.id}, Role: {u.role}")
        print(f"Hash in DB: {u.password_hash}")
        
        is_valid = verify_password("password12", u.password_hash)
        print(f"Password 'password12' valid? {is_valid}")
        
        # Test creating a token
        from app.core.security import create_access_token
        token = create_access_token(u.id)
        print("Token generation successful")

    # Also check CORS origins
    print(f"Allowed Origins: {settings.BACKEND_CORS_ORIGINS}")

except Exception as e:
    print(f"Error: {e}")
finally:
    db.close()
