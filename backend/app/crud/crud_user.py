from typing import Optional
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import get_password_hash

class CRUDUser(CRUDBase[User, UserCreate, UserUpdate]):
    def get_by_email(self, db: Session, *, email: str) -> Optional[User]:
        return db.query(User).filter(User.email == email).first()

    def create(self, db: Session, *, obj_in: UserCreate) -> User:
        db_obj = User(
            email=obj_in.email,
            password_hash=get_password_hash(obj_in.password),
            name=obj_in.name,
            role=obj_in.role,
            is_saas_super_admin=obj_in.is_saas_super_admin,
            customer_account_id=obj_in.customer_account_id
        )
        import time
        db_obj.id = f"u_{int(time.time()*1000)}"
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_users_for_project(self, db: Session, project_id: str, customer_id: str) -> list[User]:
        from app.models.project import ProjectAccess
        from sqlalchemy import or_
        
        # 1. Users in the same Customer Account who have role 'Admin'
        # 2. Users who have explicit access to this project (ProjectAccess)
        
        q = db.query(User).outerjoin(ProjectAccess, User.id == ProjectAccess.user_id).filter(
            or_(
                # Condition 1: Customer Admin
                (User.customer_account_id == customer_id) & (User.role == 'Admin'),
                # Condition 2: Explicit Project Access
                (ProjectAccess.project_id == project_id)
            )
        ).filter(User.is_active == True).distinct()
        
        return q.all()

    def invite_to_project(self, db: Session, project_id: str, customer_id: str, invite: UserCreate) -> User:
        from app.models.project import ProjectAccess
        from app.core.security import get_password_hash
        import time

        # 1. Check if user exists
        user = self.get_by_email(db, email=invite.email)
        if not user:
            # Create new user
            # Default password for invited users? Or invite.password.
            # Assuming payload has dummy password or we generate one.
            # For this context, we'll use the one from payload or default "password12"
            pwd = invite.password or "password12"
            
            db_obj = User(
                email=invite.email,
                password_hash=get_password_hash(pwd),
                name=invite.name,
                role=invite.role, # Use the invited role as system role for now
                is_saas_super_admin=False,
                customer_account_id=customer_id
            )
            db_obj.id = f"u_{int(time.time()*1000)}"
            db.add(db_obj)
            db.commit()
            db.refresh(db_obj)
            user = db_obj
        
        # 2. Add Project Access
        # Check if access already exists
        existing_access = db.query(ProjectAccess).filter_by(user_id=user.id, project_id=project_id).first()
        if not existing_access:
            access_obj = ProjectAccess(
                id=f"pa_{int(time.time()*1000)}",
                user_id=user.id,
                project_id=project_id,
                access_role=invite.role # Project specific role
            )
            db.add(access_obj)
            db.commit()
        else:
            # Update role?
            existing_access.access_role = invite.role
            db.add(existing_access)
            db.commit()
            
        return user

user = CRUDUser(User)
