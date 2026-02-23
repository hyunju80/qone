from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi.encoders import jsonable_encoder

from app.crud.base import CRUDBase
from app.models.test import TestScript, Scenario, TestHistory, TestSchedule, ScheduleScript
from app.schemas.test_script import TestScriptCreate, TestScriptUpdate
from app.schemas.scenario import ScenarioCreate, ScenarioUpdate
from app.schemas.test_history import TestHistoryCreate, TestHistoryUpdate
from app.schemas.test_schedule import TestScheduleCreate, TestScheduleUpdate

class CRUDTestScript(CRUDBase[TestScript, TestScriptCreate, TestScriptUpdate]):
    def get_by_project(self, db: Session, project_id: str, skip: int = 0, limit: int = 100) -> List[TestScript]:
        return db.query(self.model).filter(self.model.project_id == project_id).offset(skip).limit(limit).all()

    def create(self, db: Session, *, obj_in: TestScriptCreate) -> TestScript:
        import time
        db_obj = TestScript(
            id=f"scr_{int(time.time()*1000)}",
            **obj_in.model_dump()
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

class CRUDScenario(CRUDBase[Scenario, ScenarioCreate, ScenarioUpdate]):
    def get_by_project(self, db: Session, project_id: str, skip: int = 0, limit: int = 100) -> List[Scenario]:
        return db.query(self.model).filter(self.model.project_id == project_id).offset(skip).limit(limit).all()

    def create(self, db: Session, *, obj_in: ScenarioCreate) -> Scenario:
        import time
        db_obj = Scenario(
            id=f"scn_{int(time.time()*1000)}",
            **obj_in.model_dump()
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

class CRUDTestHistory(CRUDBase[TestHistory, TestHistoryCreate, TestHistoryUpdate]):
    def get_by_script(self, db: Session, script_id: str, skip: int = 0, limit: int = 100) -> List[TestHistory]:
        return db.query(self.model).filter(self.model.script_id == script_id).order_by(self.model.run_date.desc()).offset(skip).limit(limit).all()
        
    def get_by_project(self, db: Session, project_id: str, skip: int = 0, limit: int = 100) -> List[TestHistory]:
        return db.query(self.model).join(TestScript).filter(TestScript.project_id == project_id).order_by(self.model.run_date.desc()).offset(skip).limit(limit).all()

    def create(self, db: Session, *, obj_in: TestHistoryCreate) -> TestHistory:
        import time
        db_obj = TestHistory(
            id=f"hist_{int(time.time()*1000)}",
            **obj_in.model_dump()
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

class CRUDTestSchedule(CRUDBase[TestSchedule, TestScheduleCreate, TestScheduleUpdate]):
    def get_by_project(self, db: Session, project_id: str, skip: int = 0, limit: int = 100) -> List[TestSchedule]:
        return db.query(self.model).filter(self.model.project_id == project_id).offset(skip).limit(limit).all()

    def update(
        self,
        db: Session,
        *,
        db_obj: TestSchedule,
        obj_in: TestScheduleUpdate | dict
    ) -> TestSchedule:
        # Standard update
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)
            
        # Extract script_ids if present
        script_ids = update_data.pop('script_ids', None)
        
        # Update standard fields (excluding script_ids which isn't a column)
        obj_data = jsonable_encoder(db_obj)
        for field in obj_data:
            if field in update_data:
                setattr(db_obj, field, update_data[field])
        
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        
        # Update M2M scripts if script_ids was provided
        if script_ids is not None:
            # Delete existing links
            db.query(ScheduleScript).filter(ScheduleScript.schedule_id == db_obj.id).delete()
            # Add new links
            for sid in script_ids:
                link = ScheduleScript(schedule_id=db_obj.id, script_id=sid)
                db.add(link)
            db.commit()
            
        return db_obj

    def remove(self, db: Session, *, id: str) -> TestSchedule:
        # Delete association links first (if no cascade)
        db.query(ScheduleScript).filter(ScheduleScript.schedule_id == id).delete()
        
        obj = db.query(self.model).get(id)
        if obj:
            db.delete(obj)
            db.commit()
        return obj

    def create(self, db: Session, *, obj_in: TestScheduleCreate) -> TestSchedule:
        import time
        
        # Extract script_ids to handle manually
        script_ids = obj_in.script_ids
        obj_data = obj_in.model_dump(exclude={'script_ids'})
        
        db_obj = TestSchedule(
            id=f"sch_{int(time.time()*1000)}",
            **obj_data
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        
        # Handle M2M relations
        if script_ids:
            for sid in script_ids:
                link = ScheduleScript(schedule_id=db_obj.id, script_id=sid)
                db.add(link)
            db.commit()
            
        return db_obj

script = CRUDTestScript(TestScript)
scenario = CRUDScenario(Scenario)
history = CRUDTestHistory(TestHistory)
schedule = CRUDTestSchedule(TestSchedule)


