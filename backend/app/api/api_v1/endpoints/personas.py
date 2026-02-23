from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api import deps

router = APIRouter()

@router.get("/", response_model=List[schemas.Persona])
def read_personas(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    project_id: str = None,
    include_global: bool = True
) -> Any:
    """
    Retrieve personas.
    """
    if project_id:
        personas = crud.persona.get_multi_by_project(
            db, project_id=project_id, include_global=include_global, skip=skip, limit=limit
        )
    else:
        personas = crud.persona.get_multi(db, skip=skip, limit=limit)
    return personas

@router.post("/", response_model=schemas.Persona)
def create_persona(
    *,
    db: Session = Depends(deps.get_db),
    persona_in: schemas.PersonaCreate,
) -> Any:
    """
    Create new persona.
    """
    persona = crud.persona.create(db=db, obj_in=persona_in)
    return persona

@router.put("/{persona_id}", response_model=schemas.Persona)
def update_persona(
    *,
    db: Session = Depends(deps.get_db),
    persona_id: str,
    persona_in: schemas.PersonaUpdate,
) -> Any:
    """
    Update a persona.
    """
    persona = crud.persona.get(db=db, id=persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    persona = crud.persona.update(db=db, db_obj=persona, obj_in=persona_in)
    return persona

@router.delete("/{persona_id}", response_model=schemas.Persona)
def delete_persona(
    *,
    db: Session = Depends(deps.get_db),
    persona_id: str,
) -> Any:
    """
    Delete a persona.
    """
    persona = crud.persona.get(db=db, id=persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    persona = crud.persona.remove(db=db, id=persona_id)
    return persona
