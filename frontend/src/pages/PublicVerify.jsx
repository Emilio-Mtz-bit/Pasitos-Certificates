import { useState } from 'react'
import * as api from '../api'
import { colors, font, card, input, btn } from '../styles'

const MENSAJES = {
  certificado_no_encontrado: 'No encontramos ningún certificado con ese folio.',
  certificado_revocado: 'Este certificado ha sido revocado por Pasitos Education & Health A.C.',
  hash_no_coincide: 'Los datos de este certificado han sido alterados. No es válido.',
  firma_invalida: 'La firma digital de este certificado no es válida.',
  nombre_no_coincide: 'El nombre ingresado no coincide con el titular del certificado.',
}

export default function PublicVerify() {
  const [folio, setFolio] = useState('')
  const [nombre, setNombre] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleVerify() {
    if (!folio.trim() || !nombre.trim()) { setError('Ingresa el folio y el nombre completo del titular'); return }
    setLoading(true); setError(''); setResult(null)
    try {
      const data = await api.verifyCertificate(folio.trim(), nombre.trim())
      setResult(data)
    } catch (e) {
      setError(e.message || 'Error al conectar con el servidor. ¿Está corriendo el backend?')
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
        <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: colors.textLight, display: 'block', marginBottom: 8 }}>
              Folio de verificación
            </label>
            <input
              style={input}
              placeholder="Ej. VER-0001"
              value={folio}
              onChange={e => setFolio(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: colors.textLight, display: 'block', marginBottom: 8 }}>
              Nombre completo del titular
            </label>
            <input
              style={input}
              placeholder="Ej. Santiago Reza Mendoza"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
            />
          </div>
        </div>
        <button style={{ ...btn.primary, width: '100%' }} onClick={handleVerify} disabled={loading}>
          {loading ? '...' : 'Verificar'}
        </button>
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
            <button style={{ ...btn.secondary, marginTop: '1rem' }} onClick={() => { setResult(null); setFolio(''); setNombre('') }}>
              Intentar con otro folio
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
