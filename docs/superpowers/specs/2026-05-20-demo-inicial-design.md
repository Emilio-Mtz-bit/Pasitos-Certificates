# Demo Inicial — Pasitos Certificates
**Fecha:** 2026-05-20  
**Alcance:** Backend funcional + frontend con 3 vistas (Admin, Instructor, Público)

---

## 1. Objetivo del demo

Demostrar el flujo completo de emisión y verificación de certificados:
1. Instructor registra un participante y captura su inscripción
2. Admin revisa y emite el certificado (SHA-256 + firma GPG real)
3. Público verifica el certificado por folio en el portal público

Todo corre localmente. Sin login. Sin PostgreSQL (SQLite para el demo).

---

## 2. Stack

| Capa | Tecnología |
|---|---|
| Backend | Python + FastAPI |
| Base de datos | SQLite (SQLAlchemy, `create_all` para el demo) |
| Criptografía | SHA-256 (hashlib) + GPG (python-gnupg) |
| Frontend | React + Vite + React Router |
| Tipografía | Nunito (Google Fonts) |
| Colores | Morado primario `#9B27AF`, oscuro `#7B2D8B`, lavanda `#F3E8FA` |

---

## 3. Alcance del backend (solo lo necesario)

### 3.1 Tablas (6 de las 7 del esquema completo)

- `gpg_keys` — llave pública armored + fingerprint
- `courses` — catálogo de cursos (seed inicial)
- `participants` — personas que toman cursos
- `enrollments` — inscripciones con calificación y estado
- `certificates` — certificados emitidos con hash y firma GPG
- `verify_log` — registro inmutable de verificaciones públicas

> Se omite `companies` y `users` porque no hay login en el demo.

### 3.2 Endpoints (8 en total)

```
GET  /courses                     Lista cursos activos
GET  /participants?q=             Busca por nombre o CURP
POST /participants                 Registra nuevo participante
POST /enrollments                  Captura inscripción
PATCH /enrollments/{id}/submit     Instructor envía a revisión (estado → pendiente)
GET  /enrollments?estado=pendiente Admin ve cola de trabajo
PATCH /enrollments/{id}/reject     Admin devuelve al instructor (estado → borrador)
PATCH /enrollments/{id}/emit       Admin emite certificado (SHA-256 + GPG)
GET  /verify/{folio}              Verificación pública por folio
```

### 3.3 Lógica de emisión (`/emit`)

Proceso atómico — si cualquier paso falla se hace rollback:
1. Validar que la inscripción existe y está en estado `pendiente`
2. Generar `no_certificado` con formato `PAC-AAAA-NNNN`
3. Generar `folio_verificacion` con formato `VER-NNNN`
4. Construir string canónico: `no_cert|folio|CURP|NOMBRE|curso|fecha|calificacion`
5. Calcular SHA-256 del string
6. Firmar el hash con la llave privada GPG del keyring local
7. Guardar certificado en BD con estado `activo`
8. Registrar en `verify_log`

### 3.4 Lógica de verificación (`/verify/{folio}`)

1. Buscar certificado por folio en BD
2. Si no existe → `{ valido: false, razon: "certificado_no_encontrado" }`
3. Si está revocado → `{ valido: false, razon: "certificado_revocado" }`
4. Recalcular SHA-256 con datos de BD y comparar con `cert_hash`
5. Si no coinciden → `{ valido: false, razon: "hash_no_coincide" }`
6. Verificar firma GPG con llave pública de `gpg_keys`
7. Si firma inválida → `{ valido: false, razon: "firma_invalida" }`
8. Registrar en `verify_log`
9. Retornar `{ valido: true, certificado: datos_publicos }`

### 3.5 Gestión de llaves GPG

- La llave privada vive en el **keyring GPG del sistema operativo**
- El fingerprint se guarda en `.env`
- La llave pública (armored) se guarda en la tabla `gpg_keys`
- Sin passphrase para el demo local
- El script `demo_seed.py` genera todo automáticamente:
  1. Genera par de llaves (`Pasitos Demo <demo@pasitosac.org>`)
  2. Importa al keyring local
  3. Escribe fingerprint en `.env`
  4. Inserta llave pública en BD
  5. Inserta cursos iniciales (C-001, C-002, C-003)

---

## 4. Estructura de archivos

```
pasitos/
├── backend/
│   ├── app/
│   │   ├── main.py              FastAPI app + CORS
│   │   ├── database.py          SQLAlchemy + SQLite
│   │   ├── models.py            Todos los modelos ORM
│   │   ├── schemas.py           Pydantic request/response
│   │   ├── services/
│   │   │   ├── hash_service.py  SHA-256
│   │   │   ├── gpg_service.py   Firma y verificación GPG
│   │   │   └── cert_service.py  Orquesta emisión completa
│   │   └── routers/
│   │       ├── participants.py
│   │       ├── enrollments.py
│   │       └── verify.py
│   ├── demo_seed.py             Setup inicial (GPG + cursos)
│   ├── .env                     GPG_KEY_FINGERPRINT + DATABASE_URL
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx              React Router setup
    │   ├── api.js               Llamadas al backend
    │   ├── pages/
    │   │   ├── Instructor.jsx
    │   │   ├── Admin.jsx
    │   │   └── PublicVerify.jsx
    │   └── components/
    │       └── NavBar.jsx
    ├── index.html
    └── vite.config.js
```

---

## 5. Diseño de pantallas

### 5.1 NavBar (todas las rutas)
Logo Pasitos + tres tabs: **Instructor** | **Admin** | **Verificación Pública**  
Colores de marca. En producción se elimina — cada rol tiene su acceso separado.

### 5.2 `/instructor`

**Paso 1 — Buscar o registrar participante**
- Campo CURP (18 caracteres) + botón "Buscar"
- Si existe: muestra tarjeta con datos del participante
- Si no existe: formulario desplegable — nombre completo, fecha de nacimiento, grado de estudios, institución/guardería

**Paso 2 — Capturar inscripción** (aparece al tener participante seleccionado)
- Dropdown: curso (lista desde `GET /courses`)
- Fecha inicio / fecha término
- Calificación (0.0 – 10.0)
- Botón "Enviar a revisión" → `PATCH /enrollments/{id}/submit`
- Confirmación visual: banner verde "Inscripción enviada a revisión"

### 5.3 `/admin`

**Layout dos columnas:**

- **Izquierda — Cola de pendientes:** lista de inscripciones en estado `pendiente`. Cada fila muestra nombre del participante, curso y fecha. Click selecciona para ver detalle.

- **Derecha — Detalle:** datos completos del participante, curso, calificación, fechas. Dos botones:
  - "Devolver al instructor" (por ahora solo cambia estado a `borrador`)
  - "Emitir certificado" → abre modal de confirmación con datos clave

**Modal de confirmación:**
Muestra: nombre, CURP parcial, curso, calificación, fecha. Botón "Confirmar emisión".  
Al confirmar: spinner mientras el backend genera hash + firma GPG.  
Resultado: tarjeta con `no_certificado` y `folio_verificacion` generados, con botón "Copiar folio".

### 5.4 `/public`

Página centrada, minimalista:
- Logo Pasitos prominente
- Título: "Verificar Certificado"
- Subtítulo: "Ingresa el folio de verificación para comprobar la autenticidad de un certificado Pasitos"
- Input: "Folio de verificación (ej. VER-0001)"
- Botón "Verificar"

**Resultado válido:** fondo verde suave, ✓ grande, nombre completo, curso, calificación, fecha de emisión, estado "ACTIVO". Mensaje: "Este certificado fue emitido por Pasitos Education & Health A.C. y es auténtico."

**Resultado inválido:** fondo rojo suave, ✗ grande, mensaje claro sin tecnicismos:
- `certificado_no_encontrado` → "No encontramos ningún certificado con ese folio."
- `certificado_revocado` → "Este certificado ha sido revocado por Pasitos Education & Health A.C."
- `hash_no_coincide` → "Los datos de este certificado han sido alterados. No es válido."
- `firma_invalida` → "La firma digital de este certificado no es válida."

---

## 6. Lo que NO se construye en este demo

- Login / JWT / autenticación
- Rol de empresa verificadora
- Generación de PDF del certificado
- Envío de correo
- Revocación de certificados (solo se define el estado en BD)
- Gestión de cursos y usuarios desde el panel
- Migraciones Alembic (se usa `create_all` para el demo)
- Deploy / hosting

---

## 7. Flujo de arranque local

```bash
# Backend
cd backend
pip install -r requirements.txt
python demo_seed.py        # genera GPG + carga cursos
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

Backend en `http://localhost:8000`  
Frontend en `http://localhost:5173`
