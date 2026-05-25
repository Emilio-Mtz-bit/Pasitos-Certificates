# Admin — Búsqueda y Revocación de Certificados
**Fecha:** 2026-05-21  
**Alcance:** Nueva pestaña en el panel Admin con búsqueda de certificados (por CURP o folio) y revocación con confirmación modal.

---

## 1. Objetivo

Permitir al administrador:
1. Buscar certificados emitidos por CURP del participante (ver todos los certificados de una persona) o por folio exacto
2. Ver el detalle completo de un certificado seleccionado
3. Revocar un certificado activo con confirmación modal (sin motivo — solo confirmación)

---

## 2. Layout

El panel `/admin` tendrá dos pestañas en la parte superior usando el mismo sistema de estilos existente (colores de marca, Nunito, inline styles):

- **Pestaña "Pendientes"** — contenido actual sin cambios (cola de inscripciones pendientes + emisión de certificados)
- **Pestaña "Certificados"** — nueva sección con buscador y detalle

El estado activo de pestaña se maneja con `useState` local en `Admin.jsx`.

---

## 3. Pestaña "Certificados"

### 3.1 Buscador

Dos modos de búsqueda seleccionables con botones toggle:

**Modo "Por CURP"**
- Input: CURP (se fuerza a mayúsculas)
- Botón "Buscar"
- Resultado: lista de certificados del participante. Cada fila muestra: nombre del titular, curso, no. certificado, folio, estado (badge verde ACTIVO / rojo REVOCADO)
- Si no hay resultados: mensaje "No se encontraron certificados para esa CURP"

**Modo "Por Folio"**
- Input: folio (se fuerza a mayúsculas, ej. VER-0001)
- Botón "Buscar"
- Resultado: muestra directamente el detalle del certificado encontrado (o mensaje de no encontrado)

### 3.2 Detalle del certificado seleccionado

Al hacer click en un certificado de la lista (o al encontrar uno por folio):

Muestra en panel derecho:
- Titular (nombre completo)
- CURP
- Curso
- Calificación
- Fecha de emisión
- No. Certificado (PAC-YYYY-NNNN)
- Folio de verificación (VER-NNNN)
- Estado: badge verde "ACTIVO" o rojo "REVOCADO"

**Si estado = activo:** botón rojo "Revocar certificado"
**Si estado = revocado:** solo el badge, sin acciones disponibles

### 3.3 Modal de revocación

Al click en "Revocar certificado":
- Modal de confirmación con datos clave: nombre, no. certificado, folio
- Advertencia: "Esta acción no se puede deshacer. El certificado quedará inválido para verificación pública."
- Botones: "Cancelar" / "Confirmar revocación"
- Al confirmar: spinner → éxito (badge cambia a REVOCADO) o error

---

## 4. Backend

### 4.1 Nuevo router: `backend/app/routers/certificates.py`

```
GET  /certificates/?curp={curp}    Busca todos los certificados de un participante por CURP
GET  /certificates/?folio={folio}  Busca un certificado por folio exacto
PATCH /certificates/{id}/revoke    Cambia estado del certificado a "revocado"
```

**GET /certificates/**
- Parámetros opcionales: `curp` o `folio` (se valida que al menos uno esté presente)
- Por CURP: JOIN con Enrollment → Participant, filtra por `participant.curp` (case-insensitive)
- Por folio: filtra por `folio_verificacion` exacto
- Respuesta: lista de `CertificateOut`

**PATCH /certificates/{id}/revoke**
- Busca el certificado por id
- Si no existe: 404
- Si ya está revocado: 400 "El certificado ya está revocado"
- Cambia `estado` a `EstadoCertificado.revocado`
- Commit y retorna el certificado actualizado

### 4.2 Nuevo schema: `CertificateOut`

En `schemas.py`:
```python
class CertificateOut(BaseModel):
    id: str
    no_certificado: str
    folio_verificacion: str
    cert_hash: str
    estado: str
    fecha_emision: Optional[date]
    participant: ParticipantOut
    course: CourseOut

    model_config = {"from_attributes": True}
```

> Nota: ya existe `CertificateEmitOut` para la respuesta de emisión — este nuevo schema es para búsqueda e incluye datos del participante y curso.

### 4.3 Registro en `main.py`

```python
from .routers import certificates
app.include_router(certificates.router)
```

---

## 5. Frontend

### 5.1 `api.js` — 3 nuevas funciones

```js
export const searchCertificatesByCurp = (curp) =>
  request(`/certificates/?curp=${encodeURIComponent(curp)}`)

export const searchCertificateByFolio = (folio) =>
  request(`/certificates/?folio=${encodeURIComponent(folio)}`)

export const revokeCertificate = (id) =>
  request(`/certificates/${id}/revoke`, { method: 'PATCH' })
```

### 5.2 `Admin.jsx` — cambios

- Agregar estado `const [tab, setTab] = useState('pendientes')`
- Agregar barra de tabs encima del contenido existente
- Envolver contenido actual en `{tab === 'pendientes' && ...}`
- Nueva sección `{tab === 'certificados' && <CertSearch />}` — puede ser un componente inline o función interna dentro de `Admin.jsx` para no crear un archivo extra

---

## 6. Lo que NO se construye

- Motivo de revocación (fuera del alcance del demo)
- Historial de revocaciones
- Notificación al participante
- Re-activación de certificados revocados

---

## 7. Archivos a modificar/crear

| Archivo | Acción |
|---|---|
| `backend/app/routers/certificates.py` | Crear |
| `backend/app/schemas.py` | Agregar `CertificateOut` |
| `backend/app/main.py` | Registrar router |
| `frontend/src/api.js` | Agregar 3 funciones |
| `frontend/src/pages/Admin.jsx` | Agregar tabs + sección Certificados |
