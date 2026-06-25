/**
 * Formulario para Unidad de Aprendizaje — formato MINERD
 * Incluye panel de recomendación de duración basado en análisis curricular
 */
import { analizarComplejidad } from "../services/unidadAprendizajeService";
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

const COMPETENCIAS_FUND = [
  "Comunicativa",
  "Pensamiento Lógico, Creativo y Crítico",
  "Resolución de Problemas",
  "Científica y Tecnológica",
  "Ambiental y de la Salud",
  "Desarrollo Personal y Espiritual",
  "Ética y Ciudadana",
];

const COMP_FUND_POR_AREA = {
  "Lenguas Extranjeras":                   ["Comunicativa", "Científica y Tecnológica"],
  "Lengua Española":                       ["Comunicativa", "Pensamiento Lógico, Creativo y Crítico"],
  "Matemática":                            ["Pensamiento Lógico, Creativo y Crítico", "Resolución de Problemas"],
  "Ciencias de la Naturaleza":             ["Científica y Tecnológica", "Ambiental y de la Salud"],
  "Ciencias Sociales":                     ["Ética y Ciudadana", "Ambiental y de la Salud"],
  "Educación Física":                      ["Desarrollo Personal y Espiritual", "Ambiental y de la Salud"],
  "Educación Artística":                   ["Comunicativa", "Desarrollo Personal y Espiritual"],
  "Formación Integral Humana y Religiosa": ["Desarrollo Personal y Espiritual", "Ética y Ciudadana"],
  "Francés":                               ["Comunicativa", "Científica y Tecnológica"],
};

const NUM_SEMANAS_OPS = [1, 2, 3, 4, 5, 6, 7, 8];
const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

const COLOR_NIVEL = {
  baja:    { bg: "#f0fdf4", border: "#86efac", badge: "#16a34a", text: "#14532d" },
  media:   { bg: "#fefce8", border: "#fde047", badge: "#ca8a04", text: "#713f12" },
  alta:    { bg: "#fff7ed", border: "#fdba74", badge: "#ea580c", text: "#7c2d12" },
  muyAlta: { bg: "#fff1f2", border: "#fda4af", badge: "#dc2626", text: "#7f1d1d" },
};

export default function FormularioUnidadAprendizaje({ datos, onChange, onGenerar, cargando }) {
  const {
    grado = "", seccion = "", area = "", asignatura = "",
    titulo = "", numSemanas = 4,
    diasClase = ["Lunes", "Martes", "Miércoles"], horasPorDia = 1, duracionHoraClase = 45,
    estrategiaTexto = "", situacionTexto = "", productoFinalTexto = "",
    asignaturasVinculadasTexto = "",
    nombreDocente = "", cedula = "", regional = "",
    distrito = "", centro = "", codigoCentro = "",
    nivel = "Secundaria", ciclo = "Primer Ciclo", modalidad = "Académica",
    jornada = "Extendida",
    periodo = "", fechaInicio = "",
    competenciasFundamentalesSeleccionadas = [],
  } = datos;

  const set = (campo) => (e) => onChange({ ...datos, [campo]: e.target.value });
  const setNum = (campo) => (e) => onChange({ ...datos, [campo]: Number(e.target.value) });

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

  const toggleDiaClase = (dia) => {
    const actual = diasClase || [];
    const siguiente = actual.includes(dia)
      ? actual.filter((d) => d !== dia)
      : [...actual, dia].sort((a, b) => DIAS_SEMANA.indexOf(a) - DIAS_SEMANA.indexOf(b));
    if (siguiente.length > 0) onChange({ ...datos, diasClase: siguiente });
  };

  const horasSemanales = (diasClase || []).length * (horasPorDia || 1);

  // ── Análisis de complejidad ──
  const puedeAnalizar = !!(titulo.trim() && area && grado);
  const rec = puedeAnalizar
    ? analizarComplejidad({ area, grado, nivel, titulo, productoFinal: productoFinalTexto })
    : null;

  const colores = rec ? COLOR_NIVEL[rec.nivelClave] : null;

  const aplicarRecomendacion = () => {
    onChange({ ...datos, numSemanas: rec.semanasRecomendadas });
  };

  // Determinar si el docente modificó la duración respecto a la recomendación
  const duracionDiferente = rec && numSemanas !== rec.semanasRecomendadas;
  const duracionMayor = rec && numSemanas > rec.semanasRecomendadas;

  const camposFaltantes = [
    !grado && "Grado",
    !seccion && "Sección",
    !area && "Área",
    (tieneMultiplesAsignaturas(area) && !asignatura) && "Asignatura",
    !titulo && "Título de la Unidad",
  ].filter(Boolean);

  const puedoGenerar = camposFaltantes.length === 0;

  return (
    <section className="planning-form-card pd-form">
      <h2>🧩 Unidad de Aprendizaje — Datos de la Planificación</h2>

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
          <label>Nivel</label>
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
        <div className="pd-field">
          <label>Período escolar</label>
          <input value={periodo} onChange={set("periodo")} placeholder="2025-2026" />
        </div>
      </div>

      {/* ── Datos de la unidad ── */}
      <div className="pd-section-title">Datos de la Unidad</div>
      <div className="pd-grid-2">
        <div className="pd-field">
          <label>Grado <span className="pd-req">*</span></label>
          <select value={grado} onChange={set("grado")}>
            <option value="">Seleccionar grado</option>
            {GRADOS.map((g) => <option key={g.grado} value={g.grado}>{g.grado}</option>)}
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
          <label>Fecha de inicio</label>
          <input type="date" value={fechaInicio} onChange={set("fechaInicio")} />
        </div>
        <div className="pd-field">
          <label>Asignaturas vinculadas</label>
          <input value={asignaturasVinculadasTexto} onChange={set("asignaturasVinculadasTexto")} placeholder="Lengua Española, Tecnología..." />
        </div>
      </div>

      {/* Título de la unidad */}
      <div className="pd-field pd-field-full" style={{ marginTop: 12 }}>
        <label>Título de la Unidad <span className="pd-req">*</span></label>
        <input
          value={titulo}
          onChange={set("titulo")}
          placeholder="Ej: Daily Routines / Operaciones con Fracciones / La Célula"
        />
      </div>

      {/* ── Panel de recomendación inteligente ── */}
      {rec && (
        <div
          className="ua-rec-panel"
          style={{ background: colores.bg, borderColor: colores.border }}
        >
          <div className="ua-rec-header">
            <span className="ua-rec-tag">Asesor Pedagógico</span>
            <span className="ua-rec-title">Análisis curricular del tema</span>
          </div>

          <div className="ua-rec-body">
            <div className="ua-rec-row">
              <div className="ua-rec-item">
                <span className="ua-rec-label">Complejidad detectada</span>
                <span
                  className="ua-rec-badge"
                  style={{ background: colores.badge, color: "#fff" }}
                >
                  {rec.emoji} {rec.etiqueta}
                </span>
              </div>
              <div className="ua-rec-item">
                <span className="ua-rec-label">Duración recomendada</span>
                <span className="ua-rec-value" style={{ color: colores.badge }}>
                  {rec.semanasRecomendadas} semana{rec.semanasRecomendadas > 1 ? "s" : ""}
                  <span className="ua-rec-sub"> ({rec.encuentrosRango} horas clase)</span>
                </span>
              </div>
            </div>

            <div className="ua-rec-justif" style={{ color: colores.text }}>
              <span className="ua-rec-justif-label">Justificación: </span>
              {rec.justificacion}
            </div>
          </div>

          <div className="ua-rec-actions">
            <button
              type="button"
              className="ua-rec-btn-usar"
              style={{ background: colores.badge }}
              onClick={aplicarRecomendacion}
            >
              ✓ Usar recomendación IA ({rec.semanasRecomendadas} semanas)
            </button>
            <span className="ua-rec-o">ó personaliza la duración abajo</span>
          </div>
        </div>
      )}

      {/* ── Estructura de la unidad ── */}
      <div className="pd-section-title">
        Estructura de la Unidad (FASES)
        {rec && (
          <span className="ua-dur-rec-hint">
            — Recomendado: {rec.emoji} {rec.semanasRecomendadas} semanas
          </span>
        )}
      </div>

      <div className="pd-grid-2">
        <div className="pd-field">
          <label>Número de semanas</label>
          <select value={numSemanas} onChange={setNum("numSemanas")}>
            {NUM_SEMANAS_OPS.map((n) => (
              <option key={n} value={n}>{n} semana{n > 1 ? "s" : ""} ({n * horasSemanales} horas clase)</option>
            ))}
          </select>
        </div>
        <div className="pd-field">
          <label>Horas clase por día</label>
          <select value={horasPorDia} onChange={setNum("horasPorDia")}>
            <option value={1}>1 hora por día</option>
            <option value={2}>Bloque: 2 horas por día</option>
          </select>
        </div>
      </div>

      <div className="pd-field pd-field-full" style={{ marginTop: 8 }}>
        <label>Días de clase</label>
        <div className="pd-comp-fund-grid">
          {DIAS_SEMANA.map((dia) => {
            const activo = (diasClase || []).includes(dia);
            return (
              <button
                key={dia}
                type="button"
                className={`pd-comp-cb ${activo ? "pd-comp-cb--on" : ""}`}
                onClick={() => toggleDiaClase(dia)}
                disabled={cargando}
              >
                <span>{activo ? "☑" : "☐"}</span> {dia}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pd-grid-2" style={{ marginTop: 8 }}>
        <div className="pd-field">
          <label>Duración de la hora clase</label>
          {nivel === "Primaria" || nivel === "Inicial" ? (
            <input value="45 minutos (Primaria)" readOnly />
          ) : (
            <select value={duracionHoraClase} onChange={setNum("duracionHoraClase")}>
              <option value={45}>45 minutos</option>
              <option value={50}>50 minutos</option>
            </select>
          )}
        </div>
      </div>

      <p className="pd-hint" style={{ marginTop: 4 }}>
        Total: <strong>{numSemanas * horasSemanales} horas clase</strong> de {nivel === "Primaria" || nivel === "Inicial" ? 45 : duracionHoraClase} min
        — {(diasClase || []).join(", ")} · {horasPorDia} hora{horasPorDia > 1 ? "s" : ""}/día · {numSemanas} semanas.
        {duracionDiferente && (
          <span className="ua-dur-aviso">
            {duracionMayor
              ? " La IA profundizará los contenidos para aprovechar el tiempo adicional."
              : " La IA priorizará los aprendizajes esenciales e indicadores obligatorios."}
          </span>
        )}
      </p>

      {/* ── Competencias fundamentales ── */}
      <div className="pd-section-title">Competencias Fundamentales</div>
      <div className="pd-comp-fund-grid">
        {COMPETENCIAS_FUND.map((c) => {
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

      {/* ── Opcionales ── */}
      <details className="pd-detalles">
        <summary>Estrategia pedagógica (opcional · se auto-genera)</summary>
        <div className="pd-field pd-field-full">
          <textarea
            rows={2}
            value={estrategiaTexto}
            onChange={set("estrategiaTexto")}
            placeholder="Ej: Enfoque Comunicativo, Aprendizaje Basado en Proyectos..."
          />
        </div>
      </details>

      <details className="pd-detalles">
        <summary>Situación de aprendizaje (opcional · se auto-genera)</summary>
        <div className="pd-field pd-field-full">
          <textarea
            rows={3}
            value={situacionTexto}
            onChange={set("situacionTexto")}
            placeholder="Describe el contexto real que motiva el aprendizaje..."
          />
        </div>
      </details>

      <details className="pd-detalles">
        <summary>Producto final de la unidad (opcional · mejora la recomendación)</summary>
        <div className="pd-field pd-field-full">
          <textarea
            rows={2}
            value={productoFinalTexto}
            onChange={set("productoFinalTexto")}
            placeholder="Ej: Presentación oral, proyecto, portafolio, mural..."
          />
        </div>
      </details>

      {!puedoGenerar && (
        <div className="pd-campos-faltantes">
          <p className="pd-hint" style={{ marginBottom: 6 }}>
            Para generar, completa los campos requeridos:
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {camposFaltantes.map((campo) => (
              <span key={campo} className="pd-campo-badge">{campo}</span>
            ))}
          </div>
        </div>
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
            <span>Generando Unidad de Aprendizaje...</span>
          </span>
        ) : (
          <span className="gen-btn-inner">
            <span className="gen-icon">🧩</span>
            <span>Generar Unidad de Aprendizaje</span>
          </span>
        )}
      </button>
    </section>
  );
}
