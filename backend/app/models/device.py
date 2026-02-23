from sqlalchemy import Column, String, JSON
from app.db.base_class import Base

class Device(Base):
    id = Column(String, primary_key=True, index=True)
    alias = Column(String)
    protocol = Column(String)
    os = Column(String) # Android, iOS, Windows, macOS
    model = Column(String)
    status = Column(String) # Available, In-Use, Offline
    specs = Column(JSON, default={})
    current_project = Column(String, nullable=True) # Could be FK to Project if strictly managed
