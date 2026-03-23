import uuid
from sqlalchemy import Column, String, DateTime, JSON, Text, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class KnowledgeDocument(Base):
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(String, index=True)
    title = Column(String, index=True)
    file_path = Column(String, nullable=False)
    category = Column(String, index=True)  
    sub_category = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship to extracted items
    items = relationship("KnowledgeItem", back_populates="document", cascade="all, delete-orphan")

class KnowledgeItem(Base):
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("knowledgedocument.id"), index=True)
    project_id = Column(String, index=True)
    page_number = Column(Integer)
    classification = Column(String) # 구분
    depth_1 = Column(String)
    depth_2 = Column(String)
    depth_3 = Column(String)
    title = Column(String) # 화면명
    content = Column(JSON) # Extracted elements
    image_path = Column(String, nullable=True) # Path to page image
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    document = relationship("KnowledgeDocument", back_populates="items")

class KnowledgeMap(Base):
    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, index=True)
    title = Column(String, index=True)
    url = Column(String)
    map_json = Column(JSON) # Action Map Structure
    created_at = Column(DateTime(timezone=True), server_default=func.now())
