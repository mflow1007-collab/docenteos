/**
 * Vista previa del plan maestro (Etapa 3 de docs/DISENO_CORAZON_DOCENTEOS.md).
 * El docente ve y ajusta situación (SituacionAprendizajePanel, Etapa 4),
 * producto, estrategia, secciones del producto, fases, sesiones,
 * competencias, indicadores y aspectos antes de generar. Sin IA: el plan se
 * calcula con construirPlanMaestro sobre la malla oficial que ya cargó el
 * formulario. Los ajustes se guardan en datos.planMaestro (solo en la sesión).
 * Desde la Etapa 5 es obligatoria donde existe: la generación redacta cada
 * fase de este plan con la IA.
 */
import { useMemo } from "react";
import { ESTRATEGIAS_FASES_GUIA_2025 } from "../data/estrategiasFasesGuia2025.js";
import { ROLES_FASES_POR_ESTRATEGIA, rolesDeFaseGuia } from "../data/rolesFasesEstrategias.js";
import {
  PLAN_MAESTRO_INICIAL, calcularVistaPrevia, resolverIndicadoresEstructurados, competenciasDeMalla,
  temasDeLaUnidad, alternarUnionConSiguiente, fijarPartes, fijarSesiones, repartirDeNuevo,
  alternarCompetencia, alternarIndicador, alternarAspecto,
} from "../services/vistaPreviaPlanMaestroService.js";
import SituacionAprendizajePanel from "./SituacionAprendizajePanel.jsx";

const NOMBRE_CATEGORIA = {
  vocabulario: "Vocabulario", gramatica: "Gramática", expresiones: "Expresiones", funcionales: "Funcionales",
};
const NOMBRE_ROL = {
  apertura: "apertura", conocimiento: "conocimiento", modelado: "modelado",
  aplicacion: "aplicación", evaluacion: "evaluación", socializacion: "socialización",
};
const NOMBRE_ACCION = { responde: "responde", produce: "produce", interactua: "interactúa" };

const cajaError = { background: "#fff1f2", border: "1px solid #fda4af", borderRadius: 8, padding: "8px 10px", color: "#7f1d1d", fontSize: 13, margin: "8px 0" };
const cajaFase = { border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px", marginTop: 8 };
const chip = (activo) => ({
  border: `1px solid ${activo ? "#7c3aed" : "#cbd5e1"}`, background: activo ? "#ede9fe" : "#fff",
  color: activo ? "#4c1d95" : "#334155", borderRadius: 999, padding: "2px 9px", fontSize: 12,
  fontWeight: activo ? 700 : 400, cursor: "pointer", margin: "2px 4px 2px 0",
});

// Indicador completo con los aspectos marcados en negrita.
function TextoIndicador({ indicador, marcados = [] }) {
  return (
    <span>
      {indicador.tronco}
      {indicador.listas.map((lista, l) => (
        <span key={l}>
          {lista.aspectos.map((a, j) => (
            <span key={a}>
              {(marcados[l] || []).includes(a) ? <strong>{a}</strong> : a}
              {lista.enlaces[j] ?? ""}
            </span>
          ))}
          {indicador.entre[l] ?? ""}
        </span>
      ))}
      {indicador.cierre}
    </span>
  );
}

export default function VistaPreviaPlanMaestro({ datos, onChange, mallaPayload, estadoMalla, horario }) {
  const pm = { ...PLAN_MAESTRO_INICIAL, ...(datos.planMaestro || {}) };
  const actualizar = (siguiente) => onChange({ ...datos, planMaestro: siguiente });
  // Horario tal como lo muestra el formulario (con sus valores por defecto).
  const datosPlan = { ...datos, ...horario };

  const estructura = useMemo(() => {
    if (!mallaPayload) return { indicadores: null, clave: null, error: null };
    try {
      const r = resolverIndicadoresEstructurados(mallaPayload);
      return { indicadores: r?.indicadores || null, clave: r?.clave || null, error: null };
    } catch (e) {
      return { indicadores: null, clave: null, error: e.message };
    }
  }, [mallaPayload]);

  const vista = calcularVistaPrevia({ datos: datosPlan, mallaPayload });
  // Si las sesiones fijadas no cuadran, se muestran las fases del reparto
  // automático para que el docente pueda corregirlas junto al error.
  const base = !vista.plan && pm.sesionesPorFase
    ? calcularVistaPrevia({ datos: { ...datosPlan, planMaestro: repartirDeNuevo(pm) }, mallaPayload })
    : null;
  const plan = vista.plan || base?.plan || null;
  const sesionesMostradas = plan ? (pm.sesionesPorFase || plan.fases.map((f) => f.sesiones)) : [];
  const sumaSesiones = sesionesMostradas.reduce((s, n) => s + (Number(n) || 0), 0);

  const estrategiaGuia = ESTRATEGIAS_FASES_GUIA_2025.find((e) => e.clave === pm.estrategia);
  const gruposUnion = pm.unir || [];
  const unidaConSiguiente = (num) => gruposUnion.some((g) => g.includes(num) && g.includes(num + 1));
  const enUnion = (num) => gruposUnion.some((g) => g.includes(num));
  // Fase de la Guía con varios papeles: se divide sola, una parte por papel.
  const partesFijas = (num) => {
    const roles = ROLES_FASES_POR_ESTRATEGIA[pm.estrategia];
    const papeles = roles ? rolesDeFaseGuia(roles, num) : [];
    return papeles.length > 1 ? papeles.length : 0;
  };
  const indicadoresPorId = new Map((estructura.indicadores || []).map((ind) => [ind.id, ind]));

  let cuerpo;
  if (!mallaPayload) {
    cuerpo = (
      <p className="pd-hint">
        {estadoMalla === "loading"
          ? "Verificando la malla curricular oficial…"
          : "Elige grado, área y asignatura con malla oficial para ver el plan maestro."}
      </p>
    );
  } else if (estructura.error) {
    cuerpo = <div style={cajaError} role="alert">{estructura.error}</div>;
  } else if (!estructura.indicadores) {
    cuerpo = (
      <p className="pd-hint">
        La vista previa del plan maestro todavía solo está disponible para Inglés 1ro y 2do de Secundaria.
        Puedes generar la unidad con el motor anterior (por semanas).
      </p>
    );
  } else {
    const competencias = competenciasDeMalla(mallaPayload, estructura.indicadores);
    cuerpo = (
      <>
        <SituacionAprendizajePanel datos={datos} onChange={onChange} pm={pm} temas={temasDeLaUnidad(datos)} malla={estructura.clave} />

        {estrategiaGuia && (
          <>
            <div className="pd-section-title" style={{ marginTop: 12 }}>Fases de la Guía (p. 22)</div>
            <ol style={{ margin: "4px 0 0", paddingLeft: 20, fontSize: 13 }}>
              {estrategiaGuia.fases.map((nombre, i) => {
                const num = i + 1;
                const ultima = num === estrategiaGuia.fases.length;
                return (
                  <li key={nombre} style={{ marginBottom: 4 }}>
                    {nombre}
                    {" "}
                    {partesFijas(num) ? (
                      <span className="pd-hint" style={{ marginLeft: 8 }}>
                        se divide sola en {partesFijas(num)} partes, una por papel
                      </span>
                    ) : (
                    <label style={{ fontSize: 12, marginLeft: 8, display: "inline-flex", gap: 4, alignItems: "center" }}>
                      partes
                      <select
                        value={pm.subdividir?.[num] || 1}
                        disabled={enUnion(num)}
                        onChange={(e) => actualizar(fijarPartes(pm, num, Number(e.target.value)))}
                      >
                        {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </label>
                    )}
                    {!ultima && !partesFijas(num) && !partesFijas(num + 1) && (
                      <label style={{ fontSize: 12, marginLeft: 10, display: "inline-flex", gap: 4, alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={unidaConSiguiente(num)}
                          disabled={Boolean(pm.subdividir?.[num] || pm.subdividir?.[num + 1])}
                          onChange={() => actualizar(alternarUnionConSiguiente(pm, num))}
                        />
                        unir con la siguiente
                      </label>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}

        <div className="pd-section-title" style={{ marginTop: 12 }}>Competencias e indicadores</div>
        <p className="pd-hint" style={{ margin: "0 0 6px" }}>
          Elige las competencias de la unidad. Al marcar una entran todos sus indicadores; quita los que no trabajes
          y marca los aspectos del tema.
        </p>
        <div className="pd-comp-fund-grid">
          {competencias.map((c) => {
            const activa = pm.competenciasElegidas.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                className={`pd-comp-cb ${activa ? "pd-comp-cb--on" : ""}`}
                onClick={() => actualizar(alternarCompetencia(pm, c.id, estructura.indicadores))}
              >
                <span>{activa ? "☑" : "☐"}</span> {c.nombre}
              </button>
            );
          })}
        </div>
        {competencias.filter((c) => pm.competenciasElegidas.includes(c.id)).map((c) => (
          <div key={c.id} style={cajaFase}>
            <strong style={{ fontSize: 13 }}>{c.nombre}</strong>
            {estructura.indicadores.filter((ind) => ind.competenciaId === c.id).map((ind) => {
              const elegido = pm.indicadoresElegidos.includes(ind.id);
              const marcados = pm.aspectosElegidos[ind.id] || [];
              return (
                <div key={ind.id} style={{ marginTop: 6, fontSize: 13 }}>
                  <label style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                    <input type="checkbox" checked={elegido} onChange={() => actualizar(alternarIndicador(pm, ind.id))} />
                    <span>
                      <em>{NOMBRE_ACCION[ind.accion]}</em> · <TextoIndicador indicador={ind} marcados={marcados} />
                    </span>
                  </label>
                  {elegido && ind.listas.map((lista, l) => (
                    <div key={l} style={{ marginLeft: 22, marginTop: 2 }}>
                      {ind.listas.length > 1 && <span className="pd-hint">Lista {l + 1}: </span>}
                      {lista.aspectos.map((a) => (
                        <button
                          key={a}
                          type="button"
                          style={chip((marcados[l] || []).includes(a))}
                          aria-pressed={(marcados[l] || []).includes(a)}
                          onClick={() => actualizar(alternarAspecto(pm, ind, l, a))}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}

        {vista.error && <div style={cajaError} role="alert">{vista.error}</div>}

        {plan && (
          <>
            <div className="pd-section-title" style={{ marginTop: 12 }}>
              Plan maestro · {plan.estrategia.nombre}
            </div>
            <p style={{ fontSize: 13, margin: "4px 0" }}>
              Sesiones: <strong>{sumaSesiones} de {plan.horario.totalSesiones}</strong>
              {" "}({plan.horario.semanas} semanas × {plan.horario.diasClase.length} días × {plan.horario.horasPorDia} h)
              {pm.sesionesPorFase && (
                <button type="button" style={{ ...chip(false), marginLeft: 8 }} onClick={() => actualizar(repartirDeNuevo(pm))}>
                  Repartir de nuevo
                </button>
              )}
            </p>
            {plan.fases.map((f, i) => (
              <div key={f.nombre} style={cajaFase}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                  <strong style={{ fontSize: 14 }}>Fase {f.numero}. {f.nombre}</strong>
                  <label style={{ fontSize: 12, display: "inline-flex", gap: 4, alignItems: "center" }}>
                    sesiones
                    <input
                      type="number"
                      min={1}
                      value={sesionesMostradas[i]}
                      style={{ width: 56 }}
                      onChange={(e) => actualizar(fijarSesiones(pm, plan, i, Number(e.target.value)))}
                    />
                  </label>
                </div>
                <div className="pd-hint" style={{ marginTop: 2 }}>
                  {vista.plan && `Sesiones ${f.rangoSesiones.desde}-${f.rangoSesiones.hasta} · `}
                  Papel: {f.roles.map((r) => NOMBRE_ROL[r] || r).join(" + ")}
                </div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Entrega: <strong>{f.entrega.texto}</strong></div>
                {f.entrega.secciones.length > 0 && (
                  <div style={{ fontSize: 13 }}>Secciones: {f.entrega.secciones.join(" · ")}</div>
                )}
                {f.indicadores.length > 0 && (
                  <ul style={{ fontSize: 13, margin: "4px 0 0", paddingLeft: 18 }}>
                    {f.indicadores.map((ind) => (
                      <li key={ind.id}>
                        <em>{NOMBRE_ACCION[ind.accion]}</em> ·{" "}
                        <TextoIndicador indicador={indicadoresPorId.get(ind.id)} marcados={ind.aspectosElegidos} />
                      </li>
                    ))}
                  </ul>
                )}
                {Object.entries(f.contenidos).some(([, items]) => items.length) && (
                  <details style={{ marginTop: 4, fontSize: 13 }}>
                    <summary>
                      Contenidos: {Object.entries(f.contenidos).filter(([, items]) => items.length)
                        .map(([cat, items]) => `${NOMBRE_CATEGORIA[cat] || cat} ${items.length}`).join(" · ")}
                    </summary>
                    {Object.entries(f.contenidos).filter(([, items]) => items.length).map(([cat, items]) => (
                      <div key={cat} style={{ marginTop: 4 }}>
                        <strong>{NOMBRE_CATEGORIA[cat] || cat}:</strong>
                        <ul style={{ margin: "2px 0 0", paddingLeft: 18 }}>
                          {items.map((x) => (
                            <li key={x.texto}>{x.texto} <span className="pd-hint">[{x.temas.join(" · ")}]</span></li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </details>
                )}
              </div>
            ))}
            {vista.plan?.avisos?.length > 0 && (
              <ul className="pd-hint" style={{ marginTop: 8 }}>
                {vista.plan.avisos.map((a) => <li key={a}>{a}</li>)}
              </ul>
            )}
          </>
        )}
      </>
    );
  }

  return (
    <details className="pd-detalles">
      <summary>Vista previa del plan maestro (sin IA · no gasta créditos)</summary>
      <p className="pd-hint" style={{ margin: "6px 0 8px" }}>
        Revisa y ajusta la estructura de la unidad. Es obligatoria: la IA redacta la unidad fase por fase con este plan.
      </p>
      {cuerpo}
    </details>
  );
}
