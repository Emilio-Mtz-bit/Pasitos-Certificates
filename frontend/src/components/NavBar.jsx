import { NavLink } from 'react-router-dom'
import { colors, font } from '../styles'

export default function NavBar() {
  return (
    <nav style={{
      background: colors.primary,
      padding: '0 2rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      height: 64,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    }}>
      <div style={{ marginRight: '1.5rem' }}>
        <span style={{ color: colors.white, fontWeight: 800, fontSize: '1.5rem', fontFamily: font, letterSpacing: '-0.5px' }}>
          Pasitos
        </span>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginLeft: 6, fontWeight: 600 }}>
          DEMO
        </span>
      </div>

      {[
        { to: '/instructor', label: 'Instructor' },
        { to: '/admin', label: 'Admin' },
        { to: '/public', label: 'Verificación Pública' },
      ].map(({ to, label }) => (
        <NavLink key={to} to={to} style={({ isActive }) => ({
          color: isActive ? colors.white : 'rgba(255,255,255,0.72)',
          textDecoration: 'none',
          fontWeight: isActive ? 700 : 500,
          fontFamily: font,
          fontSize: '0.95rem',
          padding: '0.4rem 1rem',
          borderRadius: 8,
          background: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
          transition: 'all 0.15s',
        })}>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
