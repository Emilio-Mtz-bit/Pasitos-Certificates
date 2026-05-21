import os
from datetime import date
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from .. import models
from . import hash_service, gpg_service

load_dotenv()


def _generar_no_certificado(db: Session) -> str:
    year = date.today().year
    count = db.query(models.Certificate).count() + 1
    return f"PAC-{year}-{count:04d}"


def _generar_folio(db: Session) -> str:
    count = db.query(models.Certificate).count() + 1
    return f"VER-{count:04d}"


def emitir_certificado(db: Session, enrollment_id: str) -> models.Certificate:
    enrollment = (
        db.query(models.Enrollment)
        .filter(
            models.Enrollment.id == enrollment_id,
            models.Enrollment.estado == models.EstadoCertificado.pendiente,
        )
        .first()
    )
    if not enrollment:
        raise ValueError("Inscripción no encontrada o no está en estado 'pendiente'")

    gpg_key = db.query(models.GpgKey).filter(models.GpgKey.activa == True).first()
    if not gpg_key:
        raise ValueError("No hay llave GPG activa en la base de datos. Ejecuta demo_seed.py")

    no_cert = _generar_no_certificado(db)
    folio = _generar_folio(db)
    fecha_emision = date.today()
    calificacion = float(enrollment.calificacion)

    cert_hash = hash_service.calcular_hash(
        no_certificado=no_cert,
        folio_verificacion=folio,
        curp=enrollment.participant.curp,
        nombre_completo=enrollment.participant.nombre_completo,
        curso=enrollment.course.nombre,
        fecha_emision=str(fecha_emision),
        calificacion=calificacion,
    )

    fingerprint = os.getenv("GPG_KEY_FINGERPRINT")
    if not fingerprint:
        raise ValueError("GPG_KEY_FINGERPRINT no está configurado en .env")

    firma = gpg_service.firmar_hash(cert_hash, fingerprint)

    resultado = (
        models.ResultadoInscripcion.acreditado
        if calificacion >= float(enrollment.course.calificacion_min)
        else models.ResultadoInscripcion.no_acreditado
    )
    enrollment.resultado = resultado
    enrollment.estado = models.EstadoCertificado.activo

    cert = models.Certificate(
        enrollment_id=enrollment_id,
        gpg_key_id=gpg_key.id,
        no_certificado=no_cert,
        folio_verificacion=folio,
        cert_hash=cert_hash,
        firma_gpg=firma,
        estado=models.EstadoCertificado.activo,
        fecha_emision=fecha_emision,
    )
    db.add(cert)
    db.commit()
    db.refresh(cert)
    return cert
