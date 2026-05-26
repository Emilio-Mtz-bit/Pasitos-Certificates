# Diseño: Generación de PDF de Certificado con QR

**Fecha:** 2026-05-25  
**Estado:** Aprobado

---

## Contexto

Al emitir un certificado desde el panel de admin, el sistema actualmente solo crea el registro en BD con SHA-256 y firma GPG. No existe ningún documento descargable. El cliente necesita un PDF que reproduzca fielmente el diseño del template "CAPACITACION QUE TRANSFORMA VIDAS", incluyendo un código QR que lleve directo a la verificación pública del certificado.

---

## Alcance

- **Incluido:** Generación del PDF (página 1 — Certificado de Competencia Laboral), QR code, endpoint de descarga, botones en el admin.
- **Excluido:** Página 2 (Boleta de Evaluación por Competencias) — se implementa en iteración futura cuando se agregue el modelo de módulos/competencias.
- **Excluido:** Imágenes de firmas — se dejan líneas en blanco; se pueden agregar en una iteración posterior.

---

## Arquitectura

```
[Admin emite certificado]
        │
        ▼
emitir_certificado() ──► crea Certificate en BD
        │
        ▼
pdf_service.generar_pdf_certificado(cert)
        │
        ▼
ReportLab dibuja PDF + qrcode incrustado
        │
        ▼
Guarda en backend/storage/certificates/{no_certificado}.pdf
        │
        ▼
cert.pdf_path guardado en BD

[Admin abre panel Certificados]
        │
        ▼
Botón "Ver PDF" → GET /certificates/{id}/pdf → FileResponse
```

---

## Cambios al backend

### 1. Dependencias nuevas (`requirements.txt`)

```
reportlab
qrcode[pil]
Pillow
```

### 2. Migración de BD — columna `pdf_path`

Se agrega `pdf_path TEXT` (nullable) a la tabla `certificates`. Como el proyecto usa SQLite sin Alembic, se ejecuta un bloque de migración seguro en el arranque de la app (`main.py`):

```python
# Al iniciar, agrega la columna si no existe (SQLite-safe)
with engine.connect() as conn:
    cols = [r[1] for r in conn.execute(text("PRAGMA table_info(certificates)"))]
    if "pdf_path" not in cols:
        conn.execute(text("ALTER TABLE certificates ADD COLUMN pdf_path TEXT"))
        conn.commit()
```

El modelo `Certificate` agrega `pdf_path = Column(String, nullable=True)`.

### 3. `pdf_service.py` — nuevo servicio

Ubicación: `backend/app/services/pdf_service.py`

**Función principal:** `generar_pdf_certificado(cert: models.Certificate) -> str`

- Recibe el objeto `Certificate` (con relaciones `enrollment → participant, course` ya cargadas).
- Lee `PUBLIC_VERIFY_URL` desde env (default: `http://localhost:5173`).
- Construye el QR apuntando a `{PUBLIC_VERIFY_URL}?folio={cert.folio_verificacion}`.
- Genera el QR como imagen PNG en memoria con `qrcode`.
- Dibuja el PDF en **A4 horizontal (landscape)** con ReportLab `canvas`.
- Guarda en `backend/storage/certificates/{cert.no_certificado}.pdf`.
- Retorna la ruta absoluta del archivo.

**Layout del PDF (coordenadas A4 landscape: 841 × 595 pt):**

| Elemento | Posición | Estilo |
|---|---|---|
| Sidebar morado izquierdo | x=0, y=0, w=80, h=595 | Fill `#7B2D8B` |
| Texto "CAPACITACION QUE TRANSFORMA VIDAS" | sidebar, rotado 90° | Blanco, 9pt |
| "Pasitos" (texto logo placeholder) | x=320, y=520 | `#7B2D8B`, 28pt Bold |
| "EDUCATION & HEALTH A.C." | x=320, y=504 | `#7B2D8B`, 9pt |
| "Autorizada por la Secretaria..." | x=280, y=488 | Gris, 8pt, centrado |
| "CERTIFICADO DE COMPETENCIA LABORAL" | x=280, y=460 | Negro, 18pt Bold, centrado |
| Badge "CON VALIDEZ DC-3..." | x=280, y=440 | Rectángulo morado, texto blanco 9pt |
| "Se certifica que:" | x=280, y=415 | Gris, 9pt, centrado |
| Nombre participante | x=280, y=385 | Negro, 26pt Bold, centrado |
| CURP | x=280, y=368 | Gris, 9pt, centrado |
| "Ha completado satisfactoriamente..." | x=280, y=340 | Gris, 9pt, centrado |
| Nombre del curso | x=280, y=310 | `#7B2D8B`, 22pt Bold, centrado |
| Descripción del curso (modalidad, horas) | x=280, y=292 | Gris, 9pt, centrado |
| Línea firma 1 (izquierda) | x=110, y=170 | Línea horizontal + nombre + cargo |
| Línea firma 2 (centro) | x=330, y=170 | Línea horizontal + nombre + cargo |
| Recuadro top-right | x=640, y=490 | Borde morado, "NO. DE CERTIFICADO", no_certificado en morado |
| Fecha emisión (top-right) | x=640, y=455 | "Emitido el {fecha}" gris 8pt |
| "Zapopan, Jalisco, México" | x=640, y=435 | Gris 8pt |
| Recuadro DC-3 (bottom-right) | x=635, y=200 | Ícono + texto legal |
| "FOLIO DE VERIFICACIÓN" | x=635, y=155 | Morado, 7pt Bold |
| Folio (ej. VER-0001) | x=635, y=140 | Morado, 12pt Bold |
| QR code | x=680, y=60, 80×80 | Imagen incrustada |
| "Escanea para verificar..." | x=635, y=50 | Gris, 6pt |

### 4. `cert_service.py` — modificación

Después del `db.commit()` y `db.refresh(cert)` al final de `emitir_certificado()`:

```python
from . import pdf_service

pdf_path = pdf_service.generar_pdf_certificado(cert)
cert.pdf_path = pdf_path
db.commit()
```

Se hace un segundo commit para persistir el `pdf_path`. Si la generación del PDF falla (excepción), el certificado ya existe en BD con estado `activo` — el error se loguea pero no revierte la emisión (el PDF puede regenerarse manualmente).

### 5. Nuevo endpoint — `GET /certificates/{certificate_id}/pdf`

En `backend/app/routers/certificates.py`:

```python
from fastapi.responses import FileResponse

@router.get("/{certificate_id}/pdf")
def download_pdf(certificate_id: str, db: Session = Depends(get_db)):
    cert = db.query(models.Certificate).filter(models.Certificate.id == certificate_id).first()
    if not cert:
        raise HTTPException(404, "Certificado no encontrado")
    if not cert.pdf_path or not os.path.exists(cert.pdf_path):
        raise HTTPException(404, "PDF no disponible para este certificado")
    return FileResponse(
        cert.pdf_path,
        media_type="application/pdf",
        filename=f"{cert.no_certificado}.pdf",
    )
```

### 6. Variable de entorno nueva

`backend/.env` (y `.env.example`):

```
PUBLIC_VERIFY_URL=http://localhost:5173
```

La URL completa del QR será: `{PUBLIC_VERIFY_URL}?folio={folio_verificacion}`

> Nota: la página de verificación pública (`PublicVerify.jsx`) debe leer `?folio` de los query params al cargar para pre-llenar el campo. Esto es un ajuste menor en el frontend.

---

## Cambios al frontend

### 7. `api.js` — función nueva

```js
export const getCertificatePdfUrl = (id) =>
  `${BASE}/certificates/${id}/pdf`
```

No usa `request()` porque la respuesta es binaria (PDF), se abre directamente en nueva pestaña.

### 8. `CertificadosTab` — botón "Ver PDF"

En el panel de detalle del certificado (donde ya existe el botón "Revocar"):

- Se agrega botón **"Ver PDF"** (estilo `btn.secondary`) que ejecuta:
  ```js
  window.open(api.getCertificatePdfUrl(selected.id), '_blank')
  ```
- Visible solo si `selected.estado === 'activo'` y la API devuelve el PDF (el botón se muestra siempre; si falla, el navegador mostrará error 404).

### 9. `PendientesTab` — botón post-emisión

En el banner verde de éxito (`emitted && ...`), junto al botón "Ver más inscripciones":

```jsx
<button
  style={{ ...btn.secondary, marginTop: '0.75rem', fontSize: '0.9rem' }}
  onClick={() => window.open(api.getCertificatePdfUrl(emitted.id), '_blank')}
>
  Descargar PDF
</button>
```

---

## Manejo de errores

| Escenario | Comportamiento |
|---|---|
| `PUBLIC_VERIFY_URL` no configurado | Usa `http://localhost:5173` como default |
| Falla generación PDF al emitir | Se loguea el error; el certificado sigue activo en BD; PDF no disponible hasta regenerar |
| Solicitan PDF de cert sin `pdf_path` | HTTP 404 con mensaje "PDF no disponible para este certificado" |
| Logo Pasitos no encontrado | Se omite imagen; se dibuja texto "Pasitos" como placeholder |

---

## Archivos a crear / modificar

| Archivo | Acción |
|---|---|
| `backend/requirements.txt` | Agregar `reportlab`, `qrcode[pil]`, `Pillow` |
| `backend/app/models.py` | Agregar `pdf_path` a `Certificate` |
| `backend/app/main.py` | Migración inline de columna `pdf_path` |
| `backend/app/services/pdf_service.py` | **Crear** |
| `backend/app/services/cert_service.py` | Llamar `pdf_service` post-commit |
| `backend/app/routers/certificates.py` | Agregar endpoint `/pdf` |
| `backend/storage/certificates/` | **Crear directorio** (con `.gitkeep`) |
| `.gitignore` | Agregar `backend/storage/certificates/*.pdf` para no commitear PDFs |
| `backend/.env` | Agregar `PUBLIC_VERIFY_URL=http://localhost:5173` |
| `frontend/src/api.js` | Agregar `getCertificatePdfUrl` |
| `frontend/src/pages/Admin.jsx` | Botones "Ver PDF" en CertificadosTab y PendientesTab |
| `frontend/src/pages/PublicVerify.jsx` | Leer `?folio` de query params al montar para pre-llenar campo |

---

## No incluido en este spec

- Firma digital visible en el PDF (líneas en blanco por ahora)
- Boleta de evaluación por competencias (página 2)
- Regeneración manual de PDFs para certificados ya emitidos sin PDF
- Autenticación del endpoint de descarga (se considera interno/admin por ahora)
