from app.db.session import SessionLocal
from app import crud

def check_user_roles():
    db = SessionLocal()
    try:
        emails = ["admin@qone.ai", "admin@skt.ai"]
        for email in emails:
            user = crud.user.get_by_email(db, email=email)
            if user:
                print(f"User: {user.email}, Role: {user.role}, is_saas_super_admin: {user.is_saas_super_admin}")
            else:
                print(f"User {email} not found")
    finally:
        db.close()

if __name__ == "__main__":
    check_user_roles()
