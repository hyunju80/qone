from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class AiExplorationSession(Base):
    id = Column(String, primary_key=True, index=True)
    history_id = Column(String, ForeignKey("testhistory.id"), unique=True)
    
    target_url = Column(String)
    goal = Column(String)
    persona_id = Column(String, ForeignKey("persona.id"), nullable=True)
    
    # Stores the full list of ExplorationStep objects (with scores, reasoning, screenshots)
    steps_data = Column(JSON) 
    
    final_score = Column(Integer)
    is_assetized = Column(Boolean, default=False)
    generated_scenario_id = Column(String, nullable=True) # Linked Scenario ID
    generated_script_id = Column(String, nullable=True) # Linked Script ID
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    history = relationship("TestHistory", back_populates="ai_session")
