from typing import Any, List

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api import deps
from app.core import security

router = APIRouter()

@router.get("/", response_model=List[schemas.User])
def read_users(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Retrieve users.
    """
    # Allow if super admin or has sufficient role
    if not current_user.is_saas_super_admin and current_user.role not in ["Admin", "Manager"]:
         raise HTTPException(
            status_code=403,
            detail="Not enough permissions",
        )
    users = crud.user.get_multi(db, skip=skip, limit=limit)
    return users

@router.post("/", response_model=schemas.User)
def create_user(
    *,
    db: Session = Depends(deps.get_db),
    user_in: schemas.UserCreate,
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Create new user.
    """
    user = crud.user.get_by_email(db, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system.",
        )
    user = crud.user.create(db, obj_in=user_in)
    return user

@router.get("/me", response_model=schemas.User)
def read_user_me(
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get current user.
    """
    return current_user

@router.delete("/{user_id}", response_model=schemas.User)
def delete_user(
    *,
    db: Session = Depends(deps.get_db),
    user_id: str,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Soft delete a user.
    """
    if current_user.role not in ["Admin", "Manager"] and not current_user.is_saas_super_admin:
         raise HTTPException(
            status_code=403,
            detail="Not enough permissions",
        )
    user = crud.user.get(db, id=user_id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="The user with this id does not exist in the system",
        )
    user = crud.user.update(db, db_obj=user, obj_in={"is_active": False})
    return user

@router.put("/me/password", response_model=schemas.User)
def update_password(
    *,
    db: Session = Depends(deps.get_db),
    password_in: schemas.UserPasswordUpdate,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update own password.
    """
    if not security.verify_password(password_in.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    
    hashed_password = security.get_password_hash(password_in.new_password)
    # We can't use crud.user.update directly for password_hash easily without schemas, 
    # but we can use the dict update_data approach if we pass password_hash key.
    # However, crud.user.update expects UserUpdate schema or dict with keys matching model.
    current_user.password_hash = hashed_password
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user

@router.put("/{user_id}", response_model=schemas.User)
def update_user(
    *,
    db: Session = Depends(deps.get_db),
    user_id: str,
    user_in: schemas.UserUpdate,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update a user.
    """
    user = crud.user.get(db, id=user_id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="The user with this id does not exist in the system",
        )
    # Permission check: Self or Admin/Manager
    # If self, allow updates.
    # If other, require Admin/Manager.
    # But for now, we assume this is mostly for Profile update or Admin managing users.
    
    # Check permissions
    is_admin = current_user.role in ["Admin", "Manager"] or current_user.is_saas_super_admin
    is_self = current_user.id == user_id
    
    if not is_admin and not is_self:
         raise HTTPException(
            status_code=403,
            detail="Not enough permissions",
        )
        
    user = crud.user.update(db, db_obj=user, obj_in=user_in)
    return user
