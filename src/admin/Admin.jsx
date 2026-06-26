import AdminGuard from './AdminGuard.jsx'
import AdminLayout from './AdminLayout.jsx'
import { AdminProvider } from '../context/AdminContext.jsx'

export default function Admin({ paginaInicial }) {
  return (
    <AdminProvider>
      <AdminGuard>
        <AdminLayout paginaInicial={paginaInicial} />
      </AdminGuard>
    </AdminProvider>
  )
}
