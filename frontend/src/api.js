const BASE = 'http://localhost:8000'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options)
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || `Error ${res.status}`)
  return data
}

export const getCourses = () => request('/courses/')

export const searchParticipants = (q) =>
  request(`/participants/?q=${encodeURIComponent(q)}`)

export const createParticipant = (data) =>
  request('/participants/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

export const createEnrollment = (data) =>
  request('/enrollments/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

export const submitEnrollment = (id) =>
  request(`/enrollments/${id}/submit`, { method: 'PATCH' })

export const getPendingEnrollments = () =>
  request('/enrollments/?estado=pendiente')

export const rejectEnrollment = (id) =>
  request(`/enrollments/${id}/reject`, { method: 'PATCH' })

export const emitCertificate = (id) =>
  request(`/enrollments/${id}/emit`, { method: 'PATCH' })

export const verifyCertificate = (folio, nombre) =>
  request(`/verify/${encodeURIComponent(folio)}?nombre=${encodeURIComponent(nombre)}`)

export const searchCertificatesByCurp = (curp) =>
  request(`/certificates/?curp=${encodeURIComponent(curp)}`)

export const searchCertificateByFolio = (folio) =>
  request(`/certificates/?folio=${encodeURIComponent(folio)}`)

export const revokeCertificate = (id) =>
  request(`/certificates/${id}/revoke`, { method: 'PATCH' })
