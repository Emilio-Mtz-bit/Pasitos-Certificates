# Instructor UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar la interfaz del instructor con selección de curso, dashboard de estudiantes con tabla, edición inline y modal para agregar participantes.

**Architecture:** El instructor selecciona un curso en una pantalla de tarjetas; al entrar ve una tabla de sus estudiantes con chips de estado y acciones por estado (editar/enviar para borradores, ver para el resto). Un modal flotante de 2 pasos permite agregar estudiantes. El backend necesita dos cambios: filtro `course_id` en GET /enrollments/ y endpoint PATCH de edición de inscripción.

**Tech Stack:** React (Vite), inline styles con `styles.js`, FastAPI, SQLAlchemy, pytest

---

## File Structure

| Archivo | Cambio |
|---------|--------|
| `backend/app/schemas.py` | Agregar `observaciones` a `EnrollmentOut`; agregar `EnrollmentUpdate` |
| `backend/app/routers/enrollments.py` | Agregar param `course_id` al GET; agregar `PATCH /{id}` de edición |
| `backend/tests/test_enrollments.py` | Tests para filtro por course_id y endpoint de edición |
| `frontend/src/api.js` | Agregar `getEnrollmentsByCourse` y `updateEnrollment` |
| `frontend/src/pages/Instructor.jsx` | Reescritura completa |

---

## Task 1: Backend — Filtrar enrollments por course_id + exponer observaciones

**Files:**
- Modify: `backend/app/schemas.py`
- Modify: `backend/app/routers/enrollments.py`
- Modify: `backend/tests/test_enrollments.py`

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `backend/tests/test_enrollments.py`:

```python
@pytest.fixture
def second_course(db):
    from app import models
    course = models.Course(
        id="course-test-2", codigo="C-002", nombre="Nutricion",
        tipo=models.TipoCurso.capacitacion_tecnica,
        modalidad=models.ModalidadCurso.presencial,
        duracion_horas=40, calificacion_min=7.0,
    )
    db.add(course)
    db.commit()
    return "course-test-2"


def test_filtrar_por_course_id(client, participant_id, second_course):
    # Inscripción en curso 1
    client.post("/enrollments/", json={
        "participant_id": participant_id,
        "course_id": "course-test-1",
        "fecha_inicio": "2025-03-01",
        "fecha_termino": "2025-03-28",
        "calificacion": 9.0,
    })
    # Inscripción en curso 2
    client.post("/enrollments/", json={
        "participant_id": participant_id,
        "course_id": second_course,
        "fecha_inicio": "2025-04-01",
        "fecha_termino": "2025-04-30",
        "calificacion": 8.0,
    })
    response = client.get("/enrollments/?course_id=course-test-1")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["course_id"] == "course-test-1"


def test_enrollment_out_incluye_observaciones(client, participant_id):
    enr = client.post("/enrollments/", json={
        "participant_id": participant_id,
        "course_id": "course-test-1",
        "fecha_inicio": "2025-03-01",
        "fecha_termino": "2025-03-28",
        "calificacion": 9.5,
    }).json()
    assert "observaciones" in enr
```

- [ ] **Step 2: Ejecutar y verificar que falla**

```bash
cd backend && pytest tests/test_enrollments.py::test_filtrar_por_course_id tests/test_enrollments.py::test_enrollment_out_incluye_observaciones -v
```

Expected: FAIL — `test_filtrar_por_course_id` devuelve 2 resultados en vez de 1; `test_enrollment_out_incluye_observaciones` falla porque `observaciones` no está en el schema.

- [ ] **Step 3: Agregar `observaciones` a `EnrollmentOut` en `backend/app/schemas.py`**

Reemplazar la clase `EnrollmentOut`:

```python
class EnrollmentOut(BaseModel):
    id: str
    participant_id: str
    course_id: str
    fecha_inicio: date
    fecha_termino: date
    calificacion: Optional[Decimal] = None
    resultado: str
    estado: str
    observaciones: Optional[str] = None
    participant: ParticipantOut
    course: CourseOut

    model_config = {"from_attributes": True}
```

- [ ] **Step 4: Agregar parámetro `course_id` al GET en `backend/app/routers/enrollments.py`**

Reemplazar la función `list_enrollments`:

```python
@router.get("/", response_model=list[schemas.EnrollmentOut])
def list_enrollments(estado: str = None, course_id: str = None, db: Session = Depends(get_db)):
    query = db.query(models.Enrollment)
    if estado:
        try:
            estado_enum = models.EstadoCertificado(estado)
            query = query.filter(models.Enrollment.estado == estado_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Estado inválido: {estado}")
    if course_id:
        query = query.filter(models.Enrollment.course_id == course_id)
    return query.order_by(models.Enrollment.created_at.desc()).all()
```

- [ ] **Step 5: Ejecutar y verificar que pasan**

```bash
cd backend && pytest tests/test_enrollments.py::test_filtrar_por_course_id tests/test_enrollments.py::test_enrollment_out_incluye_observaciones -v
```

Expected: PASS

- [ ] **Step 6: Ejecutar suite completa para verificar que no hay regresiones**

```bash
cd backend && pytest tests/test_enrollments.py -v
```

Expected: todos los tests pasan.

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas.py backend/app/routers/enrollments.py backend/tests/test_enrollments.py
git commit -m "feat: filter enrollments by course_id and expose observaciones in schema"
```

---

## Task 2: Backend — PATCH /enrollments/{id} para edición de inscripción

**Files:**
- Modify: `backend/app/schemas.py`
- Modify: `backend/app/routers/enrollments.py`
- Modify: `backend/tests/test_enrollments.py`

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `backend/tests/test_enrollments.py`:

```python
def test_actualizar_inscripcion_en_borrador(client, participant_id):
    enr = client.post("/enrollments/", json={
        "participant_id": participant_id,
        "course_id": "course-test-1",
        "fecha_inicio": "2025-03-01",
        "fecha_termino": "2025-03-28",
        "calificacion": 9.5,
    }).json()
    response = client.patch(f"/enrollments/{enr['id']}", json={
        "calificacion": 8.0,
        "fecha_inicio": "2025-04-01",
        "fecha_termino": "2025-04-30",
    })
    assert response.status_code == 200
    data = response.json()
    assert float(data["calificacion"]) == 8.0
    assert data["fecha_inicio"] == "2025-04-01"


def test_no_actualizar_inscripcion_no_borrador(client, participant_id):
    enr = client.post("/enrollments/", json={
        "participant_id": participant_id,
        "course_id": "course-test-1",
        "fecha_inicio": "2025-03-01",
        "fecha_termino": "2025-03-28",
        "calificacion": 9.5,
    }).json()
    client.patch(f"/enrollments/{enr['id']}/submit")
    response = client.patch(f"/enrollments/{enr['id']}", json={"calificacion": 8.0})
    assert response.status_code == 400


def test_actualizar_inscripcion_no_encontrada(client):
    response = client.patch("/enrollments/no-existe", json={"calificacion": 8.0})
    assert response.status_code == 404
```

- [ ] **Step 2: Ejecutar y verificar que fallan**

```bash
cd backend && pytest tests/test_enrollments.py::test_actualizar_inscripcion_en_borrador tests/test_enrollments.py::test_no_actualizar_inscripcion_no_borrador tests/test_enrollments.py::test_actualizar_inscripcion_no_encontrada -v
```

Expected: FAIL — 404 o 405 porque el endpoint no existe.

- [ ] **Step 3: Agregar schema `EnrollmentUpdate` en `backend/app/schemas.py`**

Agregar después de `EnrollmentCreate`:

```python
class EnrollmentUpdate(BaseModel):
    calificacion: Optional[Decimal] = None
    fecha_inicio: Optional[date] = None
    fecha_termino: Optional[date] = None
```

- [ ] **Step 4: Agregar endpoint PATCH en `backend/app/routers/enrollments.py`**

Agregar después del endpoint `create_enrollment` (antes de `submit_enrollment`):

```python
@router.patch("/{enrollment_id}", response_model=schemas.EnrollmentOut)
def update_enrollment(enrollment_id: str, data: schemas.EnrollmentUpdate, db: Session = Depends(get_db)):
    enrollment = db.query(models.Enrollment).filter(models.Enrollment.id == enrollment_id).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Inscripción no encontrada")
    if enrollment.estado != models.EstadoCertificado.borrador:
        raise HTTPException(status_code=400, detail="Solo se pueden editar inscripciones en borrador")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(enrollment, key, value)
    db.commit()
    db.refresh(enrollment)
    return enrollment
```

> **Nota:** FastAPI distingue `PATCH /{id}` de `PATCH /{id}/submit` por el segmento adicional, así que no hay conflicto de rutas independientemente del orden de declaración.

- [ ] **Step 5: Ejecutar y verificar que pasan**

```bash
cd backend && pytest tests/test_enrollments.py::test_actualizar_inscripcion_en_borrador tests/test_enrollments.py::test_no_actualizar_inscripcion_no_borrador tests/test_enrollments.py::test_actualizar_inscripcion_no_encontrada -v
```

Expected: PASS

- [ ] **Step 6: Ejecutar suite completa**

```bash
cd backend && pytest tests/test_enrollments.py -v
```

Expected: todos los tests pasan.

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas.py backend/app/routers/enrollments.py backend/tests/test_enrollments.py
git commit -m "feat: add PATCH /enrollments/{id} for inline grade/date editing"
```

---

## Task 3: Frontend — Agregar helpers a api.js

**Files:**
- Modify: `frontend/src/api.js`

- [ ] **Step 1: Agregar las dos funciones al final de `frontend/src/api.js`**

```javascript
export const getEnrollmentsByCourse = (courseId) =>
  request(`/enrollments/?course_id=${encodeURIComponent(courseId)}`)

export const updateEnrollment = (id, data) =>
  request(`/enrollments/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api.js
git commit -m "feat: add getEnrollmentsByCourse and updateEnrollment to api.js"
```

---

## Task 4: Frontend — Reescribir Instructor.jsx

**Files:**
- Modify: `frontend/src/pages/Instructor.jsx` (reescritura completa)

- [ ] **Step 1: Reemplazar el contenido completo de `frontend/src/pages/Instructor.jsx`**

```jsx
import { useState, useEffect, Fragment } from 'react'
import * as api from '../api'
import { colors, font, card, input, btn } from '../styles'

const STATUS_CONFIG = {
  borrador:  { label: 'Borrador',  bg: '#e9ecef', color: '#495057' },
  pendiente: { label: 'Pendiente', bg: '#fff3cd', color: '#856404' },
  activo:    { label: 'Activo',    bg: '#d4edda', color: '#155724' },
  revocado:  { label: 'Revocado',  bg: '#f8d7da', color: '#721c24' },
}

const RESULT_LABELS = {
  acreditado:    'Acreditado',
  no_acreditado: 'No acreditado',
  en_proceso:    'En proceso',
}

function chip(bg, color, text) {
  return (
    <span style={{ display: 'inline-block', background: bg, color, borderRadius: 20, padding: '0.2rem 0.65rem', fontSize: '0.78rem', fontWeight: 700, fontFamily: font }}>
      {text}
    </span>
  )
}

function formatTipo(t) {
  return { capacitacion_tecnica: 'Capacitación', taller_practico: 'Taller', diplomado: 'Diplomado' }[t] ?? t
}

function formatModalidad(m) {
  return { presencial: 'Presencial', online: 'En línea', presencial_online: 'Mixta' }[m] ?? m
}

const tdStyle = { padding: '0.75rem 1rem', verticalAlign: 'middle', borderBottom: `1px solid #f0e4fb` }
const labelStyle = { fontSize: '0.82rem', fontWeight: 600, color: colors.textLight, display: 'block', marginBottom: 4 }

function ErrorBanner({ msg, onClose }) {
  return (
    <div style={{ background: '#fde8e8', color: '#721c24', border: '1px solid #dc3545', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span>{msg}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#721c24', fontSize: '1.1rem', lineHeight: 1 }}>✕</button>
    </div>
  )
}

function SuccessBanner({ msg }) {
  return (
    <div style={{ background: '#d4f5e2', color: '#155724', border: '1px solid #28a745', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem' }}>
      ✓ {msg}
    </div>
  )
}

export default function Instructor() {
  const [view, setView] = useState('courses')
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [courses, setCourses] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [filter, setFilter] = useState('all')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ calificacion: '', fecha_inicio: '', fecha_termino: '' })
  const [expandedId, setExpandedId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [modalStep, setModalStep] = useState(1)
  const [curpInput, setCurpInput] = useState('')
  const [modalParticipant, setModalParticipant] = useState(null)
  const [showNewP, setShowNewP] = useState(false)
  const [newP, setNewP] = useState({ nombre_completo: '', curp: '', fecha_nacimiento: '', institucion: '', cargo: '' })
  const [enrollForm, setEnrollForm] = useState({ fecha_inicio: '', fecha_termino: '', calificacion: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    api.getCourses().then(setCourses).catch(() => setError('No se pudo conectar al backend'))
  }, [])

  useEffect(() => {
    if (selectedCourse) {
      api.getEnrollmentsByCourse(selectedCourse.id)
        .then(setEnrollments)
        .catch(() => setError('No se pudieron cargar los estudiantes'))
    }
  }, [selectedCourse])

  const filtered = filter === 'all' ? enrollments : enrollments.filter(e => e.estado === filter)
  const counts = {
    all:       enrollments.length,
    borrador:  enrollments.filter(e => e.estado === 'borrador').length,
    pendiente: enrollments.filter(e => e.estado === 'pendiente').length,
    activo:    enrollments.filter(e => e.estado === 'activo').length,
  }

  function enterCourse(course) {
    setSelectedCourse(course); setView('dashboard')
    setFilter('all'); setEditingId(null); setExpandedId(null); setError(''); setSuccess('')
  }

  function exitCourse() {
    setView('courses'); setSelectedCourse(null); setEnrollments([])
    setError(''); setSuccess('')
  }

  function openEdit(enr) {
    setEditingId(enr.id); setExpandedId(null)
    setEditForm({ calificacion: enr.calificacion ?? '', fecha_inicio: enr.fecha_inicio, fecha_termino: enr.fecha_termino })
  }

  async function handleSaveEdit(id) {
    setLoading(true); setError('')
    try {
      const updated = await api.updateEnrollment(id, {
        calificacion: parseFloat(editForm.calificacion),
        fecha_inicio: editForm.fecha_inicio,
        fecha_termino: editForm.fecha_termino,
      })
      setEnrollments(prev => prev.map(e => e.id === id ? updated : e))
      setEditingId(null)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleSubmit(id) {
    setLoading(true); setError('')
    try {
      const updated = await api.submitEnrollment(id)
      setEnrollments(prev => prev.map(e => e.id === id ? { ...e, estado: updated.estado } : e))
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  function openModal() {
    setShowModal(true); setModalStep(1)
    setCurpInput(''); setModalParticipant(null); setShowNewP(false)
    setNewP({ nombre_completo: '', curp: '', fecha_nacimiento: '', institucion: '', cargo: '' })
    setEnrollForm({ fecha_inicio: '', fecha_termino: '', calificacion: '' })
    setError('')
  }

  function closeModal() { setShowModal(false); setError('') }

  async function handleModalSearch() {
    if (curpInput.trim().length !== 18) { setError('La CURP debe tener exactamente 18 caracteres'); return }
    setLoading(true); setError('')
    try {
      const results = await api.searchParticipants(curpInput.trim().toUpperCase())
      if (results.length > 0) {
        setModalParticipant(results[0]); setShowNewP(false)
      } else {
        setModalParticipant(null); setShowNewP(true)
        setNewP(p => ({ ...p, curp: curpInput.trim().toUpperCase() }))
      }
    } catch { setError('Error al buscar participante') }
    finally { setLoading(false) }
  }

  async function handleModalCreate() {
    if (!newP.nombre_completo.trim()) { setError('El nombre completo es obligatorio'); return }
    setLoading(true); setError('')
    try {
      const p = await api.createParticipant(newP)
      setModalParticipant(p); setShowNewP(false)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleModalEnroll() {
    if (!enrollForm.fecha_inicio || !enrollForm.fecha_termino || !enrollForm.calificacion) {
      setError('Completa todos los campos'); return
    }
    setLoading(true); setError('')
    try {
      const enr = await api.createEnrollment({
        participant_id: modalParticipant.id,
        course_id: selectedCourse.id,
        fecha_inicio: enrollForm.fecha_inicio,
        fecha_termino: enrollForm.fecha_termino,
        calificacion: parseFloat(enrollForm.calificacion),
      })
      await api.submitEnrollment(enr.id)
      const updated = await api.getEnrollmentsByCourse(selectedCourse.id)
      setEnrollments(updated)
      closeModal()
      setSuccess('Estudiante enviado a revisión correctamente')
      setTimeout(() => setSuccess(''), 4000)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  // ── Pantalla 1: Selección de curso ──────────────────────────────

  if (view === 'courses') {
    return (
      <div style={{ maxWidth: 900, margin: '2rem auto', padding: '0 1rem' }}>
        <h1 style={{ color: colors.primary, fontWeight: 800, fontSize: '1.8rem', marginBottom: '0.25rem' }}>
          Panel del Instructor
        </h1>
        <p style={{ color: colors.textLight, marginBottom: '2rem' }}>
          Selecciona el curso que impartes para gestionar a tus estudiantes.
        </p>
        {error && <ErrorBanner msg={error} onClose={() => setError('')} />}
        {courses.length === 0 && !error && (
          <p style={{ color: colors.textLight }}>Cargando cursos...</p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
          {courses.map(c => (
            <div key={c.id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                {chip(colors.lightMid, colors.primary, formatTipo(c.tipo))}
                {chip('#e0f2fe', '#0369a1', formatModalidad(c.modalidad))}
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.15rem', color: colors.text, lineHeight: 1.3 }}>{c.nombre}</div>
              <div style={{ color: colors.textLight, fontSize: '0.85rem' }}>{c.codigo} · {c.duracion_horas} horas</div>
              <button style={{ ...btn.primary, marginTop: '0.75rem', width: '100%' }} onClick={() => enterCourse(c)}>
                Entrar al curso →
              </button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Pantalla 2: Dashboard del curso ─────────────────────────────

  return (
    <div style={{ maxWidth: 1050, margin: '2rem auto', padding: '0 1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button onClick={exitCourse} style={{ ...btn.secondary, fontSize: '0.85rem', padding: '0.35rem 0.85rem', marginBottom: '0.5rem' }}>
            ← Cambiar curso
          </button>
          <h1 style={{ color: colors.primary, fontWeight: 800, fontSize: '1.6rem', margin: 0 }}>{selectedCourse.nombre}</h1>
          <p style={{ color: colors.textLight, margin: '0.2rem 0 0', fontSize: '0.9rem' }}>
            {selectedCourse.codigo} · {selectedCourse.duracion_horas} horas · {formatModalidad(selectedCourse.modalidad)}
          </p>
        </div>
        <button style={btn.primary} onClick={openModal}>＋ Agregar estudiante</button>
      </div>

      {error && <ErrorBanner msg={error} onClose={() => setError('')} />}
      {success && <SuccessBanner msg={success} />}

      {/* Filtros de resumen */}
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {[
          { key: 'all',      label: `Todos (${counts.all})` },
          { key: 'borrador', label: `Borradores (${counts.borrador})` },
          { key: 'pendiente',label: `Pendientes (${counts.pendiente})` },
          { key: 'activo',   label: `Activos (${counts.activo})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              padding: '0.4rem 1rem', borderRadius: 20, fontSize: '0.85rem', fontWeight: 700,
              cursor: 'pointer', fontFamily: font, transition: 'all 0.15s',
              background: filter === key ? colors.primary : colors.light,
              color: filter === key ? colors.white : colors.primary,
              border: `2px solid ${filter === key ? colors.primary : colors.border}`,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tabla */}
      {filtered.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: colors.textLight, padding: '3rem' }}>
          {enrollments.length === 0
            ? 'Aún no hay estudiantes inscritos en este curso.'
            : 'No hay estudiantes con el filtro seleccionado.'}
        </div>
      ) : (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: colors.light }}>
                {['Nombre', 'CURP', 'Calificación', 'Resultado', 'Estado', 'Acciones'].map(h => (
                  <th key={h} style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: 700, color: colors.dark, borderBottom: `2px solid ${colors.border}`, whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(enr => {
                const sc = STATUS_CONFIG[enr.estado] ?? { label: enr.estado, bg: '#e9ecef', color: '#495057' }
                const isEditing = editingId === enr.id
                const isExpanded = expandedId === enr.id
                return (
                  <Fragment key={enr.id}>
                    <tr style={{ background: isEditing ? colors.gray : 'white' }}>
                      <td style={tdStyle}>
                        <span style={{ fontWeight: 600 }}>{enr.participant.nombre_completo}</span>
                        {enr.observaciones && enr.estado === 'borrador' && (
                          <span style={{ marginLeft: 8 }}>{chip('#f8d7da', '#721c24', 'Rechazado')}</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.8rem', color: colors.textLight }}>
                        {enr.participant.curp}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>
                        {enr.calificacion != null ? Number(enr.calificacion).toFixed(1) : '—'}
                      </td>
                      <td style={tdStyle}>{RESULT_LABELS[enr.resultado] ?? enr.resultado}</td>
                      <td style={tdStyle}>{chip(sc.bg, sc.color, sc.label)}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        {enr.estado === 'borrador' && !isEditing && (
                          <>
                            <button onClick={() => openEdit(enr)} style={{ ...btn.secondary, fontSize: '0.8rem', padding: '0.3rem 0.75rem', marginRight: 6 }}>
                              Editar
                            </button>
                            <button onClick={() => handleSubmit(enr.id)} disabled={loading} style={{ ...btn.primary, fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}>
                              Enviar
                            </button>
                          </>
                        )}
                        {enr.estado !== 'borrador' && (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : enr.id)}
                            style={{ ...btn.secondary, fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
                          >
                            {isExpanded ? 'Cerrar' : 'Ver'}
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Fila de edición inline */}
                    {isEditing && (
                      <tr style={{ background: colors.gray }}>
                        <td colSpan={6} style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${colors.border}` }}>
                          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div>
                              <label style={labelStyle}>Calificación</label>
                              <input style={{ ...input, width: 110 }} type="number" min="0" max="10" step="0.1"
                                value={editForm.calificacion}
                                onChange={e => setEditForm(f => ({ ...f, calificacion: e.target.value }))} />
                            </div>
                            <div>
                              <label style={labelStyle}>Fecha inicio</label>
                              <input style={{ ...input, width: 155 }} type="date"
                                value={editForm.fecha_inicio}
                                onChange={e => setEditForm(f => ({ ...f, fecha_inicio: e.target.value }))} />
                            </div>
                            <div>
                              <label style={labelStyle}>Fecha término</label>
                              <input style={{ ...input, width: 155 }} type="date"
                                value={editForm.fecha_termino}
                                onChange={e => setEditForm(f => ({ ...f, fecha_termino: e.target.value }))} />
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button style={{ ...btn.primary, fontSize: '0.9rem' }} onClick={() => handleSaveEdit(enr.id)} disabled={loading}>
                                {loading ? '...' : 'Guardar'}
                              </button>
                              <button style={{ ...btn.secondary, fontSize: '0.9rem' }} onClick={() => setEditingId(null)}>
                                Cancelar
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Fila de detalle (solo lectura) */}
                    {isExpanded && (
                      <tr style={{ background: colors.gray }}>
                        <td colSpan={6} style={{ padding: '0.75rem 1.25rem', color: colors.textLight, fontSize: '0.88rem', borderBottom: `1px solid ${colors.border}` }}>
                          {enr.observaciones
                            ? <><strong style={{ color: colors.text }}>Observaciones:</strong> {enr.observaciones}</>
                            : 'Sin observaciones del administrador.'}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Agregar Estudiante */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ ...card, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <button onClick={closeModal} style={{ position: 'absolute', top: 14, right: 18, background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: colors.textLight, lineHeight: 1 }}>
              ✕
            </button>
            <h2 style={{ color: colors.primary, fontWeight: 800, marginTop: 0, marginBottom: '0.2rem' }}>Agregar estudiante</h2>
            <p style={{ color: colors.textLight, fontSize: '0.85rem', marginBottom: '1.5rem' }}>Paso {modalStep} de 2</p>

            {error && <ErrorBanner msg={error} onClose={() => setError('')} />}

            {/* Paso 1: Buscar / Crear participante */}
            {modalStep === 1 && (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>CURP del participante</label>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <input
                      style={input} placeholder="18 caracteres" maxLength={18}
                      value={curpInput}
                      onChange={e => setCurpInput(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && handleModalSearch()}
                    />
                    <button style={{ ...btn.primary, whiteSpace: 'nowrap' }} onClick={handleModalSearch} disabled={loading}>
                      {loading ? '...' : 'Buscar'}
                    </button>
                  </div>
                </div>

                {modalParticipant && (
                  <div style={{ background: colors.light, borderRadius: 10, padding: '0.85rem 1rem', border: `1px solid ${colors.border}` }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: colors.primary, marginBottom: 4 }}>PARTICIPANTE ENCONTRADO</div>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{modalParticipant.nombre_completo}</div>
                    <div style={{ color: colors.textLight, fontSize: '0.85rem' }}>{modalParticipant.curp}</div>
                    {modalParticipant.institucion && (
                      <div style={{ color: colors.textLight, fontSize: '0.85rem' }}>{modalParticipant.institucion}</div>
                    )}
                    <button style={{ ...btn.primary, marginTop: '0.75rem', width: '100%' }} onClick={() => { setError(''); setModalStep(2) }}>
                      Continuar con este participante →
                    </button>
                  </div>
                )}

                {showNewP && (
                  <div style={{ display: 'grid', gap: '0.6rem', paddingTop: '0.5rem', borderTop: `1px solid ${colors.border}` }}>
                    <p style={{ margin: 0, color: colors.textLight, fontSize: '0.88rem' }}>
                      Participante no encontrado. Completa sus datos para registrarlo:
                    </p>
                    {[
                      ['nombre_completo', 'Nombre completo *', 'text'],
                      ['curp', 'CURP *', 'text'],
                      ['fecha_nacimiento', 'Fecha de nacimiento', 'date'],
                      ['institucion', 'Institución / Guardería', 'text'],
                      ['cargo', 'Cargo', 'text'],
                    ].map(([field, label, type]) => (
                      <div key={field}>
                        <label style={labelStyle}>{label}</label>
                        <input style={input} type={type} value={newP[field]}
                          onChange={e => setNewP(p => ({ ...p, [field]: e.target.value }))} />
                      </div>
                    ))}
                    <button style={btn.primary} onClick={handleModalCreate} disabled={loading}>
                      {loading ? 'Guardando...' : 'Registrar y continuar →'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Paso 2: Capturar inscripción */}
            {modalStep === 2 && (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <div style={{ background: colors.light, borderRadius: 8, padding: '0.6rem 1rem', fontSize: '0.9rem' }}>
                  <strong style={{ color: colors.textLight }}>Participante:</strong> {modalParticipant?.nombre_completo}
                </div>
                <div style={{ background: colors.light, borderRadius: 8, padding: '0.6rem 1rem', fontSize: '0.9rem' }}>
                  <strong style={{ color: colors.textLight }}>Curso:</strong> {selectedCourse.nombre}
                </div>
                {[
                  ['fecha_inicio', 'Fecha inicio *', 'date'],
                  ['fecha_termino', 'Fecha término *', 'date'],
                ].map(([field, label, type]) => (
                  <div key={field}>
                    <label style={labelStyle}>{label}</label>
                    <input style={input} type={type} value={enrollForm[field]}
                      onChange={e => setEnrollForm(f => ({ ...f, [field]: e.target.value }))} />
                  </div>
                ))}
                <div>
                  <label style={labelStyle}>Calificación final * (0 – 10)</label>
                  <input style={{ ...input, width: 130 }} type="number" min="0" max="10" step="0.1"
                    value={enrollForm.calificacion}
                    onChange={e => setEnrollForm(f => ({ ...f, calificacion: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                  <button style={{ ...btn.secondary, flex: '0 0 auto' }} onClick={() => { setModalStep(1); setError('') }}>
                    ← Volver
                  </button>
                  <button style={{ ...btn.primary, flex: 1 }} onClick={handleModalEnroll} disabled={loading}>
                    {loading ? 'Enviando...' : 'Enviar a revisión →'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar que el frontend compila sin errores**

```bash
cd frontend && npm run build
```

Expected: compilación exitosa sin errores.

- [ ] **Step 3: Iniciar el servidor de desarrollo y probar manualmente**

En una terminal:
```bash
cd backend && uvicorn app.main:app --reload
```

En otra terminal:
```bash
cd frontend && npm run dev
```

Abrir `http://localhost:5173` → ir a la ruta del instructor.

Checklist de prueba manual:
- [ ] La pantalla muestra tarjetas de cursos activos
- [ ] Dar clic en "Entrar al curso" lleva al dashboard de ese curso
- [ ] El botón "← Cambiar curso" regresa a la selección
- [ ] Los filtros de resumen (Todos / Borradores / Pendientes / Activos) filtran la tabla
- [ ] Un enrollment en borrador muestra botones "Editar" y "Enviar"
- [ ] Dar clic en "Editar" expande la fila con inputs de calificación y fechas
- [ ] "Guardar" actualiza la fila en la tabla sin recargar la página
- [ ] "Enviar" cambia el estado del enrollment a pendiente y actualiza el chip
- [ ] Un enrollment rechazado (borrador con observaciones) muestra badge "Rechazado"
- [ ] Un enrollment pendiente/activo/revocado muestra botón "Ver" que expande observaciones
- [ ] El botón "＋ Agregar estudiante" abre el modal
- [ ] Buscar una CURP existente muestra la tarjeta del participante y permite continuar
- [ ] Buscar una CURP inexistente muestra el formulario de registro
- [ ] El Paso 2 del modal tiene el curso preseleccionado y no editable
- [ ] "Enviar a revisión" en el modal cierra el modal y muestra el banner de éxito
- [ ] El nuevo estudiante aparece en la tabla con estado pendiente

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Instructor.jsx
git commit -m "feat: redesign instructor UI with course selection, student table, inline editing, and add student modal"
```

---

## Verificación final

```bash
cd backend && pytest -v
```

Expected: todos los tests pasan (incluyendo los nuevos de Task 1 y Task 2).
