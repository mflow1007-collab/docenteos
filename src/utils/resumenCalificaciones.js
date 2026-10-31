/**
 * C.F. por competencias del Registro › Calificaciones (canal registroCalificaciones).
 * Sacado tal cual de RegistroCalificacionesPage.jsx (F6) para que el informe
 * de la familia muestre exactamente el mismo número que el Registro.
 */
import { aplicarNotaEnCelda, consolidarNotaAspecto } from "../services/hiloPedagogico.js";
import { proximaEntregaReportes } from "../data/calendarioEscolarMINERD.js";


export function crearNotasVacias(cantidadCompetencias = 4) {
  return {
    competencias: Array.from({ length: Math.max(1, cantidadCompetencias) }, () => ({
      periodos: Array.from({ length: 4 }, () => ({ p: "", rp: "" })),
    })),
    ceCompletiva: "",
    ceExtraordinaria: "",
  };
}

export function normalizarNotasCompetencias(notas, cantidadCompetencias = 4) {
  const base = notas || crearNotasVacias(cantidadCompetencias);
  return {
    ...base,
    competencias: Array.from({ length: Math.max(1, cantidadCompetencias) }, (_, ci) => {
      const comp = base.competencias?.[ci] || {};
      return {
        ...comp,
        periodos: Array.from({ length: 4 }, (_, pi) => comp.periodos?.[pi] || { p: "", rp: "" }),
      };
    }),
  };
}

export function calcularResumenEstudiante(notas) {
  const compAvgs = notas.competencias.map((comp) => {
    const finals = comp.periodos.map((per) => {
      const p = Number(per.p) || 0;
      const rp = Number(per.rp) || 0;
      return p >= 70 ? p : rp > 0 ? rp : p;
    });
    const validos = finals.filter((v) => v > 0);
    if (!validos.length) return 0;
    return Math.round((validos.reduce((a, b) => a + b, 0) / validos.length) * 10) / 10;
  });

  const cfValidos = compAvgs.filter((v) => v > 0);
  const cfExacto = cfValidos.length
    ? Math.round((cfValidos.reduce((a, b) => a + b, 0) / cfValidos.length) * 100) / 100
    : 0;
  const cf = Math.round(cfExacto);

  const ceComp  = Number(notas.ceCompletiva)     || 0;
  const p50cf   = cf > 0     ? Math.round(cf * 0.5)     : 0;
  const p50cec  = ceComp > 0 ? Math.round(ceComp * 0.5) : 0;
  const ccf     = p50cf + p50cec;

  const ceExtra  = Number(notas.ceExtraordinaria) || 0;
  const p30cf    = cf > 0      ? Math.round(cf * 0.3)       : 0;
  const p70ceex  = ceExtra > 0 ? Math.round(ceExtra * 0.7)  : 0;
  const cexf     = p30cf + p70ceex;

  const necesitaComp  = cf > 0 && cf < 70;
  const necesitaExtra = necesitaComp && ccf > 0 && ccf < 70;

  let situacion = cf > 0 ? "Reprobado" : "—";
  let aprobado = false, reprobado = false;
  if      (cf >= 70)   { situacion = "Aprobado";       aprobado = true; }
  else if (ccf >= 70)  { situacion = "Completiva";     aprobado = true; }
  else if (cexf >= 70) { situacion = "Extraordinaria"; aprobado = true; }
  else if (cf > 0)     { reprobado = true; }

  return { compAvgs, cfExacto, cf, ccf, cexf, necesitaComp, necesitaExtra, situacion, aprobado, reprobado };
}

// ─── F7 — C.F. desde las notas por indicador (opción A de César) ─────────────

/**
 * Columnas = competencias de la malla (curricularContent). Cada indicador va a
 * la columna de su competencia según la malla; cada resultado va al período
 * por su fecha de evaluación y los cortes del calendario MINERD.
 * Celda (competencia × período) = puntos / máximo de los aspectos activos de esa
 * competencia, solo con lo evaluado (los pendientes no bajan la nota). Solo
 * cuentan los indicadores con nota en el Registro (registroNotas, lo que se ve
 * en Registro › Instrumentos); los resultados dan el período.
 * PURO. Devuelve { celdas: {"ci|pi": porcentaje}, sinCompetencia, sinPeriodo }.
 */
export function celdasDesdeIndicadores({
  competencias = [], aspectos = [], instrumentos = [], resultados = [], notas = [], ids = [], nivel = "",
} = {}) {
  const columna = new Map();
  competencias.forEach((comp, ci) => {
    for (const ind of comp?.indicadoresLogro || []) {
      const id = typeof ind === "string" ? "" : ind?.id;
      if (id) columna.set(String(id), ci);
    }
  });
  const buscados = new Set(ids.filter(Boolean).map(String));
  const delEstudiante = resultados.filter((r) => buscados.has(String(r?.estudianteId || "")));
  const periodoDe = (r) => {
    const fecha = String(r?.fechaEvaluacion || "").slice(0, 10);
    const corte = fecha ? proximaEntregaReportes(nivel, fecha) : null;
    const n = Number(String(corte?.periodo || "").replace(/\D/g, ""));
    return n >= 1 && n <= 4 ? n - 1 : null;
  };

  const suma = new Map();
  const sinCompetencia = new Set();
  let sinPeriodo = 0;
  for (const aspecto of aspectos.filter((a) => (a?.estado || "activo") === "activo" && a?.indicadorId)) {
    const aspectoId = aspecto.aspectoId || aspecto.id;
    const nota = notas.find((n) => String(n?.aspectoId || "") === String(aspectoId)
      && buscados.has(String(n?.estudianteId || "")));
    if (!nota || nota.valorObtenido === "" || nota.valorObtenido === null || nota.valorObtenido === undefined) continue;
    const instrumentosAspecto = instrumentos.filter((ins) => (ins.aspectoRegistroIds || []).includes(aspectoId));
    const propios = delEstudiante.filter((r) => r.estado === "evaluado"
      && instrumentosAspecto.some((ins) => String(ins.id || ins.instrumentoId) === String(r.instrumentoId)));
    if (!propios.length) continue;
    const ci = columna.get(String(aspecto.indicadorId));
    if (ci === undefined) { sinCompetencia.add(String(aspecto.indicadorId)); continue; }

    const porPeriodo = new Map();
    for (const r of propios) {
      const pi = periodoDe(r);
      if (pi === null) { sinPeriodo += 1; continue; }
      porPeriodo.set(pi, [...(porPeriodo.get(pi) || []), r]);
    }
    // Ajuste manual del indicador (regla 12): vale si todo cae en un solo período
    const manual = nota.ajusteManual && porPeriodo.size === 1;

    for (const [pi, lista] of porPeriodo) {
      const c = consolidarNotaAspecto({ aspecto, instrumentos, resultados: lista });
      const puntos = manual ? Number(nota.valorObtenido) : c.valorCalculadoPuntos;
      if (puntos === null || !Number.isFinite(puntos)) continue;
      const clave = `${ci}|${pi}`;
      const previo = suma.get(clave) || { puntos: 0, maximo: 0 };
      suma.set(clave, { puntos: previo.puntos + puntos, maximo: previo.maximo + c.puntajeMaximo });
    }
  }

  const celdas = {};
  for (const [clave, { puntos, maximo }] of suma) {
    if (maximo > 0) celdas[clave] = Math.round((puntos / maximo) * 100);
  }
  return { celdas, sinCompetencia: [...sinCompetencia], sinPeriodo };
}

/**
 * Lleva las celdas calculadas a las notas de UN estudiante con la regla 12
 * (aplicarNotaEnCelda): la celda automática se actualiza; la puesta a mano no
 * se pisa, queda con «Nuevo cálculo». Una celda que venía de los indicadores y
 * ya no tiene nada evaluado se vacía. PURO.
 */
export function aplicarCeldasIndicadores(notas, celdas = {}, cantidadCompetencias = 4) {
  const base = normalizarNotasCompetencias(notas, cantidadCompetencias);
  let cambios = 0;
  const competencias = base.competencias.map((comp, ci) => ({
    ...comp,
    periodos: comp.periodos.map((per, pi) => {
      const calculo = celdas[`${ci}|${pi}`];
      let nueva = per;
      if (calculo !== undefined) {
        nueva = aplicarNotaEnCelda(per, calculo, { origenCelda: "indicadores" });
      } else if (per.origenCelda === "indicadores" && !per.ajusteManual && per.fuente === "instrumentos") {
        nueva = { ...per, p: "", valorCalculado: null, desactualizado: false };
      } else if (per.origenCelda === "indicadores" && per.desactualizado) {
        nueva = { ...per, valorCalculado: null, desactualizado: false };
      }
      if (JSON.stringify(nueva) !== JSON.stringify(per)) cambios += 1;
      return nueva;
    }),
  }));
  return { notas: { ...base, competencias }, cambios };
}

/** Las notas con cada celda «Nuevo cálculo» aceptada (C.F. según los indicadores). */
export function notasConCalculoAceptado(notas) {
  return {
    ...notas,
    competencias: (notas?.competencias || []).map((comp) => ({
      ...comp,
      periodos: (comp.periodos || []).map((per) => (per?.desactualizado && per.valorCalculado !== null && per.valorCalculado !== undefined
        ? { ...per, p: per.valorCalculado, rp: "" } : per)),
    })),
  };
}
