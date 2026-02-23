from app.db.base import Base
from app.db.session import engine
from app.models.ai import AiExplorationSession
# Import other models to ensure relationships are valid
from app.models.test import TestHistory

def init():
    print("Creating AI tables...")
    Base.metadata.create_all(bind=engine)
    print("Done.")

if __name__ == "__main__":
    init()
