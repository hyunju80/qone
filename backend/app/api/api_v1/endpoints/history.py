from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app import crud, models, schemas
from app.schemas import self_healing
from app.api import deps
from app.models.test import TestHistory, TestScript, SelfHealingLog
from app.models.project import ProjectInsight
from app.schemas.test_history import TestHistoryCreate, TestHistorySummary, ProjectInsightCreate, ProjectInsight as ProjectInsightSchema
import uuid

router = APIRouter()

@router.post("/projects/{project_id}/insights", response_model=ProjectInsightSchema)
def save_project_insight(
    project_id: str,
    insight_in: ProjectInsightCreate,
    db: Session = Depends(deps.get_db)
):
    """
    Saves a new project insight (AI Report).
    """
    insight = ProjectInsight(
        id=str(uuid.uuid4()),
        project_id=project_id,
        **insight_in.dict()
    )
    db.add(insight)
    db.commit()
    db.refresh(insight)
    return insight

@router.get("/projects/{project_id}/insights", response_model=List[ProjectInsightSchema])
def get_project_insights(
    project_id: str,
    db: Session = Depends(deps.get_db)
):
    """
    Gets all insights for a project.
    """
    from app.models.project import ProjectInsight
    return db.query(ProjectInsight)\
        .filter(ProjectInsight.project_id == project_id)\
        .order_by(ProjectInsight.created_at.desc())\
        .all()

@router.get("/projects/{project_id}/insights/latest", response_model=Optional[ProjectInsightSchema])
def get_latest_insight(
    project_id: str,
    db: Session = Depends(deps.get_db)
):
    """
    Gets the most recent insight for a project.
    """
    from app.models.project import ProjectInsight
    return db.query(ProjectInsight)\
        .filter(ProjectInsight.project_id == project_id)\
        .order_by(ProjectInsight.created_at.desc())\
        .first()

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

@router.get("/active-defects", response_model=List[schemas.TestHistory])
def read_active_defects(
    db: Session = Depends(deps.get_db),
    project_id: str = "",
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Retrieve all active defects (latest failure for each script) in a project.
    """
    from app.models.test import TestHistory
    from sqlalchemy import desc
    
    if not project_id:
        return []
        
    # Get only the latest run for each script, where the latest run was FAILED, AND script is ACTIVE
    all_recent = db.query(TestHistory).join(TestHistory.script).distinct(TestHistory.script_id).filter(
        TestHistory.project_id == project_id,
        TestScript.is_active == True
    ).options(joinedload(TestHistory.script)).order_by(TestHistory.script_id, desc(TestHistory.run_date)).all()
    
    active_defects = [h for h in all_recent if h.script_id and h.status == 'failed']
    return active_defects

@router.get("/summary", response_model=schemas.TestHistorySummary)
def read_history_summary(
    db: Session = Depends(deps.get_db),
    project_id: str = "",
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get summary statistics for history.
    """
    from app.models.test import TestHistory, TestScript
    from datetime import datetime, timedelta
    
    if not project_id:
        return {
            "total": 0, "passed": 0, "failed": 0, "rate": 0, 
            "pipelineRuns": 0, "scheduledRuns": 0,
            "total_assets": 0, "active_defects": 0, "weekly_growth": 0
        }
    
    # 1. Base Execution Stats
    total = db.query(TestHistory).filter(TestHistory.project_id == project_id).count()
    passed = db.query(TestHistory).filter(TestHistory.project_id == project_id, TestHistory.status == 'passed').count()
    failed = total - passed
    rate = round((passed / total) * 100, 1) if total > 0 else 0
    pipelineRuns = db.query(TestHistory).filter(TestHistory.project_id == project_id, TestHistory.trigger == 'pipeline').count()
    scheduledRuns = db.query(TestHistory).filter(TestHistory.project_id == project_id, TestHistory.trigger == 'scheduled').count()
    
    # 2. Asset Stats (Golden Asset Fleet) - Only Active Assets
    total_assets = db.query(TestScript).filter(TestScript.project_id == project_id, TestScript.is_active == True).count()
    
    # Weekly growth: Created in the last 7 days
    weekly_growth = 0
    try:
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        weekly_growth = db.query(TestScript).filter(
            TestScript.project_id == project_id,
            TestScript.created_at >= seven_days_ago
        ).count()
    except Exception as e:
        print(f"DEBUG: Failed to calculate weekly growth: {e}")
        weekly_growth = 0

    # 3. Active Defects (Latest run is failed) - Only for Active Assets
    # Optimized: Use DISTINCT ON to get only the latest history record for each script
    # This avoids fetching all history records and processing them in Python.
    from sqlalchemy import desc
    all_recent = db.query(TestHistory).join(TestHistory.script).distinct(TestHistory.script_id).filter(
        TestHistory.project_id == project_id,
        TestScript.is_active == True
    ).options(joinedload(TestHistory.script)).order_by(TestHistory.script_id, desc(TestHistory.run_date)).all()
    
    active_defects = 0
    active_defects_by_origin = {"AI": 0, "STEP": 0, "AI_EXPLORATION": 0, "MANUAL": 0}
    
    for h in all_recent:
        if not h.script_id: continue
        if h.status == 'failed':
            active_defects += 1
            if h.script:
                origin = h.script.origin or "MANUAL"
                active_defects_by_origin[origin] = active_defects_by_origin.get(origin, 0) + 1
    
    return {
        "total": total,
        "passed": passed,
        "failed": failed,
        "rate": rate,
        "pipelineRuns": pipelineRuns,
        "scheduledRuns": scheduledRuns,
        "total_assets": total_assets,
        "active_defects": active_defects,
        "weekly_growth": weekly_growth,
        "active_defects_by_origin": active_defects_by_origin
    }

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
    all_logs = db.query(SelfHealingLog).filter(
        SelfHealingLog.status == "success"
    ).order_by(SelfHealingLog.created_at.desc()).all()
    
    seen_scripts = set()
    unique_logs = []
    for log in all_logs:
        if log.script_id not in seen_scripts:
            unique_logs.append(log)
            seen_scripts.add(log.script_id)
            
    return unique_logs

@router.get("/pending-healing/list", response_model=List[schemas.TestHistory])
def read_pending_healing(
    *,
    db: Session = Depends(deps.get_db),
    project_id: str
) -> Any:
    # 1. Fetch only the LATEST state for each unique script in this project
    # Optimized: Use DISTINCT ON to de-dupe at the database level.
    from sqlalchemy import desc
    all_recent_history = db.query(TestHistory).distinct(TestHistory.script_id).filter(
        TestHistory.project_id == project_id
    ).options(joinedload(TestHistory.script)).order_by(TestHistory.script_id, desc(TestHistory.run_date)).all()
    
    pending = []
    
    for history in all_recent_history:
        if not history.script_id:
            continue
            
        # Check if the LATEST state is 'failed' and AI-Healing is enabled
        if history.status == "failed" and history.script and history.script.enable_ai_test:
            # 3. Exclude if healing is already successful for THIS specific failure
            already_healed = db.query(SelfHealingLog).filter(
                SelfHealingLog.history_id == history.id,
                SelfHealingLog.status == "success"
            ).first()
            
            if not already_healed:
                pending.append(history)
                
    return pending

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
