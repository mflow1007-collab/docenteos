import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

// ─── Tips por sección ─────────────────────────────────────────────────────────
const TIPS = {
  inicio: [
    { color: '#ef4444', tag: 'Alerta',         msg: 'Revisa los estudiantes en riesgo antes de iniciar la clase.' },
    { color: '#7c3aed', tag: 'Sugerencia',      msg: 'Accede a "Planificación" para preparar tu próxima sesión con ayuda de la IA.' },
    { color: '#2563eb', tag: 'Recuerda',        msg: 'El historial de planificaciones está en la parte inferior del dashboard.' },
  ],
  planificacion: [
    { color: '#7c3aed', tag: 'Tip IA',          msg: 'Selecciona el indicador de logro específico antes de generar — mejora la calidad del plan.' },
    { color: '#16a34a', tag: 'Buena práctica',  msg: 'Guarda el plan generado para que aparezca en el historial del dashboard.' },
    { color: '#2563eb', tag: 'MINERD',          msg: 'Los planes generados siguen la estructura oficial del Diseño Curricular dominicano.' },
  ],
  'mi-registro': [
    { color: '#2563eb', tag: 'Evaluación',      msg: 'Registra el nivel de logro por indicador, no solo la nota numérica.' },
    { color: '#f59e0b', tag: 'Recuerda',        msg: 'El sistema calcula el promedio automáticamente al guardar el registro.' },
    { color: '#16a34a', tag: 'Tip',             msg: 'Puedes agregar evidencias fotográficas directamente desde el registro.' },
  ],
  registro: [
    { color: '#2563eb', tag: 'Evaluación',      msg: 'Registra el nivel de logro por indicador, no solo la nota numérica.' },
    { color: '#f59e0b', tag: 'Recuerda',        msg: 'El sistema calcula el promedio automáticamente al guardar el registro.' },
    { color: '#16a34a', tag: 'Tip',             msg: 'Puedes agregar evidencias fotográficas directamente desde el registro.' },
  ],
  instrumentos: [
    { color: '#7c3aed', tag: 'Tip',             msg: 'Genera un instrumento específico para cada actividad de evaluación.' },
    { color: '#16a34a', tag: 'MINERD',          msg: 'Los instrumentos están alineados al currículo oficial dominicano.' },
    { color: '#2563eb', tag: 'Recuerda',        msg: 'Las rúbricas pueden guardarse y reutilizarse en otros cursos.' },
  ],
  estudiantes: [
    { color: '#ef4444', tag: 'Atención',        msg: 'Filtra por "En riesgo" para identificar estudiantes que necesitan intervención.' },
    { color: '#2563eb', tag: 'Tip',             msg: 'El perfil de cada estudiante muestra su historial completo de evaluaciones.' },
    { color: '#16a34a', tag: 'Buena práctica',  msg: 'Registra intervenciones desde el perfil del estudiante para dar seguimiento.' },
  ],
  'detalle-estudiante': [
    { color: '#7c3aed', tag: 'Perfil',          msg: 'Usa la pestaña "Informe IA" para obtener un análisis pedagógico del estudiante.' },
    { color: '#2563eb', tag: 'Tip',             msg: 'Las intervenciones registradas aquí son visibles para coordinación.' },
  ],
  ia: [
    { color: '#7c3aed', tag: 'Centro IA',       msg: 'Usa "Entrenar mi IA" para personalizar las respuestas según tu estilo pedagógico.' },
    { color: '#16a34a', tag: 'Tip',             msg: 'El asistente tiene contexto de tu grado, área y currículo MINERD.' },
    { color: '#2563eb', tag: 'Recuerda',        msg: 'Los prompts guardados en la Biblioteca Inteligente aceleran tu trabajo.' },
  ],
  reportes: [
    { color: '#f59e0b', tag: 'Reportes',        msg: 'Exporta los reportes en PDF para compartir con coordinación o padres.' },
    { color: '#7c3aed', tag: 'Tip',             msg: 'Filtra por grado o asignatura para comparar el desempeño entre grupos.' },
  ],
  cursos: [
    { color: '#2563eb', tag: 'Cursos',          msg: 'Configura el horario de cada curso para habilitar recordatorios de clase.' },
    { color: '#7c3aed', tag: 'Tip',             msg: 'Desde el detalle del curso puedes ver asistencia, evaluaciones y evidencias.' },
  ],
  curricular: [
    { color: '#16a34a', tag: 'Currículo',       msg: 'Aquí están las competencias y estándares oficiales del MINERD.' },
    { color: '#2563eb', tag: 'Tip',             msg: 'Consulta los indicadores de logro antes de planificar para mayor precisión.' },
  ],
  'asistente-personal': [
    { color: '#7c3aed', tag: 'Asistente',       msg: 'Tu asistente personal recuerda el contexto de conversaciones anteriores.' },
    { color: '#2563eb', tag: 'Tip',             msg: 'Puedes preguntarle sobre el currículo, estrategias, estudiantes difíciles y más.' },
  ],
}

const TIPS_DEFAULT = [
  { color: '#7c3aed', tag: 'DocenteOS',         msg: 'Estoy aquí para orientarte en tu trabajo pedagógico diario.' },
  { color: '#2563eb', tag: 'Tip',               msg: 'Usa la Planificación IA para generar planes alineados al currículo MINERD.' },
]

// ─── Estilos inline compartidos ───────────────────────────────────────────────
const S = {
  fab: {
    position: 'fixed', right: 24, bottom: 24, zIndex: 40,
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'linear-gradient(135deg,#7c3aed,#6d28d9)',
    color: '#fff', border: 0, fontSize: 13.5, fontWeight: 700,
    padding: '11px 18px', borderRadius: 30, cursor: 'pointer',
    boxShadow: '0 12px 28px rgba(124,58,237,.45)',
    fontFamily: 'inherit', transition: 'transform .12s, box-shadow .12s',
    userSelect: 'none',
  },
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(8,14,33,.4)', zIndex: 49,
  },
  panel: (abierto) => ({
    position: 'fixed', right: 0, top: 0, height: '100vh',
    width: 340, background: '#fff',
    boxShadow: '-12px 0 40px rgba(0,0,0,.18)',
    zIndex: 50, display: 'flex', flexDirection: 'column',
    transform: abierto ? 'translateX(0)' : 'translateX(100%)',
    transition: 'transform .28s ease',
  }),
  panelHead: {
    background: 'linear-gradient(135deg,#0e1a3a,#1b2c5c)',
    color: '#fff', padding: '17px 18px',
    display: 'flex', alignItems: 'center', gap: 11, flexShrink: 0,
  },
  tipCard: (color) => ({
    borderLeft: `3px solid ${color}`,
    border: `1px solid #e9edf5`,
    borderLeftColor: color,
    borderRadius: 11, padding: '12px 14px', marginBottom: 10,
    background: '#faf9ff',
  }),
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CoachIA({ pagina = 'inicio', formulario = {} }) {
  const [abierto, setAbierto] = useState(false)
  const navigate = useNavigate()

  const primerNombre = (formulario.nombreDocente || 'Docente').split(' ')[0]
  const tips = TIPS[pagina] || TIPS_DEFAULT

  const irAAsistente = () => {
    setAbierto(false)
    navigate('/asistente-personal')
  }

  return (
    <>
      {/* ── FAB ─────────────────────────────────────────────────────────── */}
      <button
        style={S.fab}
        onClick={() => setAbierto(v => !v)}
        aria-label="Abrir Coach IA"
        title="Coach IA"
      >
        ✦ Coach
      </button>

      {/* ── Overlay (click fuera cierra) ─────────────────────────────────── */}
      {abierto && (
        <div style={S.overlay} onClick={() => setAbierto(false)} />
      )}

      {/* ── Panel lateral ────────────────────────────────────────────────── */}
      <aside style={S.panel(abierto)} aria-label="Coach IA">

        {/* Cabecera */}
        <div style={S.panelHead}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'rgba(255,255,255,.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17,
          }}>✦</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>DocenteOS Coach</div>
            <div style={{ fontSize: 11.5, color: '#9db0e0', marginTop: 1 }}>
              Hola, {primerNombre}
            </div>
          </div>
          <button
            onClick={() => setAbierto(false)}
            style={{
              background: 'none', border: 0, color: '#9db0e0',
              fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 4,
            }}
            aria-label="Cerrar Coach"
          >×</button>
        </div>

        {/* Cuerpo */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

          {/* Etiqueta de sección */}
          <div style={{
            fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '.5px', color: '#8a96ab', marginBottom: 12,
          }}>
            Sugerencias · {pagina.replace(/-/g, ' ')}
          </div>

          {/* Tarjetas de tips */}
          {tips.map((tip, i) => (
            <div key={i} style={S.tipCard(tip.color)}>
              <div style={{
                fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: '.3px', color: tip.color, marginBottom: 5,
              }}>{tip.tag}</div>
              <div style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.55 }}>
                {tip.msg}
              </div>
            </div>
          ))}

          {/* CTA: Asistente personal */}
          <div style={{
            marginTop: 8, padding: '14px 15px',
            background: '#f1ebfe', borderRadius: 11,
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: '#6d28d9', marginBottom: 5,
            }}>¿Tienes una pregunta pedagógica?</div>
            <div style={{
              fontSize: 12.5, color: '#5b21b6', lineHeight: 1.5, marginBottom: 11,
            }}>
              Tu asistente personal IA puede ayudarte con estrategias, el currículo MINERD, estudiantes difíciles y más.
            </div>
            <button
              onClick={irAAsistente}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                background: '#7c3aed', color: '#fff', border: 0,
                borderRadius: 9, padding: '8px 14px',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              🤖 Asistente Personal
            </button>
          </div>

          {/* Footer */}
          <div style={{
            marginTop: 14, fontSize: 11, color: '#94a3b8',
            textAlign: 'center', lineHeight: 1.6,
          }}>
            DocenteOS · Plataforma pedagógica MINERD
          </div>
        </div>
      </aside>
    </>
  )
}
