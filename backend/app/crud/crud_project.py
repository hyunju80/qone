from typing import List
from sqlalchemy.orm import Session
from app.crud.base import CRUDBase
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate

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

project = CRUDProject(Project)
