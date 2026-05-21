from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/participants", tags=["participants"])


@router.get("/", response_model=list[schemas.ParticipantOut])
def search_participants(q: str = "", db: Session = Depends(get_db)):
    if not q:
        return []
    query = db.query(models.Participant).filter(
        or_(
            models.Participant.curp.ilike(f"%{q}%"),
            models.Participant.nombre_completo.ilike(f"%{q}%"),
        )
    )
    return query.all()


@router.post("/", response_model=schemas.ParticipantOut)
def create_participant(data: schemas.ParticipantCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Participant).filter(models.Participant.curp == data.curp.upper()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un participante con esa CURP")
    participant = models.Participant(**data.model_dump(exclude={"curp"}), curp=data.curp.upper())
    db.add(participant)
    db.commit()
    db.refresh(participant)
    return participant
