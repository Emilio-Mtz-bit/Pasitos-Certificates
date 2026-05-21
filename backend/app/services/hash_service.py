import hashlib


def build_cert_string(
    no_certificado: str,
    folio_verificacion: str,
    curp: str,
    nombre_completo: str,
    curso: str,
    fecha_emision: str,
    calificacion: float,
) -> str:
    cal_str = f"{float(calificacion):.1f}"
    return "|".join([
        no_certificado,
        folio_verificacion,
        curp.upper(),
        nombre_completo.upper(),
        curso,
        fecha_emision,
        cal_str,
    ])


def calcular_hash(
    no_certificado: str,
    folio_verificacion: str,
    curp: str,
    nombre_completo: str,
    curso: str,
    fecha_emision: str,
    calificacion: float,
) -> str:
    s = build_cert_string(no_certificado, folio_verificacion, curp, nombre_completo, curso, fecha_emision, calificacion)
    return hashlib.sha256(s.encode("utf-8")).hexdigest()
