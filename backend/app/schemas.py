from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import date
from decimal import Decimal


class ParticipantCreate(BaseModel):
    nombre_completo: str
    curp: str

    @field_validator('curp')
    @classmethod
    def curp_debe_tener_18_caracteres(cls, v):
        if len(v.strip()) != 18:
            raise ValueError('La CURP debe tener exactamente 18 caracteres')
        return v.strip().upper()
    fecha_nacimiento: Optional[date] = None
    correo_electronico: Optional[str] = None
    institucion: Optional[str] = None
    cargo: Optional[str] = None


class ParticipantOut(BaseModel):
    id: str
    nombre_completo: str
    curp: str
    fecha_nacimiento: Optional[date] = None
    correo_electronico: Optional[str] = None
    institucion: Optional[str] = None
    cargo: Optional[str] = None

    model_config = {"from_attributes": True}


class CourseOut(BaseModel):
    id: str
    codigo: str
    nombre: str
    tipo: str
    modalidad: str
    duracion_horas: int
    descripcion: Optional[str] = None
    calificacion_min: Decimal

    model_config = {"from_attributes": True}


class EnrollmentCreate(BaseModel):
    participant_id: str
    course_id: str
    fecha_inicio: date
    fecha_termino: date
    calificacion: Decimal


class EnrollmentOut(BaseModel):
    id: str
    participant_id: str
    course_id: str
    fecha_inicio: date
    fecha_termino: date
    calificacion: Optional[Decimal] = None
    resultado: str
    estado: str
    participant: ParticipantOut
    course: CourseOut

    model_config = {"from_attributes": True}


class CertificateEmitOut(BaseModel):
    id: str
    no_certificado: str
    folio_verificacion: str
    cert_hash: str
    estado: str
    fecha_emision: Optional[date] = None

    model_config = {"from_attributes": True}


class CertificateSearchOut(BaseModel):
    id: str
    no_certificado: str
    folio_verificacion: str
    estado: str
    fecha_emision: Optional[date] = None
    nombre: str
    curp: str
    curso: str
    calificacion: Optional[Decimal] = None
