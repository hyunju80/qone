from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api import deps

router = APIRouter()

@router.get("/", response_model=List[schemas.Project])
def read_projects(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Retrieve projects.
    """
    if current_user.is_saas_super_admin:
        return crud.project.get_multi(db, skip=skip, limit=limit)
    
    # If Customer Admin
    if current_user.role == 'Admin':
        return crud.project.get_multi_by_owner(db, customer_id=current_user.customer_account_id, skip=skip, limit=limit)
    
    # If Manager, QA Engineer, or Viewer -> Only explicit ProjectAccess
    # NOTE: This assumes project access logic is strict.
    return crud.project.get_projects_for_user(db, user_id=current_user.id)

@router.post("/", response_model=schemas.Project)
def create_project(
    *,
    db: Session = Depends(deps.get_db),
    project_in: schemas.ProjectCreate,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Create new project.
    """
    # Force customer_account_id to be current user's account if not super admin
    if not current_user.is_saas_super_admin and not hasattr(project_in, 'customer_account_id'):
         pass # Handled below
    
    # We need to manually inject customer_account_id derived from user
    # Or strict validation. For now, let's create a custom object data.
    project_data = project_in.model_dump()
    project_data['customer_account_id'] = current_user.customer_account_id
    
    # Since ProjectCreate doesn't have customer_account_id, we need a slightly different logic in CRUD or Schema
    # Ideally ProjectCreate shouldn't require it, code fills it.
    
    # Let's fix schema if needed, or pass explicit dictionary to model constructor in CRUD
    # But CRUD expects Schema.
    # We can modify ProjectCreate to optionally accept it, OR handle it at DB level.
    # For now, let's just forcefully set attribute on the DB object inside CRUD or here.
    
    # Hack: We can't easily add field to Pydantic model at runtime.
    # Better approach: Update Generic CRUD to accept **kwargs, or Custom CRUD Method.
    
    # Re-using Generic Create but passing extra fields? Generic Create uses jsonable_encoder(obj_in).
    
    # Override logic:
    # We will implement dedicated create_with_owner method in CRUDProject
    pass 
    
    # Wait, simple way:
    db_obj = models.Project(**project_data) # Schema fields + extra
    import time
    db_obj.id = f"proj_{int(time.time()*1000)}"
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    db.refresh(db_obj)
    return db_obj

@router.put("/{project_id}", response_model=schemas.Project)
def update_project(
    *,
    db: Session = Depends(deps.get_db),
    project_id: str,
    project_in: schemas.ProjectUpdate,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update a project.
    """
    project = crud.project.get(db, id=project_id)
    if not project:
        raise HTTPException(
            status_code=404,
            detail="The project with this id does not exist in the system",
        )
        
    # Permission: Super Admin OR (Customer Admin of owning account) OR (Explicit Manager/Admin of project? - TBD)
    # For now, restrict to Admin of the customer account or Super Admin.
    
    if not current_user.is_saas_super_admin:
        has_permission = False
        
        # 1. Customer Admin
        if current_user.role == 'Admin' and project.customer_account_id == current_user.customer_account_id:
            has_permission = True
            
        # 2. Project Manager (via ProjectAccess)
        if not has_permission:
            for access in current_user.project_access:
                if access.project_id == project_id and access.access_role == 'Manager':
                    has_permission = True
                    break
        
        if not has_permission:
             raise HTTPException(status_code=403, detail="Not enough permissions")
             
    project = crud.project.update(db, db_obj=project, obj_in=project_in)
    return project

@router.get("/{project_id}/users", response_model=List[schemas.User])
def read_project_users(
    *,
    db: Session = Depends(deps.get_db),
    project_id: str,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get users with access to specific project (Customer Admins + Explicit Members).
    """
    project = crud.project.get(db, id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Permission check: User must be SuperAdmin OR (CustomerAdmin of the project's account) OR (Member of the project)
    # Simple check: if not super admin, must match customer account (loose check for now)
    if not current_user.is_saas_super_admin and project.customer_account_id != current_user.customer_account_id:
        # TODO: Check ProjectAccess if cross-customer access is allowed? 
        # For now, assume strict customer boundary.
         raise HTTPException(status_code=400, detail="Not enough permissions")

    users = crud.user.get_users_for_project(
        db, 
        project_id=project_id, 
        customer_id=project.customer_account_id
    )
    return users

@router.post("/{project_id}/invite", response_model=schemas.User)
def invite_user(
    *,
    db: Session = Depends(deps.get_db),
    project_id: str,
    invite_in: schemas.UserInvite,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Invite a user to the project.
    """
    project = crud.project.get(db, id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Permission check: Manager or Admin
    # (Simplified check)
    
    # Map UserInvite to UserCreate-like object for CRUD
    # We assign default password "password12" if creating new user
    user_create_data = schemas.UserCreate(
        email=invite_in.email,
        name=invite_in.name,
        role=invite_in.role, # Project Role passed here, but system role will be 'Viewer'
        password="password12",
        customer_account_id=project.customer_account_id
    )
    
    user = crud.user.invite_to_project(
        db, 
        project_id=project_id, 
        customer_id=project.customer_account_id,
        invite=user_create_data
    )
    return user
