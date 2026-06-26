import './admin.css'

const MENU = [
  {
    grupo: 'General',
    items: [
      { id: 'home',         icon: '⊞',  label: 'Resumen' },
    ]
  },
  {
    grupo: 'Usuarios & Centros',
    items: [
      { id: 'usuarios',    icon: '👥', label: 'Usuarios' },
      { id: 'centros',     icon: '🏫', label: 'Centros Educativos' },
      { id: 'seguridad',   icon: '🔒', label: 'Seguridad' },
    ]
  },
  {
    grupo: 'Contenido',
    items: [
      { id: 'curriculo',   icon: '📚', label: 'Currículo' },
    ]
  },
  {
    grupo: 'Inteligencia Artificial',
    items: [
      { id: 'prompts',      icon: '✨', label: 'Banco de Prompts' },
      { id: 'historial-ia', icon: '🕒', label: 'Historial IA' },
    ]
  },
  {
    grupo: 'Sistema',
    items: [
      { id: 'auditoria',     icon: '📋', label: 'Auditoría' },
      { id: 'configuracion', icon: '⚙️', label: 'Configuración' },
      { id: 'firebase',      icon: '🔥', label: 'Firebase' },
    ]
  },
]

export default function AdminSidebar({ pagina, setPagina }) {
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <span className="admin-sidebar-icon">⚙</span>
        <div>
          <strong>DocenteOS</strong>
          <small>Panel Administrativo</small>
        </div>
      </div>

      <nav className="admin-sidebar-nav">
        {MENU.map(({ grupo, items }) => (
          <div key={grupo} className="admin-nav-group">
            <div className="admin-nav-group-label">{grupo}</div>
            {items.map(({ id, icon, label }) => (
              <button
                key={id}
                className={`admin-nav-btn${pagina === id ? ' active' : ''}`}
                onClick={() => setPagina(id)}
              >
                <span className="admin-nav-icon">{icon}</span>
                {label}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="admin-sidebar-footer">
        v1.0 · DocenteOS MINERD
      </div>
    </aside>
  )
}
