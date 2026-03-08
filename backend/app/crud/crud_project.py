from typing import List, Any, Union
from sqlalchemy.orm import Session
from app.crud.base import CRUDBase
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate
from sqlalchemy.orm.attributes import flag_modified

class CRUDProject(CRUDBase[Project, ProjectCreate, ProjectUpdate]):
    def get_multi_by_owner(self, db: Session, *, customer_id: str, skip: int = 0, limit: int = 100) -> List[Project]:
        return db.query(self.model)\
            .filter(Project.customer_account_id == customer_id)\
            .offset(skip)\
            .limit(limit)\
            .all()

    def get_projects_for_user(self, db: Session, *, user_id: str) -> List[Project]:
        from app.models.project import ProjectAccess
        return db.query(self.model)\
            .join(ProjectAccess, ProjectAccess.project_id == self.model.id)\
            .filter(ProjectAccess.user_id == user_id)\
            .all()

    def update(
        self, db: Session, *, db_obj: Project, obj_in: Union[ProjectUpdate, dict[str, Any]]
    ) -> Project:
        # Perform standard update first
        obj = super().update(db, db_obj=db_obj, obj_in=obj_in)
        
        # Determine which fields were actually updated
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)
            
        json_fields = ["categories", "target_devices", "environments", "object_repo", "mobile_config"]
        modified_any = False
        
        for field in json_fields:
            if field in update_data:
                flag_modified(obj, field)
                modified_any = True
                
        if modified_any:
            db.add(obj)
            db.commit()
            db.refresh(obj)
            
        return obj

project = CRUDProject(Project)
