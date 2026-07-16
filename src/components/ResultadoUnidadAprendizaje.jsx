/**
 * ResultadoUnidadAprendizaje — Visualización MINERD del plan por fases
 * Tabla: Momento | Tiempo | Actividades | Evidencias | Evaluación | Recursos
 * Metacognición: fila verde dentro de la tabla cruzando cols 4+5
 */

import { useState } from "react";
import AuditoriaModal from "./AuditoriaModal.jsx";

const textoSeguro = (value) => {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (!value || typeof value !== "object") return "";
  return [
    value.organismo || value.ministerio || value.entidad,
    value.documento || value.titulo || value.nombre,
    value.anio || value.year,
  ].map(textoSeguro).filter(Boolean).join(" · ");
};

export default function ResultadoUnidadAprendizaje({ unidad, onGuardar, onDescargar, onVer, onNueva, onAplicarAcciones, onEditarUnidad, guardando, mensaje, onIrAModoAula }) {
  const [mostrarAuditoria, setMostrarAuditoria] = useState(false);
  // Modo edición (Bloque 1): permite al docente elegir qué indicadores trabaja
  // el plan. Los cambios se elevan al padre vía onEditarUnidad para persistirlos.
  const [editando, setEditando] = useState(false);

  if (!unidad) return null;

  // Alterna "trabajado" (aplicaTemaActual) de un indicador dentro de una
  // competencia y eleva la unidad modificada al padre. Un indicador ya trabajado
  // en un plan ANTERIOR (trabajadoAntes) se puede re-elegir: el docente decide.
  const toggleIndicadorTrabajado = (compIdx, indIdx) => {
    if (!onEditarUnidad) return;
    const detalle = Array.isArray(unidad.competenciasDetalle) ? unidad.competenciasDetalle : [];
    const nuevoDetalle = detalle.map((comp, ci) => {
      if (ci !== compIdx) return comp;
      const inds = (comp.indicadores || []).map((ind, ii) => {
        if (ii !== indIdx) return ind;
        const item = typeof ind === "string" ? { descripcion: ind } : { ...ind };
        return { ...item, aplicaTemaActual: !item.aplicaTemaActual };
      });
      return { ...comp, indicadores: inds };
    });
    onEditarUnidad({ ...unidad, competenciasDetalle: nuevoDetalle });
  };

  // Escribe un valor en una ruta anidada del objeto unidad (ej. "metadatos.titulo"
  // o "fasesSemanales.0.dias.1.titulo") y eleva la unidad modificada al padre.
  const setEnRuta = (ruta, valor) => {
    if (!onEditarUnidad) return;
    const partes = ruta.split(".");
    const clon = JSON.parse(JSON.stringify(unidad));
    let ref = clon;
    for (let i = 0; i < partes.length - 1; i++) {
      const k = /^\d+$/.test(partes[i]) ? Number(partes[i]) : partes[i];
      if (ref[k] == null) ref[k] = /^\d+$/.test(partes[i + 1]) ? [] : {};
      ref = ref[k];
    }
    const ultima = partes[partes.length - 1];
    ref[/^\d+$/.test(ultima) ? Number(ultima) : ultima] = valor;
    onEditarUnidad(clon);
  };

  // Texto normal, o input/textarea editable cuando editando===true.
  // Es una FUNCIÓN que devuelve JSX (no un componente) para no recrear el nodo
  // en cada render — así los inputs conservan el foco mientras se escribe.
  const editable = ({ ruta, valor, multilinea = false, negrita = false, placeholder = "" }) => {
    if (!editando) {
      if (!valor) return multilinea ? null : <span>{valor}</span>;
      return negrita ? <strong>{valor}</strong> : <span>{valor}</span>;
    }
    const estilo = { width: "100%", boxSizing: "border-box", fontFamily: "inherit", fontSize: "inherit", padding: "3px 6px", border: "1px solid #93c5fd", borderRadius: 4, background: "#f8fafc" };
    return multilinea
      ? <textarea style={{ ...estilo, minHeight: 60, resize: "vertical" }} defaultValue={valor || ""} placeholder={placeholder} onBlur={(e) => setEnRuta(ruta, e.target.value)} />
      : <input style={estilo} defaultValue={valor || ""} placeholder={placeholder} onBlur={(e) => setEnRuta(ruta, e.target.value)} />;
  };

  const { metadatos: m, competencias, contenidos, fasesSemanales = [] } = unidad;
  const modeloSuperior = unidad.modeloCurricularSuperior || {};
  const fuenteCurricular = textoSeguro(modeloSuperior.fuente) || "MINERD";
  const versionCurriculo = textoSeguro(modeloSuperior.versionCurriculo);
  const nivelMCERL = textoSeguro(modeloSuperior.nivelMCERL || competencias?.nivelMCERL);
  const renderList = (items = [], empty = "No registrado en la malla.") => (
    items?.length ? (
      <ul className="ua-list">{items.map((item, i) => <li key={i}>{textoItem(item)}</li>)}</ul>
    ) : <em>{empty}</em>
  );
  const textoItem = (item) => {
    if (typeof item === "string") return item;
    if (typeof item === "number") return String(item);
    if (!item || typeof item !== "object") return "";
    if (item.estructura) {
      const ejemplos = Array.isArray(item.ejemplos) && item.ejemplos.length
        ? `: ${item.ejemplos.join("; ")}`
        : "";
      return `${item.estructura}${ejemplos}`;
    }
    if (item.categoria || item.funcion) {
      const nombre = item.categoria || item.funcion;
      const ejemplos = Array.isArray(item.ejemplos) && item.ejemplos.length
        ? `: ${item.ejemplos.join(", ")}`
        : "";
      return `${nombre}${ejemplos}`;
    }
    return item.descripcion || item.texto || item.nombre || item.titulo || item.codigo || JSON.stringify(item);
  };
  const renderIndicador = (ind, compIdx = null, indIdx = null) => {
    if (typeof ind === "string") ind = { descripcion: ind };
    const codigo = ind?.codigo || ind?.id || ind?.codigoOficial || "";
    const descripcion = ind?.descripcion || ind?.texto || "";
    const style = {
      fontWeight: ind?.aplicaTemaActual ? 800 : undefined,
      textDecoration: ind?.trabajadoAntes ? "line-through" : undefined,
      opacity: ind?.trabajadoAntes ? 0.72 : undefined,
    };
    const texto = (
      <span style={style}>
        {codigo && <><strong>{codigo}</strong> — </>}
        {descripcion}
      </span>
    );
    // En modo edición: checkbox para marcar/desmarcar si el plan trabaja este
    // indicador. Marcado = negrita. El docente elige de los 21, aunque estén
    // tachados por haberse trabajado antes.
    if (editando && compIdx !== null && indIdx !== null) {
      return (
        <label style={{ display: "flex", alignItems: "flex-start", gap: 6, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={!!ind?.aplicaTemaActual}
            onChange={() => toggleIndicadorTrabajado(compIdx, indIdx)}
            style={{ marginTop: 3, flexShrink: 0 }}
          />
          {texto}
        </label>
      );
    }
    return texto;
  };
  const renderIndicadores = (items = [], empty = "No registrado en la malla.", compIdx = null) => (
    items?.length ? (
      <ul className="ua-list">{items.map((item, i) => <li key={i}>{renderIndicador(item, compIdx, i)}</li>)}</ul>
    ) : <em>{empty}</em>
  );
  const competenciasDetalle = Array.isArray(unidad.competenciasDetalle) ? unidad.competenciasDetalle : [];
  const competenciasVisibles = competenciasDetalle.length
    ? competenciasDetalle
    : (Array.isArray(modeloSuperior.competencias) ? modeloSuperior.competencias : []);

  return (
    <div className="ua-resultado">

      {mensaje && <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>}

      {editando && (
        <div className="mensaje info" style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af" }}>
          ✏️ <strong>Modo edición:</strong> marca o desmarca los indicadores que trabaja este plan. Los marcados salen en <strong>negrita</strong>; los ya trabajados en un plan anterior aparecen <span style={{ textDecoration: "line-through" }}>tachados</span> pero puedes volver a elegirlos. Pulsa <strong>Listo</strong> y luego <strong>Guardar</strong> para conservar los cambios.
        </div>
      )}

      {/* Acciones superiores */}
      <div className="minerd-acciones top">
        <button className="save-btn" onClick={onGuardar} disabled={guardando}>
          {guardando ? "⏳ Guardando..." : "💾 Guardar"}
        </button>
        {onEditarUnidad && (
          <button
            className="export-btn"
            onClick={() => setEditando((v) => !v)}
            style={editando ? { background: "#1e40af", color: "#fff" } : undefined}
          >
            {editando ? "✓ Listo" : "✏️ Editar"}
          </button>
        )}
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
              <td colSpan={3}>{editable({ ruta: "metadatos.titulo", valor: m.titulo, negrita: true })}</td>
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
              <td colSpan={3}>{editable({ ruta: "metadatos.productoFinal", valor: m.productoFinal, multilinea: true })}</td>
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
        <p className="ua-text-block">{editable({ ruta: "situacionAprendizaje", valor: unidad.situacionAprendizaje, multilinea: true })}</p>
        <div className="ua-section-head" style={{ marginTop: 8 }}>AMBIENTE DE APRENDIZAJE</div>
        <p className="ua-text-block">{editable({ ruta: "ambienteAprendizaje", valor: unidad.ambienteAprendizaje, multilinea: true })}</p>
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
        {(fuenteCurricular || versionCurriculo || nivelMCERL) && (
          <p className="ua-text-block" style={{ fontSize: 13 }}>
            Fuente curricular: {fuenteCurricular}
            {versionCurriculo ? ` · Versión: ${versionCurriculo}` : ""}
            {nivelMCERL ? ` · Nivel MCERL: ${nivelMCERL}` : ""}
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
                  <td>{renderIndicadores(comp.indicadores, "No registrado en la malla.", i)}</td>
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
            <ul>{(contenidos?.conceptuales || []).map((c, i) => {
              const texto = textoItem(c);
              const m = String(texto).match(/^(Vocabulario|Gramática|Expresión):\s*(.*)$/s);
              return m ? <li key={i}><strong>{m[1]}:</strong> {m[2]}</li> : <li key={i}>{texto}</li>;
            })}</ul>
          </div>
          <div className="ua-cont-col ua-cont-procedimental">
            <div className="ua-cont-head">Procedimentales</div>
            <ul>{(contenidos?.procedimentales || []).map((c, i) => {
              const texto = textoItem(c);
              const m = String(texto).match(/^(Funcional|Discursivo):\s*(.*)$/s);
              return m ? <li key={i}><strong>{m[1]}:</strong> {m[2]}</li> : <li key={i}>{texto}</li>;
            })}</ul>
          </div>
          <div className="ua-cont-col ua-cont-actitudinal">
            <div className="ua-cont-head">Actitudinales</div>
            <ul>{(contenidos?.actitudinales || []).map((c, i) => <li key={i}>{textoItem(c)}</li>)}</ul>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FASES / SEMANAS
      ══════════════════════════════════════ */}
      {fasesSemanales.map((fase, fi) => (
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
                {fase.indicadoresAvance.map((ind, i) => <li key={i}>{textoItem(ind)}</li>)}
              </ol>
            </div>
          )}

          {/* DÍAs */}
          {(fase.dias || []).map((dia, di) => (
            <div key={dia.numero} className="ua-dia-block">

              <div className="ua-semana-header">
                Día {dia.dia || dia.numero || dia.numeroGlobal}: &ldquo;{editando
                  ? editable({ ruta: `fasesSemanales.${fi}.dias.${di}.titulo`, valor: dia.titulo })
                  : dia.titulo}&rdquo;
                {(dia.focoLinguistico || editando) && (
                  <span> · {editando
                    ? editable({ ruta: `fasesSemanales.${fi}.dias.${di}.focoLinguistico`, valor: dia.focoLinguistico, placeholder: "Foco lingüístico / estructura" })
                    : dia.focoLinguistico}</span>
                )}
                {dia.etapaProgresion && (
                  <span className="ua-etapa-badge">{dia.etapaProgresion}</span>
                )}
              </div>
              {(dia.estrategiasDia || editando) && (
                <div className="ua-estrategia-band">
                  <strong>Estrategia de enseñanza y aprendizaje:</strong> {editando
                    ? editable({ ruta: `fasesSemanales.${fi}.dias.${di}.estrategiasDia`, valor: dia.estrategiasDia })
                    : dia.estrategiasDia}
                </div>
              )}
              <div className="ua-intencion-band">
                <strong>Intención pedagógica del día:</strong> {editando
                  ? editable({ ruta: `fasesSemanales.${fi}.dias.${di}.intencionPedagogica`, valor: dia.intencionPedagogica, multilinea: true })
                  : dia.intencionPedagogica}
              </div>

              {/* CRITERIOS DE ÉXITO + APORTE AL PRODUCTO */}
              <div className="ua-dia-meta-row">
                {dia.criteriosExito?.length > 0 && (
                  <div className="ua-exito-block">
                    <div className="ua-exito-head">Hoy tendrás éxito si…</div>
                    <ul className="ua-exito-list">
                      {dia.criteriosExito.map((c, i) => <li key={i}>{textoItem(c)}</li>)}
                    </ul>
                  </div>
                )}
                {(dia.aporteProducto || editando) && (
                  <div className="ua-aporte-block">
                    <div className="ua-aporte-head">Aporte al producto final</div>
                    <p className="ua-aporte-text">{editando
                      ? editable({ ruta: `fasesSemanales.${fi}.dias.${di}.aporteProducto`, valor: dia.aporteProducto, placeholder: "Artefacto que esta clase aporta" })
                      : dia.aporteProducto}</p>
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
                    {(dia.momentos || []).map((mom, mi) => (
                      <MomentoRows
                        key={mom.nombre}
                        mom={mom}
                        editando={editando}
                        setEnRuta={setEnRuta}
                        rutaBase={`fasesSemanales.${fi}.dias.${di}.momentos.${mi}`}
                      />
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
  const parts = String(text ?? "").split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("_") && p.endsWith("_")) return <em key={i}>{p.slice(1, -1)}</em>;
    return p;
  });
}

function textoPlano(valor) {
  if (valor == null) return "";
  if (typeof valor === "string" || typeof valor === "number") return String(valor);
  if (Array.isArray(valor)) return valor.map(textoPlano).filter(Boolean).join(" · ");
  if (typeof valor === "object") {
    return valor.descripcion || valor.texto || valor.nombre || valor.titulo || valor.criterio || valor.indicador || JSON.stringify(valor);
  }
  return String(valor);
}

function renderEvidencias(evidencias) {
  if (!evidencias) return <em>No registradas.</em>;
  if (typeof evidencias === "string" || typeof evidencias === "number") return parseFormatting(evidencias);
  if (Array.isArray(evidencias)) {
    return (
      <ul className="ua-list">
        {evidencias.map((item, i) => <li key={i}>{parseFormatting(textoPlano(item))}</li>)}
      </ul>
    );
  }
  if (typeof evidencias === "object") {
    const etiquetas = {
      conocimientos: "Conocimientos",
      conocimiento: "Conocimiento",
      desempeno: "Desempeño",
      desempeño: "Desempeño",
      producto: "Producto",
    };
    const entradas = Object.entries(evidencias)
      .map(([clave, valor]) => ({ clave, valor: Array.isArray(valor) ? valor : [valor].filter(Boolean) }))
      .filter(({ valor }) => valor.length);
    if (!entradas.length) return <em>No registradas.</em>;
    return (
      <div>
        {entradas.map(({ clave, valor }) => (
          <div key={clave} style={{ marginBottom: 4 }}>
            <strong>{etiquetas[clave] || clave}:</strong>
            <ul className="ua-list">
              {valor.map((item, i) => <li key={i}>{parseFormatting(textoPlano(item))}</li>)}
            </ul>
          </div>
        ))}
      </div>
    );
  }
  return parseFormatting(evidencias);
}

function normalizarRecursos(recursos) {
  if (!recursos) return { humanos: "", didacticos: "", tecnologicos: "" };
  if (typeof recursos === "string" || Array.isArray(recursos)) {
    return { humanos: "", didacticos: textoPlano(recursos), tecnologicos: "" };
  }
  if (typeof recursos === "object") {
    return {
      humanos: textoPlano(recursos.humanos || recursos.humano || ""),
      didacticos: textoPlano(recursos.didacticos || recursos.didácticos || recursos.materiales || recursos.recursos || recursos.items || ""),
      tecnologicos: textoPlano(recursos.tecnologicos || recursos.tecnológicos || recursos.digitales || ""),
    };
  }
  return { humanos: "", didacticos: textoPlano(recursos), tecnologicos: "" };
}

/**
 * Renderiza las 2 filas por momento: datos + fila verde de metacognición
 */
function MomentoRows({ mom, editando = false, rutaBase = "", setEnRuta = null }) {
  const ev = mom.evaluacion || {};
  const rec = normalizarRecursos(mom.recursos || {});
  const actividades = Array.isArray(mom.actividades)
    ? mom.actividades
    : [mom.actividades].filter(Boolean);
  const metacognicion = Array.isArray(mom.metacognicion)
    ? mom.metacognicion
    : [mom.metacognicion].filter(Boolean);
  const inputEstilo = { width: "100%", boxSizing: "border-box", fontFamily: "inherit", fontSize: "inherit", padding: "3px 6px", border: "1px solid #93c5fd", borderRadius: 4, background: "#f8fafc" };

  return (
    <>
      {/* Fila principal */}
      <tr>
        <td className="ua-td-momento" rowSpan={2}>
          <strong>{mom.nombre}</strong>
        </td>
        <td className="ua-td-tiempo" rowSpan={2}>{mom.tiempo}</td>
        <td className="ua-td-acts" rowSpan={2}>
          {actividades.map((act, i) => (
            <p key={i} className="ua-act-item">
              <strong>{i + 1}{")"}</strong>{" "}
              {editando && setEnRuta
                ? <textarea
                    style={{ ...inputEstilo, minHeight: 44, resize: "vertical" }}
                    defaultValue={textoPlano(act)}
                    onBlur={(e) => setEnRuta(`${rutaBase}.actividades.${i}`, e.target.value)}
                  />
                : parseFormatting(textoPlano(act))}
            </p>
          ))}
        </td>
        <td className="ua-td-evid" style={{ whiteSpace: "pre-line" }}>
          {renderEvidencias(mom.evidencias)}
        </td>
        <td className="ua-td-eval">
          <p><strong>Tipo:</strong> {textoPlano(ev.tipo)}.</p>
          <p><strong>Agente:</strong> {textoPlano(ev.agente)}.</p>
          <p><strong>Técnica:</strong> {textoPlano(ev.tecnica)}.</p>
          <p><strong>Instrumento:</strong> {textoPlano(ev.instrumento)}.</p>
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
          {editando && setEnRuta
            ? <textarea
                style={{ ...inputEstilo, minHeight: 44, resize: "vertical" }}
                defaultValue={metacognicion.map(textoPlano).join(" · ")}
                onBlur={(e) => setEnRuta(`${rutaBase}.metacognicion`, e.target.value.split(/\s*·\s*/).filter(Boolean))}
              />
            : <span className="ua-meta-text">{metacognicion.map(textoPlano).join(" · ")}</span>}
        </td>
      </tr>
    </>
  );
}
