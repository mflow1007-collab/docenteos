import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'


const SECCIONES_VALIDAS = ['home','usuarios','centros','curriculo','monitor-fuentes','banco-pedagogico','gateway-ia','prompts','historial-ia','auditoria','seguridad','firebase','configuracion','suscripciones','entrenamiento-ia','estadisticas','banco-aprendizaje','banco-docente','asistente-personal','uso-ia','costos-ia','agentes','topics','insights']
import AdminSidebar from './AdminSidebar.jsx'
import AdminTopbar from './AdminTopbar.jsx'
import AdminHome from './pages/AdminHome.jsx'
import AdminUsuarios from './pages/AdminUsuarios.jsx'
import AdminCentros from './pages/AdminCentros.jsx'
import AdminCurriculo from './pages/AdminCurriculo.jsx'
import AdminMonitorFuentes from './pages/AdminMonitorFuentes.jsx'
import AdminPrompts from './pages/AdminPrompts.jsx'
import AdminHistorialIA from './pages/AdminHistorialIA.jsx'
import AdminAuditoria from './pages/AdminAuditoria.jsx'
import AdminSeguridad from './pages/AdminSeguridad.jsx'
import AdminFirebase from './pages/AdminFirebase.jsx'
import AdminIA from './pages/AdminIA.jsx'
import AdminSubscriptions from './pages/AdminSubscriptions.jsx'
import AdminConfiguracion from './pages/AdminConfiguracion.jsx'
import AdminEntrenamientoIA from './pages/AdminEntrenamientoIA.jsx'
import AdminBancoPedagogico from './pages/AdminBancoPedagogico.jsx'
import AdminEstadisticas from './pages/AdminEstadisticas.jsx'
import AdminBancoAprendizaje from './pages/AdminBancoAprendizaje.jsx'
import AdminBancoDocente from './pages/AdminBancoDocente.jsx'
import AdminAsistentePersonal from './pages/AdminAsistentePersonal.jsx'
import AdminUsoIA from './pages/AdminUsoIA.jsx'
import AdminCostosIA from './pages/AdminCostosIA.jsx'
import AdminAgentes from './pages/AdminAgentes.jsx'
import AdminTopics from './pages/AdminTopics.jsx'
import AdminInsights from './pages/AdminInsights.jsx'
import './admin.css'

export default function AdminLayout({ paginaInicial = 'home' }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  // Lee la sección desde la URL: /admin/usuarios → 'usuarios'
  const seccionUrl = pathname.replace(/^\/admin\/?/, '').split('/')[0]
  const seccionInicial = SECCIONES_VALIDAS.includes(seccionUrl) ? seccionUrl : paginaInicial

  const [pagina, setPagina] = useState(seccionInicial)

  const volverApp = () => navigate('/', { replace: true })

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
          {pagina === 'monitor-fuentes' && <AdminMonitorFuentes />}
          {pagina === 'gateway-ia'    && <AdminIA            />}
          {pagina === 'prompts'       && <AdminPrompts       />}
          {pagina === 'historial-ia'  && <AdminHistorialIA   />}
          {pagina === 'auditoria'     && <AdminAuditoria     />}
          {pagina === 'seguridad'     && <AdminSeguridad     />}
          {pagina === 'firebase'      && <AdminFirebase      />}
          {pagina === 'suscripciones'  && <AdminSubscriptions />}
          {pagina === 'configuracion'   && <AdminConfiguracion  />}
          {pagina === 'entrenamiento-ia'  && <AdminEntrenamientoIA  />}
          {pagina === 'banco-pedagogico'  && <AdminBancoPedagogico  />}
          {pagina === 'estadisticas'     && <AdminEstadisticas     />}
          {pagina === 'banco-aprendizaje'  && <AdminBancoAprendizaje  />}
          {pagina === 'banco-docente'     && <AdminBancoDocente     />}
          {pagina === 'asistente-personal' && <AdminAsistentePersonal />}
          {pagina === 'uso-ia'            && <AdminUsoIA            />}
          {pagina === 'costos-ia'         && <AdminCostosIA         />}
          {pagina === 'agentes'           && <AdminAgentes  />}
          {pagina === 'topics'            && <AdminTopics   />}
          {pagina === 'insights'          && <AdminInsights />}
        </main>
      </div>
    </div>
  )
}
