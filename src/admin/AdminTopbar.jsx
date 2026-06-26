import { useAdmin } from '../context/AdminContext.jsx'

const TITULOS = {
  home:           'Resumen General',
  usuarios:       'Gestión de Usuarios',
  centros:        'Centros Educativos',
  curriculo:      'Currículo MINERD',
  prompts:        'Banco de Prompts IA',
  'historial-ia': 'Historial de IA',
  auditoria:      'Auditoría del Sistema',
  seguridad:      'Seguridad',
  configuracion:  'Configuración Global',
  firebase:       'Firebase & Base de Datos',
}

export default function AdminTopbar({ pagina, onVolverApp }) {
  const { user } = useAdmin()

  return (
    <header className="admin-topbar">
      <div className="admin-topbar-left">
        <h1 className="admin-topbar-title">{TITULOS[pagina] || 'Admin'}</h1>
      </div>
      <div className="admin-topbar-right">
        <span className="admin-topbar-email">{user?.email}</span>
        <button className="admin-topbar-back" onClick={onVolverApp}>
          ← Volver a DocenteOS
        </button>
      </div>
    </header>
  )
}
