/**
 * ResultadoPlanDiario — Visualización MINERD del plan diario
 */
import { useState, useEffect, useRef } from 'react'

// ─── Timer de clase ───────────────────────────────────────────────────────────
function TimerClase({ momentos = [] }) {
  const [activo, setActivo] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const [momentoIdx, setMomentoIdx] = useState(0)
  const interval = useRef(null)

  useEffect(() => {
    if (activo) {
      interval.current = setInterval(() => setSegundos(s => s + 1), 1000)
    } else {
      clearInterval(interval.current)
    }
    return () => clearInterval(interval.current)
  }, [activo])

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const totalMomento = momentos[momentoIdx]?.min * 60 || 0
  const pct = totalMomento > 0 ? Math.min((segundos / totalMomento) * 100, 100) : 0
  const sobre = totalMomento > 0 && segundos > totalMomento

  const handleAvanzar = () => {
    if (momentoIdx < momentos.length - 1) {
      setMomentoIdx(i => i + 1)
      setSegundos(0)
    }
  }
  const handleReset = () => { setActivo(false); setSegundos(0); setMomentoIdx(0) }

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'stretch',
      margin: '0 0 16px', padding: '14px 16px',
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
      boxShadow: '0 2px 8px rgba(0,0,0,.06)',
    }}>
      {/* ── Reloj ── */}
      <div style={{ minWidth: 140, flex: '0 0 auto', textAlign: 'center' }}>
        <div style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '.4px', color: '#8a96ab', marginBottom: 4,
        }}>⏱ Timer de Clase</div>
        <div style={{
          fontSize: 34, fontWeight: 800, letterSpacing: '-1px',
          color: sobre ? '#ef4444' : '#1e293b', fontVariantNumeric: 'tabular-nums',
        }}>{fmt(segundos)}</div>
        <div style={{
          fontSize: 11, color: sobre ? '#ef4444' : '#64748b', marginBottom: 8,
        }}>
          {momentos[momentoIdx]?.nombre || 'Clase'}
          {totalMomento > 0 && ` · ${momentos[momentoIdx]?.min} min`}
        </div>
        {/* Barra de progreso */}
        {totalMomento > 0 && (
          <div style={{
            height: 5, borderRadius: 3,
            background: '#e2e8f0', overflow: 'hidden', marginBottom: 8,
          }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: sobre ? '#ef4444' : '#7c3aed',
              transition: 'width .5s linear',
            }} />
          </div>
        )}
        {/* Controles */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          <button onClick={() => setActivo(v => !v)} style={{
            background: activo ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${activo ? '#fca5a5' : '#86efac'}`,
            color: activo ? '#dc2626' : '#16a34a',
            borderRadius: 7, padding: '4px 10px',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>{activo ? '⏸ Pausar' : '▶ Iniciar'}</button>
          {momentoIdx < momentos.length - 1 && (
            <button onClick={handleAvanzar} style={{
              background: '#eff6ff', border: '1px solid #93c5fd',
              color: '#2563eb', borderRadius: 7, padding: '4px 10px',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>→</button>
          )}
          <button onClick={handleReset} style={{
            background: '#f8fafc', border: '1px solid #e2e8f0',
            color: '#64748b', borderRadius: 7, padding: '4px 8px',
            fontSize: 12, cursor: 'pointer',
          }}>↺</button>
        </div>
      </div>

      {/* ── Tarjeta ASIST ── */}
      <div style={{ flex: 1, minWidth: 220, borderLeft: '1px solid #e2e8f0', paddingLeft: 14 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '.4px', color: '#8a96ab', marginBottom: 8,
        }}>📋 Guía Rápida — ASIST</div>
        {momentos.filter(mt => mt.guia).map((mt, i) => (
          <div key={i} style={{
            display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6,
          }}>
            <div style={{
              flexShrink: 0, width: 20, height: 20,
              background: momentoIdx === i ? '#7c3aed' : '#e2e8f0',
              color: momentoIdx === i ? '#fff' : '#64748b',
              borderRadius: 5, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 10, fontWeight: 800,
            }}>{mt.icono}</div>
            <div>
              <div style={{
                fontSize: 10.5, fontWeight: 700, color: '#374151',
                textDecoration: momentoIdx > i ? 'line-through' : 'none',
              }}>{mt.nombre} · {mt.min} min</div>
              <div style={{ fontSize: 11.5, color: '#6b7280', lineHeight: 1.45 }}>
                {mt.guia}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ResultadoPlanDiario({ plan, onGuardar, onDescargar, onNueva, guardando, mensaje }) {
  if (!plan) return null;

  const { metadatos: m, competenciasEIndicadores: ci, intencionPedagogica: ip,
          contenidos, desarrolloClase: dc, adaptacionesNEAE: neae,
          resumenEvaluacion: re, instrumentosEvaluacion: ie } = plan;

  return (
    <div className="pd-resultado">

      {/* ── Mensaje de estado ── */}
      {mensaje && <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>}

      {/* ── Acciones superiores ── */}
      <div className="minerd-acciones top">
        <button className="save-btn" onClick={onGuardar} disabled={guardando}>
          {guardando ? "⏳ Guardando..." : "💾 Guardar"}
        </button>
        <button className="export-btn" onClick={onDescargar}>📥 PDF</button>
        <button className="reset-btn" onClick={onNueva}>↻ Nuevo</button>
      </div>

      {/* ── Timer de clase + guía ASIST ── */}
      <TimerClase momentos={[
        {
          nombre: 'Inicio',
          icono: '🚀',
          min: parseInt(dc?.inicio?.tiempo) || 10,
          guia: ip?.intencionDelDia || '',
        },
        {
          nombre: 'Desarrollo',
          icono: '📚',
          min: parseInt(dc?.desarrollo?.tiempo) || 30,
          guia: ip?.estrategia || '',
        },
        {
          nombre: 'Cierre',
          icono: '✅',
          min: parseInt(dc?.cierre?.tiempo) || 10,
          guia: dc?.cierre?.evaluacion?.instrumento || (Array.isArray(ci?.indicadoresLogro) ? ci.indicadoresLogro[0] : '') || '',
        },
      ]} />

      {/* ════════════════════════════════════════
          ENCABEZADO
      ════════════════════════════════════════ */}
      <header className="pd-header">
        <div className="pd-header-logo">
          <div className="pd-header-ministry">MINISTERIO DE EDUCACIÓN DE LA REPÚBLICA DOMINICANA</div>
          <div className="pd-header-subtitle">PLAN DIARIO</div>
        </div>
      </header>

      {/* ── DATOS GENERALES ── */}
      <section className="pd-section">
        <div className="pd-section-head">DATOS GENERALES</div>
        <table className="pd-tabla-datos">
          <tbody>
            <tr>
              <td className="pd-lbl">Nombre completo</td><td>{m.nombreDocente}</td>
              <td className="pd-lbl">Cédula</td><td>{m.cedula}</td>
            </tr>
            <tr>
              <td className="pd-lbl">Regional</td><td>{m.regional}</td>
              <td className="pd-lbl">Distrito</td><td>{m.distrito}</td>
            </tr>
            <tr>
              <td className="pd-lbl">Centro Educativo</td><td>{m.centro}</td>
              <td className="pd-lbl">Código del Centro</td><td>{m.codigoCentro}</td>
            </tr>
            <tr>
              <td className="pd-lbl">Nivel / Subsistema</td><td>{m.nivel}</td>
              <td className="pd-lbl">Ciclo</td><td>{m.ciclo}</td>
            </tr>
            <tr>
              <td className="pd-lbl">Grado y Sección</td><td>{m.grado} {m.seccion}</td>
              <td className="pd-lbl">Modalidad</td><td>{m.modalidad}</td>
            </tr>
            <tr>
              <td className="pd-lbl">Área</td><td>{m.area}</td>
              <td className="pd-lbl">Asignatura</td><td>{m.asignatura}</td>
            </tr>
            <tr>
              <td className="pd-lbl">Fecha</td><td>{m.fecha}</td>
              <td className="pd-lbl">Duración</td><td>{m.duracion}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── COMPETENCIAS E INDICADORES ── */}
      <section className="pd-section">
        <div className="pd-section-head">COMPETENCIAS E INDICADORES DE LOGRO</div>
        <table className="pd-tabla-datos">
          <tbody>
            <tr>
              <td className="pd-lbl pd-lbl-top">Competencias<br/>Fundamentales</td>
              <td>
                <div className="pd-comp-fund-row">
                  {(ci.competenciasFundamentales || []).map((c) => (
                    <span key={c.nombre} className={`pd-comp-chip ${c.seleccionada ? "pd-comp-chip--on" : "pd-comp-chip--off"}`}>
                      {c.seleccionada ? "☑" : "☐"} {c.nombre}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
            <tr>
              <td className="pd-lbl pd-lbl-top">Indicadores de logros</td>
              <td>
                <ul className="pd-list">
                  {(ci.indicadoresLogro || []).map((ind, i) => <li key={i}>{ind}</li>)}
                </ul>
              </td>
            </tr>
            <tr>
              <td className="pd-lbl pd-lbl-top">Competencias específicas</td>
              <td>{ci.competenciaEspecifica}</td>
            </tr>
            <tr>
              <td className="pd-lbl pd-lbl-top">Situación de Aprendizaje</td>
              <td>{ci.situacionAprendizaje}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── INTENCIÓN PEDAGÓGICA ── */}
      <section className="pd-section">
        <div className="pd-section-head">INTENCIÓN PEDAGÓGICA Y ESTRATEGIA</div>
        <table className="pd-tabla-datos">
          <tbody>
            <tr>
              <td className="pd-lbl pd-lbl-top">Estrategia de enseñanza<br/>y aprendizaje</td>
              <td>{ip.estrategia}</td>
            </tr>
            <tr>
              <td className="pd-lbl pd-lbl-top">Intención pedagógica<br/>del día</td>
              <td><strong>{ip.intencionDelDia}</strong></td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── CONTENIDOS ── */}
      <section className="pd-section">
        <div className="pd-section-head">CONTENIDOS</div>
        <div className="pd-contenidos-grid">
          <div className="pd-cont-col pd-cont-conceptual">
            <div className="pd-cont-head">Conceptuales</div>
            <ul>{(contenidos.conceptuales || []).map((c, i) => <li key={i}>{c}</li>)}</ul>
          </div>
          <div className="pd-cont-col pd-cont-procedimental">
            <div className="pd-cont-head">Procedimentales</div>
            <ul>{(contenidos.procedimentales || []).map((c, i) => <li key={i}>{c}</li>)}</ul>
          </div>
          <div className="pd-cont-col pd-cont-actitudinal">
            <div className="pd-cont-head">Actitudinales</div>
            <ul>{(contenidos.actitudinales || []).map((c, i) => <li key={i}>{c}</li>)}</ul>
          </div>
        </div>
      </section>

      {/* ── DESARROLLO DE LA CLASE ── */}
      <section className="pd-section">
        <div className="pd-section-head">DESARROLLO DE LA CLASE</div>
        <table className="pd-dev-table">
          <thead>
            <tr>
              <th rowSpan={2} className="pd-dev-th pd-th-momento">Momento</th>
              <th rowSpan={2} className="pd-dev-th pd-th-tiempo">Tiempo</th>
              <th rowSpan={2} className="pd-dev-th pd-th-acts">Actividades</th>
              <th colSpan={3} className="pd-dev-th pd-th-eval-group">Evaluación</th>
              <th rowSpan={2} className="pd-dev-th pd-th-recursos">Recursos</th>
            </tr>
            <tr>
              <th className="pd-dev-th pd-th-sub">Evidencias</th>
              <th className="pd-dev-th pd-th-sub">Técnicos e<br/>Instrumentos</th>
              <th className="pd-dev-th pd-th-sub">Metacognición</th>
            </tr>
          </thead>
          <tbody>
            {[
              { key: "inicio",     label: "Inicio",     cls: "pd-tr-inicio",     data: dc.inicio },
              { key: "desarrollo", label: "Desarrollo", cls: "pd-tr-desarrollo", data: dc.desarrollo },
              { key: "cierre",     label: "Cierre",     cls: "pd-tr-cierre",     data: dc.cierre },
            ].map(({ key, label, cls, data }) => (
              <tr key={key} className={cls}>
                <td className="pd-td-momento"><strong>{label}</strong></td>
                <td className="pd-td-tiempo">{data.tiempo}</td>
                <td className="pd-td-acts">
                  {(data.actividades || []).map((act, i) => (
                    <p key={i}><strong>{i + 1}{")"}</strong> {act}</p>
                  ))}
                </td>
                <td className="pd-td-evidencias">
                  {(data.evaluacion?.evidencias || []).map((e, i) => (
                    <p key={i}>{e}</p>
                  ))}
                </td>
                <td className="pd-td-tecnico">
                  <p><strong>Tipo:</strong></p>
                  <p>{data.evaluacion?.tipo}</p>
                  <p><strong>Agente:</strong></p>
                  <p>{data.evaluacion?.agente}</p>
                  <p><strong>Técnica:</strong></p>
                  <p>{data.evaluacion?.tecnica}</p>
                  <p><strong>Instrumento:</strong> {data.evaluacion?.instrumento}</p>
                </td>
                <td className="pd-td-meta">
                  {(data.metacognicion || []).map((q, i) => (
                    <p key={i} className="pd-meta-q">{q}</p>
                  ))}
                </td>
                <td className="pd-td-recursos">
                  <p><strong>Humanos:</strong><br/>{data.recursos?.humanos}</p>
                  <p><strong>Didácticos:</strong><br/>{data.recursos?.didacticos}</p>
                  <p><strong>Tecnológicos:</strong><br/>{data.recursos?.tecnologicos}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── NEAE ── */}
      <section className="pd-section">
        <div className="pd-section-head">ADAPTACIONES (Para estudiantes con NEAE — si aplica)</div>
        <div className="pd-neae-grid">
          <div className="pd-neae-col">
            <div className="pd-neae-head">De acceso</div>
            <p>{neae.acceso}</p>
          </div>
          <div className="pd-neae-col">
            <div className="pd-neae-head">Metodológicas</div>
            <p>{neae.metodologicas}</p>
          </div>
          <div className="pd-neae-col">
            <div className="pd-neae-head">De evaluación</div>
            <p>{neae.evaluacion}</p>
          </div>
        </div>
      </section>

      {/* ── RESUMEN EVALUACIÓN ── */}
      <section className="pd-section">
        <div className="pd-section-head">RESUMEN DE EVALUACIÓN Y OBSERVACIONES</div>
        <div className="pd-resumen-grid">
          <div>
            <div className="pd-resumen-head">Técnicas</div>
            <ul>{(re.tecnicas || []).map((t, i) => <li key={i}>{t}</li>)}</ul>
          </div>
          <div>
            <div className="pd-resumen-head">Instrumentos</div>
            <ul>{(re.instrumentos || []).map((t, i) => <li key={i}>{t}</li>)}</ul>
          </div>
          <div>
            <div className="pd-resumen-head">Observaciones</div>
            <ul>{(re.observaciones || []).map((t, i) => <li key={i}>{t}</li>)}</ul>
          </div>
        </div>
      </section>

      {/* ── INSTRUMENTOS DE EVALUACIÓN ── */}
      <section className="pd-section">
        <div className="pd-section-head">INSTRUMENTOS DE EVALUACIÓN</div>

        {/* Lista de Cotejo */}
        <div className="pd-instrumento">
          <div className="pd-instr-title">1. LISTA DE COTEJO — (Diagnóstica – Inicio)</div>
          <p className="pd-instr-sub">Tema: {m.tema}</p>
          <table className="pd-instr-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}>N.º</th>
                <th>Nombre del estudiante</th>
                {(ie.criteriosCotejo || []).map((c, i) => <th key={i}>{c.criterio}</th>)}
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, "…", 15].map((n, ri) => (
                <tr key={ri}>
                  <td className="pd-tc">{n}</td>
                  <td></td>
                  {(ie.criteriosCotejo || []).map((_, ci) => (
                    <td key={ci} className="pd-tc">☐ Sí &nbsp; ☐ No</td>
                  ))}
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="pd-instr-legend">
            <strong>Criterio de interpretación:</strong> Mayoría Sí: Buen dominio previo. · Mayoría No: Requiere activación de conocimientos.
          </p>
        </div>

        {/* Rúbrica Analítica */}
        <div className="pd-instrumento">
          <div className="pd-instr-title">2. RÚBRICA ANALÍTICA — (Formativa – Desarrollo)</div>
          <p className="pd-instr-sub">Actividad: {m.tema}</p>
          <table className="pd-instr-table">
            <thead>
              <tr>
                <th style={{ width: "28%" }}>Criterio</th>
                <th className="pd-nivel3">Nivel 3 (Logrado)</th>
                <th className="pd-nivel2">Nivel 2 (En proceso)</th>
                <th className="pd-nivel1">Nivel 1 (Inicial)</th>
              </tr>
            </thead>
            <tbody>
              {(ie.criteriosRubrica || []).map((c, i) => (
                <tr key={i}>
                  <td><strong>{c.criterio}</strong></td>
                  <td className="pd-nivel3">{c.nivel3}</td>
                  <td className="pd-nivel2">{c.nivel2}</td>
                  <td className="pd-nivel1">{c.nivel1}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="pd-instr-legend">
            <strong>Escala de valoración:</strong>
            &nbsp; 13–15 puntos: Logro destacado &nbsp;·&nbsp;
            10–12 puntos: Logro esperado &nbsp;·&nbsp;
            7–9 puntos: En proceso &nbsp;·&nbsp;
            1–6 puntos: Inicio
          </p>
        </div>

        {/* Escala de Valoración */}
        <div className="pd-instrumento">
          <div className="pd-instr-title">3. ESCALA DE VALORACIÓN — (Formativa – Cierre)</div>
          <p className="pd-instr-sub">Actividad: Reflexión oral + producción breve</p>
          <table className="pd-instr-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}>N.º</th>
                <th>Nombre del estudiante</th>
                {(ie.criteriosEscala || []).map((c, i) => <th key={i}>{c.criterio}</th>)}
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, "…", 15].map((n, ri) => (
                <tr key={ri}>
                  <td className="pd-tc">{n}</td>
                  <td></td>
                  {(ie.criteriosEscala || []).map((_, ci) => (
                    <td key={ci} className="pd-tc pd-escala-cell">☐ Siempre &nbsp; ☐ A veces &nbsp; ☐ Nunca</td>
                  ))}
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="pd-instr-legend">
            <strong>Interpretación:</strong> Siempre: Dominio del aprendizaje. · A veces: En proceso. · Nunca: Requiere refuerzo.
          </p>
        </div>
      </section>

      {/* ── Acciones inferiores ── */}
      <div className="acciones-resultado">
        <button className="save-btn" onClick={onGuardar} disabled={guardando}>
          {guardando ? "⏳ Guardando..." : "💾 Guardar"}
        </button>
        <button className="export-btn" onClick={onDescargar}>📥 Descargar PDF</button>
        <button className="reset-btn" onClick={onNueva}>↻ Nuevo plan</button>
      </div>
    </div>
  );
}
