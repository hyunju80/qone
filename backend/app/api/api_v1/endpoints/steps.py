from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app import crud, models, schemas
from app.api import deps
from app.models.test import TestScript, TestStep
from app.schemas.test_script import TestScriptCreate, TestScriptUpdate

router = APIRouter()

# Schema for Step Request/Response
class StepBase(BaseModel):
    step_number: int
    action: str
    selector_type: str = ""
    selector_value: str = ""
    option: str = ""
    step_name: Optional[str] = None
    description: Optional[str] = None
    mandatory: bool = False
    skip_on_error: bool = False
    screenshot: bool = False
    sleep: float = 0.0

class StepCreate(StepBase):
    pass

class StepResponse(StepBase):
    id: str
    script_id: str

    class Config:
        orm_mode = True

class StepAssetCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    platform: str # WEB, APP
    steps: List[StepCreate]

class StepAssetResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    platform: Optional[str]
    origin: str
    steps: List[StepResponse]
    is_favorite: bool = False
    is_active: bool = True
    success_rate: float = 0.0
    run_count: int = 0

    class Config:
        orm_mode = True

@router.post("/", response_model=StepAssetResponse)
def create_step_asset(
    *,
    db: Session = Depends(deps.get_db),
    asset_in: StepAssetCreate,
    current_user: models.User = Depends(deps.get_current_active_user),
    project_id: str
) -> Any:
    """
    Create a new Step Asset (TestScript with origin='STEP').
    """
    # 1. Create TestScript
    import uuid
    script_id = str(uuid.uuid4())
    
    script = TestScript(
        id=script_id,
        project_id=project_id,
        name=asset_in.name,
        description=asset_in.description,
        status="DRAFT",
        origin="STEP", # Mark as Step Runner Asset
        platform=asset_in.platform,
        code="", # No python code for now
        engine="playwright" if asset_in.platform == "WEB" else "appium"
    )
    db.add(script)
    
    # 2. Create Steps
    for step_data in asset_in.steps:
        step = TestStep(
            id=str(uuid.uuid4()),
            script_id=script_id,
            step_number=step_data.step_number,
            action=step_data.action,
            selector_type=step_data.selector_type,
            selector_value=step_data.selector_value,
            option=step_data.option,
            step_name=step_data.step_name,
            description=step_data.description,
            mandatory=step_data.mandatory,
            skip_on_error=step_data.skip_on_error,
            screenshot=step_data.screenshot,
            sleep=step_data.sleep
        )
        db.add(step)
    
    db.commit()
    db.refresh(script)
    return script

@router.get("/", response_model=List[StepAssetResponse])
def read_step_assets(
    project_id: str,
    platform: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Retrieve Step Assets (origin='STEP').
    """
    query = db.query(TestScript).filter(
        TestScript.project_id == project_id,
        TestScript.origin == "STEP"
    )
    
    if platform:
        query = query.filter(TestScript.platform == platform)
        
    assets = query.offset(skip).limit(limit).all()
    return assets

@router.get("/{asset_id}", response_model=StepAssetResponse)
def read_step_asset(
    *,
    db: Session = Depends(deps.get_db),
    asset_id: str,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get Step Asset by ID.
    """
    asset = db.query(TestScript).filter(TestScript.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset.origin != "STEP":
         raise HTTPException(status_code=400, detail="Not a Step Asset")
         
    return asset

@router.put("/{asset_id}", response_model=StepAssetResponse)
def update_step_asset(
    *,
    db: Session = Depends(deps.get_db),
    asset_id: str,
    asset_in: StepAssetCreate,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update a Step Asset.
    Replaces all steps with the new list.
    """
    # 1. Get existing asset
    asset = db.query(TestScript).filter(TestScript.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset.origin != "STEP":
         raise HTTPException(status_code=400, detail="Not a Step Asset")

    # 2. Update Script Metadata
    asset.name = asset_in.name
    asset.description = asset_in.description
    asset.platform = asset_in.platform
    asset.engine = "playwright" if asset_in.platform == "WEB" else "appium"
    
    # 3. Delete old steps
    # We can delete directly via relationship or query
    db.query(TestStep).filter(TestStep.script_id == asset_id).delete()
    
    # 4. Create new steps
    import uuid
    for step_data in asset_in.steps:
        step = TestStep(
            id=str(uuid.uuid4()),
            script_id=asset_id,
            step_number=step_data.step_number,
            action=step_data.action,
            selector_type=step_data.selector_type,
            selector_value=step_data.selector_value,
            option=step_data.option,
            step_name=step_data.step_name,
            description=step_data.description,
            mandatory=step_data.mandatory,
            skip_on_error=step_data.skip_on_error,
            screenshot=step_data.screenshot,
            sleep=step_data.sleep
        )
        db.add(step)
    
    db.commit()
    db.refresh(asset)
    return asset

@router.delete("/{asset_id}", response_model=StepAssetResponse)
def delete_step_asset(
    *,
    db: Session = Depends(deps.get_db),
    asset_id: str,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Delete a Step Asset.
    """
    asset = db.query(TestScript).filter(TestScript.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
        
    db.delete(asset)
    db.commit()
    return asset
