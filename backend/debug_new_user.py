from app.db.session import SessionLocal
from app import crud, schemas
from app.models.user import User

def debug_new_user():
    db = SessionLocal()
    try:
        # Simulate data from endpoint
        email = "new_admin@test.com"
        
        # Cleanup if exists
        u = crud.user.get_by_email(db, email=email)
        if u:
            db.delete(u)
            db.commit()

        user_in = schemas.UserCreate(
            email=email,
            password="password12",
            name="Test Admin",
            role="Admin",
            customer_account_id="cust_default" # Just link to default for test
        )
        
        print(f"Creating user with dict: {user_in.dict()}")
        
        user = crud.user.create(db, obj_in=user_in)
        
        print(f"Created User: {user.email}")
        print(f"Role: {user.role}")
        print(f"is_saas_super_admin: {user.is_saas_super_admin}")
        
    finally:
        db.close()

if __name__ == "__main__":
    debug_new_user()
