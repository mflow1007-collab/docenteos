/**
 * CentroDecisionesKE — Panel de inteligencia del Knowledge Engine.
 *
 * Visualiza en tiempo real cómo DocenteOS tomará decisiones antes de generar
 * una planificación. Consulta el estado real de las colecciones KE sin
 * modificar ninguna lógica del motor.
 */

import { useEffect, useState } from 'react'
import { db } from '../firebase.js'
import { collection, getDocs, query, where, limit } from 'firebase/firestore'
import {
  COLLECTIONS, STATES, EXAMPLE_TYPES, AGENT_IDS,
} from '../services/ai/knowledge/KnowledgeTypes.js'
import './CentroDecisionesKE.css'

// ── Hook: consulta estado real del KE ─────────────────────────────────────────
function useKEStatus() {
  const [datos,    setDatos]    = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!db) { setCargando(false); return }
    let activo = true
    setCargando(true)

    ;(async () => {
      try {
        const [memoriaSnap, casosSnap, estilosSnap] = await Promise.all([
          getDocs(query(
            collection(db, COLLECTIONS.KE_AGENTES, AGENT_IDS.PLANIFICADOR, COLLECTIONS.KE_MEMORIA),
            where('estado', '==', STATES.ACTIVE),
            limit(100),
          )),
          getDocs(query(
            collection(db, COLLECTIONS.KE_EJEMPLOS),
            where('estado', '==', STATES.ACTIVE),
            where('tipo',   '==', EXAMPLE_TYPES.CASO_EXITO),
            limit(100),
          )),
          getDocs(query(
            collection(db, COLLECTIONS.KE_ESTILOS),
            where('estado', '==', STATES.ACTIVE),
            limit(50),
          )),
        ])
        if (activo) {
          setDatos({
            memoriasActivas: memoriaSnap.size,
            casosExito:      casosSnap.size,
            totalEstilos:    estilosSnap.size,
            tieneEstilo:     estilosSnap.size > 0,
          })
        }
      } catch {
        if (activo) {
          setDatos({ memoriasActivas: 0, casosExito: 0, totalEstilos: 0, tieneEstilo: false })
        }
      } finally {
        if (activo) setCargando(false)
      }
    })()

    return () => { activo = false }
  }, [])

  return { datos, cargando }
}

// ── Cálculo de confianza (0–100) ─────────────────────────────────────────────
function calcularConfianza({ memorias, casos, tieneEstilo, planSimilares, tieneCurriculo }) {
  const pBIC       = 8
  const pCurriculo = tieneCurriculo ? 12 : 0
  const pEstilo    = tieneEstilo    ? 15 : 0
  const pCasos     = Math.min(20, casos          * 5)
  const pPlanes    = Math.min(20, planSimilares  * 2)
  const pMemoria   = Math.min(25, memorias       * 4)
  const total      = pBIC + pCurriculo + pEstilo + pCasos + pPlanes + pMemoria

  let nivel, color
  if      (total >= 80) { nivel = 'Muy alto';         color = '#10B981' }
  else if (total >= 60) { nivel = 'Alto';              color = '#3B82F6' }
  else if (total >= 40) { nivel = 'Medio';             color = '#F59E0B' }
  else                  { nivel = 'En construcción';   color = '#94A3B8' }

  return { total, nivel, color, pBIC, pCurriculo, pEstilo, pCasos, pPlanes, pMemoria }
}

// ── Distribución de fuentes (transparencia) ───────────────────────────────────
function calcularTransparencia(conf) {
  const { pBIC, pCurriculo, pEstilo, pCasos, pPlanes, pMemoria, total } = conf
  const iaBase = Math.max(5, 100 - total)
  const factor = total > 0 ? (100 - iaBase) / total : 0

  const raw = [
    pCurriculo > 0 && { fuente: 'Currículo MINERD',       v: pCurriculo * factor, color: '#1E40AF' },
    pBIC > 0       && { fuente: 'Banco Institucional',      v: pBIC * factor,       color: '#2563EB' },
    pCasos > 0     && { fuente: 'Casos de éxito',          v: pCasos * factor,     color: '#0891B2' },
    pEstilo > 0    && { fuente: 'Estilo docente',           v: pEstilo * factor,    color: '#7C3AED' },
    pMemoria > 0   && { fuente: 'Memorias del agente',      v: pMemoria * factor,   color: '#4F46E5' },
    pPlanes > 0    && { fuente: 'Planificaciones previas',  v: pPlanes * factor,    color: '#0D9488' },
    { fuente: 'IA (organización)', v: iaBase, color: '#94A3B8' },
  ].filter(Boolean)

  const sum = raw.reduce((s, i) => s + i.v, 0)
  const items = raw.map(i => ({ ...i, pct: Math.round((i.v / sum) * 100) }))

  // Ajuste para que sumen exactamente 100
  const diff = 100 - items.reduce((s, i) => s + i.pct, 0)
  if (items.length > 0) items[0].pct += diff

  return items
}

// ── Subcomponente: fila de fuente ─────────────────────────────────────────────
function FuenteItem({ icono, label, valor, activo, esIA = false }) {
  return (
    <div className={`ke-cd-fuente${activo ? ' ke-cd-fuente-activo' : ''}${esIA ? ' ke-cd-fuente-ia' : ''}`}>
      <div className="ke-cd-fuente-icon">{icono}</div>
      <div className="ke-cd-fuente-body">
        <span className="ke-cd-fuente-label">{label}</span>
        <span className="ke-cd-fuente-valor">{valor}</span>
      </div>
      <div className="ke-cd-fuente-estado">
        {activo ? '✅' : esIA ? '🤖' : <span className="ke-cd-estado-vacio">○</span>}
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function CentroDecisionesKE({
  estadoTemas,
  historialPlanificaciones = [],
  tieneCurriculoOficial,
  area,
  asignatura,
  grado,
  nivel,
}) {
  const { datos, cargando } = useKEStatus()

  // Planificaciones similares al área/asignatura actual
  const planSimilares = historialPlanificaciones.filter(p => {
    const meta = p?.contenido?.metadatos || {}
    return (
      (area       && (meta.area       === area       || p.area       === area))       ||
      (asignatura && (meta.asignatura === asignatura || p.asignatura === asignatura))
    )
  }).length

  const memorias    = datos?.memoriasActivas ?? 0
  const casos       = datos?.casosExito      ?? 0
  const tieneEstilo = datos?.tieneEstilo     ?? false
  const totalPlanes = historialPlanificaciones.length

  const conf          = calcularConfianza({ memorias, casos, tieneEstilo, planSimilares, tieneCurriculo: !!tieneCurriculoOficial })
  const transparencia = calcularTransparencia(conf)

  const temaActivo     = estadoTemas?.temaActivo?.titulo    || ''
  const temaSecundario = estadoTemas?.temaSecundario?.titulo || ''

  // Explicación dinámica
  const tieneBaseSolida = planSimilares >= 3 || memorias >= 5 || casos >= 3
  const fuentesActivas = [
    tieneCurriculoOficial && '✔ Currículo MINERD',
    '✔ Banco Institucional (BIC)',
    casos > 0     && `✔ ${casos} casos de éxito relacionados`,
    memorias > 0  && `✔ ${memorias} memorias del agente`,
    tieneEstilo   && '✔ Estilo pedagógico personalizado',
  ].filter(Boolean)

  // Recomendaciones automáticas
  const recomendaciones = [
    casos === 0       && 'Guarda una planificación como caso de éxito.',
    !tieneEstilo      && 'Enseña tu estilo al sistema para mejorar la coherencia.',
    memorias < 3      && 'Aprueba las mejoras sugeridas por el Auditor.',
    'Continúa utilizando DocenteOS. Cada planificación mejora el aprendizaje.',
  ].filter(Boolean)

  // Nodos del árbol de decisión
  const nodos = [
    { id: 'ke',        label: 'Knowledge Engine',      valor: '',                                     raiz: true  },
    { id: 'memorias',  label: 'Memorias del agente',   valor: memorias > 0   ? `${memorias} activas`             : 'Sin datos',      activo: memorias > 0   },
    { id: 'casos',     label: 'Casos de éxito',        valor: casos > 0      ? `${casos} encontrados`            : 'Sin datos',      activo: casos > 0      },
    { id: 'estilo',    label: 'Estilo docente',         valor: tieneEstilo    ? 'Encontrado'                      : 'Sin registrar',  activo: tieneEstilo    },
    { id: 'planes',    label: 'Planificaciones',        valor: planSimilares  > 0 ? `${planSimilares} similares`  : 'Sin similares',  activo: planSimilares > 0 },
    { id: 'bic',       label: 'Banco Institucional',   valor: 'Consultado',                                                         activo: true           },
    { id: 'curriculo', label: 'Currículo MINERD',       valor: tieneCurriculoOficial ? 'Encontrado' : 'No disponible',               activo: !!tieneCurriculoOficial },
    { id: 'ia',        label: 'IA',                    valor: 'Motor de generación',                              esIA: true,        activo: false          },
  ]

  const hayContexto = !!(temaActivo || area || asignatura)

  return (
    <section className="ke-cd-card">
      <div className="ke-cd-header">
        <div className="ke-cd-header-icon">✦</div>
        <div>
          <h2 className="ke-cd-title">Centro de Decisiones</h2>
          <p className="ke-cd-subtitle">Cómo DocenteOS construirá tu planificación</p>
        </div>
      </div>

      {cargando ? (
        <div className="ke-cd-loading">
          <div className="ke-cd-loading-bar" />
          <p>Consultando Knowledge Engine...</p>
        </div>
      ) : (
        <div className="ke-cd-body">

          {/* 1 · Tema actual */}
          {hayContexto && (
            <div className="ke-cd-section">
              <div className="ke-cd-section-title">Tema actual</div>
              <div className="ke-cd-tema-grid">
                {temaActivo && (
                  <div className="ke-cd-tema-item ke-cd-tema-item-full">
                    <span className="ke-cd-tema-label">Tema activo</span>
                    <span className="ke-cd-tema-value ke-cd-tema-highlight">{temaActivo}</span>
                  </div>
                )}
                {temaSecundario && (
                  <div className="ke-cd-tema-item ke-cd-tema-item-full">
                    <span className="ke-cd-tema-label">Tema relacionado</span>
                    <span className="ke-cd-tema-value">{temaSecundario}</span>
                  </div>
                )}
                {area && (
                  <div className="ke-cd-tema-item">
                    <span className="ke-cd-tema-label">Área</span>
                    <span className="ke-cd-tema-value">{area}</span>
                  </div>
                )}
                {asignatura && asignatura !== area && (
                  <div className="ke-cd-tema-item">
                    <span className="ke-cd-tema-label">Asignatura</span>
                    <span className="ke-cd-tema-value">{asignatura}</span>
                  </div>
                )}
                {nivel && (
                  <div className="ke-cd-tema-item">
                    <span className="ke-cd-tema-label">Nivel</span>
                    <span className="ke-cd-tema-value">{nivel}</span>
                  </div>
                )}
                {grado && (
                  <div className="ke-cd-tema-item">
                    <span className="ke-cd-tema-label">Grado</span>
                    <span className="ke-cd-tema-value">{grado}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2 · Fuentes del KE */}
          <div className="ke-cd-section">
            <div className="ke-cd-section-title">Estado del Knowledge Engine</div>
            <div className="ke-cd-fuentes">
              <FuenteItem
                icono="🧠"
                label="Memorias del agente"
                valor={memorias > 0 ? `${memorias} memorias activas` : 'Sin memorias registradas'}
                activo={memorias > 0}
              />
              <FuenteItem
                icono="⭐"
                label="Casos de éxito"
                valor={casos > 0 ? `${casos} casos de éxito encontrados` : 'Sin casos de éxito'}
                activo={casos > 0}
              />
              <FuenteItem
                icono="🎨"
                label="Estilo del docente"
                valor={tieneEstilo ? 'Estilo personalizado encontrado' : 'Sin estilo registrado'}
                activo={tieneEstilo}
              />
              <FuenteItem
                icono="📋"
                label="Planificaciones propias"
                valor={
                  totalPlanes === 0
                    ? 'No existen planificaciones previas'
                    : planSimilares > 0
                      ? `${planSimilares} planificaciones similares`
                      : `${totalPlanes} planificaciones — sin similares al tema`
                }
                activo={planSimilares > 0}
              />
              <FuenteItem
                icono="🏫"
                label="Banco Institucional (BIC)"
                valor="Banco institucional consultado"
                activo={true}
              />
              <FuenteItem
                icono="📚"
                label="Currículo MINERD"
                valor={tieneCurriculoOficial ? 'Currículo oficial encontrado' : 'No disponible para este contexto'}
                activo={!!tieneCurriculoOficial}
              />
              <FuenteItem
                icono="🤖"
                label="Inteligencia Artificial"
                valor="Utilizada únicamente para organizar y completar la generación. Nunca como fuente principal."
                activo={false}
                esIA={true}
              />
            </div>
          </div>

          {/* 3 · Barra de confianza */}
          <div className="ke-cd-section">
            <div className="ke-cd-section-title">Nivel de confianza</div>
            <div className="ke-cd-confianza">
              <div className="ke-cd-confianza-bar-wrap">
                <div
                  className="ke-cd-confianza-bar"
                  style={{ width: `${conf.total}%`, background: conf.color }}
                />
              </div>
              <div className="ke-cd-confianza-info">
                <span className="ke-cd-confianza-pct" style={{ color: conf.color }}>
                  {conf.total}%
                </span>
                <span className="ke-cd-confianza-nivel">
                  Nivel de confianza: <strong>{conf.nivel}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* 4 · Explicación de la decisión */}
          <div className="ke-cd-section">
            <div className="ke-cd-section-title">¿Por qué DocenteOS tomará esta decisión?</div>
            <div className="ke-cd-explicacion">
              {tieneBaseSolida ? (
                <>
                  <p>
                    Se encontraron{' '}
                    {[
                      planSimilares > 0 && `${planSimilares} planificaciones similares`,
                      casos > 0         && `${casos} casos de éxito`,
                      memorias > 0      && `${memorias} memorias activas`,
                    ].filter(Boolean).join(', ')}.
                  </p>
                  <p>La nueva planificación reutilizará:</p>
                  <ul className="ke-cd-fuentes-lista">
                    {tieneEstilo      && <li>• Tu estilo de escritura pedagógica</li>}
                    {planSimilares > 0 && <li>• Actividades exitosas de planificaciones anteriores</li>}
                    {casos > 0        && <li>• Estrategias con los mejores resultados</li>}
                    {memorias > 0     && <li>• Reglas y criterios aprendidos del agente</li>}
                  </ul>
                  <p className="ke-cd-explicacion-ia">La IA adaptará únicamente el nuevo tema.</p>
                </>
              ) : (
                <>
                  <p>No existen planificaciones previas suficientes para este contexto.</p>
                  <p>Se utilizarán:</p>
                  <ul className="ke-cd-fuentes-lista">
                    {fuentesActivas.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                  <p className="ke-cd-explicacion-ia">La IA únicamente organizará esta información.</p>
                </>
              )}
            </div>
          </div>

          {/* 5 + 6 · Árbol de decisión + Estado de aprendizaje */}
          <div className="ke-cd-two-col">

            <div className="ke-cd-section">
              <div className="ke-cd-section-title">Árbol de decisión</div>
              <div className="ke-cd-arbol">
                {nodos.map((nodo, i) => (
                  <div
                    key={nodo.id}
                    className={[
                      'ke-cd-arbol-nodo',
                      nodo.raiz && 'ke-cd-arbol-root',
                      nodo.esIA && 'ke-cd-arbol-ia',
                    ].filter(Boolean).join(' ')}
                  >
                    {i > 0 && <div className="ke-cd-arbol-flecha">↓</div>}
                    <div className={`ke-cd-arbol-box${nodo.activo && !nodo.raiz ? ' ke-cd-arbol-activo' : ''}`}>
                      <span className="ke-cd-arbol-label">{nodo.label}</span>
                      {nodo.valor && <span className="ke-cd-arbol-valor">{nodo.valor}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="ke-cd-section">
              <div className="ke-cd-section-title">Estado del aprendizaje</div>
              <div className="ke-cd-aprendizaje">
                <div className="ke-cd-aprendizaje-badge">
                  {memorias > 0 || casos > 0 ? '🟢 Aprendiendo' : '🟡 Iniciando'}
                </div>
                <div className="ke-cd-aprendizaje-stats">
                  <div className="ke-cd-ap-stat">
                    <span className="ke-cd-ap-num">{memorias}</span>
                    <span className="ke-cd-ap-lab">memorias</span>
                  </div>
                  <div className="ke-cd-ap-stat">
                    <span className="ke-cd-ap-num">{datos?.totalEstilos ?? 0}</span>
                    <span className="ke-cd-ap-lab">estilos</span>
                  </div>
                  <div className="ke-cd-ap-stat">
                    <span className="ke-cd-ap-num">{casos}</span>
                    <span className="ke-cd-ap-lab">casos de éxito</span>
                  </div>
                  <div className="ke-cd-ap-stat">
                    <span className="ke-cd-ap-num">{totalPlanes}</span>
                    <span className="ke-cd-ap-lab">planificaciones</span>
                  </div>
                </div>

                {/* 7 · Recomendaciones */}
                <div className="ke-cd-ap-recomendaciones-title">
                  Para mejorar futuras planificaciones:
                </div>
                <ul className="ke-cd-ap-recomendaciones">
                  {recomendaciones.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            </div>

          </div>

          {/* 8 · Transparencia */}
          <div className="ke-cd-section">
            <div className="ke-cd-section-title">¿Cómo construirá DocenteOS esta planificación?</div>
            <div className="ke-cd-transparencia">
              {transparencia.map((item) => (
                <div key={item.fuente} className="ke-cd-trans-item">
                  <div className="ke-cd-trans-header">
                    <span className="ke-cd-trans-pct" style={{ color: item.color }}>
                      {item.pct}%
                    </span>
                    <span className="ke-cd-trans-label">{item.fuente}</span>
                  </div>
                  <div className="ke-cd-trans-bar-wrap">
                    <div
                      className="ke-cd-trans-bar"
                      style={{ width: `${item.pct}%`, background: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </section>
  )
}
