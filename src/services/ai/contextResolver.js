/**
 * contextResolver — Construye los bloques de contexto para inyectar en los
 * system prompts de la IA.
 *
 * No llama a Firestore directamente: recibe los datos ya cargados.
 *
 * Funciones exportadas:
 *   buildTeacherContext(perfil, planificaciones)     → contexto del docente + planificación activa
 *   buildCurriculumContext(curriculoDoc, compActiva) → currículo oficial MINERD del área/grado
 */

/**
 * @param {Object|null} perfil  — perfilInstitucional del docente (de AuthContext)
 * @param {Array}  planificaciones — array de planificaciones del docente
 * @returns {string} Bloque de contexto formateado, o "" si no hay datos
 */
export function buildTeacherContext(perfil, planificaciones = []) {
  const lines = [];

  // ── Perfil del docente ───────────────────────────────────────────────────────
  if (perfil?.nombreDocente)  lines.push(`Docente: ${perfil.nombreDocente}`);

  const centro = perfil?.centroEducativo || perfil?.centro;
  if (centro) lines.push(`Centro: ${centro}`);

  const nivel = Array.isArray(perfil?.nivelesDocente)
    ? perfil.nivelesDocente.join(", ")
    : (perfil?.nivel || "");
  if (nivel) lines.push(`Nivel: ${nivel}`);

  const ciclo = Array.isArray(perfil?.ciclos)
    ? perfil.ciclos.join(", ")
    : (perfil?.ciclo || "");
  if (ciclo) lines.push(`Ciclo: ${ciclo}`);

  if (perfil?.jornadaEscolar)  lines.push(`Jornada: ${perfil.jornadaEscolar}`);
  if (perfil?.periodoEscolar)  lines.push(`Año escolar: ${perfil.periodoEscolar}`);
  if (perfil?.regional)        lines.push(`Regional: ${perfil.regional}`);

  // ── Planificación activa más reciente ────────────────────────────────────────
  const plan = planificaciones.find((p) => p.estado !== "archivada") ?? planificaciones[0] ?? null;

  if (plan) {
    const m = plan.metadatos    || {};
    const d = plan.datosGenerales || {};

    lines.push("---");

    const tema = m.tema || m.tituloTema || d.tema;
    if (tema) lines.push(`Planificación activa: "${tema}"`);

    const area = m.area || d.area;
    if (area) lines.push(`Área: ${area}`);

    const asignatura = m.asignatura || d.asignatura;
    if (asignatura && asignatura !== area) lines.push(`Asignatura: ${asignatura}`);

    const grado = m.grado || m.nivelEducativo;
    if (grado) lines.push(`Grado: ${grado}`);

    if (m.periodo) lines.push(`Período: ${m.periodo}`);

    const competencia = m.competenciaSeleccionada || d.competencia;
    if (competencia) lines.push(`Competencia activa: ${String(competencia).slice(0, 200)}`);

    const indicadores = m.indicadoresOficiales || d.indicadoresLogro || [];
    if (Array.isArray(indicadores) && indicadores.length > 0) {
      lines.push(`Indicadores de logro: ${indicadores.slice(0, 3).join(" · ")}`);
    }
  }

  if (lines.length === 0) return "";

  return `## CONTEXTO DEL DOCENTE\n${lines.join("\n")}\n---\n`;
}

// ─── RAG: Currículo Oficial MINERD ────────────────────────────────────────────

/**
 * Construye el bloque de contexto curricular oficial a partir del documento
 * Firestore de diseñoCurricular.
 *
 * El bloque es compacto (< 1 200 tokens) para no dominar el context window:
 *   • Competencias específicas (nombres)
 *   • Indicadores de logro de la competencia activa (detalle completo)
 *   • Contenidos generales (abreviados)
 *   • Orientaciones metodológicas (2-3 primeras)
 *
 * @param {Object|null} curriculoDoc    Documento completo de diseñoCurricular
 * @param {string}      [compActiva]   Descripción parcial de la competencia activa (para resaltarla)
 * @returns {string}
 */
export function buildCurriculumContext(curriculoDoc, compActiva = "") {
  if (!curriculoDoc) return "";

  const lines = [];
  lines.push("## CURRÍCULO OFICIAL MINERD");

  if (curriculoDoc.nivel) lines.push(`Nivel: ${curriculoDoc.nivel}`);
  if (curriculoDoc.grado) lines.push(`Grado: ${curriculoDoc.grado}`);
  if (curriculoDoc.area)  lines.push(`Área:  ${curriculoDoc.area}`);
  if (curriculoDoc.nivelDominio) lines.push(`Nivel MCERL: ${curriculoDoc.nivelDominio}`);

  // Competencias fundamentales
  const compFund = curriculoDoc.competenciasFundamentales || [];
  if (compFund.length > 0) {
    lines.push(`Competencias fundamentales: ${compFund.slice(0, 5).join(" · ")}`);
  }

  // Competencias específicas — nombres + detalle de la activa
  const competencias = curriculoDoc.competencias || [];
  if (competencias.length > 0) {
    lines.push("Competencias específicas:");

    const prefixMatch = compActiva.slice(0, 40).toLowerCase();

    competencias.slice(0, 8).forEach((c, i) => {
      const desc = String(c.descripcion || c.id || "").trim();
      const esActiva = prefixMatch && desc.toLowerCase().includes(prefixMatch);
      const tag = esActiva ? " ← ACTIVA" : "";
      lines.push(`  ${i + 1}. ${desc.slice(0, 130)}${tag}`);

      // Indicadores de logro de la competencia activa (hasta 6)
      if (esActiva) {
        const indicadores = c.indicadoresLogro || [];
        if (indicadores.length > 0) {
          lines.push("  Indicadores de logro (competencia activa):");
          indicadores.slice(0, 6).forEach((ind) => {
            lines.push(`    · ${String(ind).slice(0, 120)}`);
          });
        }

        // Contenidos de la competencia activa
        const con = c.contenidos || {};
        if (con.conceptuales?.length > 0) {
          lines.push(`  Contenidos conceptuales: ${con.conceptuales.slice(0, 4).join(", ")}`);
        }
        if (con.procedimentales?.length > 0) {
          lines.push(`  Contenidos procedimentales: ${con.procedimentales.slice(0, 3).join(", ")}`);
        }
      }
    });
  }

  // Orientaciones metodológicas (máx. 3)
  const orientaciones = curriculoDoc.orientacionesMetodologicas || [];
  if (orientaciones.length > 0) {
    lines.push("Orientaciones metodológicas:");
    orientaciones.slice(0, 3).forEach((o) => {
      lines.push(`  · ${String(o).slice(0, 160)}`);
    });
  }

  // Contenidos generales del área (si no se incluyeron por competencia)
  const conGen = curriculoDoc.contenidosGenerales || {};
  if (conGen.conceptuales?.length > 0 && competencias.length === 0) {
    lines.push(`Contenidos conceptuales: ${conGen.conceptuales.slice(0, 5).join(", ")}`);
  }

  lines.push("---");
  return lines.join("\n") + "\n";
}
