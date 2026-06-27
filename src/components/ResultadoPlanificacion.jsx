/**
 * ResultadoPlanificacion — estructura MINERD enriquecida
 */

import { EventTracker } from '../services/ai/learning/EventTracker.js';
import { LEARNING_EVENTS, AGENT_IDS } from '../services/ai/knowledge/KnowledgeTypes.js';

const TIPO_EVAL_LABEL = { diagnostica: "Diagnóstica", formativa: "Formativa", sumativa: "Sumativa" };

const COLOR_EJE = ["eje-violeta", "eje-azul", "eje-verde", "eje-naranja"];

const IA_ACCIONES = [
  { id: "mejorar",              label: "✨ Mejorar",          title: "Sugerencias pedagógicas" },
  { id: "corregir",             label: "🔧 Corregir",         title: "Alinear con MINERD" },
  { id: "regenerar-actividades",label: "🔄 Nuevas actividades",title: "Regenerar actividades" },
  { id: "neae",                 label: "♿ Adaptar NEAE",      title: "Adecuaciones curriculares" },
  { id: "adaptar-tiempo",       label: "⏱ Adaptar tiempo",    title: "Ajustar duración de clase" },
];

function renderBold(text) {
  const parts = String(text).split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part);
}

export default function ResultadoPlanificacion({
  planificacion,
  onGuardar,
  onDescargar,
  onNueva,
  guardando,
  canGuardar = true,
  mensaje,
  onAccionIA,
  iaAccion,
  iaTexto,
  iaGenerando,
  iaError,
  iaMinutos,
  setIaMinutos,
  iaRef,
  onLimpiarIA,
  // Entrenar IA
  onGuardarEstilo,
  onConvertirCasoExito,
  guardandoEstilo,
  guardandoCasoExito,
  mensajeEntrenar,
}) {
  if (!planificacion) return null;

  const meta  = planificacion.metadatos    || {};
  const datos = planificacion.datosGenerales || {};
  const semanas = planificacion.desarrolloSemanal || [];

  const tema              = meta.tema       || datos.tema        || "";
  const area              = meta.area       || datos.area        || "";
  const competencia       = datos.competencia || meta.competenciaSeleccionada || "";
  const indicadores       = datos.indicadoresOficiales   || meta.indicadoresOficiales   || [];
  const ejesTematicos     = datos.ejesTematicos          || meta.ejesTematicos          || [];
  const asignaturas       = datos.asignaturasVinculadas  || meta.asignaturasVinculadas  || [];
  const situacion         = datos.situacionAprendizaje   || meta.situacionAprendizaje   || "";
  const ambiente          = datos.ambienteAprendizaje    || meta.ambienteAprendizaje    || "";
  const contenidos        = datos.contenidos || {};
  const imagen            = datos.imagenTematica;

  const botonGuardar = guardando
    ? "⏳ Guardando..."
    : canGuardar
      ? "💾 Guardar"
      : "🔒 Guardar";

  return (
    <div className="resultado resultado-minerd">

      {/* Mensaje de estado */}
      {mensaje && (
        <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>
      )}

      {/* ── Botones superiores ── */}
      <div className="minerd-acciones top">
        <button className="save-btn"   onClick={() => { EventTracker.track(LEARNING_EVENTS.AUDITORIA_APLICADA, { agentId: AGENT_IDS.AUDITOR, area: area ?? null, asignatura: null, grado: meta.grado ?? null, tema: tema ?? null, metadata: {} }); onGuardar(); }}   disabled={guardando || !canGuardar}>{botonGuardar}</button>
        <button className="export-btn" onClick={onDescargar}>📥 PDF</button>
        <button className="reset-btn"  onClick={onNueva}>↻ Nueva</button>
      </div>

      {/* ── Acciones IA ── */}
      {onAccionIA && (
        <div className="plan-ia-bar">
          <span className="plan-ia-label">🤖 IA:</span>
          {IA_ACCIONES.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`plan-ia-btn${iaAccion === a.id && iaGenerando ? " plan-ia-btn-active" : ""}`}
              title={a.title}
              disabled={iaGenerando}
              onClick={() => onAccionIA(a.id, { minutos: iaMinutos })}
            >
              {iaAccion === a.id && iaGenerando ? "⏳..." : a.label}
            </button>
          ))}
          {iaAccion === "adaptar-tiempo" && (
            <label className="plan-ia-min-label">
              <input
                type="number"
                min={20}
                max={120}
                value={iaMinutos}
                onChange={(e) => setIaMinutos?.(Number(e.target.value))}
                className="plan-ia-min-input"
              />
              min
            </label>
          )}
          {(iaTexto || iaError) && (
            <button type="button" className="plan-ia-limpiar" onClick={onLimpiarIA}>✕ Limpiar</button>
          )}
        </div>
      )}

      {onAccionIA && iaError && (
        <div className="plan-ia-error">⚠️ {iaError}</div>
      )}

      {/* ── Barra: Entrenar IA ── */}
      {(onGuardarEstilo || onConvertirCasoExito) && (
        <div className="plan-entrenar-bar">
          <span className="plan-entrenar-label">Entrenar:</span>
          {onGuardarEstilo && (
            <button
              type="button"
              className="plan-entrenar-btn"
              disabled={guardandoEstilo || guardandoCasoExito}
              onClick={onGuardarEstilo}
              title="Extrae la estructura, actividades y estilo de esta planificación para usarlo en futuras generaciones"
            >
              {guardandoEstilo ? "⏳ Guardando..." : "🎨 Guardar como mi estilo"}
            </button>
          )}
          {onConvertirCasoExito && (
            <button
              type="button"
              className="plan-entrenar-btn"
              disabled={guardandoEstilo || guardandoCasoExito}
              onClick={onConvertirCasoExito}
              title="Marca esta planificación como caso de éxito para que el sistema la use de referencia"
            >
              {guardandoCasoExito ? "⏳ Guardando..." : "⭐ Convertir en caso de éxito"}
            </button>
          )}
          {mensajeEntrenar && (
            <span className={`plan-entrenar-msg plan-entrenar-msg--${mensajeEntrenar.tipo}`}>
              {mensajeEntrenar.texto}
            </span>
          )}
        </div>
      )}

      {onAccionIA && (iaTexto || iaGenerando) && (
        <div className="plan-ia-panel" ref={iaRef}>
          <div className="plan-ia-panel-header">
            <span>
              {IA_ACCIONES.find((a) => a.id === iaAccion)?.title || "Análisis IA"}
            </span>
            {iaGenerando && <span className="plan-ia-spinner">Generando...</span>}
          </div>
          <div className="plan-ia-content">
            {iaTexto.split("\n").map((line, i) => {
              if (line.startsWith("## "))  return <h3 key={i} className="plan-ia-h3">{line.slice(3)}</h3>;
              if (line.startsWith("### ")) return <h4 key={i} className="plan-ia-h4">{line.slice(4)}</h4>;
              if (line.startsWith("- ") || line.startsWith("* "))
                return <li key={i} className="plan-ia-li">{renderBold(line.slice(2))}</li>;
              if (line.trim() === "") return <br key={i} />;
              return <p key={i} className="plan-ia-p">{renderBold(line)}</p>;
            })}
            {iaGenerando && <span className="plan-ia-cursor">▋</span>}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          CABECERA DE LA UNIDAD
      ══════════════════════════════════════════════════════════════ */}
      <header className="minerd-cabecera">
        <div className="minerd-cab-tipo">{meta.tipoPlanificacion || "Planificación"}</div>
        <h2 className="minerd-cab-titulo">{tema}</h2>

        <div className="minerd-cab-grid">
          {meta.grado      && <div className="minerd-cab-item"><span>Grado</span><strong>{meta.grado}</strong></div>}
          {meta.seccion    && <div className="minerd-cab-item"><span>Sección</span><strong>{meta.seccion}</strong></div>}
          {area            && <div className="minerd-cab-item"><span>Área</span><strong>{area}</strong></div>}
          {meta.periodo    && <div className="minerd-cab-item"><span>Período</span><strong>{meta.periodo}</strong></div>}
          {meta.duracion   && <div className="minerd-cab-item"><span>Duración</span><strong>{meta.duracion}</strong></div>}
          {meta.fechaInicio && <div className="minerd-cab-item"><span>Fecha inicio</span><strong>{meta.fechaInicio}</strong></div>}
        </div>

        {imagen && (
          <img
            src={imagen}
            alt="Imagen temática"
            className="minerd-cab-imagen"
          />
        )}

        {asignaturas.length > 0 && (
          <div className="minerd-cab-vinculadas">
            <span className="minerd-cab-vinc-label">Asignaturas vinculadas:</span>
            {asignaturas.map((a, i) => (
              <span key={i} className="minerd-cab-tag">{a}</span>
            ))}
          </div>
        )}
      </header>

      {/* ══════════════════════════════════════════════════════════════
          EJES TEMÁTICOS TRANSVERSALES
      ══════════════════════════════════════════════════════════════ */}
      {ejesTematicos.length > 0 && (
        <section className="minerd-seccion minerd-ejes">
          <h3 className="minerd-sec-titulo">🌐 Ejes Temáticos Transversales</h3>
          <div className="minerd-ejes-grid">
            {ejesTematicos.map((eje, i) => (
              <div key={i} className={`minerd-eje-card ${COLOR_EJE[i % 4]}`}>
                {eje}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SITUACIÓN DE APRENDIZAJE
      ══════════════════════════════════════════════════════════════ */}
      {situacion && (
        <section className="minerd-seccion">
          <h3 className="minerd-sec-titulo">🌍 Situación de Aprendizaje</h3>
          <p className="minerd-situacion-txt">{situacion}</p>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════
          AMBIENTE DE APRENDIZAJE
      ══════════════════════════════════════════════════════════════ */}
      {ambiente && (
        <section className="minerd-seccion">
          <h3 className="minerd-sec-titulo">🏫 Ambiente de Aprendizaje</h3>
          <p className="minerd-ambiente-txt">{ambiente}</p>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════
          COMPETENCIA E INDICADORES
      ══════════════════════════════════════════════════════════════ */}
      <section className="minerd-seccion">
        <h3 className="minerd-sec-titulo">🎯 Competencia e Indicadores de Logro</h3>
        {competencia && (
          <div className="minerd-competencia-box">
            <span className="minerd-comp-label">Competencia específica</span>
            <p>{competencia}</p>
          </div>
        )}
        {indicadores.length > 0 && (
          <div className="minerd-indicadores">
            <p className="minerd-ind-label">Indicadores de logro oficiales:</p>
            <ol className="minerd-ind-list">
              {indicadores.map((ind, i) => (
                <li key={i}>{ind}</li>
              ))}
            </ol>
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════
          CONTENIDOS
      ══════════════════════════════════════════════════════════════ */}
      {(contenidos.conceptuales || contenidos.procedimentales || contenidos.actitudinales) && (
        <section className="minerd-seccion">
          <h3 className="minerd-sec-titulo">📚 Contenidos</h3>
          <div className="minerd-contenidos-3">
            <div className="minerd-cont-col conceptuales">
              <h4>Conceptuales</h4>
              <ul>{(contenidos.conceptuales || []).map((c, i) => <li key={i}>{c}</li>)}</ul>
            </div>
            <div className="minerd-cont-col procedimentales">
              <h4>Procedimentales</h4>
              <ul>{(contenidos.procedimentales || []).map((c, i) => <li key={i}>{c}</li>)}</ul>
            </div>
            <div className="minerd-cont-col actitudinales">
              <h4>Actitudinales</h4>
              <ul>{(contenidos.actitudinales || []).map((c, i) => <li key={i}>{c}</li>)}</ul>
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════
          DESARROLLO SEMANAL
      ══════════════════════════════════════════════════════════════ */}
      <section className="minerd-seccion">
        <h3 className="minerd-sec-titulo">📅 Desarrollo Semanal ({semanas.length} semanas)</h3>
        <div className="minerd-semanas">
          {semanas.map((sem) => (
            <div key={sem.n} className={`minerd-semana minerd-semana-${sem.fase || "desarrollo"}`}>

              {/* Cabecera de la semana */}
              <div className="minerd-sem-head">
                <span className="minerd-sem-num">Semana {sem.n}</span>
                <h4>{sem.titulo}</h4>
                <p className="minerd-sem-proposito">{sem.proposito}</p>
                <span className={`minerd-sem-eval-badge eval-${(sem.evaluacionSemana || sem.resumenEvaluacion)?.tipo || "formativa"}`}>
                  {TIPO_EVAL_LABEL[(sem.evaluacionSemana || sem.resumenEvaluacion)?.tipo] || "Formativa"}
                </span>
              </div>

              {/* Tabla de días */}
              <div className="minerd-dias-tabla">
                {(sem.dias || []).map((dia) => (
                  <div key={dia.n} className="minerd-dia-col">
                    <div className="minerd-dia-nombre">
                      {dia.nombre || `Día ${dia.n}`}
                      {dia.totalMin && (
                        <span className="minerd-dia-tiempo">
                          {dia.periodos === 2 ? "2 períodos · " : ""}{dia.totalMin} min
                        </span>
                      )}
                    </div>
                    {dia.tituloDia && (
                      <div className="minerd-dia-subtema">{dia.tituloDia}</div>
                    )}
                    {dia.intencionPedagogica && (
                      <div className="minerd-dia-intencion">
                        <span className="minerd-dia-int-label">Intención pedagógica:</span>
                        {dia.intencionPedagogica}
                      </div>
                    )}
                    {(dia.momentos || []).map((m, mi) => (
                      <div key={mi} className={`minerd-momento minerd-m-${m.tipo.toLowerCase()}`}>
                        <div className="minerd-m-header">
                          <span className="minerd-m-tipo">{m.tipo}</span>
                          <span className="minerd-m-tiempo">{m.tiempo}</span>
                        </div>
                        <ul className="minerd-m-acts">
                          {(m.actividades || []).map((act, ai) => (
                            <li key={ai}>{act}</li>
                          ))}
                        </ul>
                        {m.metacognicion && m.metacognicion.length > 0 && (
                          <div className="minerd-m-meta">
                            <span className="minerd-m-meta-label">💭 Metacognición</span>
                            {m.metacognicion[0]}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* ── Evidencias estructuradas (3 bloques) ── */}
              {sem.evidenciasSemana && (
                <div className="minerd-sem-evidencias">
                  <strong className="minerd-ev-titulo">📋 Evidencias de aprendizaje</strong>
                  <div className="minerd-evidencias-3">
                    <div className="minerd-ev-bloque conocimientos">
                      <h5>🧠 Conocimientos previos</h5>
                      <ul>{(sem.evidenciasSemana.conocimientosPrevios || []).map((e, i) => <li key={i}>{e}</li>)}</ul>
                    </div>
                    <div className="minerd-ev-bloque desempeno">
                      <h5>⭐ Desempeño esperado</h5>
                      <ul>{(sem.evidenciasSemana.desempenoEsperado || []).map((e, i) => <li key={i}>{e}</li>)}</ul>
                    </div>
                    <div className="minerd-ev-bloque producto">
                      <h5>🎯 Producto a elaborar</h5>
                      <ul>{(sem.evidenciasSemana.productoElaborar || []).map((e, i) => <li key={i}>{e}</li>)}</ul>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Materiales y recursos ── */}
              {sem.materialesSemana && (
                <details className="minerd-materiales">
                  <summary>📦 Materiales y recursos</summary>
                  <div className="minerd-mat-grid">
                    <div className="minerd-mat-grupo">
                      <h5>📄 Impresos / Físicos</h5>
                      <ul>{(sem.materialesSemana.impresos || []).map((m, i) => <li key={i}>{m}</li>)}</ul>
                    </div>
                    <div className="minerd-mat-grupo">
                      <h5>💻 Digitales</h5>
                      <ul>{(sem.materialesSemana.digitales || []).map((m, i) => <li key={i}>{m}</li>)}</ul>
                    </div>
                    <div className="minerd-mat-grupo">
                      <h5>🏫 Ambientación</h5>
                      <ul>{(sem.materialesSemana.otros || []).map((m, i) => <li key={i}>{m}</li>)}</ul>
                    </div>
                  </div>
                </details>
              )}

              {/* ── NEAE ── */}
              {sem.adecuacionesNEAE && (
                <details className="minerd-neae">
                  <summary>♿ Adecuaciones NEAE</summary>
                  <div className="minerd-neae-grid">
                    {[
                      { clave: "acceso",     titulo: "Acceso" },
                      { clave: "curricular", titulo: "Curricular" },
                      { clave: "evaluacion", titulo: "Evaluación" },
                    ].map(({ clave, titulo }) =>
                      sem.adecuacionesNEAE[clave] ? (
                        <div key={clave} className="minerd-neae-grupo">
                          <h5>{titulo}</h5>
                          <ul>{sem.adecuacionesNEAE[clave].map((item, i) => <li key={i}>{item}</li>)}</ul>
                        </div>
                      ) : null
                    )}
                  </div>
                </details>
              )}

              {/* ── Evaluación ── */}
              {(sem.evaluacionSemana || sem.resumenEvaluacion) && (() => {
                const ev = sem.evaluacionSemana || sem.resumenEvaluacion;
                return (
                  <details className="minerd-eval-resumen">
                    <summary>
                      📊 Evaluación — {TIPO_EVAL_LABEL[ev.tipo] || "Formativa"}
                    </summary>
                    <div className="minerd-eval-body">
                      <div className="minerd-eval-grid">
                        <div>
                          <p><strong>Técnicas</strong></p>
                          <ul>{(ev.tecnicas || []).map((t, i) => <li key={i}>{t}</li>)}</ul>
                        </div>
                        <div>
                          <p><strong>Instrumentos</strong></p>
                          <ul>{(ev.instrumentos || []).map((t, i) => <li key={i}>{t}</li>)}</ul>
                        </div>
                        <div>
                          <p><strong>Criterios de logro</strong></p>
                          <ul>{(ev.criterios || (ev.observacionesPedagogicas ? [ev.observacionesPedagogicas] : [])).map((t, i) => <li key={i}>{t}</li>)}</ul>
                        </div>
                      </div>
                    </div>
                  </details>
                );
              })()}
            </div>
          ))}
        </div>
      </section>

      {/* ── Botones inferiores ── */}
      <div className="acciones-resultado">
        <button className="save-btn" onClick={onGuardar} disabled={guardando || !canGuardar}>
          {botonGuardar}
        </button>
        <button className="export-btn" onClick={onDescargar}>📥 Descargar PDF</button>
        <button className="reset-btn"  onClick={onNueva}>↻ Nueva planificación</button>
      </div>
    </div>
  );
}
