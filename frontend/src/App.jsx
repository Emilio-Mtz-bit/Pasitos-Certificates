import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { font } from './styles'
import NavBar from './components/NavBar'
import Instructor from './pages/Instructor'
import Admin from './pages/Admin'
import PublicVerify from './pages/PublicVerify'

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ fontFamily: font, minHeight: '100vh', background: '#faf7fc' }}>
        <NavBar />
        <Routes>
          <Route path="/" element={<Navigate to="/instructor" replace />} />
          <Route path="/instructor" element={<Instructor />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/public" element={<PublicVerify />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
