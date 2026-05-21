# Demo Inicial Pasitos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backend FastAPI funcional (SQLite + SHA-256 + GPG real) con 9 endpoints, y frontend React con tres rutas (/instructor, /admin, /public) que demuestran el flujo completo de emisión y verificación de certificados.

**Architecture:** El backend expone endpoints REST sin autenticación para el demo. La emisión de certificados es atómica: genera número de certificado, folio, calcula SHA-256 y firma GPG, todo en una sola transacción. El frontend consume estos endpoints desde tres páginas de rol con React Router v6.

**Tech Stack:** Python 3.x, FastAPI, SQLAlchemy (SQLite), python-gnupg, python-dotenv, pytest, httpx, React 18, Vite, React Router v6, Nunito (Google Fonts)

---

## Prerequisito: Instalar Gpg4win (Windows)

- [ ] Descarga e instala Gpg4win desde https://www.gpg4win.org/
- [ ] Verifica en terminal: `gpg --version` debe mostrar versión 2.x+
- [ ] Si no aparece, agrega `C:\Program Files (x86)\GnuPG\bin` al PATH del sistema

---

## Mapa de archivos

```
pasitos/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── hash_service.py
│   │   │   ├── gpg_service.py
│   │   │   └── cert_service.py
│   │   └── routers/
│   │       ├── __init__.py
│   │       ├── courses.py
│   │       ├── participants.py
│   │       ├── enrollments.py
│   │       └── verify.py
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py
│   │   ├── test_hash_service.py
│   │   ├── test_gpg_service.py
│   │   ├── test_participants.py
│   │   ├── test_enrollments.py
│   │   └── test_verify.py
│   ├── demo_seed.py
│   ├── .env
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx
    │   ├── api.js
    │   ├── styles.js
    │   ├── components/
    │   │   └── NavBar.jsx
    │   └── pages/
    │       ├── Instructor.jsx
    │       ├── Admin.jsx
    │       └── PublicVerify.jsx
    ├── index.html
    └── vite.config.js
```

---

## Task 1: Estructura del proyecto backend

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/.env`
- Create: `backend/app/__init__.py`
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/routers/__init__.py`
- Create: `backend/tests/__init__.py`

- [ ] **Step 1: Crear estructura de directorios**

```bash
cd "C:\Users\Josem\Documents\Tec\Semestre 6\Criptografia y Algebras Modernas\Pasitos-Certificates"
mkdir backend
mkdir backend\app
mkdir backend\app\services
mkdir backend\app\routers
mkdir backend\tests
```

- [ ] **Step 2: Crear requirements.txt**

Archivo: `backend/requirements.txt`
```
fastapi
uvicorn[standard]
sqlalchemy
python-gnupg
python-dotenv
pydantic
pytest
httpx
pytest-asyncio
```

- [ ] **Step 3: Crear archivos __init__.py vacíos**

```bash
echo. > backend\app\__init__.py
echo. > backend\app\services\__init__.py
echo. > backend\app\routers\__init__.py
echo. > backend\tests\__init__.py
```

- [ ] **Step 4: Crear .env template**

Archivo: `backend/.env`
```
DATABASE_URL=sqlite:///./pasitos.db
GPG_KEY_FINGERPRINT=
```

- [ ] **Step 5: Instalar dependencias**

```bash
cd backend
pip install -r requirements.txt
```

- [ ] **Step 6: Commit**

```bash
git add backend/requirements.txt backend/.env backend/app/__init__.py backend/app/services/__init__.py backend/app/routers/__init__.py backend/tests/__init__.py
git commit -m "chore: scaffold backend project structure"
```

---

## Task 2: database.py + models.py

**Files:**
- Create: `backend/app/database.py`
- Create: `backend/app/models.py`

- [ ] **Step 1: Crear database.py**

Archivo: `backend/app/database.py`
```python
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./pasitos.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 2: Crear models.py**

Archivo: `backend/app/models.py`
```python
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
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/database.py backend/app/models.py
git commit -m "feat: add database setup and ORM models"
```

---

## Task 3: schemas.py

**Files:**
- Create: `backend/app/schemas.py`

- [ ] **Step 1: Crear schemas.py**

Archivo: `backend/app/schemas.py`
```python
from pydantic import BaseModel
from typing import Optional, List
from datetime import date
from decimal import Decimal


class ParticipantCreate(BaseModel):
    nombre_completo: str
    curp: str
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas.py
git commit -m "feat: add Pydantic schemas"
```

---

## Task 4: Hash service (TDD)

**Files:**
- Create: `backend/tests/test_hash_service.py`
- Create: `backend/app/services/hash_service.py`

- [ ] **Step 1: Escribir tests**

Archivo: `backend/tests/test_hash_service.py`
```python
from app.services.hash_service import build_cert_string, calcular_hash


def test_build_cert_string_format():
    result = build_cert_string(
        "PAC-2025-0001", "VER-0001", "LOHM900115MJCRRL05",
        "María López Hernández", "Puericultura", "2025-03-28", 9.5
    )
    assert result == "PAC-2025-0001|VER-0001|LOHM900115MJCRRL05|MARÍA LÓPEZ HERNÁNDEZ|Puericultura|2025-03-28|9.5"


def test_curp_normalizado_a_mayusculas():
    r1 = build_cert_string("A", "B", "lohm900115mjcrrl05", "nombre", "curso", "2025-01-01", 9.0)
    r2 = build_cert_string("A", "B", "LOHM900115MJCRRL05", "nombre", "curso", "2025-01-01", 9.0)
    assert r1 == r2


def test_nombre_normalizado_a_mayusculas():
    r1 = build_cert_string("A", "B", "CURP", "maría lópez", "curso", "2025-01-01", 9.0)
    r2 = build_cert_string("A", "B", "CURP", "MARÍA LÓPEZ", "curso", "2025-01-01", 9.0)
    assert r1 == r2


def test_calificacion_un_decimal():
    r = build_cert_string("A", "B", "C", "D", "E", "2025-01-01", 9.0)
    assert r.endswith("|9.0")

    r2 = build_cert_string("A", "B", "C", "D", "E", "2025-01-01", 9.5)
    assert r2.endswith("|9.5")


def test_hash_es_determinista():
    h1 = calcular_hash("PAC-2025-0001", "VER-0001", "CURP18CHARS000000", "Nombre", "Curso", "2025-01-01", 9.5)
    h2 = calcular_hash("PAC-2025-0001", "VER-0001", "CURP18CHARS000000", "Nombre", "Curso", "2025-01-01", 9.5)
    assert h1 == h2
    assert len(h1) == 64


def test_hash_cambia_con_datos_distintos():
    h1 = calcular_hash("PAC-2025-0001", "VER-0001", "CURP18CHARS000000", "Nombre", "Curso", "2025-01-01", 9.5)
    h2 = calcular_hash("PAC-2025-0001", "VER-0001", "CURP18CHARS000000", "Nombre", "Curso", "2025-01-01", 8.0)
    assert h1 != h2
```

- [ ] **Step 2: Ejecutar tests — deben fallar**

```bash
cd backend
pytest tests/test_hash_service.py -v
```
Esperado: `ERROR` — `ModuleNotFoundError: No module named 'app.services.hash_service'`

- [ ] **Step 3: Implementar hash_service.py**

Archivo: `backend/app/services/hash_service.py`
```python
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
```

- [ ] **Step 4: Ejecutar tests — deben pasar**

```bash
pytest tests/test_hash_service.py -v
```
Esperado: `6 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/hash_service.py backend/tests/test_hash_service.py
git commit -m "feat: add hash service with SHA-256"
```

---

## Task 5: GPG service (TDD)

**Files:**
- Create: `backend/tests/test_gpg_service.py`
- Create: `backend/app/services/gpg_service.py`

- [ ] **Step 1: Escribir tests**

Archivo: `backend/tests/test_gpg_service.py`
```python
import pytest
import gnupg
from app.services.gpg_service import get_gpg, firmar_hash, verificar_firma


@pytest.fixture(scope="module")
def test_fingerprint():
    gpg = get_gpg()
    existing = [k for k in gpg.list_keys(True)
                if any("testpasitos@demo.com" in uid for uid in k.get("uids", []))]
    if existing:
        yield existing[0]["fingerprint"]
        return
    input_data = gpg.gen_key_input(
        key_type="RSA", key_length=1024,
        name_real="Test Pasitos GPG", name_email="testpasitos@demo.com",
        expire_date=0, no_protection=True,
    )
    key = gpg.gen_key(input_data)
    fingerprint = key.fingerprint
    yield fingerprint
    gpg.delete_keys(fingerprint, True)
    gpg.delete_keys(fingerprint)


def test_firmar_produce_firma_pgp(test_fingerprint):
    firma = firmar_hash("a" * 64, test_fingerprint)
    assert "BEGIN PGP SIGNATURE" in firma


def test_verificar_firma_valida(test_fingerprint):
    test_hash = "b" * 64
    firma = firmar_hash(test_hash, test_fingerprint)
    assert verificar_firma(test_hash, firma) is True


def test_verificar_falla_con_hash_distinto(test_fingerprint):
    firma = firmar_hash("a" * 64, test_fingerprint)
    assert verificar_firma("b" * 64, firma) is False
```

- [ ] **Step 2: Ejecutar tests — deben fallar**

```bash
pytest tests/test_gpg_service.py -v
```
Esperado: `ERROR` — `ModuleNotFoundError`

- [ ] **Step 3: Implementar gpg_service.py**

Archivo: `backend/app/services/gpg_service.py`
```python
import os
import tempfile
import gnupg


def get_gpg() -> gnupg.GPG:
    try:
        g = gnupg.GPG()
        g.list_keys()
        return g
    except Exception:
        gpg_path = r"C:\Program Files (x86)\GnuPG\bin\gpg.exe"
        if os.path.exists(gpg_path):
            return gnupg.GPG(gpgbinary=gpg_path)
        raise RuntimeError(
            "GPG no encontrado. Instala Gpg4win desde https://www.gpg4win.org/"
        )


def firmar_hash(cert_hash: str, fingerprint: str) -> str:
    gpg = get_gpg()
    signed = gpg.sign(cert_hash, keyid=fingerprint, detach=True)
    if not signed:
        raise RuntimeError(f"La firma GPG falló. ¿El fingerprint '{fingerprint}' está en el keyring?")
    return str(signed)


def verificar_firma(cert_hash: str, firma_armored: str) -> bool:
    gpg = get_gpg()
    with tempfile.NamedTemporaryFile(mode="w", suffix=".asc", delete=False) as f:
        f.write(firma_armored)
        sig_path = f.name
    try:
        verified = gpg.verify_data(sig_path, cert_hash.encode("utf-8"))
        return bool(verified.valid)
    finally:
        os.unlink(sig_path)
```

- [ ] **Step 4: Ejecutar tests — deben pasar**

```bash
pytest tests/test_gpg_service.py -v
```
Esperado: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/gpg_service.py backend/tests/test_gpg_service.py
git commit -m "feat: add GPG service for signing and verification"
```

---

## Task 6: Demo seed script

**Files:**
- Create: `backend/demo_seed.py`

- [ ] **Step 1: Crear demo_seed.py**

Archivo: `backend/demo_seed.py`
```python
import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.services.gpg_service import get_gpg
from app.database import engine, SessionLocal, Base
from app import models


def get_or_create_demo_gpg_key():
    gpg = get_gpg()
    existing = [k for k in gpg.list_keys(True)
                if any("demo@pasitosac.org" in uid for uid in k.get("uids", []))]
    if existing:
        fingerprint = existing[0]["fingerprint"]
        print(f"Llave GPG demo ya existe: {fingerprint}")
    else:
        print("Generando par de llaves GPG (puede tardar unos segundos)...")
        input_data = gpg.gen_key_input(
            key_type="RSA", key_length=2048,
            name_real="Pasitos Education Demo",
            name_email="demo@pasitosac.org",
            expire_date=0,
            no_protection=True,
        )
        key = gpg.gen_key(input_data)
        if not key.fingerprint:
            raise RuntimeError("Error al generar llave GPG")
        fingerprint = key.fingerprint
        print(f"Llave GPG generada: {fingerprint}")

    public_key = gpg.export_keys(fingerprint)
    return fingerprint, public_key


def write_env(fingerprint: str):
    env_path = Path(__file__).parent / ".env"
    content = f"DATABASE_URL=sqlite:///./pasitos.db\nGPG_KEY_FINGERPRINT={fingerprint}\n"
    env_path.write_text(content, encoding="utf-8")
    print(f".env actualizado con GPG_KEY_FINGERPRINT={fingerprint}")


def seed_database(fingerprint: str, public_key: str):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing_key = db.query(models.GpgKey).filter(models.GpgKey.key_id == fingerprint).first()
        if not existing_key:
            gpg_key = models.GpgKey(
                key_id=fingerprint,
                descripcion="Pasitos Demo 2026",
                public_key_armored=public_key,
                activa=True,
            )
            db.add(gpg_key)
            print("Llave GPG guardada en BD")

        cursos = [
            ("C-001", "Puericultura", models.TipoCurso.capacitacion_tecnica,
             models.ModalidadCurso.presencial_online, 80, 7.0,
             "Formación integral en cuidado, nutrición, desarrollo y salud del niño de 0 a 6 años."),
            ("C-002", "Asistente Educativo", models.TipoCurso.capacitacion_tecnica,
             models.ModalidadCurso.presencial_online, 80, 7.0,
             "Formación para personal de apoyo educativo en estancias infantiles y guarderías."),
            ("C-003", "Primeros Auxilios Pediátricos", models.TipoCurso.taller_practico,
             models.ModalidadCurso.presencial_online, 50, 7.0,
             "Atención de emergencias médicas en niños: RCP, atragantamiento, fiebre, convulsiones."),
        ]
        for codigo, nombre, tipo, modalidad, horas, cal_min, desc in cursos:
            if not db.query(models.Course).filter(models.Course.codigo == codigo).first():
                db.add(models.Course(
                    codigo=codigo, nombre=nombre, tipo=tipo,
                    modalidad=modalidad, duracion_horas=horas,
                    calificacion_min=cal_min, descripcion=desc,
                ))
                print(f"  Curso {codigo} — {nombre} agregado")

        db.commit()
        print("\nBase de datos lista!")
    finally:
        db.close()


if __name__ == "__main__":
    fingerprint, public_key = get_or_create_demo_gpg_key()
    write_env(fingerprint)
    seed_database(fingerprint, public_key)
    print("\nSetup completo. Ejecuta: uvicorn app.main:app --reload")
```

- [ ] **Step 2: Ejecutar el seed**

```bash
cd backend
python demo_seed.py
```
Esperado: mensajes de generación de llave GPG, escritura de .env, y cursos agregados.

- [ ] **Step 3: Commit**

```bash
git add backend/demo_seed.py
git commit -m "feat: add demo seed script (GPG key + courses)"
```

---

## Task 7: Certificate service

**Files:**
- Create: `backend/app/services/cert_service.py`

- [ ] **Step 1: Crear cert_service.py**

Archivo: `backend/app/services/cert_service.py`
```python
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/cert_service.py
git commit -m "feat: add certificate emission service (SHA-256 + GPG)"
```

---

## Task 8: Routers de cursos y participantes + conftest (TDD)

**Files:**
- Create: `backend/tests/conftest.py`
- Create: `backend/app/routers/courses.py`
- Create: `backend/app/routers/participants.py`
- Create: `backend/tests/test_participants.py`

- [ ] **Step 1: Crear conftest.py**

Archivo: `backend/tests/conftest.py`
```python
import os
import pytest
import gnupg
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base, get_db
from app.main import app
from app import models

TEST_DB_URL = "sqlite:///./test_pasitos.db"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def gpg_test_key():
    from app.services.gpg_service import get_gpg
    gpg = get_gpg()
    existing = [k for k in gpg.list_keys(True)
                if any("testpasitos@demo.com" in uid for uid in k.get("uids", []))]
    if existing:
        fingerprint = existing[0]["fingerprint"]
    else:
        input_data = gpg.gen_key_input(
            key_type="RSA", key_length=1024,
            name_real="Test Pasitos", name_email="testpasitos@demo.com",
            expire_date=0, no_protection=True,
        )
        key = gpg.gen_key(input_data)
        fingerprint = key.fingerprint

    os.environ["GPG_KEY_FINGERPRINT"] = fingerprint
    public_key = gpg.export_keys(fingerprint)
    yield {"fingerprint": fingerprint, "public_key": public_key}


@pytest.fixture(autouse=True)
def reset_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db(gpg_test_key):
    session = TestingSessionLocal()
    gpg_key = models.GpgKey(
        id="gpg-test-1",
        key_id=gpg_test_key["fingerprint"],
        descripcion="Test key",
        public_key_armored=gpg_test_key["public_key"],
    )
    course = models.Course(
        id="course-test-1", codigo="C-001", nombre="Puericultura",
        tipo=models.TipoCurso.capacitacion_tecnica,
        modalidad=models.ModalidadCurso.presencial_online,
        duracion_horas=80, calificacion_min=7.0,
    )
    session.add_all([gpg_key, course])
    session.commit()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

- [ ] **Step 2: Crear routers/courses.py**

Archivo: `backend/app/routers/courses.py`
```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/courses", tags=["courses"])


@router.get("/", response_model=list[schemas.CourseOut])
def list_courses(db: Session = Depends(get_db)):
    return db.query(models.Course).filter(models.Course.activo == True).all()
```

- [ ] **Step 3: Escribir tests de participantes**

Archivo: `backend/tests/test_participants.py`
```python
def test_crear_participante(client):
    response = client.post("/participants", json={
        "nombre_completo": "María López Hernández",
        "curp": "LOHM900115MJCRRL05",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["curp"] == "LOHM900115MJCRRL05"
    assert data["nombre_completo"] == "María López Hernández"
    assert "id" in data


def test_buscar_por_curp(client):
    client.post("/participants", json={"nombre_completo": "María López", "curp": "LOHM900115MJCRRL05"})
    response = client.get("/participants?q=LOHM900115MJCRRL05")
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_buscar_por_nombre(client):
    client.post("/participants", json={"nombre_completo": "María López", "curp": "LOHM900115MJCRRL05"})
    response = client.get("/participants?q=María")
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_curp_duplicada_retorna_400(client):
    client.post("/participants", json={"nombre_completo": "María López", "curp": "LOHM900115MJCRRL05"})
    response = client.post("/participants", json={"nombre_completo": "Otra Persona", "curp": "LOHM900115MJCRRL05"})
    assert response.status_code == 400


def test_buscar_sin_resultados(client):
    response = client.get("/participants?q=XXXXXX")
    assert response.status_code == 200
    assert response.json() == []
```

- [ ] **Step 4: Ejecutar tests — deben fallar**

```bash
pytest tests/test_participants.py -v
```
Esperado: `ERROR` — `app.main` no existe todavía. Continúa al paso 5.

- [ ] **Step 5: Crear routers/participants.py**

Archivo: `backend/app/routers/participants.py`
```python
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
    participant = models.Participant(**data.model_dump(), curp=data.curp.upper())
    db.add(participant)
    db.commit()
    db.refresh(participant)
    return participant
```

- [ ] **Step 6: Commit (main.py se crea en Task 12, los tests pasan después)**

```bash
git add backend/tests/conftest.py backend/app/routers/courses.py backend/app/routers/participants.py backend/tests/test_participants.py
git commit -m "feat: add courses and participants routers"
```

---

## Task 9: Enrollments router (TDD)

**Files:**
- Create: `backend/tests/test_enrollments.py`
- Create: `backend/app/routers/enrollments.py`

- [ ] **Step 1: Escribir tests**

Archivo: `backend/tests/test_enrollments.py`
```python
import pytest


@pytest.fixture
def participant_id(client):
    resp = client.post("/participants", json={
        "nombre_completo": "María López Hernández",
        "curp": "LOHM900115MJCRRL05",
    })
    return resp.json()["id"]


def test_crear_inscripcion(client, participant_id):
    response = client.post("/enrollments", json={
        "participant_id": participant_id,
        "course_id": "course-test-1",
        "fecha_inicio": "2025-03-01",
        "fecha_termino": "2025-03-28",
        "calificacion": 9.5,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["estado"] == "borrador"
    assert data["resultado"] == "en_proceso"


def test_submit_cambia_estado_a_pendiente(client, participant_id):
    enr = client.post("/enrollments", json={
        "participant_id": participant_id,
        "course_id": "course-test-1",
        "fecha_inicio": "2025-03-01",
        "fecha_termino": "2025-03-28",
        "calificacion": 9.5,
    }).json()
    response = client.patch(f"/enrollments/{enr['id']}/submit")
    assert response.status_code == 200
    assert response.json()["estado"] == "pendiente"


def test_listar_pendientes(client, participant_id):
    enr = client.post("/enrollments", json={
        "participant_id": participant_id,
        "course_id": "course-test-1",
        "fecha_inicio": "2025-03-01",
        "fecha_termino": "2025-03-28",
        "calificacion": 9.5,
    }).json()
    client.patch(f"/enrollments/{enr['id']}/submit")
    response = client.get("/enrollments?estado=pendiente")
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_reject_cambia_estado_a_borrador(client, participant_id):
    enr = client.post("/enrollments", json={
        "participant_id": participant_id,
        "course_id": "course-test-1",
        "fecha_inicio": "2025-03-01",
        "fecha_termino": "2025-03-28",
        "calificacion": 9.5,
    }).json()
    client.patch(f"/enrollments/{enr['id']}/submit")
    response = client.patch(f"/enrollments/{enr['id']}/reject")
    assert response.status_code == 200
    assert response.json()["estado"] == "borrador"


def test_emit_genera_certificado(client, participant_id):
    enr = client.post("/enrollments", json={
        "participant_id": participant_id,
        "course_id": "course-test-1",
        "fecha_inicio": "2025-03-01",
        "fecha_termino": "2025-03-28",
        "calificacion": 9.5,
    }).json()
    client.patch(f"/enrollments/{enr['id']}/submit")
    response = client.patch(f"/enrollments/{enr['id']}/emit")
    assert response.status_code == 200
    data = response.json()
    assert data["no_certificado"].startswith("PAC-")
    assert data["folio_verificacion"].startswith("VER-")
    assert len(data["cert_hash"]) == 64
```

- [ ] **Step 2: Crear enrollments router**

Archivo: `backend/app/routers/enrollments.py`
```python
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
```

- [ ] **Step 3: Commit (tests pasan después de crear main.py)**

```bash
git add backend/app/routers/enrollments.py backend/tests/test_enrollments.py
git commit -m "feat: add enrollments router with submit/reject/emit"
```

---

## Task 10: Verify router (TDD)

**Files:**
- Create: `backend/tests/test_verify.py`
- Create: `backend/app/routers/verify.py`

- [ ] **Step 1: Escribir tests**

Archivo: `backend/tests/test_verify.py`
```python
import pytest


@pytest.fixture
def certificado_emitido(client):
    part = client.post("/participants", json={
        "nombre_completo": "María López Hernández",
        "curp": "LOHM900115MJCRRL05",
    }).json()
    enr = client.post("/enrollments", json={
        "participant_id": part["id"],
        "course_id": "course-test-1",
        "fecha_inicio": "2025-03-01",
        "fecha_termino": "2025-03-28",
        "calificacion": 9.5,
    }).json()
    client.patch(f"/enrollments/{enr['id']}/submit")
    cert = client.patch(f"/enrollments/{enr['id']}/emit").json()
    return cert


def test_verificar_folio_valido(client, certificado_emitido):
    folio = certificado_emitido["folio_verificacion"]
    response = client.get(f"/verify/{folio}")
    assert response.status_code == 200
    data = response.json()
    assert data["valido"] is True
    assert data["certificado"]["nombre"] == "María López Hernández"
    assert data["certificado"]["curso"] == "Puericultura"
    assert data["verificacion"]["firma_gpg_valida"] is True
    assert data["verificacion"]["hash_integro"] is True


def test_verificar_folio_inexistente(client):
    response = client.get("/verify/VER-9999")
    assert response.status_code == 200
    data = response.json()
    assert data["valido"] is False
    assert data["razon"] == "certificado_no_encontrado"


def test_verify_log_se_registra(client, certificado_emitido, db):
    from app import models
    folio = certificado_emitido["folio_verificacion"]
    client.get(f"/verify/{folio}")
    logs = db.query(models.VerifyLog).all()
    assert len(logs) == 1
    assert logs[0].resultado == models.ResultadoVerificacion.valido
```

- [ ] **Step 2: Crear verify router**

Archivo: `backend/app/routers/verify.py`
```python
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
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/verify.py backend/tests/test_verify.py
git commit -m "feat: add public verify endpoint by folio"
```

---

## Task 11: main.py + ejecutar todos los tests

**Files:**
- Create: `backend/app/main.py`

- [ ] **Step 1: Crear main.py**

Archivo: `backend/app/main.py`
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import courses, participants, enrollments, verify

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Pasitos Certificates API", version="1.0.0-demo")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(courses.router)
app.include_router(participants.router)
app.include_router(enrollments.router)
app.include_router(verify.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "pasitos-certificates-demo"}
```

- [ ] **Step 2: Ejecutar todos los tests**

```bash
cd backend
pytest tests/ -v
```
Esperado: todos los tests pasan (puede tardar por la generación de GPG en el primer run).

- [ ] **Step 3: Verificar que el servidor arranca**

```bash
uvicorn app.main:app --reload
```
Abre `http://localhost:8000/health` — debe responder `{"status": "ok"}`.
Abre `http://localhost:8000/docs` — debe mostrar el Swagger UI con todos los endpoints.

- [ ] **Step 4: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: add FastAPI main app with CORS and all routers"
```

---

## Task 12: Frontend setup + App.jsx + api.js + styles.js

**Files:**
- Create: `frontend/` (via Vite)
- Create: `frontend/src/App.jsx`
- Create: `frontend/src/api.js`
- Create: `frontend/src/styles.js`

- [ ] **Step 1: Crear proyecto Vite**

```bash
cd "C:\Users\Josem\Documents\Tec\Semestre 6\Criptografia y Algebras Modernas\Pasitos-Certificates"
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install react-router-dom
```

- [ ] **Step 2: Agregar fuente Nunito en index.html**

Archivo: `frontend/index.html` — reemplaza el `<head>`:
```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet" />
    <title>Pasitos Certificates</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Crear styles.js**

Archivo: `frontend/src/styles.js`
```js
export const colors = {
  primary: '#9B27AF',
  dark: '#7B2D8B',
  light: '#F3E8FA',
  lightMid: '#E8D0F5',
  white: '#FFFFFF',
  text: '#1a1a1a',
  textLight: '#666666',
  successBg: '#d4f5e2',
  successBorder: '#28a745',
  successText: '#155724',
  errorBg: '#fde8e8',
  errorBorder: '#dc3545',
  errorText: '#721c24',
  border: '#e0c8f0',
  gray: '#f8f4fb',
}

export const font = "'Nunito', sans-serif"

export const card = {
  background: colors.white,
  border: `1px solid ${colors.border}`,
  borderRadius: 16,
  padding: '1.5rem',
  boxShadow: '0 2px 8px rgba(155, 39, 175, 0.08)',
}

export const input = {
  width: '100%',
  padding: '0.6rem 1rem',
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  fontSize: '1rem',
  fontFamily: font,
  outline: 'none',
  boxSizing: 'border-box',
}

export const btn = {
  primary: {
    background: colors.primary,
    color: colors.white,
    border: 'none',
    borderRadius: 8,
    padding: '0.65rem 1.4rem',
    fontSize: '1rem',
    fontFamily: font,
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondary: {
    background: 'transparent',
    color: colors.primary,
    border: `2px solid ${colors.primary}`,
    borderRadius: 8,
    padding: '0.6rem 1.4rem',
    fontSize: '1rem',
    fontFamily: font,
    fontWeight: 700,
    cursor: 'pointer',
  },
  danger: {
    background: '#dc3545',
    color: colors.white,
    border: 'none',
    borderRadius: 8,
    padding: '0.65rem 1.4rem',
    fontSize: '1rem',
    fontFamily: font,
    fontWeight: 700,
    cursor: 'pointer',
  },
}
```

- [ ] **Step 4: Crear api.js**

Archivo: `frontend/src/api.js`
```js
const BASE = 'http://localhost:8000'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options)
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || `Error ${res.status}`)
  return data
}

export const getCourses = () => request('/courses/')

export const searchParticipants = (q) =>
  request(`/participants/?q=${encodeURIComponent(q)}`)

export const createParticipant = (data) =>
  request('/participants/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

export const createEnrollment = (data) =>
  request('/enrollments/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

export const submitEnrollment = (id) =>
  request(`/enrollments/${id}/submit`, { method: 'PATCH' })

export const getPendingEnrollments = () =>
  request('/enrollments/?estado=pendiente')

export const rejectEnrollment = (id) =>
  request(`/enrollments/${id}/reject`, { method: 'PATCH' })

export const emitCertificate = (id) =>
  request(`/enrollments/${id}/emit`, { method: 'PATCH' })

export const verifyCertificate = (folio) =>
  request(`/verify/${encodeURIComponent(folio)}`)
```

- [ ] **Step 5: Crear App.jsx**

Archivo: `frontend/src/App.jsx`
```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { font } from './styles'
import NavBar from './components/NavBar'
import Instructor from './pages/Instructor'
import Admin from './pages/Admin'
import PublicVerify from './pages/PublicVerify'

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ fontFamily: font, minHeight: '100vh', background: '#faf7fc' }}>
        <NavBar />
        <Routes>
          <Route path="/" element={<Navigate to="/instructor" replace />} />
          <Route path="/instructor" element={<Instructor />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/public" element={<PublicVerify />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
```

- [ ] **Step 6: Actualizar main.jsx**

Archivo: `frontend/src/main.jsx`
```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 7: Commit**

```bash
cd ..
git add frontend/
git commit -m "feat: scaffold frontend with Vite, React Router, api client and styles"
```

---

## Task 13: NavBar

**Files:**
- Create: `frontend/src/components/NavBar.jsx`

- [ ] **Step 1: Crear NavBar.jsx**

Archivo: `frontend/src/components/NavBar.jsx`
```jsx
import { NavLink } from 'react-router-dom'
import { colors, font } from '../styles'

export default function NavBar() {
  return (
    <nav style={{
      background: colors.primary,
      padding: '0 2rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      height: 64,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    }}>
      <div style={{ marginRight: '1.5rem' }}>
        <span style={{ color: colors.white, fontWeight: 800, fontSize: '1.5rem', fontFamily: font, letterSpacing: '-0.5px' }}>
          Pasitos
        </span>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginLeft: 6, fontWeight: 600 }}>
          DEMO
        </span>
      </div>

      {[
        { to: '/instructor', label: 'Instructor' },
        { to: '/admin', label: 'Admin' },
        { to: '/public', label: 'Verificación Pública' },
      ].map(({ to, label }) => (
        <NavLink key={to} to={to} style={({ isActive }) => ({
          color: isActive ? colors.white : 'rgba(255,255,255,0.72)',
          textDecoration: 'none',
          fontWeight: isActive ? 700 : 500,
          fontFamily: font,
          fontSize: '0.95rem',
          padding: '0.4rem 1rem',
          borderRadius: 8,
          background: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
          transition: 'all 0.15s',
        })}>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/NavBar.jsx
git commit -m "feat: add NavBar component with brand colors"
```

---

## Task 14: Página Instructor

**Files:**
- Create: `frontend/src/pages/Instructor.jsx`

- [ ] **Step 1: Crear Instructor.jsx**

Archivo: `frontend/src/pages/Instructor.jsx`
```jsx
import { useState, useEffect } from 'react'
import * as api from '../api'
import { colors, font, card, input, btn } from '../styles'

const GRADOS = ['primaria', 'secundaria', 'preparatoria', 'tecnico_superior', 'licenciatura', 'posgrado']

export default function Instructor() {
  const [curpInput, setCurpInput] = useState('')
  const [participant, setParticipant] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [newP, setNewP] = useState({ nombre_completo: '', curp: '', fecha_nacimiento: '', institucion: '', cargo: '' })
  const [courses, setCourses] = useState([])
  const [form, setForm] = useState({ course_id: '', fecha_inicio: '', fecha_termino: '', calificacion: '' })
  const [folio, setFolio] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { api.getCourses().then(setCourses).catch(() => setError('No se pudo conectar al backend')) }, [])

  async function handleSearch() {
    if (!curpInput.trim()) return
    setLoading(true); setError(''); setParticipant(null); setShowForm(false); setFolio(null)
    try {
      const results = await api.searchParticipants(curpInput.trim().toUpperCase())
      if (results.length > 0) {
        setParticipant(results[0])
      } else {
        setShowForm(true)
        setNewP(p => ({ ...p, curp: curpInput.trim().toUpperCase() }))
      }
    } catch { setError('Error al buscar participante') }
    finally { setLoading(false) }
  }

  async function handleCreate() {
    setLoading(true); setError('')
    try {
      const p = await api.createParticipant(newP)
      setParticipant(p); setShowForm(false)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleEnroll() {
    if (!form.course_id || !form.fecha_inicio || !form.fecha_termino || !form.calificacion) {
      setError('Completa todos los campos de la inscripción'); return
    }
    setLoading(true); setError('')
    try {
      const enr = await api.createEnrollment({
        participant_id: participant.id,
        course_id: form.course_id,
        fecha_inicio: form.fecha_inicio,
        fecha_termino: form.fecha_termino,
        calificacion: parseFloat(form.calificacion),
      })
      await api.submitEnrollment(enr.id)
      setFolio('pendiente')
      setForm({ course_id: '', fecha_inicio: '', fecha_termino: '', calificacion: '' })
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  function reset() {
    setCurpInput(''); setParticipant(null); setShowForm(false)
    setNewP({ nombre_completo: '', curp: '', fecha_nacimiento: '', institucion: '', cargo: '' })
    setForm({ course_id: '', fecha_inicio: '', fecha_termino: '', calificacion: '' })
    setFolio(null); setError('')
  }

  return (
    <div style={{ maxWidth: 700, margin: '2rem auto', padding: '0 1rem' }}>
      <h1 style={{ color: colors.primary, fontWeight: 800, fontSize: '1.8rem', marginBottom: '0.25rem' }}>
        Registro de Inscripción
      </h1>
      <p style={{ color: colors.textLight, marginBottom: '2rem' }}>
        Busca al participante por CURP y captura su inscripción al curso.
      </p>

      {error && (
        <div style={{ background: colors.errorBg, color: colors.errorText, border: `1px solid ${colors.errorBorder}`, borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {folio && (
        <div style={{ background: colors.successBg, color: colors.successText, border: `1px solid ${colors.successBorder}`, borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 4 }}>✓ Inscripción enviada a revisión</div>
          <div>El administrador recibirá la solicitud y emitirá el certificado una vez aprobada.</div>
          <button onClick={reset} style={{ ...btn.secondary, marginTop: '0.75rem', fontSize: '0.9rem' }}>
            Registrar otro participante
          </button>
        </div>
      )}

      {!folio && (
        <>
          {/* Paso 1: Buscar */}
          <div style={{ ...card, marginBottom: '1.5rem' }}>
            <h2 style={{ color: colors.dark, fontWeight: 700, fontSize: '1.1rem', marginTop: 0, marginBottom: '1rem' }}>
              Paso 1 — Buscar participante por CURP
            </h2>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <input
                style={input}
                placeholder="CURP (18 caracteres)"
                value={curpInput}
                maxLength={18}
                onChange={e => setCurpInput(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
              <button style={{ ...btn.primary, whiteSpace: 'nowrap' }} onClick={handleSearch} disabled={loading}>
                {loading ? '...' : 'Buscar'}
              </button>
            </div>
          </div>

          {/* Participante encontrado */}
          {participant && !showForm && (
            <div style={{ ...card, background: colors.light, marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: 700, color: colors.primary, fontSize: '0.8rem', marginBottom: 4 }}>PARTICIPANTE ENCONTRADO</div>
              <div style={{ fontWeight: 800, fontSize: '1.2rem', color: colors.text }}>{participant.nombre_completo}</div>
              <div style={{ color: colors.textLight, fontSize: '0.9rem' }}>CURP: {participant.curp}</div>
              {participant.institucion && <div style={{ color: colors.textLight, fontSize: '0.9rem' }}>{participant.institucion}</div>}
            </div>
          )}

          {/* Formulario nuevo participante */}
          {showForm && (
            <div style={{ ...card, marginBottom: '1.5rem' }}>
              <h2 style={{ color: colors.dark, fontWeight: 700, fontSize: '1.1rem', marginTop: 0, marginBottom: '1rem' }}>
                Nuevo participante
              </h2>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {[
                  ['nombre_completo', 'Nombre completo *', 'text'],
                  ['curp', 'CURP *', 'text'],
                  ['fecha_nacimiento', 'Fecha de nacimiento', 'date'],
                  ['institucion', 'Institución / Guardería', 'text'],
                  ['cargo', 'Cargo', 'text'],
                ].map(([field, label, type]) => (
                  <div key={field}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: colors.textLight, display: 'block', marginBottom: 4 }}>{label}</label>
                    <input style={input} type={type} value={newP[field]} onChange={e => setNewP(p => ({ ...p, [field]: e.target.value }))} />
                  </div>
                ))}
                <button style={btn.primary} onClick={handleCreate} disabled={loading}>
                  {loading ? 'Guardando...' : 'Registrar participante'}
                </button>
              </div>
            </div>
          )}

          {/* Paso 2: Inscripción */}
          {participant && (
            <div style={card}>
              <h2 style={{ color: colors.dark, fontWeight: 700, fontSize: '1.1rem', marginTop: 0, marginBottom: '1rem' }}>
                Paso 2 — Capturar inscripción
              </h2>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: colors.textLight, display: 'block', marginBottom: 4 }}>Curso *</label>
                  <select style={input} value={form.course_id} onChange={e => setForm(f => ({ ...f, course_id: e.target.value }))}>
                    <option value="">Selecciona un curso...</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.codigo} — {c.nombre} ({c.duracion_horas} hrs)</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {[['fecha_inicio', 'Fecha inicio *'], ['fecha_termino', 'Fecha término *']].map(([field, label]) => (
                    <div key={field}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, color: colors.textLight, display: 'block', marginBottom: 4 }}>{label}</label>
                      <input style={input} type="date" value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
                    </div>
                  ))}
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: colors.textLight, display: 'block', marginBottom: 4 }}>Calificación final * (0 – 10)</label>
                  <input style={{ ...input, width: 120 }} type="number" min="0" max="10" step="0.1" value={form.calificacion} onChange={e => setForm(f => ({ ...f, calificacion: e.target.value }))} />
                </div>
                <button style={btn.primary} onClick={handleEnroll} disabled={loading}>
                  {loading ? 'Enviando...' : 'Enviar a revisión →'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Instructor.jsx
git commit -m "feat: add Instructor page with participant search and enrollment form"
```

---

## Task 15: Página Admin

**Files:**
- Create: `frontend/src/pages/Admin.jsx`

- [ ] **Step 1: Crear Admin.jsx**

Archivo: `frontend/src/pages/Admin.jsx`
```jsx
import { useState, useEffect, useCallback } from 'react'
import * as api from '../api'
import { colors, font, card, btn } from '../styles'

export default function Admin() {
  const [enrollments, setEnrollments] = useState([])
  const [selected, setSelected] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [emitted, setEmitted] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadPending = useCallback(async () => {
    try {
      const data = await api.getPendingEnrollments()
      setEnrollments(data)
    } catch { setError('Error al cargar inscripciones pendientes') }
  }, [])

  useEffect(() => { loadPending() }, [loadPending])

  async function handleEmit() {
    setLoading(true); setError('')
    try {
      const cert = await api.emitCertificate(selected.id)
      setEmitted(cert)
      setShowModal(false)
      setSelected(null)
      loadPending()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleReject() {
    setLoading(true); setError('')
    try {
      await api.rejectEnrollment(selected.id)
      setSelected(null)
      loadPending()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '2rem auto', padding: '0 1rem' }}>
      <h1 style={{ color: colors.primary, fontWeight: 800, fontSize: '1.8rem', marginBottom: '0.25rem' }}>
        Panel de Administración
      </h1>
      <p style={{ color: colors.textLight, marginBottom: '2rem' }}>
        Revisa las inscripciones pendientes y emite certificados.
      </p>

      {error && (
        <div style={{ background: colors.errorBg, color: colors.errorText, border: `1px solid ${colors.errorBorder}`, borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {emitted && (
        <div style={{ background: colors.successBg, color: colors.successText, border: `1px solid ${colors.successBorder}`, borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 8 }}>✓ Certificado emitido exitosamente</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.95rem' }}>
            <div><span style={{ fontWeight: 600 }}>No. Certificado:</span> {emitted.no_certificado}</div>
            <div><span style={{ fontWeight: 600 }}>Folio:</span> {emitted.folio_verificacion}</div>
            <div style={{ gridColumn: '1/-1', fontFamily: 'monospace', fontSize: '0.8rem', color: '#2d6a4f', wordBreak: 'break-all' }}>
              <span style={{ fontWeight: 600 }}>SHA-256:</span> {emitted.cert_hash}
            </div>
          </div>
          <button onClick={() => setEmitted(null)} style={{ ...btn.secondary, marginTop: '0.75rem', fontSize: '0.9rem' }}>
            Ver más inscripciones
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Cola de pendientes */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ color: colors.dark, fontWeight: 700, fontSize: '1rem', margin: 0 }}>
              Pendientes de aprobar
            </h2>
            <span style={{ background: colors.primary, color: colors.white, borderRadius: 20, padding: '2px 10px', fontSize: '0.8rem', fontWeight: 700 }}>
              {enrollments.length}
            </span>
          </div>
          {enrollments.length === 0 ? (
            <div style={{ color: colors.textLight, textAlign: 'center', padding: '2rem 0', fontSize: '0.9rem' }}>
              No hay inscripciones pendientes
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {enrollments.map(enr => (
                <div
                  key={enr.id}
                  onClick={() => { setSelected(enr); setEmitted(null) }}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 10,
                    border: `2px solid ${selected?.id === enr.id ? colors.primary : colors.border}`,
                    background: selected?.id === enr.id ? colors.light : colors.white,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: colors.text }}>{enr.participant.nombre_completo}</div>
                  <div style={{ color: colors.textLight, fontSize: '0.85rem' }}>{enr.course.nombre}</div>
                  <div style={{ color: colors.textLight, fontSize: '0.8rem' }}>{enr.fecha_termino}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detalle */}
        <div style={card}>
          {!selected ? (
            <div style={{ color: colors.textLight, textAlign: 'center', padding: '3rem 0' }}>
              Selecciona una inscripción para revisar
            </div>
          ) : (
            <>
              <h2 style={{ color: colors.dark, fontWeight: 700, fontSize: '1.1rem', marginTop: 0 }}>
                Expediente
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.5rem', marginBottom: '1.5rem' }}>
                {[
                  ['Participante', selected.participant.nombre_completo],
                  ['CURP', selected.participant.curp],
                  ['Institución', selected.participant.institucion || '—'],
                  ['Curso', selected.course.nombre],
                  ['Modalidad', selected.course.modalidad],
                  ['Duración', `${selected.course.duracion_horas} horas`],
                  ['Fecha inicio', selected.fecha_inicio],
                  ['Fecha término', selected.fecha_termino],
                  ['Calificación', <strong style={{ color: colors.primary, fontSize: '1.1rem' }}>{selected.calificacion}</strong>],
                  ['Cal. mínima', selected.course.calificacion_min],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: colors.textLight, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontWeight: 600, color: colors.text }}>{value}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button style={btn.primary} onClick={() => setShowModal(true)}>
                  Emitir certificado
                </button>
                <button style={btn.danger} onClick={handleReject} disabled={loading}>
                  Devolver al instructor
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal de confirmación */}
      {showModal && selected && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div style={{ ...card, maxWidth: 480, width: '90%' }}>
            <h2 style={{ color: colors.primary, fontWeight: 800, marginTop: 0 }}>Confirmar emisión</h2>
            <p style={{ color: colors.textLight, fontSize: '0.9rem', marginBottom: '1rem' }}>
              Se generará el SHA-256 y la firma GPG del certificado. Esta acción no se puede deshacer sin revocar.
            </p>
            <div style={{ background: colors.light, borderRadius: 10, padding: '1rem', marginBottom: '1.25rem', fontSize: '0.95rem' }}>
              <div><strong>Participante:</strong> {selected.participant.nombre_completo}</div>
              <div><strong>CURP:</strong> {selected.participant.curp.slice(0, 4)}**************</div>
              <div><strong>Curso:</strong> {selected.course.nombre}</div>
              <div><strong>Calificación:</strong> {selected.calificacion}</div>
              <div><strong>Fecha término:</strong> {selected.fecha_termino}</div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button style={btn.secondary} onClick={() => setShowModal(false)} disabled={loading}>
                Cancelar
              </button>
              <button style={btn.primary} onClick={handleEmit} disabled={loading}>
                {loading ? 'Generando certificado...' : 'Confirmar emisión'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Admin.jsx
git commit -m "feat: add Admin page with pending queue, detail view and emit modal"
```

---

## Task 16: Página Verificación Pública

**Files:**
- Create: `frontend/src/pages/PublicVerify.jsx`

- [ ] **Step 1: Crear PublicVerify.jsx**

Archivo: `frontend/src/pages/PublicVerify.jsx`
```jsx
import { useState } from 'react'
import * as api from '../api'
import { colors, font, card, input, btn } from '../styles'

const MENSAJES = {
  certificado_no_encontrado: 'No encontramos ningún certificado con ese folio.',
  certificado_revocado: 'Este certificado ha sido revocado por Pasitos Education & Health A.C.',
  hash_no_coincide: 'Los datos de este certificado han sido alterados. No es válido.',
  firma_invalida: 'La firma digital de este certificado no es válida.',
}

export default function PublicVerify() {
  const [folio, setFolio] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleVerify() {
    if (!folio.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const data = await api.verifyCertificate(folio.trim())
      setResult(data)
    } catch (e) {
      setError('Error al conectar con el servidor. ¿Está corriendo el backend?')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', background: colors.light, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '3rem 1rem' }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div style={{ fontWeight: 800, fontSize: '2.2rem', color: colors.primary, fontFamily: font, letterSpacing: '-0.5px', marginBottom: 4 }}>
          Pasitos
        </div>
        <div style={{ fontSize: '0.85rem', color: colors.dark, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: '1rem' }}>
          Education & Health A.C.
        </div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: colors.text, margin: '0 0 0.5rem' }}>
          Verificar Certificado
        </h1>
        <p style={{ color: colors.textLight, margin: 0, fontSize: '1rem', maxWidth: 440 }}>
          Ingresa el folio de verificación para comprobar la autenticidad de un certificado Pasitos.
        </p>
      </div>

      {/* Buscador */}
      <div style={{ ...card, width: '100%', maxWidth: 520, marginBottom: '2rem' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: colors.textLight, display: 'block', marginBottom: 8 }}>
          Folio de verificación
        </label>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <input
            style={input}
            placeholder="Ej. VER-0001"
            value={folio}
            onChange={e => setFolio(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleVerify()}
          />
          <button style={{ ...btn.primary, whiteSpace: 'nowrap' }} onClick={handleVerify} disabled={loading}>
            {loading ? '...' : 'Verificar'}
          </button>
        </div>
        {error && <div style={{ color: colors.errorText, fontSize: '0.9rem', marginTop: '0.5rem' }}>{error}</div>}
      </div>

      {/* Resultado válido */}
      {result?.valido && (
        <div style={{ width: '100%', maxWidth: 520, borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 20px rgba(40,167,69,0.15)' }}>
          <div style={{ background: '#28a745', padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: 4 }}>✓</div>
            <div style={{ color: colors.white, fontWeight: 800, fontSize: '1.3rem' }}>Certificado Válido</div>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem', marginTop: 4 }}>
              Este certificado fue emitido por Pasitos Education & Health A.C. y es auténtico.
            </div>
          </div>
          <div style={{ background: colors.white, padding: '1.5rem' }}>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {[
                ['Titular', result.certificado.nombre],
                ['CURP', result.certificado.curp_parcial],
                ['Curso', result.certificado.curso],
                ['Duración', `${result.certificado.duracion_horas} horas`],
                ['Calificación', result.certificado.calificacion_final],
                ['Resultado', result.certificado.resultado === 'acreditado' ? '✓ Acreditado' : '✗ No acreditado'],
                ['Fecha de emisión', result.certificado.fecha_emision],
                ['No. Certificado', result.certificado.no_certificado],
                ['Folio', result.certificado.folio_verificacion],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${colors.border}`, paddingBottom: '0.5rem' }}>
                  <span style={{ color: colors.textLight, fontSize: '0.9rem' }}>{label}</span>
                  <span style={{ fontWeight: 700, color: colors.text, fontSize: '0.9rem' }}>{value}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: colors.light, borderRadius: 8, fontSize: '0.8rem', color: colors.dark }}>
              <strong>Verificación criptográfica:</strong> Hash SHA-256 ✓ · Firma GPG ✓
            </div>
          </div>
        </div>
      )}

      {/* Resultado inválido */}
      {result && !result.valido && (
        <div style={{ width: '100%', maxWidth: 520, borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 20px rgba(220,53,69,0.15)' }}>
          <div style={{ background: '#dc3545', padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: 4 }}>✗</div>
            <div style={{ color: colors.white, fontWeight: 800, fontSize: '1.3rem' }}>Certificado No Válido</div>
          </div>
          <div style={{ background: colors.white, padding: '1.5rem', textAlign: 'center' }}>
            <p style={{ color: colors.errorText, fontWeight: 600, fontSize: '1rem', margin: 0 }}>
              {MENSAJES[result.razon] || result.mensaje || 'Este certificado no es válido.'}
            </p>
            <button style={{ ...btn.secondary, marginTop: '1rem' }} onClick={() => { setResult(null); setFolio('') }}>
              Intentar con otro folio
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/PublicVerify.jsx
git commit -m "feat: add public verify page with valid/invalid result display"
```

---

## Task 17: Smoke test de integración + limpieza

- [ ] **Step 1: Ejecutar todos los tests del backend**

```bash
cd backend
pytest tests/ -v --tb=short
```
Esperado: todos los tests pasan.

- [ ] **Step 2: Arrancar backend**

```bash
cd backend
uvicorn app.main:app --reload
```

- [ ] **Step 3: Arrancar frontend (en otra terminal)**

```bash
cd frontend
npm run dev
```

- [ ] **Step 4: Smoke test manual del flujo completo**

1. Abre `http://localhost:5173/instructor`
2. Busca una CURP que no existe (ej. `LOHM900115MJCRRL05`) → debe mostrar formulario de registro
3. Registra el participante, selecciona Puericultura, captura calificación 9.5, envía a revisión → banner verde
4. Abre `http://localhost:5173/admin` → debe aparecer la inscripción en la cola
5. Click en la inscripción → ver detalle → "Emitir certificado" → modal → "Confirmar emisión"
6. Copia el folio que aparece (ej. `VER-0001`)
7. Abre `http://localhost:5173/public` → ingresa el folio → resultado verde con datos del certificado

- [ ] **Step 5: Commit final**

```bash
git add .
git commit -m "feat: complete demo — instructor, admin and public verify pages"
```

---

## Flujo de arranque resumido

```bash
# Terminal 1 — Backend
cd backend
python demo_seed.py          # solo la primera vez
uvicorn app.main:app --reload

# Terminal 2 — Frontend
cd frontend
npm run dev
```

- Backend: `http://localhost:8000` (Swagger: `/docs`)
- Frontend: `http://localhost:5173`
