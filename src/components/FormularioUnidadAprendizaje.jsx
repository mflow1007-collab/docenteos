/**
 * Formulario para Unidad de Aprendizaje — formato MINERD
 * Incluye panel de recomendación de duración basado en análisis curricular
 */
import { useEffect, useMemo, useState } from "react";
import { analizarComplejidad } from "../services/unidadAprendizajeService";
import {
  getAreas,
  getAreaCurricularDeAsignatura,
  getAsignaturas,
  getAsignaturaAutomatica,
  tieneMultiplesAsignaturas,
} from "../planning/areaAsignaturaMap.js";
import {
  getAvailableCurricularScopes,
  getCurricularContentForUnit,
  temasOficialesDeMalla,
} from "../services/bancoConocimientoService.js";
import { sugerirTemasATrabajar, sugerirTemaOficial, normalizarTema, coincideContextoTemaTrabajado } from "../services/curriculumCombinacionService";

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

const normalizarClave = (valor) => String(valor || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/\s+/g, " ")
  .trim();

const normalizarNivel = (valor) => {
  const n = normalizarClave(valor);
  if (["secundario", "secundaria"].includes(n)) return "secundaria";
  if (["primario", "primaria"].includes(n)) return "primaria";
  return n;
};

const gradoCorto = (grado = "") => String(grado || "").split(" ")[0] || "";

const gradoCompletoDesdeMalla = (scope = {}) => {
  const grado = String(scope.grade || "").trim();
  const nivel = String(scope.level || "").trim();
  return [grado, nivel].filter(Boolean).join(" ");
};

const normalizarGrado = (grado = "") => normalizarClave(grado)
  .replace(/\s+(primaria|secundaria|inicial|bachillerato)\b.*/g, "")
  .trim();

const scopeHabilitaAsignatura = (scope = {}, area = "", asignatura = "") => {
  if (!area) return true;
  const scopeArea = scope.area || "";
  const scopeSubject = scope.subject || "";
  if (normalizarClave(scopeArea) !== normalizarClave(area)) return false;
  if (!asignatura) return true;
  if (normalizarClave(scopeSubject) === normalizarClave(asignatura)) return true;
  return normalizarClave(scopeSubject) === normalizarClave(area)
    && normalizarClave(getAreaCurricularDeAsignatura(asignatura)) === normalizarClave(area);
};

// FUENTE ÚNICA: los temas del selector salen EXCLUSIVAMENTE de los temas
// oficiales de la malla resuelta (temasOficialesDeMalla — payload.temas).
// Los contenidos (estructuras, vocabulario, items) JAMÁS se ofrecen como temas.
const normalizarCurriculoParaAsesor = (doc) => {
  const payload = doc?.payload || doc || {};
  return {
    ...payload,
    id: doc?.id || payload.id,
    temasCurriculares: temasOficialesDeMalla(doc),
    criteriosCombinacionTematica: Array.isArray(payload.criteriosCombinacionTematica)
      ? payload.criteriosCombinacionTematica
      : [],
  };
};

const curriculoCoincideConSeleccion = ({ doc, nivel, grado, area, asignatura }) => {
  const payload = doc?.payload || doc || {};
  const docNivel = payload.level || payload.nivel || doc?.level || "";
  const docGrado = payload.grade || payload.grado || doc?.grade || "";
  const docArea = payload.area || doc?.area || "";
  const docAsignatura = payload.subject || payload.asignatura || doc?.subject || "";
  const esperadoAsignatura = asignatura || area;
  const asignaturaPerteneceAlArea = normalizarClave(getAreaCurricularDeAsignatura(esperadoAsignatura)) === normalizarClave(area);
  const coincideAsignatura = normalizarClave(docAsignatura) === normalizarClave(esperadoAsignatura)
    || (asignaturaPerteneceAlArea && normalizarClave(docAsignatura) === normalizarClave(area));

  return Boolean(
    docNivel && docGrado && docArea && docAsignatura &&
    normalizarNivel(docNivel) === normalizarNivel(nivel) &&
    normalizarGrado(docGrado) === normalizarGrado(grado) &&
    normalizarClave(docArea) === normalizarClave(area) &&
    coincideAsignatura
  );
};

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

export default function FormularioUnidadAprendizaje({ datos, onChange, onGenerar, cargando, temasTrabajados = [] }) {
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
    temasSeleccionados = [],
  } = datos;

  const set = (campo) => (e) => onChange({ ...datos, [campo]: e.target.value });

  // Nivel EFECTIVO: el del grado seleccionado manda (el campo Nivel puede
  // quedar rancio en "Secundaria" si el docente no lo toca — bypass real).
  const nivelDelGradoSeleccionado = GRADOS.find((g) => g.grado === grado)?.nivel || "";
  const nivelEfectivo = nivelDelGradoSeleccionado || nivel;

  // Al elegir grado se sincroniza el nivel en los datos (consistencia del
  // documento y de la generación, no solo del Asesor)
  const handleGradoChange = (e) => {
    const nuevoGrado = e.target.value;
    const nivelDelGrado = GRADOS.find((g) => g.grado === nuevoGrado)?.nivel;
    onChange({ ...datos, grado: nuevoGrado, ...(nivelDelGrado ? { nivel: nivelDelGrado } : {}) });
  };
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

  // ── Sugerencia de tema oficial (texto libre → tema del currículo + afines) ──
  const [sugerenciaTema, setSugerenciaTema] = useState(null);
  const [temasMalla, setTemasMalla] = useState([]);
  const [estadoCurriculoAsesor, setEstadoCurriculoAsesor] = useState({ status: "idle", mensaje: "" });
  const [modoElegido, setModoElegido] = useState(null); // "solo" | nombre de combinación | "propia"
  const [mostrarPropia, setMostrarPropia] = useState(false);
  const [temasPropios, setTemasPropios] = useState([]);
  const [mallasDisponibles, setMallasDisponibles] = useState([]);
  const [cargandoMallas, setCargandoMallas] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setCargandoMallas(true);
    getAvailableCurricularScopes()
      .then((items) => {
        if (!cancelado) setMallasDisponibles(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (!cancelado) setMallasDisponibles([]);
      })
      .finally(() => {
        if (!cancelado) setCargandoMallas(false);
      });
    return () => { cancelado = true; };
  }, []);

  const areasDisponibles = useMemo(() => {
    const activas = new Set(
      mallasDisponibles
        .map((scope) => scope.area)
        .filter(Boolean)
        .map(normalizarClave)
    );
    return AREAS.filter((a) => activas.has(normalizarClave(a)));
  }, [mallasDisponibles]);

  const asignaturasDisponibles = useMemo(() => {
    if (!area) return [];
    const asignaturasBase = getAsignaturas(area);
    return asignaturasBase.filter((asig) => (
      mallasDisponibles.some((scope) => scopeHabilitaAsignatura(scope, area, asig))
    ));
  }, [area, mallasDisponibles]);

  const areaTieneMultiplesAsignaturas = asignaturasDisponibles.length > 1
    || tieneMultiplesAsignaturas(area);

  const gradosDisponibles = useMemo(() => {
    const candidatos = mallasDisponibles.filter((scope) => {
      return scopeHabilitaAsignatura(scope, area, asignatura);
    });
    const labels = [...new Set(candidatos.map(gradoCompletoDesdeMalla).filter(Boolean))];
    return GRADOS.filter((g) => labels.includes(g.grado));
  }, [area, asignatura, mallasDisponibles]);

  useEffect(() => {
    if (cargandoMallas || !grado) return;
    const existe = gradosDisponibles.some((g) => g.grado === grado);
    if (!existe) {
      onChange({ ...datos, grado: "", nivel: "", ciclo: "Primer Ciclo" });
    }
  }, [cargandoMallas, grado, gradosDisponibles, datos, onChange]);

  useEffect(() => {
    if (cargandoMallas || !area) return;
    const existeArea = areasDisponibles.some((a) => normalizarClave(a) === normalizarClave(area));
    if (!existeArea) {
      onChange({ ...datos, area: "", asignatura: "", grado: "", nivel: "", ciclo: "Primer Ciclo" });
      return;
    }
    const existeAsignatura = !asignatura
      || asignaturasDisponibles.some((a) => normalizarClave(a) === normalizarClave(asignatura));
    if (!existeAsignatura) {
      onChange({ ...datos, asignatura: "", grado: "", nivel: "", ciclo: "Primer Ciclo" });
    }
  }, [cargandoMallas, area, asignatura, areasDisponibles, asignaturasDisponibles, datos, onChange]);

  useEffect(() => {
    const texto = (titulo || "").trim();
    const asignaturaRequerida = areaTieneMultiplesAsignaturas;
    const seleccionCompleta = Boolean(grado && area && (!asignaturaRequerida || asignatura));

    if (!seleccionCompleta) {
      setSugerenciaTema(null);
      setTemasMalla([]);
      setEstadoCurriculoAsesor({ status: "idle", mensaje: "" });
      return undefined;
    }

    let cancelado = false;
    const timer = setTimeout(async () => {
      const candidatas = [...new Set(
        [asignatura || area, area, getAreaCurricularDeAsignatura(asignatura)].filter(Boolean)
      )];

      let curriculo = null;
      let docDetectado = null;
      if (!cancelado) setEstadoCurriculoAsesor({ status: "loading", mensaje: "Verificando malla curricular oficial..." });

      try {
        for (const areaCandidata of candidatas) {
          // Clave estricta con nivel: se pasa el GRADO COMPLETO ("1ro Primaria")
          // y el nivel EFECTIVO del grado seleccionado — el campo nivel del
          // formulario puede quedar rancio (bypass real: resolvía Secundaria
          // para Primaria). El nivel embebido en el grado manda en el resolver.
          const doc = await getCurricularContentForUnit(areaCandidata, grado, nivelEfectivo);
          if (!doc) continue;
          docDetectado = docDetectado || doc;
          if (curriculoCoincideConSeleccion({ doc, nivel: nivelEfectivo, grado, area, asignatura: asignatura || area })) {
            curriculo = normalizarCurriculoParaAsesor(doc);
            break;
          }
        }
      } catch (error) {
        if (!cancelado) {
          setSugerenciaTema(null);
          setTemasMalla([]);
          setEstadoCurriculoAsesor({
            status: "error",
            mensaje: `No se pudo verificar la malla curricular oficial: ${error.message}`,
          });
        }
        return;
      }

      if (!cancelado) {
        if (!curriculo) {
          const payload = docDetectado?.payload || docDetectado || {};
          const detalleDetectado = docDetectado
            ? ` Se encontró otra malla activa (${payload.level || payload.nivel || docDetectado.level || "nivel no indicado"} · ${payload.grade || payload.grado || docDetectado.grade || "grado no indicado"} · ${payload.area || docDetectado.area || "área no indicada"} · ${payload.subject || payload.asignatura || docDetectado.subject || "asignatura no indicada"}), pero no coincide exactamente.`
            : "";
          setSugerenciaTema(null);
          setTemasMalla([]);
          setModoElegido(null);
          setMostrarPropia(false);
          setEstadoCurriculoAsesor({
            status: "missing",
            mensaje: `No existe una malla curricular oficial exacta para ${nivelEfectivo || nivel} · ${grado} · ${area}${asignatura ? ` · ${asignatura}` : ""}.${detalleDetectado}`,
          });
          return;
        }

        setEstadoCurriculoAsesor({ status: "ready", mensaje: "" });
        setSugerenciaTema(texto.length >= 3 ? sugerirTemasATrabajar(curriculo, texto) : null);
        setTemasMalla(curriculo.temasCurriculares || []);
      }
    }, 600);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [titulo, grado, nivel, area, asignatura, areaTieneMultiplesAsignaturas]);

  // Temas ya trabajados (del historial del docente), resueltos también contra
  // la malla: si trabajó "Parts of the House", marca "Vivienda, entorno y
  // ciudad" como trabajado. Solo marca visualmente — nunca bloquea.
  // Solo cuentan los registros del MISMO contexto (nivel+grado+asignatura):
  // "Parts of the House" trabajado en 1ro Secundaria no marca 1ro Primaria.
  const trabajadosResueltos = (() => {
    const s = new Set();
    const seleccionContexto = { nivel: nivelEfectivo, grado, asignatura: asignatura || area, area };
    temasTrabajados.forEach((registro) => {
      if (!registro || typeof registro !== "object") return; // strings legacy: sin contexto → no marcar
      if (!coincideContextoTemaTrabajado(registro, seleccionContexto)) return;
      const usado = registro.texto;
      s.add(normalizarTema(usado));
      if (temasMalla.length > 0) {
        const oficial = sugerirTemaOficial(usado, temasMalla);
        if (oficial) s.add(normalizarTema(oficial.tema));
      }
    });
    return s;
  })();
  const temaYaTrabajado = (t) => trabajadosResueltos.has(normalizarTema(t));
  const estiloTrabajado = { textDecoration: "line-through", opacity: 0.7 };

  // Semanas que sugiere una combinación ("5-6 semanas" → 5); si no trae
  // duración, ~2 semanas por tema acotado a 4-8
  const semanasDeCombinacion = (op) => {
    const n = parseInt(String(op.duracionSugerida || ""), 10);
    if (Number.isFinite(n) && n >= 1) return Math.min(8, n);
    return Math.min(8, Math.max(4, op.temas.length * 2));
  };

  const elegirSoloTema = () => {
    setModoElegido("solo");
    setMostrarPropia(false);
    onChange({
      ...datos,
      temasSeleccionados: [],
      numSemanas: rec ? rec.semanasRecomendadas : numSemanas,
    });
  };

  const elegirCombinacion = (op) => {
    setModoElegido(op.nombre);
    setMostrarPropia(false);
    onChange({ ...datos, temasSeleccionados: op.temas, numSemanas: semanasDeCombinacion(op) });
  };

  const abrirPropia = () => {
    setMostrarPropia(true);
    if (temasPropios.length === 0 && sugerenciaTema?.temaOficial) {
      setTemasPropios([sugerenciaTema.temaOficial]);
    }
  };

  const toggleTemaPropio = (t) => {
    setTemasPropios((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const confirmarPropia = () => {
    if (temasPropios.length === 0) return;
    setModoElegido("propia");
    const semanas = temasPropios.length === 1
      ? (rec?.semanasRecomendadas ?? numSemanas)
      : Math.min(8, Math.max(4, temasPropios.length * 2));
    onChange({
      ...datos,
      temasSeleccionados: temasPropios.length > 1 ? [...temasPropios] : [],
      numSemanas: semanas,
    });
  };

  // ── Análisis de complejidad ──
  const puedeAnalizar = !!(titulo.trim() && area && grado);
  const rec = puedeAnalizar
    ? analizarComplejidad({ area, grado, nivel, titulo, productoFinal: productoFinalTexto })
    : null;

  const colores = rec ? COLOR_NIVEL[rec.nivelClave] : null;

  const aplicarRecomendacion = () => {
    onChange({ ...datos, numSemanas: rec.semanasRecomendadas });
  };

  const aplicarTituloSugerido = (tituloNuevo) => {
    if (tituloNuevo) onChange({ ...datos, titulo: tituloNuevo });
  };

  // Determinar si el docente modificó la duración respecto a la recomendación
  const duracionDiferente = rec && numSemanas !== rec.semanasRecomendadas;
  const duracionMayor = rec && numSemanas > rec.semanasRecomendadas;

  const camposFaltantes = [
    !grado && "Grado",
    !seccion && "Sección",
    !area && "Área",
    (areaTieneMultiplesAsignaturas && !asignatura) && "Asignatura",
    !titulo && "Título de la Unidad",
    (grado && area && (!areaTieneMultiplesAsignaturas || asignatura) && estadoCurriculoAsesor.status === "loading") && "Verificación de malla curricular",
    (grado && area && (!areaTieneMultiplesAsignaturas || asignatura) && ["missing", "error"].includes(estadoCurriculoAsesor.status)) && "Malla curricular oficial exacta",
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
          <select value={grado} onChange={handleGradoChange} disabled={cargandoMallas || !gradosDisponibles.length}>
            <option value="">
              {cargandoMallas
                ? "Cargando mallas..."
                : gradosDisponibles.length
                  ? "Seleccionar grado"
                  : "No hay mallas activas"}
            </option>
            {gradosDisponibles.map((g) => <option key={g.grado} value={g.grado}>{g.grado}</option>)}
          </select>
          {!cargandoMallas && !gradosDisponibles.length && (
            <small style={{ color: "#b91c1c", fontWeight: 700 }}>
              Sube primero la malla oficial de ese grado en el Banco de Conocimiento.
            </small>
          )}
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
          <select value={area} onChange={handleAreaChange} disabled={cargandoMallas || !areasDisponibles.length}>
            <option value="">
              {cargandoMallas
                ? "Cargando áreas..."
                : areasDisponibles.length
                  ? "Seleccionar área"
                  : "No hay áreas con malla activa"}
            </option>
            {areasDisponibles.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="pd-field">
          <label>Asignatura {areaTieneMultiplesAsignaturas && <span className="pd-req">*</span>}</label>
          {areaTieneMultiplesAsignaturas ? (
            <select value={asignatura} onChange={set("asignatura")}>
              <option value="">Seleccionar asignatura</option>
              {asignaturasDisponibles.map((a) => (
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

      {/* ── Asesor Pedagógico: tarjeta azul con las 3 formas de trabajar el tema ── */}
      {estadoCurriculoAsesor.status === "loading" ? (
        <div
          className="ua-rec-panel"
          style={{ background: "#eff6ff", borderColor: "#93c5fd" }}
        >
          <div className="ua-rec-header">
            <span className="ua-rec-tag">Asesor Pedagógico</span>
            <span className="ua-rec-title">Verificación curricular</span>
          </div>
          <div className="ua-rec-body">
            <p style={{ color: "#1e3a8a", fontWeight: 700, margin: 0 }}>
              {estadoCurriculoAsesor.mensaje}
            </p>
          </div>
        </div>
      ) : ["missing", "error"].includes(estadoCurriculoAsesor.status) ? (
        <div
          className="ua-rec-panel"
          style={{ background: "#fff1f2", borderColor: "#fda4af" }}
        >
          <div className="ua-rec-header">
            <span className="ua-rec-tag">Asesor Pedagógico</span>
            <span className="ua-rec-title">Malla curricular no disponible</span>
          </div>
          <div className="ua-rec-body">
            <p style={{ color: "#7f1d1d", fontWeight: 700, margin: "0 0 6px" }}>
              No se puede analizar ni generar esta unidad sin la malla curricular oficial exacta.
            </p>
            <p style={{ color: "#7f1d1d", margin: 0, fontSize: 13 }}>
              {estadoCurriculoAsesor.mensaje}
            </p>
          </div>
        </div>
      ) : estadoCurriculoAsesor.status === "ready" && !sugerenciaTema ? (
        <div
          className="ua-rec-panel"
          style={{ background: "#eff6ff", borderColor: "#93c5fd" }}
        >
          <div className="ua-rec-header">
            <span className="ua-rec-tag">Asesor Pedagógico</span>
            <span className="ua-rec-title">Análisis curricular del tema</span>
          </div>
          <div className="ua-rec-body">
            <p style={{ color: "#1e3a8a", fontWeight: 700, margin: "0 0 6px" }}>
              Malla curricular oficial verificada.
            </p>
            <p style={{ color: "#1e3a8a", margin: 0, fontSize: 13 }}>
              {(titulo || "").trim().length >= 3
                ? "El tema escrito no coincide todavía con un tema oficial de esta malla."
                : "Escribe el título o tema de la unidad para buscar su tema oficial en la malla."}
            </p>
          </div>
        </div>
      ) : sugerenciaTema ? (
        <div
          className="ua-rec-panel"
          style={{ background: "#eff6ff", borderColor: "#93c5fd" }}
        >
          <div className="ua-rec-header">
            <span className="ua-rec-tag">Asesor Pedagógico</span>
            <span className="ua-rec-title">Análisis curricular del tema</span>
          </div>

          <div className="ua-rec-body">
            <div className="ua-rec-row">
              <div className="ua-rec-item">
                <span className="ua-rec-label">Tema oficial del currículo</span>
                <span className="ua-rec-value" style={{ color: "#1d4ed8" }}>
                  🎯 {sugerenciaTema.temaOficial}
                  <span className="ua-rec-sub"> (confianza {sugerenciaTema.confianza})</span>
                </span>
              </div>
              {rec && (
                <div className="ua-rec-item">
                  <span className="ua-rec-label">Complejidad detectada</span>
                  <span
                    className="ua-rec-badge"
                    style={{ background: colores.badge, color: "#fff" }}
                  >
                    {rec.emoji} {rec.etiqueta}
                  </span>
                </div>
              )}
            </div>

            {temaYaTrabajado(sugerenciaTema.temaOficial) && (
              <div style={{
                marginTop: 8, padding: "8px 12px", borderRadius: 8,
                background: "#fffbeb", border: "1.5px solid #f59e0b",
                color: "#92400e", fontSize: 13,
              }}>
                ⚠️ <strong>Ya hemos trabajado este tema.</strong> Puedes volver a elegirlo
                si deseas reforzarlo — no está bloqueado.
              </div>
            )}

            <p style={{ color: "#1e3a8a", fontWeight: 700, fontSize: 14, margin: "12px 0 8px" }}>
              ¿Cómo quieres trabajar esta unidad? Elige una opción:
            </p>

            {/* Opción 1: solo el tema del docente */}
            <div style={{
              background: modoElegido === "solo" ? "#dbeafe" : "white",
              border: `2px solid ${modoElegido === "solo" ? "#1d4ed8" : "#bfdbfe"}`,
              borderRadius: 10, padding: "10px 12px", marginBottom: 8,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <span style={{ color: "#1d4ed8", fontWeight: 700, fontSize: 13 }}>
                  📍 Solo mi tema — {sugerenciaTema.temaOficial}
                  {rec && (
                    <span style={{ fontWeight: 500, opacity: 0.75 }}>
                      {" "}· {rec.semanasRecomendadas} semana{rec.semanasRecomendadas > 1 ? "s" : ""} ({rec.encuentrosRango} horas clase)
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={elegirSoloTema}
                  disabled={cargando}
                  style={{
                    padding: "6px 14px", borderRadius: 8,
                    background: "#1d4ed8", color: "white", border: "none",
                    fontWeight: 700, fontSize: 12, cursor: "pointer",
                  }}
                >
                  {modoElegido === "solo" ? "✓ Elegido" : `Elegir solo mi tema${rec ? ` (${rec.semanasRecomendadas} sem.)` : ""}`}
                </button>
              </div>
              {rec && (
                <p style={{ color: "#1e3a8a", fontSize: 12, fontStyle: "italic", margin: "6px 0 0" }}>
                  {rec.justificacion}
                </p>
              )}
            </div>

            {/* Opción 2: combinación sugerida por el currículo (+ alternativas) */}
            {(sugerenciaTema.opciones || []).map((op, i) => (
              <div
                key={op.nombre}
                style={{
                  background: modoElegido === op.nombre ? "#dbeafe" : "white",
                  border: `2px solid ${modoElegido === op.nombre ? "#1d4ed8" : "#bfdbfe"}`,
                  borderRadius: 10, padding: "10px 12px", marginBottom: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <span style={{ color: "#1d4ed8", fontWeight: 700, fontSize: 13 }}>
                    {i === 0 ? "✨ Combinación sugerida por el currículo — " : "🔀 "}
                    {op.nombre}
                    {op.duracionSugerida && (
                      <span style={{ fontWeight: 500, opacity: 0.75 }}> · {op.duracionSugerida}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => elegirCombinacion(op)}
                    disabled={cargando}
                    style={{
                      padding: "6px 14px", borderRadius: 8,
                      background: i === 0 ? "#1d4ed8" : "white",
                      color: i === 0 ? "white" : "#1d4ed8",
                      border: i === 0 ? "none" : "1.5px solid #1d4ed8",
                      fontWeight: 700, fontSize: 12, cursor: "pointer",
                    }}
                  >
                    {modoElegido === op.nombre ? "✓ Elegida" : `Aceptar combinación (${semanasDeCombinacion(op)} sem.)`}
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {op.temas.map((t) => (
                    <span
                      key={t}
                      className="pd-campo-badge"
                      title={temaYaTrabajado(t) ? "Ya trabajaste este tema — puedes volver a elegirlo" : undefined}
                      style={{ background: "#dbeafe", color: "#1e3a8a", ...(temaYaTrabajado(t) ? estiloTrabajado : {}) }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
                {op.tituloSugerido && (
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                    <span style={{ color: "#1e3a8a", fontSize: 12 }}>
                      💡 Título sugerido: <strong>“{op.tituloSugerido}”</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => aplicarTituloSugerido(op.tituloSugerido)}
                      disabled={cargando}
                      style={{
                        padding: "2px 10px", borderRadius: 8,
                        background: "white", color: "#1d4ed8",
                        border: "1.5px solid #1d4ed8",
                        fontWeight: 700, fontSize: 11, cursor: "pointer",
                      }}
                    >
                      Usar este título
                    </button>
                  </div>
                )}
                {i === 0 && (
                  <p style={{ color: "#1e3a8a", fontSize: 12, fontStyle: "italic", margin: "6px 0 0" }}>
                    {op.razon}
                  </p>
                )}
              </div>
            ))}

            {/* Opción 3: combinación propia con todos los temas de la malla */}
            {temasMalla.length > 0 && (
              <div style={{
                background: modoElegido === "propia" ? "#dbeafe" : "white",
                border: `2px solid ${modoElegido === "propia" ? "#1d4ed8" : "#bfdbfe"}`,
                borderRadius: 10, padding: "10px 12px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <span style={{ color: "#1d4ed8", fontWeight: 700, fontSize: 13 }}>
                    🎨 Mi propia combinación — elige los temas de la malla que quieras trabajar
                  </span>
                  {!mostrarPropia && (
                    <button
                      type="button"
                      onClick={abrirPropia}
                      disabled={cargando}
                      style={{
                        padding: "6px 14px", borderRadius: 8,
                        background: "white", color: "#1d4ed8",
                        border: "1.5px solid #1d4ed8",
                        fontWeight: 700, fontSize: 12, cursor: "pointer",
                      }}
                    >
                      Elegir mis temas
                    </button>
                  )}
                </div>

                {mostrarPropia && (
                  <>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                      {temasMalla.map((t) => {
                        const activo = temasPropios.includes(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => toggleTemaPropio(t)}
                            disabled={cargando}
                            title={temaYaTrabajado(t) ? "Ya trabajaste este tema — puedes volver a elegirlo" : undefined}
                            style={{
                              padding: "4px 10px", borderRadius: 8,
                              background: activo ? "#1d4ed8" : "white",
                              color: activo ? "white" : "#1e3a8a",
                              border: `1.5px solid ${activo ? "#1d4ed8" : "#93c5fd"}`,
                              fontWeight: 600, fontSize: 12, cursor: "pointer",
                              ...(temaYaTrabajado(t) && !activo ? estiloTrabajado : {}),
                            }}
                          >
                            {activo ? "☑" : "☐"} {t}
                          </button>
                        );
                      })}
                    </div>
                    {temasPropios.some(temaYaTrabajado) && (
                      <p style={{
                        color: "#92400e", background: "#fffbeb",
                        border: "1.5px solid #f59e0b", borderRadius: 8,
                        padding: "6px 10px", fontSize: 12, margin: "8px 0 0",
                      }}>
                        ⚠️ Ya hemos trabajado: {temasPropios.filter(temaYaTrabajado).join(", ")}.
                        Puedes volver a trabajarlos si lo deseas.
                      </p>
                    )}
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                      <button
                        type="button"
                        onClick={confirmarPropia}
                        disabled={cargando || temasPropios.length === 0}
                        style={{
                          padding: "6px 14px", borderRadius: 8,
                          background: temasPropios.length === 0 ? "#93c5fd" : "#1d4ed8",
                          color: "white", border: "none",
                          fontWeight: 700, fontSize: 12,
                          cursor: temasPropios.length === 0 ? "not-allowed" : "pointer",
                        }}
                      >
                        {modoElegido === "propia"
                          ? "✓ Elegida"
                          : `Usar mi combinación (${temasPropios.length} tema${temasPropios.length !== 1 ? "s" : ""})`}
                      </button>
                      <span style={{ color: "#1e3a8a", fontSize: 12 }}>
                        Duración estimada: {temasPropios.length <= 1
                          ? `${rec?.semanasRecomendadas ?? numSemanas} semanas`
                          : `${Math.min(8, Math.max(4, temasPropios.length * 2))} semanas`}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Confirmación de la elección */}
            {modoElegido && (
              <div style={{
                marginTop: 10, padding: "8px 12px",
                background: "#f0fdf4", border: "2px solid #22c55e", borderRadius: 10,
                display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
              }}>
                <span style={{ color: "#15803d", fontWeight: 700, fontSize: 13 }}>
                  🔗 Trabajarás{temasSeleccionados.length > 1 ? " estos temas" : ""}:
                </span>
                {(temasSeleccionados.length > 0 ? temasSeleccionados : [sugerenciaTema.temaOficial]).map((t) => (
                  <span key={t} style={{
                    background: "#dcfce7", color: "#166534",
                    borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 600,
                  }}>
                    {t}
                  </span>
                ))}
                <span style={{ color: "#15803d", fontSize: 12 }}>
                  · {numSemanas} semana{numSemanas > 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>
        </div>
      ) : estadoCurriculoAsesor.status === "ready" && rec && (
        /* Fallback: áreas sin malla curricular — solo análisis de complejidad */
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
        {/* Ante candado de malla no se muestra estructura recomendada */}
        {!["missing", "error"].includes(estadoCurriculoAsesor.status) && rec && (
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
