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

from app import models, schemas
from app.api import deps

router = APIRouter()

UPLOAD_DIR = "uploads/knowledge"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("/documents/{project_id}", response_model=List[schemas.KnowledgeDocument])
def get_documents(
    project_id: str,
    db: Session = Depends(deps.get_db),
) -> Any:
    docs = db.query(models.KnowledgeDocument).filter(models.KnowledgeDocument.project_id == project_id).order_by(models.KnowledgeDocument.created_at.desc()).all()
    return docs

@router.get("/documents/{doc_id}/items", response_model=List[schemas.KnowledgeItem])
def get_document_items(
    doc_id: str,
    db: Session = Depends(deps.get_db),
) -> Any:
    items = db.query(models.KnowledgeItem).filter(models.KnowledgeItem.document_id == doc_id).order_by(models.KnowledgeItem.page_number.asc()).all()
    return items

@router.post("/documents", response_model=schemas.KnowledgeDocument)
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

    doc = models.KnowledgeDocument(
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
    
    # Parse mapping config
    mapping = json.loads(mapping_config) if isinstance(mapping_config, str) else mapping_config
    req_map = mapping.get("required", {})
    custom_map = mapping.get("custom", [])
    
    depth_cfg = req_map.get("depth", {"keyword": "화면경로", "delimiter": ">"})
    class_cfg = req_map.get("classification", {"keyword": "구분"})
    title_cfg = req_map.get("title", {"keyword": "화면명"})
    
    depth_key = depth_cfg.get("keyword")
    delimiter = depth_cfg.get("delimiter", ">")
    class_key = class_cfg.get("keyword")
    title_key = title_cfg.get("keyword")

    # Collect all keywords to use as stop words for cleaner extraction
    STOP_WORDS = ["P.NO", "화면ID", "화면ID / 화면명", "Description", "비고"]
    for key in [depth_key, class_key, title_key]:
        if key and key not in STOP_WORDS: STOP_WORDS.append(key)
    for c in custom_map:
        ck = c.get("keyword")
        if ck and ck not in STOP_WORDS: STOP_WORDS.append(ck)

    def clean_extracted_value(value: str, current_key: str) -> str:
        if not value: return ""
        min_pos = len(value)
        for stop_word in STOP_WORDS:
            if stop_word == current_key: continue
            pos = value.find(stop_word)
            if pos != -1 and pos < min_pos:
                min_pos = pos
        return value[:min_pos].strip(": ").strip()

    IMG_DIR = os.path.join(UPLOAD_DIR, "images")
    os.makedirs(IMG_DIR, exist_ok=True)

    if file_ext == ".pdf":
        with pdfplumber.open(file_path) as pdf:
            for i, page in enumerate(pdf.pages):
                # --- Image Capture ---
                image_filename = f"{uuid.uuid4()}.png"
                image_path = os.path.join(IMG_DIR, image_filename)
                try:
                    page.to_image(resolution=150).save(image_path)
                    relative_image_path = f"/{UPLOAD_DIR}/images/{image_filename}"
                except Exception as e:
                    print(f"Failed to capture image: {e}")
                    relative_image_path = None

                # --- One Item Per Page Logic ---
                text_content = page.extract_text()
                if not text_content: continue
                
                # Helper to find Description column more reliably
                description_text = ""
                # Search for the "Description" or "비고" header
                desc_headers = page.search("Description") or page.search("비고")
                if desc_headers:
                    # Take the first occurrence. We want everything to the right of its x0, 
                    # but give it a larger buffer to the left to avoid truncation (e.g. -50px)
                    # Headers often start slightly to the right of the cell content.
                    header_x0 = desc_headers[0]["x0"]
                    # Usually the column before Description (화면명/Title or No) ends quite far to the left.
                    # We'll take a crop of the right 60% of the page or similar, or just x0 - 40.
                    crop_left = max(0, header_x0 - 60) 
                    desc_crop = page.within_bbox((crop_left, 0, page.width, page.height))
                    description_text = desc_crop.extract_text()
                    if description_text:
                        # Clean up: Remove the header word "Description" if it was captured
                        description_text = description_text.replace("Description", "").replace("비고", "").strip()

                # Extract other fields line-by-line (Original Heuristic)
                extracted_depth = ""
                extracted_class = ""
                extracted_title = ""
                custom_values = {}
                
                lines = text_content.split('\n')
                for line in lines:
                    if depth_key and depth_key in line:
                        val = line.split(depth_key)[-1]
                        extracted_depth = clean_extracted_value(val, depth_key)
                    if class_key and class_key in line:
                        val = line.split(class_key)[-1]
                        extracted_class = clean_extracted_value(val, class_key)
                    
                    matched_title_key = None
                    if title_key and title_key in line: matched_title_key = title_key
                    elif "화면명" in line: matched_title_key = "화면명"
                    elif "화면ID" in line: matched_title_key = "화면ID"

                    if matched_title_key:
                        val = line.split(matched_title_key)[-1]
                        extracted_title = clean_extracted_value(val, matched_title_key)

                    for c in custom_map:
                        ck = c.get("keyword")
                        cn = c.get("name")
                        if ck and ck in line:
                            val = line.split(ck)[-1]
                            custom_values[cn] = clean_extracted_value(val, ck)

                # Prioritize the improved description crop
                if description_text:
                    custom_values["Description"] = description_text

                depths = [d.strip() for d in extracted_depth.split(delimiter)] if extracted_depth else []
                
                item = models.KnowledgeItem(
                    document_id=doc.id,
                    project_id=project_id,
                    page_number=i + 1,
                    classification=extracted_class or "No Class",
                    depth_1=depths[0] if len(depths) > 0 else "",
                    depth_2=depths[1] if len(depths) > 1 else "",
                    depth_3=depths[2] if len(depths) > 2 else "",
                    title=extracted_title or f"Page {i+1}",
                    content={"raw_text_snippet": text_content[:500], **custom_values},
                    image_path=relative_image_path
                )
                db.add(item)
                items.append(item)
            
    elif file_ext in [".xlsx", ".xls"]:
        df = pd.read_excel(file_path)
        for i, row in df.iterrows():
            # Support mapping to column names
            extracted_depth = str(row.get(depth_key, "")) if depth_key else ""
            depths = [d.strip() for d in extracted_depth.split(delimiter)] if depth_key else []
            
            extracted_class = str(row.get(class_key, "")) if class_key else ""
            extracted_title = str(row.get(title_key, "")) if title_key else f"Row {i+1}"
            
            # Custom fields from columns
            custom_values = {}
            for c in custom_map:
                ck = c.get("keyword")
                cn = c.get("name")
                if ck:
                    custom_values[cn] = str(row.get(ck, ""))

            content_payload = {"raw_row_data": row.to_dict()}
            content_payload.update(custom_values)

            item = models.KnowledgeItem(
                document_id=doc.id,
                project_id=project_id,
                page_number=i + 1,
                classification=extracted_class,
                depth_1=depths[0] if len(depths) > 0 else "",
                depth_2=depths[1] if len(depths) > 1 else "",
                depth_3=depths[2] if len(depths) > 2 else "",
                title=extracted_title,
                content=content_payload
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
    doc = db.query(models.KnowledgeDocument).filter(models.KnowledgeDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)
        
    db.delete(doc)
    db.commit()
    return {"status": "ok"}

# --- Knowledge Map Endpoints ---

@router.get("/maps/{project_id}", response_model=List[schemas.KnowledgeMap])
def read_maps(
    project_id: str,
    db: Session = Depends(deps.get_db),
) -> Any:
    maps = db.query(models.KnowledgeMap).filter(models.KnowledgeMap.project_id == project_id).order_by(models.KnowledgeMap.created_at.desc()).all()
    return maps

@router.post("/maps", response_model=schemas.KnowledgeMap)
def create_map(
    map_in: schemas.KnowledgeMapCreate,
    db: Session = Depends(deps.get_db),
) -> Any:
    db_obj = models.KnowledgeMap(
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
    map_obj = db.query(models.KnowledgeMap).filter(models.KnowledgeMap.id == map_id).first()
    if not map_obj:
        raise HTTPException(status_code=404, detail="Map not found")
        
    db.delete(map_obj)
    db.commit()
    return {"status": "ok"}
@router.put("/maps/{map_id}", response_model=schemas.KnowledgeMap)
def update_map(
    map_id: str,
    map_in: schemas.KnowledgeMapUpdate,
    db: Session = Depends(deps.get_db)
) -> Any:
    map_obj = db.query(models.KnowledgeMap).filter(models.KnowledgeMap.id == map_id).first()
    if not map_obj:
        raise HTTPException(status_code=404, detail="Map not found")
        
    update_data = map_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(map_obj, field, value)
        
    db.add(map_obj)
    db.commit()
    db.refresh(map_obj)
    return map_obj

@router.get("/hierarchy/{project_id}", response_model=List[schemas.KnowledgeHierarchyItem])
def get_hierarchy(
    project_id: str,
    db: Session = Depends(deps.get_db),
) -> Any:
    # Join with documents to get categories
    results = db.query(models.KnowledgeItem, models.KnowledgeDocument.category) \
        .join(models.KnowledgeDocument, models.KnowledgeItem.document_id == models.KnowledgeDocument.id) \
        .filter(models.KnowledgeItem.project_id == project_id).all()
    
    # Build tree
    root = {} # name -> node

    for it, category in results:
        # Path: Category > Classification > Depth 1 > Depth 2 > Depth 3
        path = [
            (category or "No Category", "category"),
            (it.classification or "No Classification", "classification"),
            (it.depth_1, "depth_1"),
            (it.depth_2, "depth_2"),
            (it.depth_3, "depth_3")
        ]
        
        current_level = root
        for name, level_type in path:
            if not name: break
            if name not in current_level:
                current_level[name] = {
                    "name": name,
                    "level": level_type,
                    "item_ids": [],
                    "children": {}
                }
            current_level[name]["item_ids"].append(it.id)
            current_level = current_level[name]["children"]

    def dict_to_tree(d):
        result = []
        for name, node in d.items():
            children = dict_to_tree(node["children"])
            result.append(schemas.KnowledgeHierarchyItem(
                name=node["name"],
                level=node["level"],
                item_ids=node["item_ids"],
                children=children
            ))
        return result

    return dict_to_tree(root)
