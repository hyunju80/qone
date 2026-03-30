from app.db.base_class import Base

# Import all models here for Alembic/SQLAlchemy to find them
from app.models.user import User, PermissionMatrix
from app.models.test import TestScript, TestHistory, TestSchedule, Scenario, Persona, TestObject, TestAction, TestDataset, ActionMap
from app.models.project import Project, ProjectAccess, ProjectInsight
from app.models.ai import AiExplorationSession
from app.models.knowledge import KnowledgeDocument, KnowledgeMap, KnowledgeItem
