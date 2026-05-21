from datetime import datetime
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from .. import models
from ..database import get_db
from ..services import hash_service, gpg_service

router = APIRouter(prefix="/verify", tags=["verify"])


@router.get("/{folio}")
def verificar_por_folio(folio: str, request: Request, db: Session = Depends(get_db)):
    cert = db.query(models.Certificate).filter(
        models.Certificate.folio_verificacion == folio
    ).first()

    log = models.VerifyLog(
        metodo=models.MetodoVerificacion.folio,
        valor_buscado=folio,
        ip_address=request.client.host if request.client else None,
        resultado=models.ResultadoVerificacion.no_encontrado,
    )

    if not cert:
        db.add(log)
        db.commit()
        return {
            "valido": False,
            "razon": "certificado_no_encontrado",
            "mensaje": "No encontramos ningún certificado con ese folio.",
        }

    log.certificate_id = cert.id

    if cert.estado == models.EstadoCertificado.revocado:
        log.resultado = models.ResultadoVerificacion.revocado
        db.add(log)
        db.commit()
        return {
            "valido": False,
            "razon": "certificado_revocado",
            "mensaje": "Este certificado ha sido revocado por Pasitos Education & Health A.C.",
        }

    enrollment = cert.enrollment
    participant = enrollment.participant
    course = enrollment.course

    recalc_hash = hash_service.calcular_hash(
        no_certificado=cert.no_certificado,
        folio_verificacion=cert.folio_verificacion,
        curp=participant.curp,
        nombre_completo=participant.nombre_completo,
        curso=course.nombre,
        fecha_emision=str(cert.fecha_emision),
        calificacion=float(enrollment.calificacion),
    )

    if recalc_hash != cert.cert_hash:
        log.resultado = models.ResultadoVerificacion.hash_no_coincide
        db.add(log)
        db.commit()
        return {
            "valido": False,
            "razon": "hash_no_coincide",
            "mensaje": "Los datos de este certificado han sido alterados. No es válido.",
        }

    firma_valida = gpg_service.verificar_firma(cert.cert_hash, cert.firma_gpg)

    if not firma_valida:
        log.resultado = models.ResultadoVerificacion.firma_invalida
        db.add(log)
        db.commit()
        return {
            "valido": False,
            "razon": "firma_invalida",
            "mensaje": "La firma digital de este certificado no es válida.",
        }

    log.resultado = models.ResultadoVerificacion.valido
    db.add(log)
    db.commit()

    return {
        "valido": True,
        "certificado": {
            "no_certificado": cert.no_certificado,
            "folio_verificacion": cert.folio_verificacion,
            "nombre": participant.nombre_completo,
            "curp_parcial": participant.curp[:4] + "**************",
            "curso": course.nombre,
            "duracion_horas": course.duracion_horas,
            "modalidad": course.modalidad.value,
            "calificacion_final": float(enrollment.calificacion),
            "fecha_emision": str(cert.fecha_emision),
            "estado": cert.estado.value,
            "resultado": enrollment.resultado.value,
        },
        "verificacion": {
            "firma_gpg_valida": True,
            "hash_integro": True,
            "verificado_en": datetime.utcnow().isoformat() + "Z",
        },
    }
