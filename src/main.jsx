import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import './index.css'
import App from './App.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegistroPage from './pages/RegistroPage.jsx'
import BienvenidaPage from './pages/BienvenidaPage.jsx'
import { auth, db } from './firebase.js'

function DocenteOSRouter() {
  const [authUser,       setAuthUser]       = useState(undefined)
  const [perfilCompleto, setPerfilCompleto] = useState(undefined)

  useEffect(() => {
    if (!auth) {
      setAuthUser(null)
      setPerfilCompleto(false)
      return
    }

    return onAuthStateChanged(auth, async (user) => {
      setAuthUser(user)

      if (!user) {
        setPerfilCompleto(false)
        return
      }

      if (!db) {
        // Sin Firestore configurado, saltar directamente al dashboard
        setPerfilCompleto(true)
        return
      }

      try {
        const snap = await getDoc(doc(db, 'usuarios', user.uid))
        setPerfilCompleto(snap.data()?.perfilInstitucionalCompleto === true)
      } catch {
        setPerfilCompleto(false)
      }
    })
  }, [])

  const cargando = authUser === undefined || (authUser !== null && perfilCompleto === undefined)
  if (cargando) return <PantallaCarga />

  const destino = !authUser ? '/login' : perfilCompleto ? '/dashboard' : '/bienvenida'

  return (
    <Routes>
      <Route
        path="/login"
        element={authUser ? <Navigate to={destino} replace /> : <LoginPage />}
      />
      <Route
        path="/registro"
        element={authUser ? <Navigate to={destino} replace /> : <RegistroPage />}
      />
      <Route
        path="/bienvenida"
        element={
          !authUser        ? <Navigate to="/login"     replace /> :
          perfilCompleto   ? <Navigate to="/dashboard" replace /> :
          <BienvenidaPage onPerfilGuardado={() => setPerfilCompleto(true)} />
        }
      />
      <Route
        path="/dashboard/*"
        element={
          !authUser      ? <Navigate to="/login"      replace /> :
          !perfilCompleto ? <Navigate to="/bienvenida" replace /> :
          <App />
        }
      />
      <Route
        path="*"
        element={<Navigate to={destino} replace />}
      />
    </Routes>
  )
}

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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <DocenteOSRouter />
    </BrowserRouter>
  </StrictMode>,
)
