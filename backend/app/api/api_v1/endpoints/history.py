from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api import deps

router = APIRouter()

@router.get("/", response_model=List[schemas.TestHistory])
def read_history(
    db: Session = Depends(deps.get_db),
    project_id: str = "",
    script_id: str = "",
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Retrieve test history.
    """
    if script_id:
        return crud.history.get_by_script(db, script_id=script_id, skip=skip, limit=limit)
    if project_id:
        return crud.history.get_by_project(db, project_id=project_id, skip=skip, limit=limit)
    return []

@router.post("/", response_model=schemas.TestHistory)
def create_history_entry(
    *,
    db: Session = Depends(deps.get_db),
    history_in: schemas.TestHistoryCreate,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Record new test history.
    """
    history = crud.history.create(db, obj_in=history_in)
    
    # Update Script Statistics
    if history_in.script_id:
        script = crud.script.get(db, id=history_in.script_id)
        if script:
            # 1. Get all history for stats
            all_history = crud.history.get_by_script(db, script_id=history_in.script_id, limit=1000)
            total_runs = len(all_history)
            passed = sum(1 for h in all_history if h.status == 'passed')
            success_rate = int((passed / total_runs) * 100) if total_runs > 0 else 0
            
            # 2. Update Script
            from app.schemas.test_script import TestScriptUpdate
            update_data = TestScriptUpdate(
                run_count=total_runs,
                success_rate=success_rate,
                last_run=history.run_date,
                # maintain other fields
                name=script.name,
                description=script.description,
                code=script.code
            )
            crud.script.update(db, db_obj=script, obj_in=update_data)

    return history

@router.get("/{history_id}", response_model=Any)
def read_history_detail(
    history_id: str,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get history by ID with full details (including AI session if exists).
    """
    history = crud.history.get(db, id=history_id)
    if not history:
        raise HTTPException(status_code=404, detail="History not found")
    
    # Manually construct response to include ai_session since Pydantic schema might be distinct
    # Or rely on ORM lazy loading if schema supports it.
    # Let's return a dict merge.
    resp = {c.name: getattr(history, c.name) for c in history.__table__.columns}
    
    if history.ai_session:
        resp["ai_session"] = {
            "id": history.ai_session.id,
            "target_url": history.ai_session.target_url,
            "goal": history.ai_session.goal,
            "steps_data": history.ai_session.steps_data,
            "final_score": history.ai_session.final_score,
            "is_assetized": history.ai_session.is_assetized,
            "generated_scenario_id": history.ai_session.generated_scenario_id,
            "generated_script_id": history.ai_session.generated_script_id
        }
        
    return resp
