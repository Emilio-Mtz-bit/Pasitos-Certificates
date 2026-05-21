export const colors = {
  primary: '#9B27AF',
  dark: '#7B2D8B',
  light: '#F3E8FA',
  lightMid: '#E8D0F5',
  white: '#FFFFFF',
  text: '#1a1a1a',
  textLight: '#666666',
  successBg: '#d4f5e2',
  successBorder: '#28a745',
  successText: '#155724',
  errorBg: '#fde8e8',
  errorBorder: '#dc3545',
  errorText: '#721c24',
  border: '#e0c8f0',
  gray: '#f8f4fb',
}

export const font = "'Nunito', sans-serif"

export const card = {
  background: colors.white,
  border: `1px solid ${colors.border}`,
  borderRadius: 16,
  padding: '1.5rem',
  boxShadow: '0 2px 8px rgba(155, 39, 175, 0.08)',
}

export const input = {
  width: '100%',
  padding: '0.6rem 1rem',
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  fontSize: '1rem',
  fontFamily: font,
  outline: 'none',
  boxSizing: 'border-box',
}

export const btn = {
  primary: {
    background: colors.primary,
    color: colors.white,
    border: 'none',
    borderRadius: 8,
    padding: '0.65rem 1.4rem',
    fontSize: '1rem',
    fontFamily: font,
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondary: {
    background: 'transparent',
    color: colors.primary,
    border: `2px solid ${colors.primary}`,
    borderRadius: 8,
    padding: '0.6rem 1.4rem',
    fontSize: '1rem',
    fontFamily: font,
    fontWeight: 700,
    cursor: 'pointer',
  },
  danger: {
    background: '#dc3545',
    color: colors.white,
    border: 'none',
    borderRadius: 8,
    padding: '0.65rem 1.4rem',
    fontSize: '1rem',
    fontFamily: font,
    fontWeight: 700,
    cursor: 'pointer',
  },
}
