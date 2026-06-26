import { useEffect, useMemo, useState } from "react";
import { guardarRegistroCalificaciones, obtenerRegistroCalificaciones } from "./firebase";
import { useAuth } from "./context/AuthContext.jsx";
import "./RegistroPage.css";

const DIAS = ["L", "M", "I", "J", "V"];
const ESTADOS_ASISTENCIA = ["", "P", "A", "T", "E"];

const MESES_ESCOLAR = [
  "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
];

// 5 semanas × 5 días por mes
const crearMesVacio = () => Array.from({ length: 5 }, () => Array(5).fill(""));

const calcAsistenciaMes = (semanas) => {
  const flat = semanas.flat();
  const total    = flat.filter((x) => x !== "").length;
  const excusas  = flat.filter((x) => x === "E").length;
  // 2 excusas = 1 P
  const presentes = flat.filter((x) => x === "P").length + Math.floor(excusas / 2);
  const pct = total > 0 ? Math.round((presentes / total) * 100) : null;
  return { presentes, excusas, total, pct };
};

const estudiantesFallback = [
  { id: 1, nombre: "Juan Pérez" },
  { id: 2, nombre: "María Rodríguez" },
  { id: 3, nombre: "Pedro Gómez" },
  { id: 4, nombre: "Katherin Romero" },
  { id: 5, nombre: "Carlos Méndez" },
  { id: 6, nombre: "Fernanda Lozano" },
];

const competenciasFallback = [
  {
    nombre: "Competencia 1",
    periodos: [
      { p: 74, rp: 82 },
      { p: 78, rp: 85 },
      { p: 80, rp: 88 },
      { p: 84, rp: 90 },
    ],
  },
  {
    nombre: "Competencia 2",
    periodos: [
      { p: 68, rp: 76 },
      { p: 72, rp: 80 },
      { p: 76, rp: 83 },
      { p: 79, rp: 86 },
    ],
  },
  {
    nombre: "Competencia 3",
    periodos: [
      { p: 83, rp: 86 },
      { p: 86, rp: 88 },
      { p: 87, rp: 90 },
      { p: 90, rp: 92 },
    ],
  },
  {
    nombre: "Competencia 4",
    periodos: [
      { p: 58, rp: 66 },
      { p: 64, rp: 71 },
      { p: 69, rp: 77 },
      { p: 73, rp: 81 },
    ],
  },
];

function promedio(nums) {
  const valores = nums.filter((n) => typeof n === "number" && !Number.isNaN(n));
  if (!valores.length) return 0;
  return Math.round(valores.reduce((a, b) => a + b, 0) / valores.length);
}

function clasificarEstado(valor) {
  if (valor >= 70) return "Aprobado";
  if (valor >= 60) return "En recuperación";
  return "Reprobado";
}

function badgeClase(valor) {
  if (valor === "P") return "presente";
  if (valor === "A") return "ausente";
  if (valor === "T") return "tardanza";
  if (valor === "E") return "excusa";
  return "vacio";
}

const COMP_CODIGOS = {
  "Matemática": ["CM-1","CM-2","CM-3","CM-4"],
  "Lengua Española": ["CE-LEI1","CE-LEI2","CE-LEI3","CE-LEI4"],
  "Ciencias Naturales": ["CCN-1","CCN-2","CCN-3","CCN-4"],
  "Ciencias Sociales": ["CCS-1","CCS-2","CCS-3","CCS-4"],
  "Educación Física": ["CEF-1","CEF-2","CEF-3","CEF-4"],
  "Inglés": ["CI-1","CI-2","CI-3","CI-4"],
  "Formación Humana": ["CFH-1","CFH-2","CFH-3","CFH-4"],
};

function crearNotasVacias() {
  return {
    competencias: Array.from({ length: 4 }, () => ({
      periodos: Array.from({ length: 4 }, () => ({ p: "", rp: "" })),
    })),
    ceCompletiva: "",
    ceExtraordinaria: "",
  };
}

function calcularResumenEstudiante(notas) {
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

function RegistroPage({
  onVolver,
  curso,
  estudiantesCurso = [],
}) {
  const { formulario } = useAuth();
  const cursoNombre = curso?.nombre || "Curso";
  const centro = curso?.centro || formulario.centro || "Pendiente de completar";
  const grado = curso?.grado || "";
  const seccion = curso?.seccion || "";
  const area = curso?.area || "";
  const docente = curso?.docente || formulario.nombreDocente || "Pendiente de completar";
  const mes = curso?.mes || new Date().toLocaleDateString("es-DO", { month: "long" });
  const periodo = curso?.periodo || "";
  const anioEscolar = curso?.anioEscolar || formulario.periodo || "Pendiente de completar";

  const estudiantes = useMemo(() => {
    if (estudiantesCurso.length > 0) return estudiantesCurso;
    if (curso?.estudiantesDetalle?.length) return curso.estudiantesDetalle;
    if (curso?.estudiantes?.length) return curso.estudiantes;
    return estudiantesFallback;
  }, [curso, estudiantesCurso]);

  const [tabActiva, setTabActiva] = useState("Resumen");
  const [periodoActivo] = useState("Periodo 1");
  const [mesActivo, setMesActivo] = useState("Agosto");
  const [asistencia, setAsistencia] = useState(
    estudiantes.map((est) => ({
      id: est.id,
      nombre: est.nombre,
      meses: Object.fromEntries(MESES_ESCOLAR.map((m) => [m, crearMesVacio()])),
    }))
  );
  const competencias = competenciasFallback;
  const [observaciones, setObservaciones] = useState({});
  const [notasEstudiantes, setNotasEstudiantes] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [mensajeGuardado, setMensajeGuardado] = useState(null);

  const cursoId = curso?.id || "sin-id";

  // Cargar registro guardado al abrir
  useEffect(() => {
    if (!cursoId || cursoId === "sin-id") return;
    obtenerRegistroCalificaciones(cursoId)
      .then(({ data }) => {
        if (!data) return;
        if (data.notasEstudiantes) setNotasEstudiantes(data.notasEstudiantes);
        if (data.asistencia)       setAsistencia(data.asistencia);
        if (data.observaciones)    setObservaciones(data.observaciones);
      })
      .catch(() => {});
  }, [cursoId]);

  const codigosComp = COMP_CODIGOS[area] || ["CE-1","CE-2","CE-3","CE-4"];

  const getNotasEstudiante = (id) => notasEstudiantes[id] ?? crearNotasVacias();

  const actualizarNotaEstudiante = (estId, compIdx, periodoIdx, campo, valor) => {
    setNotasEstudiantes((prev) => {
      const actual = prev[estId] ?? crearNotasVacias();
      return {
        ...prev,
        [estId]: {
          ...actual,
          competencias: actual.competencias.map((comp, ci) =>
            ci !== compIdx ? comp : {
              ...comp,
              periodos: comp.periodos.map((per, pi) =>
                pi !== periodoIdx ? per : { ...per, [campo]: valor }
              ),
            }
          ),
        },
      };
    });
  };

  const actualizarExtraEstudiante = (estId, campo, valor) => {
    setNotasEstudiantes((prev) => {
      const actual = prev[estId] ?? crearNotasVacias();
      return { ...prev, [estId]: { ...actual, [campo]: valor } };
    });
  };

  const resumen = useMemo(() => {
    const asistenciaGeneral = promedio(
      asistencia.map((e) => {
        const todos = MESES_ESCOLAR.flatMap((m) => (e.meses?.[m] ?? crearMesVacio()).flat());
        const total    = todos.filter((x) => x !== "").length;
        const excusas  = todos.filter((x) => x === "E").length;
        const presentes = todos.filter((x) => x === "P").length + Math.floor(excusas / 2);
        return total > 0 ? Math.round((presentes / total) * 100) : null;
      }).filter((v) => v !== null)
    );

    const cfs = estudiantes.map((est) => {
      const notas = notasEstudiantes[est.id] ?? crearNotasVacias();
      return calcularResumenEstudiante(notas).cf;
    }).filter((cf) => cf > 0);

    const promedioGrupo = cfs.length
      ? Math.round(cfs.reduce((a, b) => a + b, 0) / cfs.length)
      : 0;

    const aprobados      = cfs.filter((cf) => cf >= 70).length;
    const enRiesgo       = cfs.filter((cf) => cf > 0 && cf < 70).length;
    const conNotas       = cfs.length;

    return {
      asistenciaGeneral,
      promedioCompetencias: promedioGrupo,
      estadoGeneral: clasificarEstado(promedioGrupo),
      aprobados,
      enRiesgo,
      conNotas,
    };
  }, [asistencia, notasEstudiantes, estudiantes]);

  const actualizarAsistencia = (estudianteId, mes, semanaIdx, diaIdx, valor) => {
    setAsistencia((prev) =>
      prev.map((est) => {
        if (est.id !== estudianteId) return est;
        const nuevosMeses = { ...est.meses };
        nuevosMeses[mes] = est.meses[mes].map((sem, si) =>
          si !== semanaIdx ? sem : sem.map((d, di) => (di !== diaIdx ? d : valor))
        );
        return { ...est, meses: nuevosMeses };
      })
    );
  };

  const actualizarObservacion = (estudianteId, texto) => {
    setObservaciones((prev) => ({
      ...prev,
      [estudianteId]: texto,
    }));
  };

  const handleGuardar = async () => {
    setGuardando(true);
    setMensajeGuardado(null);
    try {
      await guardarRegistroCalificaciones({
        cursoId,
        area,
        grado,
        seccion,
        anioEscolar,
        nivel: "secundaria",
        notasEstudiantes,
        asistencia,
        observaciones,
      });
      setMensajeGuardado({ tipo: "ok", texto: "✅ Registro guardado correctamente." });
    } catch {
      setMensajeGuardado({ tipo: "error", texto: "❌ Error al guardar. Intenta de nuevo." });
    } finally {
      setGuardando(false);
      setTimeout(() => setMensajeGuardado(null), 4000);
    }
  };

  const exportarExcel = () => {
    const rows = [];
    rows.push([`Registro de Calificaciones — ${area} — ${cursoNombre} — ${anioEscolar}`]);
    rows.push([`Docente: ${docente}`, "", `Centro: ${centro}`]);
    rows.push([]);
    const periodoLabels = codigosComp.flatMap((cod) =>
      ["P1","RP1","P2","RP2","P3","RP3","P4","RP4"].map((p) => `${cod}·${p}`)
    );
    rows.push(["N°", "Estudiante", ...periodoLabels, "PC1","PC2","PC3","PC4","C.F.","Situación"]);
    estudiantes.forEach((est, idx) => {
      const notas = getNotasEstudiante(est.id);
      const { compAvgs, cfExacto, situacion } = calcularResumenEstudiante(notas);
      const celdas = notas.competencias.flatMap((comp) =>
        comp.periodos.flatMap((per) => [per.p ?? "", per.rp ?? ""])
      );
      rows.push([
        idx + 1, est.nombre, ...celdas,
        ...compAvgs.map((a) => (a > 0 ? a.toFixed(1) : "")),
        cfExacto > 0 ? cfExacto.toFixed(2) : "",
        situacion === "—" ? "" : situacion,
      ]);
    });
    const csv = rows
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Registro_${area}_${cursoNombre}_${anioEscolar}.csv`.replace(/\s+/g, "_");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportarPDF = () => {
    const compHeaders = codigosComp
      .map((cod, ci) => `<th colspan="8" class="comp-h c${ci + 1}-h">C${ci + 1} · ${cod}</th>`)
      .join("");
    const subHeaders = codigosComp
      .flatMap(() => ["P1","RP1","P2","RP2","P3","RP3","P4","RP4"].map((p) =>
        `<th class="tc ${p.startsWith("R") ? "rp" : "p"}">${p}</th>`
      ))
      .join("");
    const bodyHTML = estudiantes.map((est, idx) => {
      const notas = getNotasEstudiante(est.id);
      const { compAvgs, cfExacto, cf, situacion } = calcularResumenEstudiante(notas);
      const celdas = notas.competencias.flatMap((comp, ci) =>
        comp.periodos.flatMap((per) => {
          const pVal = Number(per.p) || 0;
          return [
            `<td class="tc c${ci + 1}">${per.p || ""}</td>`,
            `<td class="tc rp-cell c${ci + 1}">${pVal >= 70 ? "✓" : (per.rp || "")}</td>`,
          ];
        })
      ).join("");
      const avgCells = compAvgs
        .map((a, ci) => `<td class="tc p${ci + 1}avg">${a > 0 ? a.toFixed(1) : "—"}</td>`)
        .join("");
      const cfHTML = cfExacto > 0
        ? `<span class="cf-d">${cfExacto.toFixed(2)}</span><span class="cf-e ${cf >= 70 ? "ok" : "risk"}">${cf}</span>`
        : "—";
      const est2 = situacion === "—" ? "" : situacion;
      const eClass = situacion === "Aprobado" ? "ok" : situacion === "—" ? "" : "risk";
      return `<tr>
        <td class="tc num">${idx + 1}</td>
        <td class="tnombre">${est.nombre}</td>
        ${celdas}${avgCells}
        <td class="tc cf-cell">${cfHTML}</td>
        <td class="tc estado ${eClass}">${est2}</td>
      </tr>`;
    }).join("");

    const css = `
      *{box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:8.5px;margin:14px;color:#111}
      h1{font-size:13px;margin:0 0 3px;color:#1d4ed8}
      h2{font-size:10px;margin:0 0 2px;color:#374151;font-weight:400}
      .meta{display:flex;gap:18px;margin:6px 0 10px;font-size:9px;color:#64748b}
      table{border-collapse:collapse;width:100%}
      th,td{border:1px solid #cbd5e1;padding:2px 3px}
      th{background:#1d4ed8;color:#fff;font-size:7.5px;text-align:center}
      .c1-h{background:#1d4ed8}.c2-h{background:#7c3aed}
      .c3-h{background:#059669}.c4-h{background:#d97706}
      .tc{text-align:center}
      .tnombre{min-width:110px;font-weight:600;font-size:8px}
      .num{width:20px}
      .rp-cell{background:#fefce8}
      .p{background:#eff6ff}.rp{background:#fef9c3}
      .p1avg{color:#1d4ed8;font-weight:700}.p2avg{color:#7c3aed;font-weight:700}
      .p3avg{color:#059669;font-weight:700}.p4avg{color:#d97706;font-weight:700}
      .cf-cell{background:#e0f2fe;text-align:center}
      .cf-d{display:block;font-size:6.5px;color:#64748b}
      .cf-e{display:block;font-size:10px;font-weight:900}
      .ok{color:#15803d}.risk{color:#be123c}
      .estado.ok{background:#dcfce7;font-weight:700}
      .estado.risk{background:#fee2e2;font-weight:700}
      @page{size:landscape;margin:10mm}
      @media print{body{margin:0}}
    `;

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
      <title>Registro · ${area} · ${cursoNombre}</title>
      <style>${css}</style></head><body>
      <h1>Registro de Calificaciones — ${area}</h1>
      <h2>${centro}</h2>
      <div class="meta">
        <span><b>Grado / Sección:</b> ${grado} ${seccion}</span>
        <span><b>Docente:</b> ${docente}</span>
        <span><b>Año escolar:</b> ${anioEscolar}</span>
      </div>
      <table><thead>
        <tr>
          <th rowspan="2">N°</th>
          <th rowspan="2" style="min-width:110px">ESTUDIANTE</th>
          ${compHeaders}
          <th colspan="4" style="background:#0369a1">PROMEDIOS</th>
          <th rowspan="2" style="background:#0369a1">C.F.</th>
          <th rowspan="2" style="background:#374151">SITUACIÓN</th>
        </tr>
        <tr>${subHeaders}
          <th class="tc p1avg">PC1</th><th class="tc p2avg">PC2</th>
          <th class="tc p3avg">PC3</th><th class="tc p4avg">PC4</th>
        </tr>
      </thead><tbody>${bodyHTML}</tbody></table>
      <script>window.onload=()=>window.print()</script>
      </body></html>`;

    const win = window.open("", "_blank");
    if (!win) { alert("Permite ventanas emergentes para exportar el PDF."); return; }
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="registro-page">
      <section className="registro-hero">
        <div className="registro-hero-copy">
          <p className="registro-kicker">📋 DocenteOS · Registro de Grado</p>
          <h1>{cursoNombre}</h1>
          <p className="registro-subtitle">
            {area} · {grado} {seccion} · {anioEscolar}
          </p>

          <div className="registro-hero-meta">
            <span>🏫 {centro}</span>
            <span>👤 {docente}</span>
            <span>📅 {mes} · Período {periodo}</span>
          </div>

          <div className="registro-hero-actions">
            <button type="button" className="rh-btn-secondary" onClick={onVolver}>← Volver</button>
            <button type="button" className="rh-btn-primary" onClick={handleGuardar} disabled={guardando}>
              {guardando ? "⏳ Guardando..." : "💾 Guardar"}
            </button>
            <button type="button" className="rh-btn-primary" onClick={exportarPDF}>📥 PDF</button>
            <button type="button" className="rh-btn-primary" onClick={exportarExcel}>📊 Excel</button>
            <button type="button" className="rh-btn-ghost" onClick={() => window.print()}>🖨 Imprimir</button>
          </div>
          {mensajeGuardado && (
            <div className={`registro-msg-guardado ${mensajeGuardado.tipo}`}>
              {mensajeGuardado.texto}
            </div>
          )}
        </div>

        <div className="registro-hero-kpis">
          <article className="registro-kpi-card">
            <span className="registro-kpi-icon" aria-hidden="true">📅</span>
            <strong>{resumen.asistenciaGeneral}%</strong>
            <small>Asistencia general</small>
          </article>
          <article className="registro-kpi-card">
            <span className="registro-kpi-icon" aria-hidden="true">📊</span>
            <strong>{resumen.promedioCompetencias}%</strong>
            <small>Promedio competencias</small>
          </article>
          <article className={`registro-kpi-card ${resumen.estadoGeneral === "Aprobado" ? "kpi-ok" : resumen.estadoGeneral === "En recuperación" ? "kpi-warn" : "kpi-risk"}`}>
            <span className="registro-kpi-icon" aria-hidden="true">
              {resumen.estadoGeneral === "Aprobado" ? "✅" : resumen.estadoGeneral === "En recuperación" ? "⚠️" : "🚨"}
            </span>
            <strong>{resumen.estadoGeneral}</strong>
            <small>Estado del grupo</small>
          </article>
          <article className="registro-kpi-card">
            <span className="registro-kpi-icon" aria-hidden="true">🗓</span>
            <strong>{periodoActivo.replace("Periodo ", "P")}</strong>
            <small>Período activo</small>
          </article>
        </div>
      </section>

      <section className="registro-tabs">
        {["Asistencia", "Competencias", "Indicadores", "Calificaciones", "Resumen"].map((tab) => (
          <button
            key={tab}
            type="button"
            className={tabActiva === tab ? "active" : ""}
            onClick={() => setTabActiva(tab)}
          >
            {tab}
          </button>
        ))}
      </section>

      {tabActiva === "Resumen" && (
        <section className="registro-panel">
          {/* ── Estadísticas del grupo ── */}
          <div className="rs-stats-row">
            <div className="rs-stat-card rs-stat-ok">
              <strong>{resumen.aprobados}</strong>
              <span>Aprobados</span>
            </div>
            <div className="rs-stat-card rs-stat-risk">
              <strong>{resumen.enRiesgo}</strong>
              <span>En riesgo / No aprobados</span>
            </div>
            <div className="rs-stat-card">
              <strong>{resumen.promedioCompetencias > 0 ? resumen.promedioCompetencias : "—"}</strong>
              <span>Promedio del grupo</span>
            </div>
            <div className="rs-stat-card">
              <strong>{resumen.asistenciaGeneral}%</strong>
              <span>Asistencia general</span>
            </div>
            <div className="rs-stat-card">
              <strong>{resumen.conNotas} / {estudiantes.length}</strong>
              <span>Con calificaciones</span>
            </div>
          </div>

          {/* ── Tabla resumen por estudiante ── */}
          <div className="registro-section-head" style={{ marginTop: "24px" }}>
            <h2>Resumen por estudiante</h2>
            <p>C.F. calculada a partir de las notas ingresadas en la pestaña Calificaciones.</p>
          </div>
          <div className="registro-table-scroll">
            <table className="registro-table rs-tabla-resumen">
              <thead>
                <tr>
                  <th className="sticky-col">N.º</th>
                  <th className="sticky-name">Estudiante</th>
                  <th>PC1</th>
                  <th>PC2</th>
                  <th>PC3</th>
                  <th>PC4</th>
                  <th>C.F.</th>
                  <th>Situación</th>
                  <th>Observación</th>
                </tr>
              </thead>
              <tbody>
                {estudiantes.map((est, idx) => {
                  const notas = notasEstudiantes[est.id] ?? crearNotasVacias();
                  const r = calcularResumenEstudiante(notas);
                  const estadoKey = r.situacion.toLowerCase().replace(/\s/g, "-");
                  return (
                    <tr key={est.id}>
                      <td className="sticky-col">{idx + 1}</td>
                      <td className="sticky-name">{est.nombre}</td>
                      {r.compAvgs.map((avg, ci) => (
                        <td key={ci} className={avg >= 70 ? "rs-nota-ok" : avg > 0 ? "rs-nota-risk" : ""}>
                          {avg > 0 ? avg.toFixed(1) : "—"}
                        </td>
                      ))}
                      <td className="rs-cf-cell">
                        {r.cfExacto > 0 ? (
                          <span className="rg-cf-formula">
                            <span className="rg-cf-decimal">{r.cfExacto.toFixed(2)}</span>
                            <span className={`rg-cf-entero ${r.cf >= 70 ? "nota-ok" : "nota-riesgo"}`}>{r.cf}</span>
                          </span>
                        ) : "—"}
                      </td>
                      <td className={`rs-situacion rs-estado-${estadoKey}`}>{r.situacion}</td>
                      <td>
                        <input
                          type="text"
                          className="rs-obs-input"
                          placeholder="Observación..."
                          value={observaciones[est.id] || ""}
                          onChange={(e) => actualizarObservacion(est.id, e.target.value)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tabActiva === "Asistencia" && (
        <section className="registro-panel">
          {/* ── Selector de mes ── */}
          <div className="asist-meses-tabs">
            {MESES_ESCOLAR.map((mes) => {
              const totals = asistencia.map((e) =>
                calcAsistenciaMes(e.meses?.[mes] ?? crearMesVacio())
              );
              const hayDatos = totals.some((t) => t.total > 0);
              return (
                <button
                  key={mes}
                  type="button"
                  className={`asist-mes-btn${mesActivo === mes ? " active" : ""}${hayDatos ? " con-datos" : ""}`}
                  onClick={() => setMesActivo(mes)}
                >
                  {mes}
                </button>
              );
            })}
          </div>

          {/* ── Tabla del mes activo ── */}
          <div className="registro-table-scroll">
            <table className="registro-table asistencia-table asist-mes-tabla">
              <thead>
                <tr>
                  <th rowSpan={2} className="sticky-col">N.º</th>
                  <th rowSpan={2} className="sticky-name">Alumno/a</th>
                  {Array.from({ length: 5 }, (_, si) => (
                    <th key={si} colSpan={5} className={`semana semana-${si + 1}`}>
                      Semana {si + 1}
                    </th>
                  ))}
                  <th rowSpan={2} className="asist-th-total">TOTAL</th>
                  <th rowSpan={2} className="asist-th-pct">%</th>
                </tr>
                <tr>
                  {Array.from({ length: 5 }, (_, si) =>
                    DIAS.map((dia) => (
                      <th key={`${si}-${dia}`} className={`dia-header semana-${si + 1}`}>{dia}</th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {asistencia.map((est, idx) => {
                  const semanas = est.meses?.[mesActivo] ?? crearMesVacio();
                  const { presentes, total, pct } = calcAsistenciaMes(semanas);
                  return (
                    <tr key={est.id}>
                      <td className="sticky-col">{idx + 1}</td>
                      <td className="sticky-name">{est.nombre}</td>
                      {semanas.map((sem, si) =>
                        sem.map((val, di) => (
                          <td key={`${est.id}-${si}-${di}`} className={`asist-celda semana-${si + 1}`}>
                            <select
                              className={`asistencia-select ${badgeClase(val)}`}
                              value={val}
                              onChange={(e) => actualizarAsistencia(est.id, mesActivo, si, di, e.target.value)}
                            >
                              {ESTADOS_ASISTENCIA.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </td>
                        ))
                      )}
                      <td className="asist-td-total">{total > 0 ? presentes : "—"}</td>
                      <td className={`asist-td-pct${pct !== null ? (pct >= 85 ? " pct-ok" : pct >= 70 ? " pct-warn" : " pct-risk") : ""}`}>
                        {pct !== null ? pct : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="registro-leyenda">
            <span><i className="verde" />P · Presente</span>
            <span><i className="rojo" />A · Ausente</span>
            <span><i className="amarillo" />T · Tardanza</span>
            <span><i className="azul" />E · Excusa</span>
            <span style={{ color: "#94a3b8" }}>TOTAL y % · 2 excusas equivalen a 1 día presente</span>
          </div>
        </section>
      )}

      {tabActiva === "Competencias" && (
        <section className="registro-panel">
          <div className="registro-section-head">
            <h2>Promedios por competencia</h2>
            <p>Promedio del grupo en cada período por competencia específica — {area}.</p>
          </div>

          <div className="registro-table-scroll">
            <table className="registro-table rs-tabla-comp">
              <thead>
                <tr>
                  <th>Competencia</th>
                  <th>P1 (prom.)</th>
                  <th>P2 (prom.)</th>
                  <th>P3 (prom.)</th>
                  <th>P4 (prom.)</th>
                  <th>PC (prom. grupo)</th>
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2, 3].map((ci) => {
                  const codigo = codigosComp[ci] || `CE-${ci + 1}`;
                  // Promedio del grupo por período para esta competencia
                  const promsPorPeriodo = [0, 1, 2, 3].map((pi) => {
                    const vals = estudiantes.map((est) => {
                      const notas = notasEstudiantes[est.id] ?? crearNotasVacias();
                      const per = notas.competencias[ci]?.periodos[pi];
                      if (!per) return 0;
                      const p  = Number(per.p)  || 0;
                      const rp = Number(per.rp) || 0;
                      return p >= 70 ? p : rp > 0 ? rp : p;
                    }).filter((v) => v > 0);
                    return vals.length
                      ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
                      : null;
                  });
                  const pcValidos = promsPorPeriodo.filter((v) => v !== null);
                  const pcProm = pcValidos.length
                    ? Math.round((pcValidos.reduce((a, b) => a + b, 0) / pcValidos.length) * 10) / 10
                    : null;
                  return (
                    <tr key={ci}>
                      <td className="rs-comp-label">
                        <span className={`rs-comp-badge rs-comp-badge-${ci + 1}`}>C{ci + 1}</span>
                        {codigo}
                      </td>
                      {promsPorPeriodo.map((v, pi) => (
                        <td key={pi} className={v !== null ? (v >= 70 ? "rs-nota-ok" : "rs-nota-risk") : ""}>
                          {v !== null ? v.toFixed(1) : "—"}
                        </td>
                      ))}
                      <td className={`rs-cf-cell ${pcProm !== null ? (pcProm >= 70 ? "rs-nota-ok" : "rs-nota-risk") : ""}`}>
                        <strong>{pcProm !== null ? pcProm.toFixed(1) : "—"}</strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="rs-nota-pie">
            * Los promedios se calculan sobre los estudiantes que ya tienen nota ingresada en la pestaña Calificaciones.
            P = nota del período · RP se usa cuando P &lt; 70.
          </p>
        </section>
      )}

      {tabActiva === "Indicadores" && (() => {
        const filas = estudiantes.map((est) => {
          const notas = notasEstudiantes[est.id] ?? crearNotasVacias();
          return { est, ...calcularResumenEstudiante(notas) };
        });
        const conNotas   = filas.filter((f) => f.cf > 0);
        const aprobados  = conNotas.filter((f) => f.situacion === "Aprobado");
        const completiva = conNotas.filter((f) => f.situacion === "Completiva");
        const extraord   = conNotas.filter((f) => f.situacion === "Extraordinaria");
        const reprobados = conNotas.filter((f) => f.reprobado);
        const enRiesgo   = conNotas.filter((f) => f.cf > 0 && f.cf < 70 && f.situacion !== "Completiva" && f.situacion !== "Extraordinaria");

        return (
          <section className="registro-panel">
            <div className="registro-section-head">
              <h2>Situación del grupo</h2>
              <p>Seguimiento real basado en las calificaciones ingresadas · {conNotas.length} de {estudiantes.length} estudiantes con notas.</p>
            </div>

            <div className="rs-indicadores-grid">
              <article className="rs-ind-card rs-ind-ok">
                <strong>{aprobados.length}</strong>
                <span>Aprobados directamente</span>
                <small>C.F. ≥ 70</small>
              </article>
              <article className="rs-ind-card rs-ind-comp">
                <strong>{completiva.length}</strong>
                <span>Aprobaron completiva</span>
                <small>C.C.F. ≥ 70</small>
              </article>
              <article className="rs-ind-card rs-ind-extra">
                <strong>{extraord.length}</strong>
                <span>Aprobaron extraordinaria</span>
                <small>C.EX.F. ≥ 70</small>
              </article>
              <article className="rs-ind-card rs-ind-risk">
                <strong>{reprobados.length}</strong>
                <span>Reprobados</span>
                <small>No aprobaron ninguna instancia</small>
              </article>
            </div>

            {enRiesgo.length > 0 && (
              <div className="rs-en-riesgo">
                <h3>⚠️ Estudiantes en riesgo (C.F. &lt; 70)</h3>
                <div className="rs-riesgo-lista">
                  {enRiesgo.map(({ est, cf, ccf }) => (
                    <div key={est.id} className="rs-riesgo-item">
                      <span className="rs-riesgo-nombre">{est.nombre}</span>
                      <span className="rs-riesgo-cf">C.F. {cf}</span>
                      {ccf > 0 && <span className="rs-riesgo-ccf">C.C.F. {ccf}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {conNotas.length === 0 && (
              <p className="rs-nota-pie" style={{ marginTop: "24px" }}>
                Aún no hay notas ingresadas. Ve a la pestaña <strong>Calificaciones</strong> para comenzar a registrar.
              </p>
            )}
          </section>
        );
      })()}

      {tabActiva === "Calificaciones" && (
  <section className="registro-panel rg-panel">
    <div className="registro-section-head">
      <h2>Calificaciones por Competencias</h2>
      <p>Registro Oficial MINERD — {area} · {cursoNombre}</p>
    </div>
    <div className="rg-scroll-wrapper">
      <table className="rg-table">
        <thead>
          <tr>
            <th rowSpan={3} className="rg-th rg-th-fixed rg-th-num">N.º</th>
            <th rowSpan={3} className="rg-th rg-th-fixed rg-th-nombre">ESTUDIANTE</th>
            <th colSpan={32} className="rg-th rg-th-section rg-section-comp">COMPETENCIAS ESPECÍFICAS</th>
            <th colSpan={5}  className="rg-th rg-th-section rg-section-prom">PROMEDIO DE COMPETENCIAS ESPECÍFICAS</th>
            <th colSpan={4}  className="rg-th rg-th-section rg-section-completiva">CALIFICACIÓN COMPLETIVA</th>
            <th colSpan={4}  className="rg-th rg-th-section rg-section-extra">CALIFICACIÓN EXTRAORDINARIA</th>
            <th colSpan={2}  className="rg-th rg-th-section rg-section-especial">CALIFICACIONES ESPECIALES</th>
            <th colSpan={3}  className="rg-th rg-th-section rg-section-situacion">SITUACIÓN FINAL EN LA ASIGNATURA</th>
          </tr>
          <tr>
            {codigosComp.map((codigo, ci) => (
              <th key={`ch-${ci}`} colSpan={8} className={`rg-th rg-th-comp rg-comp-${ci + 1}`}>
                <span className="rg-comp-num">C{ci + 1}</span>
                <span className="rg-comp-code">{codigo}</span>
                <span className="rg-comp-name">{competencias[ci]?.nombre || `Competencia ${ci + 1}`}</span>
              </th>
            ))}
            <th className="rg-th rg-th-prom">C1</th>
            <th className="rg-th rg-th-prom">C2</th>
            <th className="rg-th rg-th-prom">C3</th>
            <th className="rg-th rg-th-prom">C4</th>
            <th className="rg-th rg-th-prom rg-th-cf-col">C.F.</th>
            <th className="rg-th rg-th-completiva">50% C.F.</th>
            <th className="rg-th rg-th-completiva">C.E.C.</th>
            <th className="rg-th rg-th-completiva">50% C.E.C.</th>
            <th className="rg-th rg-th-completiva rg-th-cf-col">C.C.F.</th>
            <th className="rg-th rg-th-extra">30% C.F.</th>
            <th className="rg-th rg-th-extra">C.E.EX.</th>
            <th className="rg-th rg-th-extra">70% C.E.EX.</th>
            <th className="rg-th rg-th-extra rg-th-cf-col">C.EX.F.</th>
            <th className="rg-th rg-th-especial">C.F.</th>
            <th className="rg-th rg-th-especial">C.E.</th>
            <th className="rg-th rg-th-situacion">A</th>
            <th className="rg-th rg-th-situacion">R</th>
            <th className="rg-th rg-th-situacion">Estado</th>
          </tr>
          <tr>
            {[0,1,2,3].flatMap((ci) =>
              ["P1","RP1","P2","RP2","P3","RP3","P4","RP4"].map((p) => (
                <th key={`ph-${ci}-${p}`} className={`rg-th rg-th-periodo ${p.startsWith("RP") ? "rg-th-rp" : "rg-th-p"}`}>{p}</th>
              ))
            )}
            {Array.from({ length: 18 }, (_, i) => (
              <th key={`e-${i}`} className="rg-th rg-th-empty"> </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {estudiantes.map((est, rowIdx) => {
            const notas = getNotasEstudiante(est.id);
            const { compAvgs, cfExacto, cf, ccf, cexf, necesitaComp, necesitaExtra, situacion, aprobado, reprobado } =
              calcularResumenEstudiante(notas);

            const ceComp   = Number(notas.ceCompletiva)     || 0;
            const ceExtra  = Number(notas.ceExtraordinaria) || 0;
            const cfDisplay = cf >= 70 ? cf : ccf >= 70 ? ccf : cexf >= 70 ? cexf : cf || 0;
            const ceDisplay = cf >= 70 ? 0  : ccf >= 70 ? ceComp : cexf >= 70 ? ceExtra : 0;
            const p50cf    = cf > 0     ? Math.round(cf * 0.5)      : 0;
            const p50cec   = ceComp > 0 ? Math.round(ceComp * 0.5)  : 0;
            const p30cf    = cf > 0     ? Math.round(cf * 0.3)      : 0;
            const p70ceex  = ceExtra > 0 ? Math.round(ceExtra * 0.7) : 0;
            const estadoKey = situacion.toLowerCase().replace(/\s/g, "-");

            return (
              <tr key={est.id} className={rowIdx % 2 === 0 ? "rg-row-even" : "rg-row-odd"}>
                <td className="rg-td rg-td-fixed rg-td-num">{rowIdx + 1}</td>
                <td className="rg-td rg-td-fixed rg-td-nombre">{est.nombre}</td>

                {notas.competencias.flatMap((comp, ci) =>
                  comp.periodos.flatMap((per, pi) => {
                    const pVal = Number(per.p) || 0;
                    const rpOk = pVal >= 70;
                    return [
                      <td key={`${est.id}-c${ci}p${pi}-p`} className={`rg-td rg-td-nota rg-comp-bg-${ci+1}`}>
                        <input type="number" min="0" max="100" value={per.p}
                          onChange={(e) => actualizarNotaEstudiante(est.id, ci, pi, "p", e.target.value)}
                          className="rg-input-nota" />
                      </td>,
                      <td key={`${est.id}-c${ci}p${pi}-rp`} className={`rg-td rg-td-nota ${rpOk ? "rg-td-rp-ok" : "rg-td-rp-pend"} rg-comp-bg-${ci+1}`}>
                        {rpOk
                          ? <span className="rg-rp-ok">✓</span>
                          : <input type="number" min="0" max="100" value={per.rp}
                              onChange={(e) => actualizarNotaEstudiante(est.id, ci, pi, "rp", e.target.value)}
                              className="rg-input-nota rg-input-rp" />
                        }
                      </td>,
                    ];
                  })
                )}

                {compAvgs.map((avg, ci) => (
                  <td key={`avg-${ci}`} className="rg-td rg-td-prom">
                    <strong className={avg >= 70 ? "nota-ok" : avg > 0 ? "nota-riesgo" : ""}>
                      {avg > 0 ? avg.toFixed(1) : "—"}
                    </strong>
                  </td>
                ))}
                <td className="rg-td rg-td-cf-cell">
                  {cfExacto > 0 ? (
                    <span className="rg-cf-formula">
                      <span className="rg-cf-decimal">{cfExacto.toFixed(2)}</span>
                      <span className={`rg-cf-entero ${cf >= 70 ? "nota-ok" : "nota-riesgo"}`}>{cf}</span>
                    </span>
                  ) : "—"}
                </td>

                <td className="rg-td rg-td-completiva">{p50cf > 0 ? p50cf : "—"}</td>
                <td className="rg-td rg-td-completiva">
                  {necesitaComp
                    ? <input type="number" min="0" max="100" value={notas.ceCompletiva}
                        onChange={(e) => actualizarExtraEstudiante(est.id, "ceCompletiva", e.target.value)}
                        className="rg-input-nota rg-input-extra" placeholder="—" />
                    : <span className="rg-na">—</span>}
                </td>
                <td className="rg-td rg-td-completiva">{p50cec > 0 ? p50cec : "—"}</td>
                <td className="rg-td rg-td-completiva rg-td-cf-cell">
                  <strong className={ccf >= 70 ? "nota-ok" : ccf > 0 ? "nota-riesgo" : ""}>{ccf > 0 ? ccf : "—"}</strong>
                </td>

                <td className="rg-td rg-td-extra">{p30cf > 0 ? p30cf : "—"}</td>
                <td className="rg-td rg-td-extra">
                  {necesitaExtra
                    ? <input type="number" min="0" max="100" value={notas.ceExtraordinaria}
                        onChange={(e) => actualizarExtraEstudiante(est.id, "ceExtraordinaria", e.target.value)}
                        className="rg-input-nota rg-input-extra" placeholder="—" />
                    : <span className="rg-na">—</span>}
                </td>
                <td className="rg-td rg-td-extra">{p70ceex > 0 ? p70ceex : "—"}</td>
                <td className="rg-td rg-td-extra rg-td-cf-cell">
                  <strong className={cexf >= 70 ? "nota-ok" : cexf > 0 ? "nota-riesgo" : ""}>{cexf > 0 ? cexf : "—"}</strong>
                </td>

                <td className="rg-td rg-td-especial">{cfDisplay > 0 ? cfDisplay : "—"}</td>
                <td className="rg-td rg-td-especial">{ceDisplay > 0 ? ceDisplay : "—"}</td>

                <td className="rg-td rg-td-situacion rg-td-check">{aprobado  ? "✓" : ""}</td>
                <td className="rg-td rg-td-situacion rg-td-check">{reprobado ? "✗" : ""}</td>
                <td className={`rg-td rg-td-situacion rg-td-estado rg-estado-${estadoKey}`}>{situacion}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    <div className="rg-leyenda">
      <span><b>P</b> = Nota del período</span>
      <span><b>RP</b> = Recuperación · solo si P &lt; 70</span>
      <span><b>C.F.</b> = Calificación final</span>
      <span><b>C.E.C.</b> = Examen completivo (si C.F. &lt; 70)</span>
      <span><b>C.E.EX.</b> = Examen extraordinario (si C.C.F. &lt; 70)</span>
      <span><b>✓ en RP</b> = Período aprobado sin recuperación</span>
    </div>
  </section>
)}

    </div>
  );
}

export default RegistroPage;
