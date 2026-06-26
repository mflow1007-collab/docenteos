import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const SECCIONES_VALIDAS = ['home','usuarios','centros','curriculo','gateway-ia','prompts','historial-ia','auditoria','seguridad','firebase','configuracion','suscripciones']
import AdminSidebar from './AdminSidebar.jsx'
import AdminTopbar from './AdminTopbar.jsx'
import AdminHome from './pages/AdminHome.jsx'
import AdminUsuarios from './pages/AdminUsuarios.jsx'
import AdminCentros from './pages/AdminCentros.jsx'
import AdminCurriculo from './pages/AdminCurriculo.jsx'
import AdminPrompts from './pages/AdminPrompts.jsx'
import AdminHistorialIA from './pages/AdminHistorialIA.jsx'
import AdminAuditoria from './pages/AdminAuditoria.jsx'
import AdminSeguridad from './pages/AdminSeguridad.jsx'
import AdminFirebase from './pages/AdminFirebase.jsx'
import AdminIA from './pages/AdminIA.jsx'
import AdminSubscriptions from './pages/AdminSubscriptions.jsx'
import AdminConfiguracion from './pages/AdminConfiguracion.jsx'
import './admin.css'

export default function AdminLayout({ paginaInicial = 'home' }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  // Lee la sección desde la URL: /admin/usuarios → 'usuarios'
  const seccionUrl = pathname.replace(/^\/admin\/?/, '').split('/')[0]
  const seccionInicial = SECCIONES_VALIDAS.includes(seccionUrl) ? seccionUrl : paginaInicial

  const [pagina, setPagina] = useState(seccionInicial)

  const volverApp = () => navigate('/dashboard', { replace: true })

  return (
    <div className="admin-shell">
      <AdminSidebar pagina={pagina} setPagina={setPagina} />
      <div className="admin-main">
        <AdminTopbar pagina={pagina} onVolverApp={volverApp} />
        <main className="admin-content">
          {pagina === 'home'          && <AdminHome          />}
          {pagina === 'usuarios'      && <AdminUsuarios      />}
          {pagina === 'centros'       && <AdminCentros       />}
          {pagina === 'curriculo'     && <AdminCurriculo     />}
          {pagina === 'gateway-ia'    && <AdminIA            />}
          {pagina === 'prompts'       && <AdminPrompts       />}
          {pagina === 'historial-ia'  && <AdminHistorialIA   />}
          {pagina === 'auditoria'     && <AdminAuditoria     />}
          {pagina === 'seguridad'     && <AdminSeguridad     />}
          {pagina === 'firebase'      && <AdminFirebase      />}
          {pagina === 'suscripciones'  && <AdminSubscriptions />}
          {pagina === 'configuracion' && <AdminConfiguracion />}
        </main>
      </div>
    </div>
  )
}
