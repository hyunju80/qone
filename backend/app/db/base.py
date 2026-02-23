from app.db.base_class import Base

# Import all models here for Alembic/SQLAlchemy to find them
from app.models.user import User
from app.models.project import Project, ProjectAccess
# Customer model file seems missing or inside others, skipping for now to avoid error, 
# although User.py defined CustomerAccount, so it's loaded via models.user
from app.models.test import TestScript, TestHistory, TestSchedule, Scenario, Persona, TestObject, TestAction, TestDataset
from app.models.ai import AiExplorationSession
