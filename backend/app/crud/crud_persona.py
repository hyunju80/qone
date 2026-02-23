from typing import List, Optional
from sqlalchemy.orm import Session
from app.crud.base import CRUDBase
from app.models.test import Persona
from app.schemas.persona import PersonaCreate, PersonaUpdate

class CRUDPersona(CRUDBase[Persona, PersonaCreate, PersonaUpdate]):
    def get_multi_by_project(
        self, db: Session, *, project_id: str, include_global: bool = True, skip: int = 0, limit: int = 100
    ) -> List[Persona]:
        query = db.query(self.model)
        if include_global:
            # project_id match OR global (project_id='global' or null depending on convention)
            # Backend model says project_id nullable. Let's assume 'global' string or None.
            # Frontend sends 'global'.
            from sqlalchemy import or_
            query = query.filter(or_(
                self.model.project_id == project_id, 
                self.model.project_id == 'global',
                self.model.project_id.is_(None)
            ))
        else:
            query = query.filter(self.model.project_id == project_id)
            
        return query.offset(skip).limit(limit).all()

    def create(self, db: Session, *, obj_in: PersonaCreate) -> Persona:
        import time
        obj_data = obj_in.model_dump()
        if obj_data.get("project_id") == "global":
            obj_data["project_id"] = None
            
        db_obj = Persona(
            id=f"p_{int(time.time()*1000)}",
            **obj_data
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, *, db_obj: Persona, obj_in: PersonaUpdate | dict) -> Persona:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)
            
        if update_data.get("project_id") == "global":
            update_data["project_id"] = None
            
        return super().update(db, db_obj=db_obj, obj_in=update_data)

persona = CRUDPersona(Persona)
