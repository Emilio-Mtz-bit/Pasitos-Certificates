# Pasitos Certificates

Sistema de gestión y emisión de certificados digitales para **Pasitos Education & Health A.C.** Los certificados se firman con GPG y se registran con hash SHA-256, permitiendo verificación pública de autenticidad.

---

## Funcionalidades

### Instructor (`/instructor`)
- Selección de curso al ingresar
- Tabla de estudiantes con semáforo de estados (borrador, pendiente, activo, revocado)
- Edición inline de calificación y fechas
- Envío de inscripciones a revisión del admin
- Modal de 2 pasos para agregar nuevos estudiantes (buscar por CURP o registrar)
- Guardar como borrador sin enviar
- Ver comentarios del admin cuando una inscripción es devuelta
- Reactivar inscripciones revocadas para re-emitir un nuevo certificado

### Administrador (`/admin`)
- Revisar inscripciones pendientes y ver expediente completo
- Emitir certificado: genera número de certificado, folio, hash SHA-256 y firma GPG
- Devolver inscripción al instructor con comentarios
- Buscar certificados por CURP o folio
- Revocar certificados emitidos

### Verificación pública (`/public`)
- Verificar autenticidad de un certificado por folio + nombre del titular
- Detecta certificados revocados, hashes alterados y firmas inválidas
- Accesible sin login — para uso de empleadores o instituciones

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | FastAPI, SQLAlchemy, SQLite |
| Criptografía | python-gnupg (firma GPG), SHA-256 |
| PDF | ReportLab, qrcode |
| Frontend | React 19, Vite, React Router |

---

## Requisitos previos

- **Python 3.11+**
- **Node.js 18+**
- **GPG** — en Windows instalar [Gpg4win](https://www.gpg4win.org/); en macOS/Linux suele venir preinstalado (`gpg --version` para verificar)

---

## Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/Emilio-Mtz-bit/Pasitos-Certificates.git
cd Pasitos-Certificates
```

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
python demo_seed.py
```

`demo_seed.py` hace todo el setup inicial:
- Genera un par de llaves GPG para firma de certificados
- Crea el archivo `.env` con el fingerprint de la llave
- Crea la base de datos `pasitos.db` con cursos y datos de ejemplo

Arranca el servidor:

```bash
uvicorn app.main:app --reload
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## URLs de acceso

| URL | Descripción |
|-----|-------------|
| `http://localhost:5173/instructor` | Vista del instructor |
| `http://localhost:5173/admin` | Panel de administración |
| `http://localhost:5173/public` | Verificación pública de certificados |
| `http://localhost:8000/docs` | Documentación interactiva de la API (Swagger) |

---

## Estructura del proyecto

```
Pasitos-Certificates/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app + migraciones de BD
│   │   ├── models.py        # Modelos SQLAlchemy
│   │   ├── schemas.py       # Esquemas Pydantic
│   │   ├── routers/         # Endpoints: enrollments, certificates, verify, ...
│   │   └── services/        # Lógica de negocio: cert_service, gpg, hash, pdf
│   ├── storage/             # PDFs generados
│   ├── demo_seed.py         # Setup inicial (GPG + BD + datos de ejemplo)
│   └── requirements.txt
└── frontend/
    └── src/
        ├── pages/           # Instructor.jsx, Admin.jsx, PublicVerify.jsx
        ├── api.js           # Llamadas al backend
        └── styles.js        # Tema visual (colores, componentes base)
```

---

## Notas técnicas

**Cadena de confianza de un certificado:**

1. Al emitir, se calcula un hash SHA-256 sobre los datos del certificado (nombre, CURP, curso, calificación, folio, fecha)
2. El hash se firma con la llave GPG privada de la organización
3. El folio de verificación permite consultar el certificado en `/public`
4. Al verificar, se recalcula el hash con los datos almacenados y se compara — cualquier alteración invalida el certificado

**Estados de una inscripción:**

```
borrador → pendiente → activo
   ↑           ↓
   └── (devuelto por admin con comentarios)

activo → revocado → borrador (reactivado por instructor) → ...
```

La base de datos se crea automáticamente al correr `demo_seed.py`. Las migraciones de esquema se aplican al iniciar el backend (`main.py`).
