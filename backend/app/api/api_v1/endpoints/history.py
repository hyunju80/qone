from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.schemas import self_healing
from app.api import deps
from app.models.test import TestScript, SelfHealingLog

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
    
    # Update Script/Asset Statistics
    if history_in.script_id:
        from app.models.test import TestScript
        
        script = db.query(TestScript).filter(TestScript.id == history_in.script_id).first()
        if script:
            # 1. Get all history for stats
            all_history = crud.history.get_by_script(db, script_id=history_in.script_id, limit=1000)
            total_runs = len(all_history)
            passed = sum(1 for h in all_history if h.status == 'passed')
            success_rate = round((passed / total_runs) * 100, 1) if total_runs > 0 else 0
            
            # 2. Update Target
            script.run_count = total_runs
            script.success_rate = success_rate
            script.last_run = history.run_date
            
            db.add(script)
            db.commit()
            print(f"DEBUG: Updated stats for {history_in.script_id}: runs={total_runs}, rate={success_rate}%")

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

@router.get("/healing/{log_id}", response_model=self_healing.SelfHealingLog)
def read_healing_status(
    *,
    db: Session = Depends(deps.get_db),
    log_id: str
) -> Any:
    """
    Get status of a specific self-healing task.
    """
    log = db.query(SelfHealingLog).filter(SelfHealingLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Healing log not found")
    return log

@router.get("/{id}/healing-logs", response_model=List[self_healing.SelfHealingLog])
def read_healing_logs(
    *,
    db: Session = Depends(deps.get_db),
    id: str
) -> Any:
    """
    Get self-healing logs for a specific history entry.
    """
    history = crud.history.get(db, id=id)
    if not history:
        raise HTTPException(status_code=404, detail="History not found")
    
    logs = db.query(SelfHealingLog).filter(SelfHealingLog.history_id == id).all()
    return logs

@router.get("/all/healed-assets/list", response_model=List[self_healing.SelfHealingLog])
def read_all_healed_assets(
    *,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Get all unique assets that have been healed.
    """
    # Return all successful healings ordered by date
    logs = db.query(SelfHealingLog).filter(SelfHealingLog.status == "success").order_by(SelfHealingLog.created_at.desc()).all()
    return logs

@router.post("/{history_id}/jira", response_model=schemas.TestHistory)
def assign_jira(
    *,
    db: Session = Depends(deps.get_db),
    history_id: str,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Assign a dummy Jira ID to a test history record.
    """
    history = crud.history.get(db, id=history_id)
    if not history:
        raise HTTPException(status_code=404, detail="History not found")
    
    # Generate a dummy Jira ID if not already present
    if not history.jira_id:
        import random
        dummy_id = f"QONE-{random.randint(1000, 9999)}"
        history.jira_id = dummy_id
        db.add(history)
        db.commit()
        db.refresh(history)
        print(f"DEBUG: Assigned Jira ID {dummy_id} to history {history_id}")
    
    return history
