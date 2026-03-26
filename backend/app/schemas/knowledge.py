from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime

# --- Knowledge Item ---
class KnowledgeItemBase(BaseModel):
    project_id: str
    page_number: int
    classification: Optional[str] = None
    depth_1: Optional[str] = None
    depth_2: Optional[str] = None
    depth_3: Optional[str] = None
    title: Optional[str] = None
    content: Optional[Any] = None
    image_path: Optional[str] = None

class KnowledgeHierarchyItem(BaseModel):
    name: str
    level: str  # 'category', 'classification', 'depth_1', 'depth_2', 'depth_3'
    item_ids: List[UUID] = []
    children: List["KnowledgeHierarchyItem"] = []

class KnowledgeItemCreate(KnowledgeItemBase):
    document_id: UUID

class KnowledgeItemUpdate(BaseModel):
    classification: Optional[str] = None
    depth_1: Optional[str] = None
    depth_2: Optional[str] = None
    depth_3: Optional[str] = None
    title: Optional[str] = None
    content: Optional[Any] = None

class KnowledgeItem(KnowledgeItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    document_id: UUID
    created_at: datetime

# --- Knowledge Document ---
class KnowledgeDocumentBase(BaseModel):
    project_id: str
    title: str
    category: str
    sub_category: Optional[str] = None

class KnowledgeDocumentCreate(KnowledgeDocumentBase):
    file_path: str

class KnowledgeDocumentUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    sub_category: Optional[str] = None

class KnowledgeDocument(KnowledgeDocumentBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    file_path: str
    created_at: datetime
    # Optionally include items if needed
    # items: List[KnowledgeItem] = []

# --- Knowledge Map ---
class KnowledgeMapBase(BaseModel):
    project_id: str
    title: str
    url: Optional[str] = None
    map_json: Optional[Any] = None

class KnowledgeMapCreate(KnowledgeMapBase):
    pass

class KnowledgeMapUpdate(BaseModel):
    title: Optional[str] = None
    url: Optional[str] = None
    map_json: Optional[Any] = None

class KnowledgeMap(KnowledgeMapBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
