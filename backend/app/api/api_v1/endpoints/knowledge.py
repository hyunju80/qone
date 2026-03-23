from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Any, Optional
import os
import shutil
import uuid
import json
import pdfplumber
from pptx import Presentation
import pandas as pd

from app.api import deps
from app.models.knowledge import KnowledgeDocument, KnowledgeMap, KnowledgeItem
from pydantic import BaseModel

class KnowledgeMapCreate(BaseModel):
    project_id: str
    title: str
    url: str
    map_json: Any

router = APIRouter()

UPLOAD_DIR = "uploads/knowledge"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("/documents/{project_id}")
def get_documents(
    project_id: str,
    db: Session = Depends(deps.get_db),
) -> Any:
    docs = db.query(KnowledgeDocument).filter(KnowledgeDocument.project_id == project_id).order_by(KnowledgeDocument.created_at.desc()).all()
    return docs

@router.get("/documents/{doc_id}/items")
def get_document_items(
    doc_id: str,
    db: Session = Depends(deps.get_db),
) -> Any:
    items = db.query(KnowledgeItem).filter(KnowledgeItem.document_id == doc_id).order_by(KnowledgeItem.page_number.asc()).all()
    return items

@router.post("/documents")
async def upload_document(
    project_id: str = Form(...),
    title: str = Form(...),
    category: str = Form(...),
    sub_category: str = Form(None),
    mapping_config: str = Form('{}'), # JSON string
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
) -> Any:
    # Save file
    file_ext = os.path.splitext(file.filename)[1].lower()
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    config = json.loads(mapping_config)
    depth_key = config.get("depth_field", "화면경로")
    class_key = config.get("classification_field", "구분")
    title_key = config.get("title_field", "화면명")
    delimiter = config.get("delimiter", ">")

    doc = KnowledgeDocument(
        project_id=project_id,
        title=title,
        file_path=file_path,
        category=category,
        sub_category=sub_category
    )
    db.add(doc)
    db.flush() # Get doc.id
    
    # --- Extraction Logic ---
    items = []
    
    if file_ext == ".pdf":
        with pdfplumber.open(file_path) as pdf:
            for i, page in enumerate(pdf.pages):
                text_content = page.extract_text()
                # Basic rule: Look for keywords and extract following text
                # In real scenario, we might want to look at tables or specific coordinates
                extracted_depth = ""
                extracted_class = ""
                extracted_title = ""
                
                # Simple line-based search for demo/first version
                lines = text_content.split('\n') if text_content else []
                for line in lines:
                    if depth_key in line:
                        extracted_depth = line.split(depth_key)[-1].strip(": shadow").strip()
                    if class_key in line:
                        extracted_class = line.split(class_key)[-1].strip(": shadow").strip()
                    if title_key in line:
                        extracted_title = line.split(title_key)[-1].strip(": shadow").strip()

                # Split depth by delimiter
                depths = [d.strip() for d in extracted_depth.split(delimiter)]
                
                item = KnowledgeItem(
                    document_id=doc.id,
                    project_id=project_id,
                    page_number=i + 1,
                    classification=extracted_class,
                    depth_1=depths[0] if len(depths) > 0 else "",
                    depth_2=depths[1] if len(depths) > 1 else "",
                    depth_3=depths[2] if len(depths) > 2 else "",
                    title=extracted_title or f"Page {i+1}",
                    content={"raw_text": text_content[:1000]} # Store snippet
                )
                db.add(item)
                items.append(item)
    
    elif file_ext in [".xlsx", ".xls"]:
        df = pd.read_excel(file_path)
        for i, row in df.iterrows():
            # Assume row-based mapping for Excel
            extracted_depth = str(row.get(depth_key, ""))
            depths = [d.strip() for d in extracted_depth.split(delimiter)]
            item = KnowledgeItem(
                document_id=doc.id,
                project_id=project_id,
                page_number=i + 1,
                classification=str(row.get(class_key, "")),
                depth_1=depths[0] if len(depths) > 0 else "",
                depth_2=depths[1] if len(depths) > 1 else "",
                depth_3=depths[2] if len(depths) > 2 else "",
                title=str(row.get(title_key, f"Row {i+1}")),
                content=row.to_dict()
            )
            db.add(item)
            items.append(item)
            
    # For PPT, we skip detailed logic for now but provide placeholder
    
    db.commit()
    db.refresh(doc)
    return doc

@router.delete("/documents/{doc_id}")
def delete_document(
    doc_id: str,
    db: Session = Depends(deps.get_db)
) -> Any:
    doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)
        
    db.delete(doc)
    db.commit()
    return {"status": "ok"}

# --- Knowledge Map Endpoints ---

@router.get("/maps/{project_id}")
def get_maps(
    project_id: str,
    db: Session = Depends(deps.get_db),
) -> Any:
    maps = db.query(KnowledgeMap).filter(KnowledgeMap.project_id == project_id).order_by(KnowledgeMap.created_at.desc()).all()
    return maps

@router.post("/maps")
def create_map(
    map_in: KnowledgeMapCreate,
    db: Session = Depends(deps.get_db),
) -> Any:
    db_obj = KnowledgeMap(
        project_id=map_in.project_id,
        title=map_in.title,
        url=map_in.url,
        map_json=map_in.map_json
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

@router.delete("/maps/{map_id}")
def delete_map(
    map_id: str,
    db: Session = Depends(deps.get_db)
) -> Any:
    map_obj = db.query(KnowledgeMap).filter(KnowledgeMap.id == map_id).first()
    if not map_obj:
        raise HTTPException(status_code=404, detail="Map not found")
        
    db.delete(map_obj)
    db.commit()
    return {"status": "ok"}

class KnowledgeMapUpdate(BaseModel):
    title: Optional[str] = None
    map_json: Optional[Any] = None

@router.put("/maps/{map_id}")
def update_map(
    map_id: str,
    map_in: KnowledgeMapUpdate,
    db: Session = Depends(deps.get_db)
) -> Any:
    map_obj = db.query(KnowledgeMap).filter(KnowledgeMap.id == map_id).first()
    if not map_obj:
        raise HTTPException(status_code=404, detail="Map not found")
        
    update_data = map_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(map_obj, field, value)
        
    db.add(map_obj)
    db.commit()
    db.refresh(map_obj)
    return map_obj
