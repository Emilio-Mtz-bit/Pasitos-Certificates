import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/certificates", tags=["certificates"])


@router.get("/", response_model=list[schemas.CertificateSearchOut])
def search_certificates(curp: str = None, folio: str = None, db: Session = Depends(get_db)):
    if not curp and not folio:
        raise HTTPException(status_code=400, detail="Proporciona curp o folio como parámetro")

    query = db.query(models.Certificate).join(
        models.Enrollment, models.Certificate.enrollment_id == models.Enrollment.id
    ).join(
        models.Participant, models.Enrollment.participant_id == models.Participant.id
    )

    if folio:
        query = query.filter(models.Certificate.folio_verificacion == folio.strip().upper())
    else:
        query = query.filter(models.Participant.curp.ilike(curp.strip()))

    certs = query.all()
    result = []
    for cert in certs:
        enr = cert.enrollment
        result.append({
            "id": cert.id,
            "no_certificado": cert.no_certificado,
            "folio_verificacion": cert.folio_verificacion,
            "estado": cert.estado.value,
            "fecha_emision": cert.fecha_emision,
            "nombre": enr.participant.nombre_completo,
            "curp": enr.participant.curp,
            "curso": enr.course.nombre,
            "calificacion": enr.calificacion,
        })
    return result


@router.get("/{certificate_id}/pdf")
def download_pdf(certificate_id: str, db: Session = Depends(get_db)):
    cert = db.query(models.Certificate).filter(models.Certificate.id == certificate_id).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificado no encontrado")
    if not cert.pdf_path or not os.path.exists(cert.pdf_path):
        raise HTTPException(status_code=404, detail="PDF no disponible para este certificado")
    return FileResponse(
        cert.pdf_path,
        media_type="application/pdf",
        filename=f"{cert.no_certificado}.pdf",
    )


@router.patch("/{certificate_id}/revoke", response_model=schemas.CertificateSearchOut)
def revoke_certificate(certificate_id: str, db: Session = Depends(get_db)):
    cert = db.query(models.Certificate).filter(models.Certificate.id == certificate_id).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificado no encontrado")
    if cert.estado == models.EstadoCertificado.revocado:
        raise HTTPException(status_code=400, detail="El certificado ya está revocado")
    cert.estado = models.EstadoCertificado.revocado
    db.commit()
    db.refresh(cert)
    enr = cert.enrollment
    return {
        "id": cert.id,
        "no_certificado": cert.no_certificado,
        "folio_verificacion": cert.folio_verificacion,
        "estado": cert.estado.value,
        "fecha_emision": cert.fecha_emision,
        "nombre": enr.participant.nombre_completo,
        "curp": enr.participant.curp,
        "curso": enr.course.nombre,
        "calificacion": enr.calificacion,
    }
