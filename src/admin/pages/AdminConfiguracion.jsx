import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase.js'

const DEFAULTS = {
  anioEscolar:       '',
  estadoSistema:     'activo',
  mensajeGlobal:     '',
  modoMantenimiento: false,
  regionales:        '',
  distritos:         '',
  niveles:           'Inicial, Primario, Secundario',
  modalidades:       'Regular, Adultos, Especial, Técnico Vocacional',
  dominioAdmin:      '@docenteos.com',
  nombrePlataforma:  'DocenteOS',
}

export default function AdminConfiguracion() {
  const [config,    setConfig]    = useState(DEFAULTS)
  const [cargando,  setCargando]  = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [guardado,  setGuardado]  = useState(false)
  const [error,     setError]     = useState('')

  useEffect(() => {
    const cargar = async () => {
      try {
        const snap = await getDoc(doc(db, 'configuracionGlobal', 'principal'))
        if (snap.exists()) {
          setConfig({ ...DEFAULTS, ...snap.data() })
        }
      } catch (err) {
        console.error('[AdminConfiguracion] cargar:', err)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [])

  const setField = (k, v) => setConfig((c) => ({ ...c, [k]: v }))

  const guardar = async () => {
    setGuardando(true)
    setError('')
    setGuardado(false)
    try {
      await setDoc(doc(db, 'configuracionGlobal', 'principal'), {
        ...config,
        fechaActualizacion: serverTimestamp(),
      }, { merge: true })
      setGuardado(true)
      setTimeout(() => setGuardado(false), 3000)
    } catch (err) {
      setError('Error al guardar: ' + err.message)
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) {
    return <div className="admin-loading"><div className="admin-spinner" />Cargando configuración…</div>
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-header-text">
          <h2>Configuración Global</h2>
          <p>Parámetros globales de la plataforma DocenteOS.</p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>

      {guardado && <div className="admin-alert success">✓ Configuración guardada correctamente.</div>}
      {error    && <div className="admin-alert error">{error}</div>}

      {/* Sección: General */}
      <div className="admin-info-panel">
        <h3>General</h3>
        <div className="admin-form-grid" style={{ marginTop: 12 }}>
          <div className="admin-form-group">
            <label className="admin-form-label">Nombre de la plataforma</label>
            <input className="admin-form-input" value={config.nombrePlataforma} onChange={(e) => setField('nombrePlataforma', e.target.value)} />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Año escolar activo</label>
            <input className="admin-form-input" value={config.anioEscolar} onChange={(e) => setField('anioEscolar', e.target.value)} placeholder="Ej: 2024-2025" />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Estado del sistema</label>
            <select className="admin-form-select" value={config.estadoSistema} onChange={(e) => setField('estadoSistema', e.target.value)}>
              <option value="activo">Activo</option>
              <option value="mantenimiento">En mantenimiento</option>
              <option value="cerrado">Cerrado</option>
            </select>
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Dominio de administradores</label>
            <input className="admin-form-input" value={config.dominioAdmin} onChange={(e) => setField('dominioAdmin', e.target.value)} placeholder="@docenteos.com" />
            <span className="admin-form-hint">Correos con este dominio tendrán acceso al panel admin.</span>
          </div>
        </div>
      </div>

      {/* Sección: Mensajes */}
      <div className="admin-info-panel" style={{ marginTop: 14 }}>
        <h3>Mensajes del sistema</h3>
        <div className="admin-form-grid cols-1" style={{ marginTop: 12 }}>
          <div className="admin-form-group">
            <label className="admin-form-label">Mensaje global (mostrado a todos los usuarios)</label>
            <textarea className="admin-form-textarea" rows={3} value={config.mensajeGlobal} onChange={(e) => setField('mensajeGlobal', e.target.value)} placeholder="Dejar vacío para no mostrar ningún mensaje." />
          </div>
        </div>

        <div className="admin-form-group" style={{ marginTop: 12 }}>
          <div className="admin-toggle">
            <label className="admin-toggle-switch">
              <input type="checkbox" checked={!!config.modoMantenimiento} onChange={(e) => setField('modoMantenimiento', e.target.checked)} />
              <span className="admin-toggle-slider" />
            </label>
            <span className="admin-form-label" style={{ textTransform: 'none', fontSize: 13, color: 'var(--adm-muted)' }}>
              Modo mantenimiento (los usuarios no pueden iniciar sesión)
            </span>
          </div>
        </div>
      </div>

      {/* Sección: Estructura MINERD */}
      <div className="admin-info-panel" style={{ marginTop: 14 }}>
        <h3>Estructura educativa MINERD</h3>
        <div className="admin-form-grid" style={{ marginTop: 12 }}>
          <div className="admin-form-group full">
            <label className="admin-form-label">Niveles disponibles (separados por coma)</label>
            <input className="admin-form-input" value={config.niveles} onChange={(e) => setField('niveles', e.target.value)} placeholder="Inicial, Primario, Secundario…" />
          </div>
          <div className="admin-form-group full">
            <label className="admin-form-label">Modalidades disponibles (separadas por coma)</label>
            <input className="admin-form-input" value={config.modalidades} onChange={(e) => setField('modalidades', e.target.value)} placeholder="Regular, Adultos, Especial…" />
          </div>
          <div className="admin-form-group full">
            <label className="admin-form-label">Regionales (una por línea o separadas por coma)</label>
            <textarea className="admin-form-textarea" rows={4} value={config.regionales} onChange={(e) => setField('regionales', e.target.value)} placeholder="01-Santo Domingo, 02-Santiago, 03-San Pedro de Macorís…" />
          </div>
          <div className="admin-form-group full">
            <label className="admin-form-label">Distritos educativos</label>
            <textarea className="admin-form-textarea" rows={4} value={config.distritos} onChange={(e) => setField('distritos', e.target.value)} placeholder="01-01 Santo Domingo Norte, 01-02 Santo Domingo Sur…" />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
        <button className="admin-btn admin-btn-primary" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  )
}
