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
      const payload = {
        fecha_inicio: editForm.fecha_inicio,
        fecha_termino: editForm.fecha_termino,
      }
      if (editForm.calificacion !== '') {
        payload.calificacion = parseFloat(editForm.calificacion)
      }
      const updated = await api.updateEnrollment(id, payload)
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
      setEditingId(null)
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
    if (newP.curp.trim().length !== 18) { setError('La CURP debe tener 18 caracteres'); return }
    setLoading(true); setError('')
    try {
      const p = await api.createParticipant(newP)
      setModalParticipant(p); setShowNewP(false)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleModalEnroll() {
    if (!modalParticipant) { setError('Error: no hay participante seleccionado'); return }
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

  async function handleModalSaveDraft() {
    if (!modalParticipant) { setError('Error: no hay participante seleccionado'); return }
    if (!enrollForm.fecha_inicio || !enrollForm.fecha_termino || !enrollForm.calificacion) {
      setError('Completa todos los campos'); return
    }
    setLoading(true); setError('')
    try {
      await api.createEnrollment({
        participant_id: modalParticipant.id,
        course_id: selectedCourse.id,
        fecha_inicio: enrollForm.fecha_inicio,
        fecha_termino: enrollForm.fecha_termino,
        calificacion: parseFloat(enrollForm.calificacion),
      })
      const updated = await api.getEnrollmentsByCourse(selectedCourse.id)
      setEnrollments(updated)
      closeModal()
      setSuccess('Inscripción guardada como borrador')
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
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                  <button style={{ ...btn.secondary, flex: '0 0 auto' }} onClick={() => { setModalStep(1); setError('') }}>
                    ← Volver
                  </button>
                  <button style={{ ...btn.secondary, flex: 1 }} onClick={handleModalSaveDraft} disabled={loading}>
                    {loading ? '...' : 'Guardar borrador'}
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
