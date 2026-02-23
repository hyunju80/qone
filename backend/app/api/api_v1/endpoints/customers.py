from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api import deps

router = APIRouter()

@router.get("/", response_model=List[schemas.Customer])
def read_customers(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Retrieve customers. Only for super admins.
    """
    customers = crud.customer.get_multi(db, skip=skip, limit=limit)
    return customers

@router.post("/", response_model=schemas.Customer)
def create_customer(
    *,
    db: Session = Depends(deps.get_db),
    customer_in: schemas.CustomerCreate,
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Create new customer.
    """
    customer = crud.customer.get(db, id=customer_in.company_name) # ID isn't company name but for checking existence?
    # Better check unique business number
    # For now just create
    customer = crud.customer.create(db, obj_in=customer_in)
    
    # 2. Check if admin user exists, if not create
    user = crud.user.get_by_email(db, email=customer_in.admin_email)
    if not user:
        user_in = schemas.UserCreate(
            email=customer_in.admin_email,
            password="password12", # Default password
            name=f"{customer.company_name} Admin",
            role="Admin",
            customer_account_id=customer.id
        )
        crud.user.create(db, obj_in=user_in)
    
    return customer
