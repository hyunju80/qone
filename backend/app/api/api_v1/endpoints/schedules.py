from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.services.scheduler import scheduler
from app.api import deps

router = APIRouter()

@router.get("/", response_model=List[schemas.TestSchedule])
def read_schedules(
    db: Session = Depends(deps.get_db),
    project_id: str = "",
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Retrieve schedules.
    """
    if project_id:
        return crud.schedule.get_by_project(db, project_id=project_id, skip=skip, limit=limit)
    return []

@router.post("/", response_model=schemas.TestSchedule)
def create_schedule(
    *,
    db: Session = Depends(deps.get_db),
    schedule_in: schemas.TestScheduleCreate,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Create new schedule.
    """
    schedule = crud.schedule.create(db, obj_in=schedule_in)
    scheduler.add_job(schedule)
    return schedule

@router.put("/{schedule_id}", response_model=schemas.TestSchedule)
def update_schedule(
    *,
    db: Session = Depends(deps.get_db),
    schedule_id: str,
    schedule_in: schemas.TestScheduleUpdate,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update a schedule.
    """
    schedule_obj = crud.schedule.get(db, id=schedule_id)
    if not schedule_obj:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    schedule = crud.schedule.update(db, db_obj=schedule_obj, obj_in=schedule_in)
    scheduler.add_job(schedule)
    return schedule

@router.delete("/{schedule_id}", response_model=schemas.TestSchedule)
def delete_schedule(
    *,
    db: Session = Depends(deps.get_db),
    schedule_id: str,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Delete a schedule.
    """
    schedule = crud.schedule.get(db, id=schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
        
    schedule = crud.schedule.remove(db, id=schedule_id)
    scheduler.remove_job(schedule_id)
    return schedule
