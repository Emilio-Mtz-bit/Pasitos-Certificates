import uuid
import enum
from sqlalchemy import Column, String, Boolean, Date, DateTime, Numeric, SmallInteger, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class EstadoCertificado(str, enum.Enum):
    borrador = "borrador"
    pendiente = "pendiente"
    activo = "activo"
    revocado = "revocado"


class ResultadoInscripcion(str, enum.Enum):
    acreditado = "acreditado"
    no_acreditado = "no_acreditado"
    en_proceso = "en_proceso"


class TipoCurso(str, enum.Enum):
    capacitacion_tecnica = "capacitacion_tecnica"
    taller_practico = "taller_practico"
    diplomado = "diplomado"


class ModalidadCurso(str, enum.Enum):
    presencial = "presencial"
    online = "online"
    presencial_online = "presencial_online"


class MetodoVerificacion(str, enum.Enum):
    folio = "folio"


class ResultadoVerificacion(str, enum.Enum):
    valido = "valido"
    no_encontrado = "no_encontrado"
    revocado = "revocado"
    hash_no_coincide = "hash_no_coincide"
    firma_invalida = "firma_invalida"


class GpgKey(Base):
    __tablename__ = "gpg_keys"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    key_id = Column(String(50), unique=True, nullable=False)
    descripcion = Column(String(255), nullable=False)
    public_key_armored = Column(Text, nullable=False)
    activa = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Course(Base):
    __tablename__ = "courses"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    codigo = Column(String(20), unique=True, nullable=False)
    nombre = Column(String(255), nullable=False)
    tipo = Column(SAEnum(TipoCurso), nullable=False)
    modalidad = Column(SAEnum(ModalidadCurso), nullable=False)
    duracion_horas = Column(SmallInteger, nullable=False)
    descripcion = Column(Text)
    calificacion_min = Column(Numeric(4, 2), default=7.0)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Participant(Base):
    __tablename__ = "participants"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    nombre_completo = Column(String(255), nullable=False)
    curp = Column(String(18), unique=True, nullable=False)
    fecha_nacimiento = Column(Date)
    correo_electronico = Column(String(255))
    institucion = Column(String(255))
    cargo = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Enrollment(Base):
    __tablename__ = "enrollments"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    participant_id = Column(String, ForeignKey("participants.id"), nullable=False)
    course_id = Column(String, ForeignKey("courses.id"), nullable=False)
    fecha_inicio = Column(Date, nullable=False)
    fecha_termino = Column(Date, nullable=False)
    calificacion = Column(Numeric(4, 2))
    resultado = Column(SAEnum(ResultadoInscripcion), default=ResultadoInscripcion.en_proceso)
    estado = Column(SAEnum(EstadoCertificado), default=EstadoCertificado.borrador)
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    participant = relationship("Participant")
    course = relationship("Course")


class Certificate(Base):
    __tablename__ = "certificates"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    enrollment_id = Column(String, ForeignKey("enrollments.id"), unique=True, nullable=False)
    gpg_key_id = Column(String, ForeignKey("gpg_keys.id"), nullable=False)
    no_certificado = Column(String(20), unique=True, nullable=False)
    folio_verificacion = Column(String(20), unique=True, nullable=False)
    cert_hash = Column(String(64), nullable=False)
    firma_gpg = Column(Text, nullable=False)
    estado = Column(SAEnum(EstadoCertificado), default=EstadoCertificado.activo)
    fecha_emision = Column(Date)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    enrollment = relationship("Enrollment")
    gpg_key = relationship("GpgKey")


class VerifyLog(Base):
    __tablename__ = "verify_log"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    certificate_id = Column(String, ForeignKey("certificates.id"), nullable=True)
    metodo = Column(SAEnum(MetodoVerificacion), nullable=False)
    valor_buscado = Column(String(255), nullable=False)
    resultado = Column(SAEnum(ResultadoVerificacion), nullable=False)
    ip_address = Column(String(45))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
