/**
 * Componente: FormularioPlanificacion
 * Ubicación: src/components/FormularioPlanificacion.jsx
 */

import { getAsignaturas, tieneMultiplesAsignaturas } from "../planning/areaAsignaturaMap.js";

const EJES_OPCIONES = [
  { value: "Desarrollo Sostenible",         color: "#059669" },
  { value: "Alfabetización Imprescindible", color: "#2563eb" },
  { value: "Ciudadanía y Convivencia",      color: "#7c3aed" },
  { value: "Salud y Bienestar",             color: "#d97706" },
];

export default function FormularioPlanificacion({
  tipoPlanificacion,
  configuracionTipo,
  grado,
  setGrado,
  seccion,
  setSeccion,
  area,
  setArea,
  periodo,
  setPeriodo,
  fechaInicio,
  setFechaInicio,
  duracion,
  setDuracion,
  diasClase,
  setDiasClase,
  tema,
  setTema,
  competencia,
  setCompetencia,
  indicadoresOficiales,
  setIndicadoresOficiales,
  imagenTematicaNombre,
  imagenSubiendo = false,
  onSeleccionarImagenTematica,
  onLimpiarImagenTematica,
  onGenerar,
  cargando,
  grados,
  secciones,
  areas,
  asignatura = "",
  setAsignatura,
  periodos,
  duraciones,
  diasClaseOpciones,
  competencias,
  // Currículo oficial (Firestore)
  competenciasCurriculares = [],
  tieneCurriculoOficial = false,
  cargandoCurriculo = false,
  temasCurriculares = [],
  combinacionSugerida = null,
  onAceptarCombinacion,
  onIgnorarCombinacion,
  temasIntegrados = [],
  // Contexto curricular (opcional)
  ejesTematicos = [],
  setEjesTematicos,
  asignaturasVinculadas = "",
  setAsignaturasVinculadas,
  situacionAprendizaje = "",
  setSituacionAprendizaje,
  // Configuración de tiempo
  minutosHoraClase = 45,
  setMinutosHoraClase,
  periodosClasePorDia = {},
  setPeriodosClasePorDia,
}) {
  const toggleDiaClase = (dia) => {
    setDiasClase((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]
    );
  };

  // Al elegir una competencia oficial, auto-carga sus indicadores de logro
  const manejarSeleccionCompetencia = (descripcion) => {
    setCompetencia(descripcion);
    if (!tieneCurriculoOficial) return;
    const comp = competenciasCurriculares.find((c) => c.descripcion === descripcion);
    if (!comp) return;
    const textoIndicadores = (comp.indicadoresLogro || [])
      .map((ind) => ind.descripcion)
      .join("\n");
    if (textoIndicadores) setIndicadoresOficiales(textoIndicadores);
  };

  const toggleEje = (eje) => {
    if (!setEjesTematicos) return;
    setEjesTematicos((prev) =>
      prev.includes(eje) ? prev.filter((e) => e !== eje) : [...prev, eje]
    );
  };

  // Validar que todos los campos estén completos
  const formularioCompleto =
    grado &&
    seccion &&
    area &&
    (!tieneMultiplesAsignaturas(area) || asignatura) &&
    (!configuracionTipo?.mostrarPeriodo || periodo) &&
    (!configuracionTipo?.mostrarFechaInicio || fechaInicio) &&
    (!configuracionTipo?.mostrarSemanas || duracion) &&
    (!configuracionTipo?.mostrarDiasClase || diasClase.length > 0) &&
    tema &&
    competencia &&
    indicadoresOficiales;

  return (
    <div className="planning-form-card">
      <h2>📋 Configura tu planificación</h2>

      <div className="planning-form-sections">
        <section className="form-section-card">
          <h3>1. DATOS GENERALES</h3>
          <div className="form-grid-2 compact">
            <label>
              <span className="label-icon">🎓</span>
              <span>Grado</span>
              <select value={grado} onChange={(e) => setGrado(e.target.value)} disabled={cargando}>
                <option value="">Selecciona un grado</option>
                {grados.map((g) => (
                  <option key={g.grado} value={g.grado}>{g.grado}</option>
                ))}
              </select>
            </label>

            <label>
              <span className="label-icon">🏷️</span>
              <span>Sección</span>
              <select value={seccion} onChange={(e) => setSeccion(e.target.value)} disabled={cargando}>
                <option value="">Selecciona una sección</option>
                {secciones.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>

            <label>
              <span className="label-icon">📚</span>
              <span>Área</span>
              <select value={area} onChange={(e) => setArea(e.target.value)} disabled={cargando}>
                <option value="">Selecciona un área</option>
                {areas.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </label>

            {tieneMultiplesAsignaturas(area) && (
              <label>
                <span className="label-icon">📖</span>
                <span>Asignatura</span>
                <select value={asignatura} onChange={(e) => setAsignatura(e.target.value)} disabled={cargando}>
                  <option value="">Selecciona la asignatura</option>
                  {getAsignaturas(area).map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </label>
            )}

            {configuracionTipo?.mostrarPeriodo && (
              <label>
                <span className="label-icon">📅</span>
                <span>Período</span>
                <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} disabled={cargando}>
                  <option value="">Selecciona un período</option>
                  {periodos.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </section>

        <section className="form-section-card">
          <h3>2. CONFIGURACIÓN CURRICULAR</h3>
          <div className="form-grid-2 compact">
            <label>
              <span className="label-icon">🎯</span>
              <span>
                Tema o Contenido
                {tieneCurriculoOficial && temasCurriculares.length > 0 && (
                  <span style={{
                    marginLeft: 8, fontSize: 11, background: "#dcfce7",
                    color: "#15803d", borderRadius: 4, padding: "2px 6px", fontWeight: 700,
                  }}>
                    Temas oficiales MINERD
                  </span>
                )}
              </span>
              {tieneCurriculoOficial && temasCurriculares.length > 0 ? (
                <select
                  value={tema}
                  onChange={(e) => setTema(e.target.value)}
                  disabled={cargando || cargandoCurriculo}
                >
                  <option value="">Selecciona un tema del currículo oficial</option>
                  {temasCurriculares.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Ej: Daily Routines, Photosynthesis"
                  value={tema}
                  onChange={(e) => setTema(e.target.value)}
                  disabled={cargando}
                />
              )}
            </label>

            <label>
              <span className="label-icon">💡</span>
              <span>
                Competencia específica
                {cargandoCurriculo && (
                  <span style={{ marginLeft: 8, fontSize: 12, color: "#2563eb" }}>
                    Cargando currículo oficial...
                  </span>
                )}
                {tieneCurriculoOficial && !cargandoCurriculo && (
                  <span style={{
                    marginLeft: 8, fontSize: 11, background: "#dcfce7",
                    color: "#15803d", borderRadius: 4, padding: "2px 6px", fontWeight: 700,
                  }}>
                    Currículo MINERD oficial
                  </span>
                )}
              </span>
              <select
                value={competencia}
                onChange={(e) => manejarSeleccionCompetencia(e.target.value)}
                disabled={cargando || cargandoCurriculo}
              >
                <option value="">
                  {cargandoCurriculo
                    ? "Cargando competencias oficiales..."
                    : tieneCurriculoOficial
                    ? "Selecciona una competencia oficial"
                    : "Selecciona una competencia"}
                </option>
                {competencias.map((comp) => (
                  <option key={comp} value={comp}>{comp}</option>
                ))}
              </select>
            </label>

            {configuracionTipo?.mostrarSemanas && (
              <label>
                <span className="label-icon">📆</span>
                <span>Cantidad de semanas</span>
                <select value={duracion} onChange={(e) => setDuracion(e.target.value)} disabled={cargando}>
                  <option value="">Selecciona semanas</option>
                  {duraciones.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </label>
            )}

            {configuracionTipo?.mostrarFechaInicio && (
              <label>
                <span className="label-icon">🗓️</span>
                <span>Fecha de inicio</span>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  disabled={cargando}
                />
              </label>
            )}

            <label style={{ gridColumn: "1 / -1" }}>
              <span className="label-icon">📌</span>
              <span>Indicadores de logro</span>
              <textarea
                placeholder="Pega aquí los indicadores oficiales sin resumir ni modificar redacción"
                value={indicadoresOficiales}
                onChange={(e) => setIndicadoresOficiales(e.target.value)}
                disabled={cargando}
                rows={4}
              />
            </label>
          </div>
        </section>

        {/* ── Sugerencia de integración curricular ── */}
        {combinacionSugerida && (
          <section className="form-section-card" style={{ borderLeft: "4px solid #f59e0b", background: "#fffbeb" }}>
            <h3 style={{ color: "#b45309", marginBottom: "8px" }}>
              ⚠️ INTEGRACIÓN CURRICULAR SUGERIDA
            </h3>
            <p style={{ color: "#92400e", fontSize: "13px", margin: "0 0 10px" }}>
              Este tema por sí solo no puede sostener pedagógicamente la cantidad de semanas seleccionada.
              El currículo oficial MINERD propone combinar los siguientes temas:
            </p>
            <p style={{ color: "#78350f", fontWeight: 700, fontSize: "14px", margin: "0 0 10px" }}>
              {combinacionSugerida.nombre}
            </p>
            <ul style={{ margin: "0 0 10px", paddingLeft: "20px" }}>
              {combinacionSugerida.distribucion.map((bloque) => (
                <li key={bloque.tema} style={{ color: "#92400e", fontSize: "13px", marginBottom: "4px" }}>
                  <strong>{bloque.tema}</strong>
                  {" — semanas "}
                  {bloque.semanaInicio === bloque.semanaFin
                    ? bloque.semanaInicio
                    : `${bloque.semanaInicio}–${bloque.semanaFin}`}
                  {" "}
                  <span style={{ opacity: 0.75 }}>
                    ({bloque.semanaFin - bloque.semanaInicio + 1} sem.)
                  </span>
                </li>
              ))}
            </ul>
            <p style={{ color: "#78350f", fontSize: "12px", fontStyle: "italic", margin: "0 0 14px" }}>
              {combinacionSugerida.justificacion}
            </p>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={onAceptarCombinacion}
                disabled={cargando}
                style={{
                  padding: "8px 18px", borderRadius: "8px",
                  background: "#d97706", color: "white", border: "none",
                  fontWeight: 700, fontSize: "13px", cursor: "pointer",
                }}
              >
                ✅ Aceptar integración curricular
              </button>
              <button
                type="button"
                onClick={onIgnorarCombinacion}
                disabled={cargando}
                style={{
                  padding: "8px 18px", borderRadius: "8px",
                  background: "white", color: "#92400e",
                  border: "2px solid #f59e0b",
                  fontWeight: 600, fontSize: "13px", cursor: "pointer",
                }}
              >
                Continuar con tema individual
              </button>
            </div>
          </section>
        )}

        {/* ── Integración curricular activa ── */}
        {temasIntegrados.length > 1 && !combinacionSugerida && (
          <div style={{
            padding: "10px 14px", background: "#f0fdf4",
            border: "2px solid #22c55e", borderRadius: "10px",
            display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap",
          }}>
            <span style={{ color: "#15803d", fontWeight: 700, fontSize: "13px" }}>
              🔗 Integración curricular activa:
            </span>
            {temasIntegrados.map((t) => (
              <span key={t} style={{
                background: "#dcfce7", color: "#166534",
                borderRadius: "6px", padding: "2px 8px",
                fontSize: "12px", fontWeight: 600,
              }}>
                {t}
              </span>
            ))}
          </div>
        )}

        <section className="form-section-card">
          <h3>3. CONFIGURACIÓN DE LA SECUENCIA</h3>
          <div className="form-grid-2 compact">
            <label>
              <span className="label-icon">🧩</span>
              <span>Tipo de planificación</span>
              <input type="text" value={tipoPlanificacion} disabled />
            </label>

            {configuracionTipo?.mostrarDiasClase && (
              <div className="dias-clase" style={{ gridColumn: "1 / -1" }}>
                <span className="dias-title">Días de clase</span>
                <div className="dias-options">
                  {diasClaseOpciones.map((dia) => (
                    <label key={dia} className="dia-check">
                      <input
                        type="checkbox"
                        checked={diasClase.includes(dia)}
                        onChange={() => toggleDiaClase(dia)}
                        disabled={cargando}
                      />
                      <span>{dia}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* ── Duración de la hora clase ── */}
            {configuracionTipo?.mostrarDiasClase && (
              <div style={{ gridColumn: "1 / -1" }}>
                <span className="dias-title">⏱ Duración de la hora clase</span>
                <div className="dias-options" style={{ gap: "10px", marginTop: "8px" }}>
                  {[45, 50].map((min) => {
                    const activo = minutosHoraClase === min;
                    return (
                      <button
                        key={min}
                        type="button"
                        disabled={cargando}
                        onClick={() => setMinutosHoraClase?.(min)}
                        style={{
                          padding: "8px 22px",
                          borderRadius: "10px",
                          border: `2px solid ${activo ? "#2563eb" : "#e2e8f0"}`,
                          background: activo ? "#eff6ff" : "#f8fafc",
                          color: activo ? "#1d4ed8" : "#64748b",
                          fontWeight: activo ? 800 : 500,
                          fontSize: "14px",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {min} min
                      </button>
                    );
                  })}
                  <span style={{ fontSize: "12px", color: "#94a3b8", alignSelf: "center" }}>
                    Aplica a todos los días seleccionados
                  </span>
                </div>
              </div>
            )}

            {/* ── Períodos por día ── */}
            {configuracionTipo?.mostrarDiasClase && diasClase.length > 0 && (
              <div style={{ gridColumn: "1 / -1" }}>
                <span className="dias-title">📚 Horas clase por día</span>
                <div style={{ display: "grid", gap: "8px", marginTop: "10px" }}>
                  {diasClase.map((dia) => {
                    const periodos = periodosClasePorDia[dia] || 1;
                    return (
                      <div key={dia} className="periodos-dia-row">
                        <span className="periodos-dia-nombre">{dia}</span>
                        {[1, 2].map((p) => {
                          const activo = periodos === p;
                          const totalMin = p * minutosHoraClase;
                          return (
                            <button
                              key={p}
                              type="button"
                              disabled={cargando}
                              onClick={() =>
                                setPeriodosClasePorDia?.((prev) => ({ ...prev, [dia]: p }))
                              }
                              style={{
                                padding: "6px 16px",
                                borderRadius: "8px",
                                border: `2px solid ${activo ? "#2563eb" : "#e2e8f0"}`,
                                background: activo ? "#eff6ff" : "#f8fafc",
                                color: activo ? "#1d4ed8" : "#64748b",
                                fontWeight: activo ? 700 : 500,
                                fontSize: "13px",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {p === 1 ? "1 período" : "2 períodos"}
                              <span style={{
                                marginLeft: "6px",
                                fontSize: "11px",
                                opacity: 0.75,
                                fontWeight: 600,
                              }}>
                                {totalMin} min
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <label style={{ gridColumn: "1 / -1" }}>
              <span className="label-icon">🖼️</span>
              <span>Imagen temática de la unidad</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onSeleccionarImagenTematica?.(e.target.files?.[0] || null)}
                disabled={cargando || imagenSubiendo}
              />
              {imagenSubiendo && <span className="form-file-help">Subiendo imagen…</span>}
              {!imagenSubiendo && imagenTematicaNombre && (
                <div className="form-file-help">
                  <span>Seleccionada: {imagenTematicaNombre}</span>
                  <button type="button" onClick={() => onLimpiarImagenTematica?.()}>
                    Quitar
                  </button>
                </div>
              )}
            </label>
          </div>
        </section>

        <section className="form-section-card">
          <h3>4. CONTEXTO CURRICULAR <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: "13px" }}>(opcional — se auto-genera si no completas)</span></h3>
          <div className="form-grid-2 compact">

            {/* Ejes Temáticos Transversales */}
            <div style={{ gridColumn: "1 / -1" }}>
              <span className="dias-title">🌐 Ejes Temáticos Transversales</span>
              <div className="dias-options" style={{ gap: "10px", marginTop: "8px" }}>
                {EJES_OPCIONES.map((eje) => {
                  const activo = ejesTematicos.includes(eje.value);
                  return (
                    <label
                      key={eje.value}
                      className="dia-check"
                      style={{
                        border: `2px solid ${activo ? eje.color : "#e2e8f0"}`,
                        borderRadius: "8px",
                        padding: "6px 12px",
                        background: activo ? `${eje.color}18` : "transparent",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={activo}
                        onChange={() => toggleEje(eje.value)}
                        disabled={cargando}
                      />
                      <span style={{ color: activo ? eje.color : "#374151", fontWeight: activo ? 700 : 500 }}>
                        {eje.value}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Asignaturas vinculadas */}
            <label style={{ gridColumn: "1 / -1" }}>
              <span className="label-icon">🔗</span>
              <span>Asignaturas vinculadas <small style={{ color: "#94a3b8" }}>(separadas por coma)</small></span>
              <input
                type="text"
                placeholder="Ej: Lengua Española, Tecnología"
                value={asignaturasVinculadas}
                onChange={(e) => setAsignaturasVinculadas?.(e.target.value)}
                disabled={cargando}
              />
            </label>

            {/* Situación de aprendizaje */}
            <label style={{ gridColumn: "1 / -1" }}>
              <span className="label-icon">🌍</span>
              <span>Situación de aprendizaje <small style={{ color: "#94a3b8" }}>(se genera automáticamente si dejas vacío)</small></span>
              <textarea
                placeholder="Describe la situación o contexto real que motiva el aprendizaje..."
                value={situacionAprendizaje}
                onChange={(e) => setSituacionAprendizaje?.(e.target.value)}
                disabled={cargando}
                rows={3}
              />
            </label>

          </div>
        </section>

      </div>

      {/* Botón Generar */}
      <button
        className="generate-btn"
        onClick={onGenerar}
        disabled={!formularioCompleto || cargando}
      >
        {cargando ? (
          <span className="gen-btn-inner">
            <span className="gen-spinner" />
            <span>Generando planificación...</span>
          </span>
        ) : (
          <span className="gen-btn-inner">
            <span className="gen-icon">✨</span>
            <span>Generar planificación</span>
          </span>
        )}
      </button>
    </div>
  );
}
