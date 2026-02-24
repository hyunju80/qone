from typing import Any, List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.models.test import TestObject, TestAction, TestDataset
from app.schemas.test_asset import (
    TestObjectCreate, TestObjectUpdate, TestObjectResponse,
    TestActionCreate, TestActionUpdate, TestActionResponse,
    TestDatasetCreate, TestDatasetUpdate, TestDatasetResponse
)
import uuid
from datetime import datetime

router = APIRouter()

# --- TestObject (Selector) ---

@router.get("/objects", response_model=List[TestObjectResponse])
def read_test_objects(
    project_id: str,
    platform: Optional[str] = Query(None),
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve test objects (selectors) by project.
    """
    query = db.query(TestObject).filter(TestObject.project_id == project_id)
    if platform:
        if platform in ["WEB", "APP"]:
            query = query.filter(TestObject.platform.in_([platform, "COMMON"]))
        else:
            query = query.filter(TestObject.platform == platform)
    return query.offset(skip).limit(limit).all()

@router.post("/objects", response_model=TestObjectResponse)
def create_test_object(
    *,
    obj_in: TestObjectCreate,
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Create new test object.
    """
    db_obj = TestObject(
        id=str(uuid.uuid4()),
        project_id=obj_in.project_id,
        name=obj_in.name,
        description=obj_in.description,
        selector_type=obj_in.selector_type,
        value=obj_in.value,
        platform=obj_in.platform,
        is_active=obj_in.is_active,
        usage_count=0
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

@router.put("/objects/{id}", response_model=TestObjectResponse)
def update_test_object(
    *,
    id: str,
    obj_in: TestObjectUpdate,
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Update a test object.
    """
    db_obj = db.query(TestObject).filter(TestObject.id == id).first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="Test object not found")
    
    update_data = obj_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_obj, field, value)
    
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

# --- TestAction (Functions) ---

@router.get("/actions", response_model=List[TestActionResponse])
def read_test_actions(
    project_id: Optional[str] = None,
    platform: Optional[str] = Query(None),
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve test actions.
    If project_id is provided, returns Global actions + Project actions.
    If not, returns Global actions only.
    """
    query = db.query(TestAction)
    if project_id:
        # Global (project_id is NULL) OR specific project
        query = query.filter((TestAction.project_id == None) | (TestAction.project_id == project_id))
    else:
        query = query.filter(TestAction.project_id == None)
    
    if platform:
        if platform in ["WEB", "APP"]:
            query = query.filter(TestAction.platform.in_([platform, "COMMON"]))
        else:
            query = query.filter(TestAction.platform == platform)
       
    return query.offset(skip).limit(limit).all()

@router.post("/actions", response_model=TestActionResponse)
def create_test_action(
    *,
    action_in: TestActionCreate,
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Create new test action.
    """
    db_obj = TestAction(
        id=str(uuid.uuid4()),
        project_id=action_in.project_id, # Nullable
        name=action_in.name,
        description=action_in.description,
        category=action_in.category,
        code_content=action_in.code_content,
        parameters=action_in.parameters,
        platform=action_in.platform,
        is_active=action_in.is_active
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

@router.put("/actions/{action_id}", response_model=TestActionResponse)
def update_test_action(
    *,
    db: Session = Depends(deps.get_db),
    action_id: str,
    action_in: TestActionUpdate,
) -> Any:
    """
    Update a test action.
    """
    action = db.query(TestAction).filter(TestAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Test action not found")
    
    update_data = action_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(action, field, value)
        
    db.add(action)
    db.commit()
    db.refresh(action)
    return action

# --- TestDataset (Data) ---

@router.get("/data", response_model=List[TestDatasetResponse])
def read_test_datasets(
    project_id: str,
    platform: Optional[str] = Query(None),
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve test datasets by project.
    """
    query = db.query(TestDataset).filter(TestDataset.project_id == project_id)
    if platform:
        if platform in ["WEB", "APP"]:
            query = query.filter(TestDataset.platform.in_([platform, "COMMON"]))
        else:
            query = query.filter(TestDataset.platform == platform)
    return query.offset(skip).limit(limit).all()

@router.post("/data", response_model=TestDatasetResponse)
def create_test_dataset(
    *,
    data_in: TestDatasetCreate,
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Create new test dataset.
    """
    db_obj = TestDataset(
        id=str(uuid.uuid4()),
        project_id=data_in.project_id,
        name=data_in.name,
        description=data_in.description,
        data=data_in.data,
        classification=data_in.classification,
        platform=data_in.platform,
        is_active=data_in.is_active,
        generation_source=data_in.generation_source
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

@router.put("/data/{dataset_id}", response_model=TestDatasetResponse)
def update_test_dataset(
    *,
    db: Session = Depends(deps.get_db),
    dataset_id: str,
    dataset_in: TestDatasetUpdate,
) -> Any:
    """
    Update a test dataset.
    """
    dataset = db.query(TestDataset).filter(TestDataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Test dataset not found")
    
    update_data = dataset_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(dataset, field, value)
        
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    return dataset
