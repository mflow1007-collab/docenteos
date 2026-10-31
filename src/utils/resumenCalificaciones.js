/**
 * C.F. por competencias del Registro › Calificaciones (canal registroCalificaciones).
 * Sacado tal cual de RegistroCalificacionesPage.jsx (F6) para que el informe
 * de la familia muestre exactamente el mismo número que el Registro.
 */


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
