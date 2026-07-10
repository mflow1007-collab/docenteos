/**
 * ResultadoUnidadAprendizaje — Visualización MINERD del plan por fases
 * Tabla: Momento | Tiempo | Actividades | Evidencias | Evaluación | Recursos
 * Metacognición: fila verde dentro de la tabla cruzando cols 4+5
 */

import { useState } from "react";
import AuditoriaModal from "./AuditoriaModal.jsx";

export default function ResultadoUnidadAprendizaje({ unidad, onGuardar, onDescargar, onVer, onNueva, onAplicarAcciones, guardando, mensaje, onIrAModoAula }) {
  const [mostrarAuditoria, setMostrarAuditoria] = useState(false);

  if (!unidad) return null;

  const { metadatos: m, competencias, contenidos, fasesSemanales = [] } = unidad;
  const modeloSuperior = unidad.modeloCurricularSuperior || {};
  const renderList = (items = [], empty = "No registrado en la malla.") => (
    items?.length ? (
      <ul className="ua-list">{items.map((item, i) => <li key={i}>{textoItem(item)}</li>)}</ul>
    ) : <em>{empty}</em>
  );
  const textoItem = (item) => {
    if (typeof item === "string") return item;
    if (!item || typeof item !== "object") return "";
    return item.descripcion || item.texto || item.nombre || item.titulo || item.codigo || "";
  };
  const renderIndicador = (ind) => {
    if (typeof ind === "string") return ind;
    const codigo = ind?.codigo || ind?.id || ind?.codigoOficial || "";
    const descripcion = ind?.descripcion || ind?.texto || "";
    const style = {
      fontWeight: ind?.aplicaTemaActual ? 800 : undefined,
      textDecoration: ind?.trabajadoAntes ? "line-through" : undefined,
      opacity: ind?.trabajadoAntes ? 0.72 : undefined,
    };
    return (
      <span style={style}>
        {codigo && <><strong>{codigo}</strong> — </>}
        {descripcion}
      </span>
    );
  };
  const renderIndicadores = (items = [], empty = "No registrado en la malla.") => (
    items?.length ? (
      <ul className="ua-list">{items.map((item, i) => <li key={i}>{renderIndicador(item)}</li>)}</ul>
    ) : <em>{empty}</em>
  );
  const competenciasDetalle = Array.isArray(unidad.competenciasDetalle) ? unidad.competenciasDetalle : [];
  const competenciasVisibles = competenciasDetalle.length
    ? competenciasDetalle
    : (Array.isArray(modeloSuperior.competencias) ? modeloSuperior.competencias : []);

  return (
    <div className="ua-resultado">

      {mensaje && <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>}

      {/* Acciones superiores */}
      <div className="minerd-acciones top">
        <button className="save-btn" onClick={onGuardar} disabled={guardando}>
          {guardando ? "⏳ Guardando..." : "💾 Guardar"}
        </button>
        <button className="export-btn" onClick={onDescargar}>🖨️ Guardar como PDF</button>
        <button className="export-btn ua-ver-btn" onClick={onVer}>👁️ Ver PDF</button>
        <button className="audit-trigger-btn" onClick={() => setMostrarAuditoria(true)}>🔍 Auditar con IA</button>
        <button className="reset-btn" onClick={onNueva}>↻ Nuevo</button>
        {onIrAModoAula && (
          <button type="button" onClick={onIrAModoAula} style={{ background:'linear-gradient(135deg,#0f172a,#1e3a5f)', color:'#fff', border:0, borderRadius:8, padding:'8px 16px', fontSize:13.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:6 }}>
            🏫 Ir a Modo Aula
          </button>
        )}
      </div>

      {mostrarAuditoria && (
        <AuditoriaModal
          unidad={unidad}
          onClose={() => setMostrarAuditoria(false)}
          onAplicarAcciones={onAplicarAcciones}
        />
      )}

      {/* ═══ ENCABEZADO ═══ */}
      <header className="ua-header">
        <div className="ua-header-ministry">MINISTERIO DE EDUCACIÓN DE LA REPÚBLICA DOMINICANA</div>
        <div className="ua-header-subtitle">PLANIFICACIÓN: UNIDAD DE APRENDIZAJE</div>
      </header>

      {/* ── DATOS GENERALES ── */}
      <section className="ua-section">
        <div className="ua-section-head">DATOS GENERALES</div>
        <table className="ua-tabla-datos">
          <tbody>
            <tr>
              <td className="ua-lbl">Nombre del docente</td><td>{m.nombreDocente}</td>
              <td className="ua-lbl">Cédula</td><td>{m.cedula}</td>
            </tr>
            <tr>
              <td className="ua-lbl">Regional</td><td>{m.regional}</td>
              <td className="ua-lbl">Distrito</td><td>{m.distrito}</td>
            </tr>
            <tr>
              <td className="ua-lbl">Centro Educativo</td><td>{m.centro}</td>
              <td className="ua-lbl">Código</td><td>{m.codigoCentro}</td>
            </tr>
            <tr>
              <td className="ua-lbl">Nivel / Ciclo</td><td>{m.nivel} / {m.ciclo}</td>
              <td className="ua-lbl">Modalidad</td><td>{m.modalidad}</td>
            </tr>
            {m.jornada && (
              <tr>
                <td className="ua-lbl">Jornada</td>
                <td colSpan={3}>{m.jornada === "Extendida" ? "Jornada Extendida (40h/sem.)" : m.jornada === "Regular" ? "Jornada Regular (30h/sem.)" : "Jornada de Transición (25h/sem.)"}</td>
              </tr>
            )}
            <tr>
              <td className="ua-lbl">Grado y Sección</td><td>{m.grado} {m.seccion}</td>
              <td className="ua-lbl">Período</td><td>{m.periodo}</td>
            </tr>
            <tr>
              <td className="ua-lbl">Área</td><td>{m.area}</td>
              <td className="ua-lbl">Asignatura</td><td>{m.asignatura}</td>
            </tr>
            <tr>
              <td className="ua-lbl">Título de la Unidad</td>
              <td colSpan={3}><strong>{m.titulo}</strong></td>
            </tr>
            <tr>
              <td className="ua-lbl">Duración</td><td>{m.duracion}</td>
              <td className="ua-lbl">Fecha de inicio</td><td>{m.fechaInicio}</td>
            </tr>
            {m.horario && (
              <tr>
                <td className="ua-lbl">Horario</td>
                <td colSpan={3}>{m.horario}</td>
              </tr>
            )}
            <tr>
              <td className="ua-lbl">Asignaturas vinculadas</td>
              <td colSpan={3}>{(m.asignaturasVinculadas || []).join(", ") || "N/A"}</td>
            </tr>
            <tr>
              <td className="ua-lbl ua-lbl-top">Producto final</td>
              <td colSpan={3}>{m.productoFinal}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── MODELO CURRICULAR SUPERIOR ── */}
      {modeloSuperior.ejes?.length > 0 && (
        <section className="ua-section">
          <div className="ua-section-head">EJE TEMÁTICO TRANSVERSAL Y CONEXIONES CURRICULARES</div>
          <table className="ua-tabla-datos">
            <tbody>
              {modeloSuperior.ejes.map((eje, i) => (
                <tr key={i}>
                  <td className="ua-lbl ua-lbl-top">{eje.nombre}</td>
                  <td>{eje.descripcion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ── SITUACIÓN Y AMBIENTE ── */}
      <section className="ua-section">
        <div className="ua-section-head">SITUACIÓN DE APRENDIZAJE</div>
        <p className="ua-text-block">{unidad.situacionAprendizaje}</p>
        <div className="ua-section-head" style={{ marginTop: 8 }}>AMBIENTE DE APRENDIZAJE</div>
        <p className="ua-text-block">{unidad.ambienteAprendizaje}</p>
        {unidad.notaInstitucional && (
          <>
            <div className="ua-section-head" style={{ marginTop: 8 }}>NOTA INSTITUCIONAL DE ORGANIZACIÓN TEMPORAL</div>
            <div className="ua-text-block">
              {String(unidad.notaInstitucional).split("\n").map((parrafo, i) => (
                <p key={i}>{parrafo}</p>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ── COMPETENCIAS ── */}
      <section className="ua-section">
        <div className="ua-section-head">COMPONENTE CURRICULAR — Asignatura: {m.asignatura}</div>
        {(modeloSuperior.fuente || modeloSuperior.versionCurriculo || modeloSuperior.nivelMCERL || competencias?.nivelMCERL) && (
          <p className="ua-text-block" style={{ fontSize: 13 }}>
            Fuente curricular: {modeloSuperior.fuente || "MINERD"}
            {modeloSuperior.versionCurriculo ? ` · Versión: ${modeloSuperior.versionCurriculo}` : ""}
            {modeloSuperior.nivelMCERL || competencias?.nivelMCERL ? ` · Nivel MCERL: ${modeloSuperior.nivelMCERL || competencias.nivelMCERL}` : ""}
          </p>
        )}
        {competenciasVisibles.length > 0 ? (
          <table className="ua-tabla-datos">
            <tbody>
              <tr>
                <td className="ua-lbl">Competencias</td>
                <td className="ua-lbl">Indicadores de Logro</td>
              </tr>
              {competenciasVisibles.map((comp, i) => (
                <tr key={i}>
                  <td className="ua-lbl-top">
                    <strong>{comp.competenciaFundamental || `Competencia ${comp.orden || i + 1}`}</strong>
                    {comp.codigo && <><br /><strong style={{ color: "#1e3a8a" }}>{comp.codigo}</strong></>}
                    {comp.especifica && <><br /><em>{comp.especifica}</em></>}
                  </td>
                  <td>{renderIndicadores(comp.indicadores)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="ua-tabla-datos">
            <tbody>
              <tr>
                <td className="ua-lbl ua-lbl-top">Competencias<br/>Fundamentales</td>
                <td>
                  <div className="ua-comp-chips">
                    {(competencias?.fundamentales || []).map((c) => (
                      <span key={c} className="ua-comp-chip">☑ {c}</span>
                    ))}
                  </div>
                </td>
              </tr>
              <tr>
                <td className="ua-lbl ua-lbl-top">Competencia<br/>Específica</td>
                <td>{competencias?.especifica}</td>
              </tr>
              <tr>
                <td className="ua-lbl ua-lbl-top">Indicadores<br/>de Logro</td>
                <td>{renderList(competencias?.indicadores || [])}</td>
              </tr>
            </tbody>
          </table>
        )}
      </section>

      {/* ── CONTENIDOS ── */}
      <section className="ua-section">
        <div className="ua-section-head">CONTENIDOS</div>
        <div className="ua-contenidos-grid">
          <div className="ua-cont-col ua-cont-conceptual">
            <div className="ua-cont-head">Conceptuales</div>
            <ul>{(contenidos?.conceptuales || []).map((c, i) => <li key={i}>{c}</li>)}</ul>
          </div>
          <div className="ua-cont-col ua-cont-procedimental">
            <div className="ua-cont-head">Procedimentales</div>
            <ul>{(contenidos?.procedimentales || []).map((c, i) => <li key={i}>{c}</li>)}</ul>
          </div>
          <div className="ua-cont-col ua-cont-actitudinal">
            <div className="ua-cont-head">Actitudinales</div>
            <ul>{(contenidos?.actitudinales || []).map((c, i) => <li key={i}>{c}</li>)}</ul>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FASES / SEMANAS
      ══════════════════════════════════════ */}
      {fasesSemanales.map((fase) => (
        <section key={fase.numero} className="ua-fase-block">

          {/* FASE header */}
          <div className="ua-fase-header">
            FASE {fase.numero} — {fase.nombre}
          </div>
          <div className="ua-estrategia-band">
            <strong>Estrategia de enseñanza y de aprendizaje:</strong> {fase.estrategia}
          </div>

          {fase.tituloSemana && (
            <div className="ua-semana-header">
              {m.titulo} — SEMANA {fase.numero} ({fase.dias?.length || 0} día{(fase.dias?.length || 0) === 1 ? "" : "s"}): &ldquo;{fase.tituloSemana}&rdquo;
            </div>
          )}

          {/* INDICADORES DE AVANCE DE LA FASE */}
          {fase.indicadoresAvance?.length > 0 && (
            <div className="ua-avance-block">
              <div className="ua-avance-head">INDICADORES DE AVANCE — FASE {fase.numero}</div>
              <ol className="ua-avance-list">
                {fase.indicadoresAvance.map((ind, i) => <li key={i}>{ind}</li>)}
              </ol>
            </div>
          )}

          {/* DÍAs */}
          {(fase.dias || []).map((dia) => (
            <div key={dia.numero} className="ua-dia-block">

              <div className="ua-semana-header">
                Día {dia.dia || dia.numero || dia.numeroGlobal}: &ldquo;{dia.titulo}&rdquo;
                {dia.focoLinguistico && (
                  <span> · {dia.focoLinguistico}</span>
                )}
                {dia.etapaProgresion && (
                  <span className="ua-etapa-badge">{dia.etapaProgresion}</span>
                )}
              </div>
              {dia.estrategiasDia && (
                <div className="ua-estrategia-band">
                  <strong>Estrategia de enseñanza y aprendizaje:</strong> {dia.estrategiasDia}
                </div>
              )}
              <div className="ua-intencion-band">
                <strong>Intención pedagógica del día:</strong> {dia.intencionPedagogica}
              </div>

              {/* CRITERIOS DE ÉXITO + APORTE AL PRODUCTO */}
              <div className="ua-dia-meta-row">
                {dia.criteriosExito?.length > 0 && (
                  <div className="ua-exito-block">
                    <div className="ua-exito-head">Hoy tendrás éxito si…</div>
                    <ul className="ua-exito-list">
                      {dia.criteriosExito.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}
                {dia.aporteProducto && (
                  <div className="ua-aporte-block">
                    <div className="ua-aporte-head">Aporte al producto final</div>
                    <p className="ua-aporte-text">{dia.aporteProducto}</p>
                  </div>
                )}
              </div>

              {/* ── Tabla de momentos ── */}
              <div className="ua-tabla-wrap">
                <table className="ua-dia-table">
                  <thead>
                    <tr>
                      <th className="ua-th ua-th-momento">Momento</th>
                      <th className="ua-th ua-th-tiempo">Tiempo</th>
                      <th className="ua-th ua-th-acts">Actividades</th>
                      <th className="ua-th ua-th-evid">Evidencias:</th>
                      <th className="ua-th ua-th-eval">Evaluación</th>
                      <th className="ua-th ua-th-recurs">Recursos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dia.momentos || []).map((mom) => (
                      <MomentoRows key={mom.nombre} mom={mom} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* ADAPTACIONES NEAE */}
          {fase.dias?.[0]?.adaptacionesNEAE && (
            <div className="ua-sub-section">
              <div className="ua-sub-head">ADAPTACIONES (Para estudiantes con NEAE — si aplica)</div>
              <div className="ua-neae-grid">
                <div className="ua-neae-col">
                  <div className="ua-neae-head">De acceso</div>
                  <p>{fase.dias[0].adaptacionesNEAE.acceso}</p>
                </div>
                <div className="ua-neae-col">
                  <div className="ua-neae-head">Metodológicas</div>
                  <p>{fase.dias[0].adaptacionesNEAE.metodologicas}</p>
                </div>
                <div className="ua-neae-col">
                  <div className="ua-neae-head">De evaluación</div>
                  <p>{fase.dias[0].adaptacionesNEAE.evaluacion}</p>
                </div>
              </div>
            </div>
          )}

          {/* RESUMEN EVALUACIÓN */}
          {fase.dias?.[0]?.resumenEvaluacion && (
            <div className="ua-sub-section">
              <div className="ua-sub-head">RESUMEN DE EVALUACIÓN Y OBSERVACIONES</div>
              <div className="ua-neae-grid">
                <div className="ua-neae-col">
                  <div className="ua-neae-head">Técnicas</div>
                  <ul className="ua-list">{(fase.dias[0].resumenEvaluacion.tecnicas || []).map((t, i) => <li key={i}>{t}</li>)}</ul>
                </div>
                <div className="ua-neae-col">
                  <div className="ua-neae-head">Instrumentos</div>
                  <ul className="ua-list">{(fase.dias[0].resumenEvaluacion.instrumentos || []).map((t, i) => <li key={i}>{t}</li>)}</ul>
                </div>
                <div className="ua-neae-col">
                  <div className="ua-neae-head">Observaciones</div>
                  <p>{fase.dias[0].resumenEvaluacion.observaciones}</p>
                </div>
              </div>
            </div>
          )}

          {/* POSIBLES DIFICULTADES Y ESTRATEGIAS */}
          {fase.posiblesDificultades && (
            <div className="ua-sub-section ua-dificultades-block">
              <div className="ua-sub-head">POSIBLES DIFICULTADES Y ESTRATEGIAS</div>
              <p className="ua-dificultades-text">{fase.posiblesDificultades}</p>
            </div>
          )}

        </section>
      ))}

      {/* Acciones inferiores */}
      <div className="acciones-resultado">
        <button className="save-btn" onClick={onGuardar} disabled={guardando}>
          {guardando ? "⏳ Guardando..." : "💾 Guardar"}
        </button>
        <button className="export-btn" onClick={onDescargar}>🖨️ Guardar como PDF</button>
        <button className="export-btn ua-ver-btn" onClick={onVer}>👁️ Ver PDF</button>
        <button className="audit-trigger-btn" onClick={() => setMostrarAuditoria(true)}>🔍 Auditar con IA</button>
        <button className="reset-btn" onClick={onNueva}>↻ Nueva unidad</button>
        {onIrAModoAula && (
          <button type="button" onClick={onIrAModoAula} style={{ background:'linear-gradient(135deg,#0f172a,#1e3a5f)', color:'#fff', border:0, borderRadius:8, padding:'8px 16px', fontSize:13.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:6 }}>
            🏫 Ir a Modo Aula
          </button>
        )}
      </div>
    </div>
  );
}

/**
/** Convierte **negrita** y _cursiva_ dentro de una cadena en nodos React */
function parseFormatting(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("_") && p.endsWith("_")) return <em key={i}>{p.slice(1, -1)}</em>;
    return p;
  });
}

/**
 * Renderiza las 2 filas por momento: datos + fila verde de metacognición
 */
function MomentoRows({ mom }) {
  const ev = mom.evaluacion || {};
  const rec = mom.recursos || {};

  return (
    <>
      {/* Fila principal */}
      <tr>
        <td className="ua-td-momento" rowSpan={2}>
          <strong>{mom.nombre}</strong>
        </td>
        <td className="ua-td-tiempo" rowSpan={2}>{mom.tiempo}</td>
        <td className="ua-td-acts" rowSpan={2}>
          {(mom.actividades || []).map((act, i) => (
            <p key={i} className="ua-act-item">
              <strong>{i + 1}{")"}</strong> {parseFormatting(act)}
            </p>
          ))}
        </td>
        <td className="ua-td-evid" style={{ whiteSpace: "pre-line" }}>
          {parseFormatting(mom.evidencias || "")}
        </td>
        <td className="ua-td-eval">
          <p><strong>Tipo:</strong> {ev.tipo}.</p>
          <p><strong>Agente:</strong> {ev.agente}.</p>
          <p><strong>Técnica:</strong> {ev.tecnica}.</p>
          <p><strong>Instrumento:</strong> {ev.instrumento}.</p>
        </td>
        <td className="ua-td-recurs" rowSpan={2}>
          <p><strong>Humanos:</strong><br />{rec.humanos}</p>
          <p><strong>Didácticos:</strong><br />{rec.didacticos}</p>
          <p><strong>Tecnológicos:</strong><br />{rec.tecnologicos}</p>
        </td>
      </tr>

      {/* Fila metacognición — verde, cruza cols 4+5 */}
      <tr>
        <td className="ua-td-meta" colSpan={2}>
          <span className="ua-meta-label">Metacognición: </span>
          <span className="ua-meta-text">
            {(mom.metacognicion || []).join(" · ")}
          </span>
        </td>
      </tr>
    </>
  );
}
