import logging
from app.db.session import engine
from app.db.base import Base
from app.models.test import Persona

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_tables():
    logger.info("Creating tables...")
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Tables created successfully.")
    except Exception as e:
        logger.error(f"Error creating tables: {e}")

if __name__ == "__main__":
    create_tables()
