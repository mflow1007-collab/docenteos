/**
 * Formulario específico para Plan Diario MINERD
 */

import { getAreas, getAsignaturas, getAsignaturaAutomatica, tieneMultiplesAsignaturas } from "../planning/areaAsignaturaMap.js";

const GRADOS = [
  { grado: "Pre-Kínder", nivel: "Inicial" }, { grado: "Kínder", nivel: "Inicial" }, { grado: "Preprimario", nivel: "Inicial" },
  { grado: "1ro Primaria", nivel: "Primaria" }, { grado: "2do Primaria", nivel: "Primaria" },
  { grado: "3ro Primaria", nivel: "Primaria" }, { grado: "4to Primaria", nivel: "Primaria" },
  { grado: "5to Primaria", nivel: "Primaria" }, { grado: "6to Primaria", nivel: "Primaria" },
  { grado: "1ro Secundaria", nivel: "Secundaria" }, { grado: "2do Secundaria", nivel: "Secundaria" },
  { grado: "3ro Secundaria", nivel: "Secundaria" }, { grado: "4to Secundaria", nivel: "Secundaria" },
  { grado: "5to Secundaria", nivel: "Secundaria" }, { grado: "6to Secundaria", nivel: "Secundaria" },
];

const SECCIONES = ["A", "B", "C", "D", "E", "F", "G"];

const AREAS = getAreas();

const DURACIONES = ["45 min", "50 min", "60 min", "75 min", "90 min", "2 períodos (90 min)"];

const COMPETENCIAS_FUNDAMENTALES = [
  "Comunicativa",
  "Pensamiento Lógico, Creativo y Crítico",
  "Resolución de Problemas",
  "Científica y Tecnológica",
  "Ambiental y de la Salud",
  "Desarrollo Personal y Espiritual",
  "Ética y Ciudadana",
];

const COMP_FUND_POR_AREA = {
  "Lenguas Extranjeras":                    ["Comunicativa", "Científica y Tecnológica"],
  "Lengua Española":                        ["Comunicativa", "Pensamiento Lógico, Creativo y Crítico"],
  "Matemática":                             ["Pensamiento Lógico, Creativo y Crítico", "Resolución de Problemas"],
  "Ciencias de la Naturaleza":              ["Científica y Tecnológica", "Ambiental y de la Salud"],
  "Ciencias Sociales":                      ["Ética y Ciudadana", "Ambiental y de la Salud"],
  "Educación Física":                       ["Desarrollo Personal y Espiritual", "Ambiental y de la Salud"],
  "Educación Artística":                    ["Comunicativa", "Desarrollo Personal y Espiritual"],
  "Formación Integral Humana y Religiosa":  ["Desarrollo Personal y Espiritual", "Ética y Ciudadana"],
  "Francés":                                ["Comunicativa", "Científica y Tecnológica"],
};

export default function FormularioPlanDiario({
  datos,
  onChange,
  onGenerar,
  cargando,
}) {
  const {
    grado = "", seccion = "", area = "", asignatura = "",
    fecha = "", duracion = "50 min", tema = "",
    nombreDocente = "", cedula = "", regional = "",
    distrito = "", centro = "", codigoCentro = "",
    nivel = "Secundaria", ciclo = "Primer Ciclo", modalidad = "Académica",
    jornada = "Extendida",
    indicadoresTexto = "",
    competenciaEspecificaTexto = "",
    situacionAprendizajeTexto = "",
    competenciasFundamentalesSeleccionadas = [],
  } = datos;

  const set = (campo) => (e) => onChange({ ...datos, [campo]: e.target.value });

  const toggleCompFund = (nombre) => {
    const actual = competenciasFundamentalesSeleccionadas || [];
    const siguiente = actual.includes(nombre)
      ? actual.filter((c) => c !== nombre)
      : [...actual, nombre];
    onChange({ ...datos, competenciasFundamentalesSeleccionadas: siguiente });
  };

  const handleAreaChange = (e) => {
    const nuevaArea = e.target.value;
    const preselect = COMP_FUND_POR_AREA[nuevaArea] || [];
    onChange({
      ...datos,
      area: nuevaArea,
      asignatura: getAsignaturaAutomatica(nuevaArea) || "",
      competenciasFundamentalesSeleccionadas: preselect,
    });
  };

  const puedoGenerar = grado && seccion && area && tema &&
    (!tieneMultiplesAsignaturas(area) || asignatura);

  return (
    <section className="planning-form-card pd-form">
      <h2>📋 Plan Diario — Datos de la Clase</h2>

      {/* ── Datos del docente ── */}
      <div className="pd-section-title">Docente y Centro</div>
      <div className="pd-grid-2">
        <div className="pd-field">
          <label>Nombre del docente</label>
          <input value={nombreDocente} onChange={set("nombreDocente")} placeholder="Nombre completo" />
        </div>
        <div className="pd-field">
          <label>Cédula</label>
          <input value={cedula} onChange={set("cedula")} placeholder="000-0000000-0" />
        </div>
        <div className="pd-field">
          <label>Regional</label>
          <input value={regional} onChange={set("regional")} placeholder="02 San Juan Oeste" />
        </div>
        <div className="pd-field">
          <label>Distrito</label>
          <input value={distrito} onChange={set("distrito")} placeholder="06" />
        </div>
        <div className="pd-field pd-field-full">
          <label>Centro educativo</label>
          <input value={centro} onChange={set("centro")} placeholder="Nombre del centro" />
        </div>
        <div className="pd-field">
          <label>Código del centro</label>
          <input value={codigoCentro} onChange={set("codigoCentro")} placeholder="00000" />
        </div>
        <div className="pd-field">
          <label>Nivel / Subsistema</label>
          <select value={nivel} onChange={set("nivel")}>
            <option value="Inicial">Inicial</option>
            <option value="Primaria">Primaria</option>
            <option value="Secundaria">Secundaria</option>
          </select>
        </div>
        <div className="pd-field">
          <label>Ciclo</label>
          <select value={ciclo} onChange={set("ciclo")}>
            <option value="Primer Ciclo">Primer Ciclo</option>
            <option value="Segundo Ciclo">Segundo Ciclo</option>
          </select>
        </div>
        <div className="pd-field">
          <label>Modalidad</label>
          <select value={modalidad} onChange={set("modalidad")}>
            <option value="Académica">Académica</option>
            <option value="Técnico Profesional">Técnico Profesional</option>
            <option value="En Artes">En Artes</option>
          </select>
        </div>
        <div className="pd-field">
          <label>Jornada escolar</label>
          <select value={jornada} onChange={set("jornada")}>
            <option value="Extendida">Jornada Extendida (40h/sem.)</option>
            <option value="Regular">Jornada Regular (30h/sem.)</option>
            <option value="Transición">Jornada de Transición (25h/sem.)</option>
          </select>
        </div>
      </div>

      {/* ── Datos de la clase ── */}
      <div className="pd-section-title">Datos de la Clase</div>
      <div className="pd-grid-2">
        <div className="pd-field">
          <label>Grado <span className="pd-req">*</span></label>
          <select value={grado} onChange={set("grado")}>
            <option value="">Seleccionar grado</option>
            {GRADOS.map((g) => (
              <option key={g.grado} value={g.grado}>{g.grado}</option>
            ))}
          </select>
        </div>
        <div className="pd-field">
          <label>Sección <span className="pd-req">*</span></label>
          <select value={seccion} onChange={set("seccion")}>
            <option value="">Seleccionar sección</option>
            {SECCIONES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="pd-field">
          <label>Área <span className="pd-req">*</span></label>
          <select value={area} onChange={handleAreaChange}>
            <option value="">Seleccionar área</option>
            {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="pd-field">
          <label>Asignatura {tieneMultiplesAsignaturas(area) && <span className="pd-req">*</span>}</label>
          {tieneMultiplesAsignaturas(area) ? (
            <select value={asignatura} onChange={set("asignatura")}>
              <option value="">Seleccionar asignatura</option>
              {getAsignaturas(area).map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          ) : (
            <input value={asignatura} onChange={set("asignatura")} placeholder="Se auto-completa con el área" readOnly />
          )}
        </div>
        <div className="pd-field">
          <label>Fecha</label>
          <input type="date" value={fecha} onChange={set("fecha")} />
        </div>
        <div className="pd-field">
          <label>Duración</label>
          <select value={duracion} onChange={set("duracion")}>
            {DURACIONES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* ── Tema ── */}
      <div className="pd-field pd-field-full" style={{ marginTop: 12 }}>
        <label>Tema de la clase <span className="pd-req">*</span></label>
        <input
          value={tema}
          onChange={set("tema")}
          placeholder="Ej: Parts of the house / There is - There are"
        />
      </div>

      {/* ── Competencias fundamentales ── */}
      <div className="pd-section-title">Competencias Fundamentales</div>
      <div className="pd-comp-fund-grid">
        {COMPETENCIAS_FUNDAMENTALES.map((c) => {
          const activa = (competenciasFundamentalesSeleccionadas || []).includes(c);
          return (
            <button
              key={c}
              type="button"
              className={`pd-comp-cb ${activa ? "pd-comp-cb--on" : ""}`}
              onClick={() => toggleCompFund(c)}
            >
              <span>{activa ? "☑" : "☐"}</span> {c}
            </button>
          );
        })}
      </div>

      {/* ── Indicadores (opcional) ── */}
      <details className="pd-detalles">
        <summary>Indicadores de logro (opcional · se auto-generan si está vacío)</summary>
        <div className="pd-field pd-field-full">
          <textarea
            rows={4}
            value={indicadoresTexto}
            onChange={set("indicadoresTexto")}
            placeholder="Escribe un indicador por línea. Si dejas vacío, se generan automáticamente."
          />
        </div>
      </details>

      {/* ── Competencia específica (opcional) ── */}
      <details className="pd-detalles">
        <summary>Competencia específica (opcional · se auto-genera si está vacía)</summary>
        <div className="pd-field pd-field-full">
          <textarea
            rows={3}
            value={competenciaEspecificaTexto}
            onChange={set("competenciaEspecificaTexto")}
            placeholder="Escribe la competencia específica o deja vacío para auto-generar."
          />
        </div>
      </details>

      {/* ── Situación de aprendizaje (opcional) ── */}
      <details className="pd-detalles">
        <summary>Situación de aprendizaje (opcional · se auto-genera si está vacía)</summary>
        <div className="pd-field pd-field-full">
          <textarea
            rows={3}
            value={situacionAprendizajeTexto}
            onChange={set("situacionAprendizajeTexto")}
            placeholder="Escribe la situación de aprendizaje o deja vacío para auto-generar."
          />
        </div>
      </details>

      {!puedoGenerar && (
        <p className="pd-hint">Completa los campos marcados con <span className="pd-req">*</span> para generar el plan.</p>
      )}

      <button
        type="button"
        className="generate-btn"
        onClick={onGenerar}
        disabled={cargando || !puedoGenerar}
        style={{ marginTop: 16 }}
      >
        {cargando ? (
          <span className="gen-btn-inner">
            <span className="gen-spinner" />
            <span>Generando plan diario...</span>
          </span>
        ) : (
          <span className="gen-btn-inner">
            <span className="gen-icon">📋</span>
            <span>Generar Plan Diario</span>
          </span>
        )}
      </button>
    </section>
  );
}
