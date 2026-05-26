import { useState, useEffect, useCallback } from 'react'
import * as api from '../api'
import { colors, font, card, btn } from '../styles'

export default function Admin() {
  const [tab, setTab] = useState('pendientes')

  return (
    <div style={{ maxWidth: 1100, margin: '2rem auto', padding: '0 1rem' }}>
      <h1 style={{ color: colors.primary, fontWeight: 800, fontSize: '1.8rem', marginBottom: '0.25rem' }}>
        Panel de Administración
      </h1>
      <p style={{ color: colors.textLight, marginBottom: '1.5rem' }}>
        Gestiona inscripciones pendientes y certificados emitidos.
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: `2px solid ${colors.border}`, paddingBottom: '0' }}>
        {[['pendientes', 'Pendientes'], ['certificados', 'Certificados']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: tab === key ? `3px solid ${colors.primary}` : '3px solid transparent',
              color: tab === key ? colors.primary : colors.textLight,
              fontFamily: font,
              fontWeight: tab === key ? 700 : 500,
              fontSize: '1rem',
              padding: '0.5rem 1.25rem',
              cursor: 'pointer',
              marginBottom: -2,
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'pendientes' && <PendientesTab />}
      {tab === 'certificados' && <CertificadosTab />}
    </div>
  )
}

function PendientesTab() {
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
      await loadPending()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleReject() {
    setLoading(true); setError('')
    try {
      await api.rejectEnrollment(selected.id)
      setSelected(null)
      await loadPending()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <>
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
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <button onClick={() => setEmitted(null)} style={{ ...btn.secondary, fontSize: '0.9rem' }}>
              Ver más inscripciones
            </button>
            <button
              onClick={() => window.open(api.getCertificatePdfUrl(emitted.id), '_blank')}
              style={{ ...btn.primary, fontSize: '0.9rem' }}
            >
              Descargar PDF
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ color: colors.dark, fontWeight: 700, fontSize: '1rem', margin: 0 }}>Pendientes de aprobar</h2>
            <span style={{ background: colors.primary, color: colors.white, borderRadius: 20, padding: '2px 10px', fontSize: '0.8rem', fontWeight: 700 }}>
              {enrollments.length}
            </span>
          </div>
          {enrollments.length === 0 ? (
            <div style={{ color: colors.textLight, textAlign: 'center', padding: '2rem 0', fontSize: '0.9rem' }}>No hay inscripciones pendientes</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {enrollments.map(enr => (
                <div
                  key={enr.id}
                  onClick={() => { setSelected(enr); setEmitted(null) }}
                  style={{
                    padding: '0.75rem 1rem', borderRadius: 10,
                    border: `2px solid ${selected?.id === enr.id ? colors.primary : colors.border}`,
                    background: selected?.id === enr.id ? colors.light : colors.white,
                    cursor: 'pointer', transition: 'all 0.15s',
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

        <div style={card}>
          {!selected ? (
            <div style={{ color: colors.textLight, textAlign: 'center', padding: '3rem 0' }}>Selecciona una inscripción para revisar</div>
          ) : (
            <>
              <h2 style={{ color: colors.dark, fontWeight: 700, fontSize: '1.1rem', marginTop: 0 }}>Expediente</h2>
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
                <button style={btn.primary} onClick={() => setShowModal(true)}>Emitir certificado</button>
                <button style={btn.danger} onClick={handleReject} disabled={loading}>Devolver al instructor</button>
              </div>
            </>
          )}
        </div>
      </div>

      {showModal && selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
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
              <button style={btn.secondary} onClick={() => setShowModal(false)} disabled={loading}>Cancelar</button>
              <button style={btn.primary} onClick={handleEmit} disabled={loading}>
                {loading ? 'Generando certificado...' : 'Confirmar emisión'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function CertificadosTab() {
  const [modo, setModo] = useState('curp')
  const [query, setQuery] = useState('')
  const [certs, setCerts] = useState([])
  const [selected, setSelected] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSearch() {
    if (!query.trim()) return
    setLoading(true); setError(''); setCerts([]); setSelected(null)
    try {
      const data = modo === 'curp'
        ? await api.searchCertificatesByCurp(query.trim().toUpperCase())
        : await api.searchCertificateByFolio(query.trim().toUpperCase())
      setCerts(data)
      if (data.length === 0) setError('No se encontraron certificados.')
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleRevoke() {
    setLoading(true); setError('')
    try {
      const updated = await api.revokeCertificate(selected.id)
      setCerts(prev => prev.map(c => c.id === updated.id ? updated : c))
      setSelected(updated)
      setShowModal(false)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <>
      {error && (
        <div style={{ background: colors.errorBg, color: colors.errorText, border: `1px solid ${colors.errorBorder}`, borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Buscador */}
        <div style={card}>
          <h2 style={{ color: colors.dark, fontWeight: 700, fontSize: '1rem', marginTop: 0, marginBottom: '1rem' }}>Buscar certificado</h2>

          {/* Toggle modo */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {[['curp', 'Por CURP'], ['folio', 'Por Folio']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setModo(key); setQuery(''); setCerts([]); setSelected(null); setError('') }}
                style={{
                  ...btn.secondary,
                  padding: '0.35rem 0.9rem',
                  fontSize: '0.85rem',
                  background: modo === key ? colors.primary : 'transparent',
                  color: modo === key ? colors.white : colors.primary,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <input
              style={{ flex: 1, padding: '0.6rem 1rem', border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: '0.9rem', fontFamily: font }}
              placeholder={modo === 'curp' ? 'CURP (18 caracteres)' : 'Ej. VER-0001'}
              value={query}
              onChange={e => setQuery(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <button style={{ ...btn.primary, whiteSpace: 'nowrap', fontSize: '0.9rem' }} onClick={handleSearch} disabled={loading}>
              {loading ? '...' : 'Buscar'}
            </button>
          </div>

          {certs.length > 0 && (
            <div style={{ display: 'grid', gap: '0.4rem' }}>
              {certs.map(cert => (
                <div
                  key={cert.id}
                  onClick={() => setSelected(cert)}
                  style={{
                    padding: '0.65rem 0.9rem', borderRadius: 8, cursor: 'pointer',
                    border: `2px solid ${selected?.id === cert.id ? colors.primary : colors.border}`,
                    background: selected?.id === cert.id ? colors.light : colors.white,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: colors.text }}>{cert.nombre}</div>
                  <div style={{ color: colors.textLight, fontSize: '0.8rem' }}>{cert.folio_verificacion} · {cert.curso}</div>
                  <span style={{
                    display: 'inline-block', marginTop: 4, fontSize: '0.75rem', fontWeight: 700,
                    padding: '1px 8px', borderRadius: 20,
                    background: cert.estado === 'activo' ? '#d4f5e2' : '#fde8e8',
                    color: cert.estado === 'activo' ? '#155724' : '#721c24',
                  }}>
                    {cert.estado.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detalle */}
        <div style={card}>
          {!selected ? (
            <div style={{ color: colors.textLight, textAlign: 'center', padding: '3rem 0' }}>
              Busca un certificado para ver su detalle
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <h2 style={{ color: colors.dark, fontWeight: 700, fontSize: '1.1rem', margin: 0 }}>Detalle del Certificado</h2>
                <span style={{
                  fontSize: '0.8rem', fontWeight: 700, padding: '3px 12px', borderRadius: 20,
                  background: selected.estado === 'activo' ? '#d4f5e2' : '#fde8e8',
                  color: selected.estado === 'activo' ? '#155724' : '#721c24',
                }}>
                  {selected.estado.toUpperCase()}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.5rem', marginBottom: '1.5rem' }}>
                {[
                  ['Titular', selected.nombre],
                  ['CURP', selected.curp],
                  ['Curso', selected.curso],
                  ['Calificación', selected.calificacion],
                  ['No. Certificado', selected.no_certificado],
                  ['Folio', selected.folio_verificacion],
                  ['Fecha de emisión', selected.fecha_emision],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: colors.textLight, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontWeight: 600, color: colors.text }}>{value}</div>
                  </div>
                ))}
              </div>

              {selected.estado === 'activo' && (
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    style={btn.secondary}
                    onClick={() => window.open(api.getCertificatePdfUrl(selected.id), '_blank')}
                  >
                    Ver PDF
                  </button>
                  <button style={btn.danger} onClick={() => setShowModal(true)}>
                    Revocar certificado
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal de revocación */}
      {showModal && selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ ...card, maxWidth: 460, width: '90%' }}>
            <h2 style={{ color: '#dc3545', fontWeight: 800, marginTop: 0 }}>Revocar certificado</h2>
            <p style={{ color: colors.textLight, fontSize: '0.9rem', marginBottom: '1rem' }}>
              Esta acción no se puede deshacer. El certificado quedará inválido para verificación pública.
            </p>
            <div style={{ background: colors.light, borderRadius: 10, padding: '1rem', marginBottom: '1.25rem', fontSize: '0.95rem' }}>
              <div><strong>Titular:</strong> {selected.nombre}</div>
              <div><strong>No. Certificado:</strong> {selected.no_certificado}</div>
              <div><strong>Folio:</strong> {selected.folio_verificacion}</div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button style={btn.secondary} onClick={() => setShowModal(false)} disabled={loading}>Cancelar</button>
              <button style={btn.danger} onClick={handleRevoke} disabled={loading}>
                {loading ? 'Revocando...' : 'Confirmar revocación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
