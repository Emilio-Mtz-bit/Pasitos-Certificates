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
    if (curpInput.trim().length !== 18) { setError('La CURP debe tener exactamente 18 caracteres'); return }
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
    if (!newP.nombre_completo.trim()) { setError('El nombre completo es obligatorio'); return }
    if (newP.curp.trim().length !== 18) { setError('La CURP debe tener exactamente 18 caracteres'); return }
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
