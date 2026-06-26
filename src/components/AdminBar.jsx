import { useAdmin } from '../context/AdminContext.jsx'

export default function AdminBar({ onIrAdmin }) {
  const { esAdmin } = useAdmin()
  if (!esAdmin) return null

  return (
    <div className="adminbar">
      <div className="adminbar-left">
        <button className="adminbar-brand" onClick={() => onIrAdmin && onIrAdmin()}>
          ⚙ DocenteOS ADMIN
        </button>
        <span className="adminbar-sep">|</span>
        <button className="adminbar-link" onClick={() => onIrAdmin && onIrAdmin('home')}>Dashboard</button>
        <button className="adminbar-link" onClick={() => onIrAdmin && onIrAdmin('usuarios')}>Usuarios</button>
        <button className="adminbar-link" onClick={() => onIrAdmin && onIrAdmin('centros')}>Centros</button>
        <button className="adminbar-link" onClick={() => onIrAdmin && onIrAdmin('curriculo')}>Currículo</button>
        <button className="adminbar-link" onClick={() => onIrAdmin && onIrAdmin('prompts')}>Prompts IA</button>
        <button className="adminbar-link" onClick={() => onIrAdmin && onIrAdmin('firebase')}>Firebase</button>
        <button className="adminbar-link" onClick={() => onIrAdmin && onIrAdmin('configuracion')}>Config</button>
        <button className="adminbar-link" onClick={() => onIrAdmin && onIrAdmin('auditoria')}>Auditoría</button>
      </div>
      <div className="adminbar-right">
        <span className="adminbar-badge">ADMIN</span>
      </div>
    </div>
  )
}
