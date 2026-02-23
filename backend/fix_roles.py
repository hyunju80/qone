from app.db.session import SessionLocal
from app import crud
from app.models.user import User

def fix_roles():
    db = SessionLocal()
    try:
        # 1. Fix Super Admin
        sa = crud.user.get_by_email(db, email="admin@qone.ai")
        if sa:
            sa.role = "Super Admin"
            sa.is_saas_super_admin = True
            db.add(sa)
            print(f"Updated {sa.email} -> Role: {sa.role}, SuperAdmin: {sa.is_saas_super_admin}")
        
        # 2. Fix Customer Admin
        ca = crud.user.get_by_email(db, email="admin@skt.ai")
        if ca:
            ca.role = "Admin"
            ca.is_saas_super_admin = False
            db.add(ca)
            print(f"Updated {ca.email} -> Role: {ca.role}, SuperAdmin: {ca.is_saas_super_admin}")
            
        db.commit()
    finally:
        db.close()

if __name__ == "__main__":
    fix_roles()
