from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..services.cert_service import emitir_certificado

router = APIRouter(prefix="/enrollments", tags=["enrollments"])


@router.get("/", response_model=list[schemas.EnrollmentOut])
def list_enrollments(estado: str = None, db: Session = Depends(get_db)):
    query = db.query(models.Enrollment)
    if estado:
        try:
            estado_enum = models.EstadoCertificado(estado)
            query = query.filter(models.Enrollment.estado == estado_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Estado inválido: {estado}")
    return query.order_by(models.Enrollment.created_at.desc()).all()


@router.post("/", response_model=schemas.EnrollmentOut)
def create_enrollment(data: schemas.EnrollmentCreate, db: Session = Depends(get_db)):
    enrollment = models.Enrollment(**data.model_dump())
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return enrollment


@router.patch("/{enrollment_id}/submit", response_model=schemas.EnrollmentOut)
def submit_enrollment(enrollment_id: str, db: Session = Depends(get_db)):
    enrollment = db.query(models.Enrollment).filter(models.Enrollment.id == enrollment_id).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Inscripción no encontrada")
    enrollment.estado = models.EstadoCertificado.pendiente
    db.commit()
    db.refresh(enrollment)
    return enrollment


@router.patch("/{enrollment_id}/reject", response_model=schemas.EnrollmentOut)
def reject_enrollment(enrollment_id: str, db: Session = Depends(get_db)):
    enrollment = db.query(models.Enrollment).filter(models.Enrollment.id == enrollment_id).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Inscripción no encontrada")
    enrollment.estado = models.EstadoCertificado.borrador
    db.commit()
    db.refresh(enrollment)
    return enrollment


@router.patch("/{enrollment_id}/emit", response_model=schemas.CertificateEmitOut)
def emit_certificate(enrollment_id: str, db: Session = Depends(get_db)):
    try:
        cert = emitir_certificado(db, enrollment_id)
        return cert
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al emitir: {str(e)}")
