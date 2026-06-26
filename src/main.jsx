import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'

const App = lazy(() => import('./App.jsx'))
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'))
const RegistroPage = lazy(() => import('./pages/RegistroPage.jsx'))
const BienvenidaPage = lazy(() => import('./pages/BienvenidaPage.jsx'))
const Admin = lazy(() => import('./admin/Admin.jsx'))

// ── Router ────────────────────────────────────────────────────────────────────
function DocenteOSRouter() {
  const { user, perfilCompleto, cargando } = useAuth()

  if (cargando) return <PantallaCarga />

  const destino = !user ? '/login' : perfilCompleto ? '/dashboard' : '/bienvenida'

  return (
    <Suspense fallback={<PantallaCarga />}>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to={destino} replace /> : <LoginPage />}
        />
        <Route
          path="/registro"
          element={user ? <Navigate to={destino} replace /> : <RegistroPage />}
        />
        <Route
          path="/bienvenida"
          element={
            !user          ? <Navigate to="/login"     replace /> :
            perfilCompleto ? <Navigate to="/dashboard" replace /> :
            // onPerfilGuardado es no-op: AuthContext detecta el cambio vía onSnapshot
            <BienvenidaPage onPerfilGuardado={() => {}} />
          }
        />
        <Route
          path="/dashboard/*"
          element={
            !user          ? <Navigate to="/login"      replace /> :
            !perfilCompleto ? <Navigate to="/bienvenida" replace /> :
            <App />
          }
        />
        <Route
          path="/admin/*"
          element={
            !user          ? <Navigate to="/login"     replace /> :
            !perfilCompleto ? <Navigate to="/bienvenida" replace /> :
            <Admin />
          }
        />
        <Route path="*" element={<Navigate to={destino} replace />} />
      </Routes>
    </Suspense>
  )
}

// ── Loading screen ────────────────────────────────────────────────────────────
function PantallaCarga() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1E40AF 0%, #2563EB 100%)',
    }}>
      <div style={{ textAlign: 'center', color: '#fff' }}>
        <div style={{
          width: 48, height: 48,
          border: '3px solid rgba(255,255,255,0.25)',
          borderTopColor: '#fff',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 16px',
        }} />
        <p style={{ fontSize: 14, opacity: 0.8, margin: 0 }}>Cargando DocenteOS…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}

// ── Entry point ───────────────────────────────────────────────────────────────
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <DocenteOSRouter />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
