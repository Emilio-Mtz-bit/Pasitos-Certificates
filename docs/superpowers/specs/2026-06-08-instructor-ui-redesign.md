# Spec: Rediseño UI Instructor

**Fecha:** 2026-06-08  
**Estado:** Aprobado

---

## Contexto

El UI actual del instructor (`/instructor`) es un formulario lineal de 2 pasos (buscar participante por CURP → capturar inscripción). No existe concepto de "mis cursos" ni listado de estudiantes inscritos. El sistema no tiene autenticación; la identidad del instructor se simula mediante selección manual del curso al entrar.

---

## Objetivo

Rediseñar la interfaz del instructor para que se sienta como un producto final: el instructor puede ver los cursos que da, gestionar la lista de estudiantes inscritos con estados visuales, editar calificaciones y enviar inscripciones a revisión.

---

## Arquitectura de pantallas

### Pantalla 1 — Selección de curso (`/instructor`)

Reemplaza el formulario actual. El instructor elige su curso antes de cualquier acción.

**Componentes:**
- Header: título "Bienvenido, selecciona tu curso" + subtítulo.
- Grid de tarjetas (2 columnas desktop, 1 columna móvil), una por curso activo.
- Cada tarjeta muestra:
  - Chip de tipo de curso (capacitación técnica / taller / diplomado)
  - Nombre del curso (grande) y código (pequeño)
  - Horas de duración + modalidad
  - Contador de estudiantes inscritos (total de enrollments del curso, sin importar estado)
  - Botón "Entrar al curso"
- Al seleccionar, navega al Dashboard del curso.

**Datos requeridos:**
- `GET /courses/` — lista cursos activos.
- `GET /enrollments/` — para calcular contador por curso (filtrado en cliente por `course_id`).

---

### Pantalla 2 — Dashboard del curso

Se activa tras seleccionar un curso. Estado local: `selectedCourse`.

**Componentes:**

#### Header del curso
- Botón "← Cambiar curso" (regresa a Pantalla 1, limpia `selectedCourse`).
- Nombre del curso, código, horas, modalidad.
- Botón primario "＋ Agregar estudiante" (abre Modal).

#### Barra de resumen
4 badges/chips clicables que filtran la tabla:
- **Total** — todos los estudiantes
- **Borradores** — `estado === 'borrador'`
- **Pendientes** — `estado === 'pendiente'`
- **Activos** — `estado === 'activo'`

#### Tabla de estudiantes
Columnas: Nombre completo | CURP | Calificación | Resultado | Estado | Acciones

**Semáforo de estado (chips de color):**
| Estado | Color |
|--------|-------|
| borrador | Gris |
| pendiente | Amarillo |
| activo | Verde |
| revocado | Rojo |

**Acciones por estado:**
| Estado | Acciones disponibles |
|--------|----------------------|
| `borrador` | "Editar" + "Enviar a revisión" |
| `borrador` + observaciones | "Editar" + "Enviar a revisión" + badge "Rechazado" |
| `pendiente` | "Ver" (solo lectura) |
| `activo` | "Ver" (solo lectura) |
| `revocado` | "Ver" (solo lectura) |

**Edición inline:** Al dar clic en "Editar", la fila se expande en la misma tabla mostrando campos editables (calificación, fecha inicio, fecha término) con botones "Guardar" y "Cancelar". No abre modal.

- Guardar llama `PATCH /enrollments/{id}` (nuevo endpoint requerido — ver sección API).
- Cancelar colapsa la fila sin guardar.

**Datos requeridos:**
- `GET /enrollments/?course_id=<id>` — filtrado por curso (nuevo parámetro requerido en backend).

---

### Modal — Agregar estudiante

Flotante centrado, se activa con "＋ Agregar estudiante". Dos pasos.

#### Paso 1 — Buscar o crear participante
- Input CURP + botón "Buscar".
- **Encontrado:** tarjeta con nombre, CURP, institución. Botón "Continuar".
- **No encontrado:** formulario de registro debajo (nombre, CURP, fecha nacimiento, institución, cargo). Botón "Registrar y continuar".
- Botón "✕" cierra el modal en cualquier momento.

#### Paso 2 — Capturar inscripción
- Curso preseleccionado (texto no editable, tomado del curso activo).
- Campos editables: Fecha inicio, Fecha término, Calificación final.
- Botón "Enviar a revisión" — ejecuta `createEnrollment` + `submitEnrollment` en secuencia.
- Botón "← Volver" regresa al Paso 1.

---

## Cambios requeridos en la API

### 1. Filtrar enrollments por curso
```
GET /enrollments/?course_id=<uuid>
```
Actualmente el endpoint solo acepta `?estado=`. Se necesita añadir el parámetro `course_id` para que el instructor solo vea los estudiantes de su curso.

### 2. Editar una inscripción existente
```
PATCH /enrollments/{id}
body: { calificacion, fecha_inicio, fecha_termino }
```
Actualmente no existe un endpoint de actualización de inscripción. Se necesita para la edición inline en la tabla.

---

## Cambios en el frontend

| Archivo | Cambio |
|---------|--------|
| `frontend/src/pages/Instructor.jsx` | Reescritura completa (pantalla selección + dashboard) |
| `frontend/src/api.js` | Agregar `getEnrollmentsByCourse(courseId)` y `updateEnrollment(id, data)` |
| `backend/app/routers/enrollments.py` | Agregar `?course_id` al GET y endpoint PATCH de edición |
| `backend/app/schemas.py` | Agregar schema `EnrollmentUpdate` |

---

## Comportamiento de estados

- Un enrollment en `borrador` con `observaciones` no nulas indica que fue rechazado por el admin y devuelto. Se muestra badge "Rechazado" junto al estado.
- El instructor no puede cambiar un enrollment de `pendiente` a otro estado — eso es exclusivo del admin.
- La edición inline solo está habilitada para enrollments en estado `borrador`.

---

## Fuera de alcance

- Autenticación real / login de instructor
- Asignación de instructores a cursos en la base de datos
- Notificaciones por correo al instructor cuando un enrollment es rechazado
- Paginación de la tabla (se asume volumen manejable por ahora)
