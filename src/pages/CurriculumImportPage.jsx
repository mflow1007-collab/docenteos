/**
 * CurriculumImportPage.jsx
 *
 * Página de administración para importar el Diseño Curricular oficial
 * de la República Dominicana a Firestore.
 *
 * Modos disponibles:
 *   1. Subir archivo .json  — sube un archivo JSON completo (todos los grados/áreas a la vez)
 *   2. Pegar JSON completo  — pega el JSON completo en un textarea
 *   3. Por asignatura       — pega un bloque JSON por asignatura (chunked, sin wrapper)
 *
 * El sistema autodetecta si el JSON pegado tiene el wrapper "asignaturas[]"
 * o si es una asignatura individual (campos grado + area + competencias en la raíz).
 */

import { useState, useRef } from "react";
import {
  importarDesdeArchivo,
  importarDesdeJSON,
  importarAsignaturaSingle,
  validarEstructuraCurriculo,
} from "../services/curriculumImportService.js";

const PLANTILLA_ASIGNATURA_EJEMPLO = {
  nivel: "Secundaria",
  ciclo: "Primer Ciclo",
  version: "2016",
  fuente: "MINERD - Diseño Curricular de Secundaria",
  grado: "1ro",
  area: "Lenguas Extranjeras",
  asignatura: "Inglés",
  nivelDominio: "A1",
  competenciasFundamentales: [
    "Comunicativa",
    "Pensamiento Lógico, Creativo y Crítico",
    "Resolución de Problemas",
    "Ética y Ciudadana",
    "Científica y Tecnológica",
    "Ambiental y de la Salud",
    "Desarrollo Personal y Espiritual"
  ],
  temasCurriculares: [
    "Identificación personal",
    "Relaciones humanas y sociales",
    "Actividades de la vida diaria",
    "Vivienda, entorno y ciudad",
    "Escuela y educación",
    "Deporte, tiempo libre y recreación",
    "Alimentación",
    "Salud y cuidados físicos",
    "Lengua y comunicación",
    "Ciencia y tecnología",
    "Clima, condiciones atmosféricas y medio ambiente",
    "Bienes y servicios",
    "Actividades sociales y culturales",
    "Viajes y turismo"
  ],
  criteriosCombinacionTematica: [
    {
      nombre: "Identidad y vida personal",
      temas: ["Identificación personal", "Relaciones humanas y sociales", "Actividades de la vida diaria"],
      duracionSugerida: "5-6 semanas",
      razon: "Temas relacionados que comparten vocabulario de personas, rutinas y presentaciones. Permiten progresar de 'Hola, me llamo...' hasta narrar actividades cotidianas de forma natural."
    },
    {
      nombre: "Mi entorno físico y el clima",
      temas: ["Vivienda, entorno y ciudad", "Clima, condiciones atmosféricas y medio ambiente"],
      duracionSugerida: "4-5 semanas",
      razon: "El hogar, la ciudad y el clima son temáticas complementarias que permiten trabajar vocabulario de lugares, preposiciones de lugar y expresiones del tiempo atmosférico."
    },
    {
      nombre: "Salud y bienestar",
      temas: ["Alimentación", "Salud y cuidados físicos"],
      duracionSugerida: "4-5 semanas",
      razon: "La alimentación y la salud son temas íntimamente relacionados que se refuerzan mutuamente y conectan con la competencia Ambiental y de la Salud."
    },
    {
      nombre: "Aprendizaje y recreación",
      temas: ["Escuela y educación", "Deporte, tiempo libre y recreación"],
      duracionSugerida: "4-5 semanas",
      razon: "El contexto escolar y las actividades de tiempo libre representan la realidad cotidiana del estudiante y facilitan el uso del presente simple y continuo para rutinas y preferencias."
    },
    {
      nombre: "Mundo global y servicios",
      temas: ["Lengua y comunicación", "Ciencia y tecnología", "Bienes y servicios", "Actividades sociales y culturales", "Viajes y turismo"],
      duracionSugerida: "6-8 semanas",
      razon: "Bloque integrador de cierre del año donde se sintetizan todas las estructuras aprendidas. Los temas de tecnología, servicios, cultura y viajes amplían el repertorio comunicativo hacia el mundo global."
    }
  ],
  contenidosGenerales: {
    conceptuales: [
      "Presente simple (afirmativo, negativo, interrogativo)",
      "Presente continuo (acciones en progreso y planes futuros)",
      "Pasado simple (verbos regulares e irregulares)",
      "Presente perfecto básico (have/has + participio pasado)",
      "Will y be going to (predicciones y planes)",
      "Would (condicional básico)",
      "Can, can't, have to (habilidad, prohibición, obligación)",
      "There + be (existencia y ubicación)",
      "Imperativo (instrucciones y prohibiciones)",
      "Let's (sugerencias)",
      "Question tags básicos",
      "Possessive 's",
      "Artículos definidos e indefinidos (a, an, the)",
      "Adjetivos calificativos, comparativos y superlativos",
      "Adjetivos posesivos (my, your, his, her, its, our, their)",
      "Pronombres interrogativos (what, where, when, who, why, how)",
      "Pronombres objeto (me, you, him, her, us, them)",
      "Pronombres posesivos (mine, yours, his, hers, ours, theirs)",
      "Preposiciones de tiempo (in, on, at) y lugar (in, on, at, next to, between, behind)",
      "Adverbios de tiempo (now, then, yesterday, tomorrow), frecuencia (always, usually, sometimes, never), modo (slowly, quickly) e intensidad (very, quite)",
      "Conectores básicos (and, but, or, so, because, however)"
    ],
    procedimentales: [
      "Solicitar y ofrecer información personal",
      "Expresar gustos y preferencias",
      "Dar y pedir indicaciones e instrucciones",
      "Dar y pedir información sobre actividades cotidianas",
      "Describir a personas por su apariencia y su forma de ser",
      "Describir y comparar lugares y objetos",
      "Dar y pedir información sobre las condiciones atmosféricas",
      "Expresar opiniones",
      "Narrar experiencias personales, propias y de otras personas",
      "Invitar, aceptar o rechazar invitaciones",
      "Comprensión de textos orales: conversaciones, anuncios, canciones, noticias, descripciones y narraciones",
      "Comprensión de textos escritos: tarjetas, listas, mensajes, correos electrónicos, formularios, folletos, afiches y narraciones",
      "Producción de textos orales: conversaciones, descripciones, instrucciones y narraciones breves",
      "Producción de textos escritos: mensajes, correos electrónicos, cartas, formularios, narraciones y descripciones",
      "Producción de audiovisuales sencillos"
    ],
    actitudinales: [
      "Motivación para aprender inglés",
      "Cuidado del medioambiente",
      "Práctica de hábitos saludables",
      "Cumplimiento de las normas de seguridad",
      "Respeto por las pertenencias de las demás personas",
      "Cortesía, asertividad y respeto al interactuar",
      "Conciencia de que el valor de las personas trasciende las posesiones materiales",
      "Respeto por las diferencias relativas a género, edad, ocupación y nacionalidad",
      "Reconocimiento de la equidad de género en el desempeño de las diferentes ocupaciones",
      "Reconocimiento de que las personas discapacitadas pueden desempeñar su trabajo exitosamente",
      "Respeto por el tiempo propio y el de las demás personas",
      "Planificación de las actividades que lleva a cabo"
    ]
  },
  orientacionesMetodologicas: [
    "Aplicar el Enfoque Comunicativo (CLT): centrar la enseñanza en el uso real del idioma en situaciones comunicativas auténticas.",
    "Usar el Aprendizaje Basado en Tareas (TBL): los estudiantes realizan tareas comunicativas que integran las cuatro habilidades (escuchar, hablar, leer, escribir).",
    "Emplear andamiaje (scaffolding): proporcionar apoyo gradual hasta que el estudiante pueda funcionar de forma autónoma.",
    "Fomentar el trabajo colaborativo en pares y grupos para simular situaciones de comunicación real.",
    "Usar materiales auténticos adaptados al nivel A1: canciones, videos cortos, tarjetas postales, menús sencillos.",
    "Integrar las TIC de manera responsable: plataformas digitales para exposición al idioma y producción comunicativa.",
    "Respetar la zona de desarrollo próximo del estudiante, transitando del input comprensible al output comunicativo gradualmente.",
    "Valorar el error como parte natural del proceso de aprendizaje de una lengua extranjera."
  ],
  posiblesProductosFinales: [
    "Tarjeta de presentación personal en inglés",
    "Mini-diálogo de presentaciones entre compañeros",
    "Correo electrónico informal a un amigo imaginario",
    "Descripción oral de un familiar o amigo",
    "Cartel sobre hábitos saludables con imágenes y texto en inglés",
    "Pequeña guía turística del barrio o ciudad (folleto sencillo)",
    "Historieta con diálogos en inglés sobre una situación cotidiana",
    "Video corto de presentación personal (30-60 segundos)",
    "Blog sencillo con entradas sobre temas funcionales del grado",
    "Presentación oral sobre una actividad cotidiana favorita"
  ],
  competencias: [
    {
      id: "CE-ING-1-COM",
      competenciaFundamental: "Comunicativa",
      descripcion: "Comprende y expresa ideas, sentimientos y valores culturales en distintas situaciones de comunicación orales y escritas relativas a necesidades concretas y temas cotidianos, utilizando el idioma inglés de forma breve y sencilla con la finalidad de presentarse, identificar personas, referirse a actividades cotidianas y ubicar objetos y lugares en el espacio.",
      indicadoresLogro: [
        { id: "IL-ING-1-COM-1", descripcion: "Responde de forma adecuada a preguntas e indicaciones, a partir de la escucha o lectura de textos claros, breves y sencillos, donde se describen el entorno inmediato, información personal propia y de otras personas, actividades cotidianas y preferencias personales." },
        { id: "IL-ING-1-COM-2", descripcion: "Se expresa en inglés mediante una serie de frases y oraciones breves y sencillas enlazadas por conectores comunes para compartir información, puntos de vista e ideas referentes al entorno próximo y actividades cotidianas, aunque con pausas y reformulaciones en lo oral y con posibles errores básicos en lo escrito." },
        { id: "IL-ING-1-COM-3", descripcion: "Interactúa de forma oral y escrita utilizando una serie de frases y oraciones breves y sencillas y con diversidad de vocabulario básico referente a información personal, actividades cotidianas y el entorno inmediato, pero con suficiente claridad para ser comprendido con un poco de esfuerzo." }
      ],
      contenidos: { conceptuales: [], procedimentales: [], actitudinales: [] }
    }
  ]
};

const PLANTILLA_COMPLETA_EJEMPLO = {
  nivel: "Secundaria",
  ciclo: "Primer Ciclo",
  version: "2016",
  fuente: "MINERD - Diseño Curricular de Secundaria",
  asignaturas: [PLANTILLA_ASIGNATURA_EJEMPLO]
};

const MODOS = [
  { key: "archivo", label: "Subir archivo .json" },
  { key: "json", label: "Pegar JSON completo" },
  { key: "asignatura", label: "Por asignatura" },
];

export default function CurriculumImportPage() {
  const [modo, setModo] = useState("archivo");
  const [archivo, setArchivo] = useState(null);
  const [jsonTexto, setJsonTexto] = useState("");
  const [asignaturaTexto, setAsignaturaTexto] = useState("");
  const [estado, setEstado] = useState("idle");
  const [progreso, setProgreso] = useState({ actual: 0, total: 0, ultimo: "" });
  const [resultado, setResultado] = useState(null);
  const [errorMensaje, setErrorMensaje] = useState("");
  const [erroresValidacion, setErroresValidacion] = useState([]);
  const fileInputRef = useRef(null);

  const resetear = () => {
    setArchivo(null);
    setJsonTexto("");
    setAsignaturaTexto("");
    setEstado("idle");
    setProgreso({ actual: 0, total: 0, ultimo: "" });
    setResultado(null);
    setErrorMensaje("");
    setErroresValidacion([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const manejarArchivo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".json")) {
      setErrorMensaje("Solo se aceptan archivos .json");
      return;
    }
    setArchivo(file);
    setErrorMensaje("");
  };

  const validarAntes = (datos) => {
    if (Array.isArray(datos.asignaturas)) {
      // Formato completo con wrapper asignaturas[]
      const { valido, errores } = validarEstructuraCurriculo(datos);
      if (!valido) {
        setErroresValidacion(errores);
        setEstado("error");
        return false;
      }
    } else {
      // Formato asignatura individual (sin wrapper)
      const camposReq = ["nivel", "grado", "area", "competencias"];
      const faltantes = camposReq.filter((f) => !datos[f]);
      if (faltantes.length > 0) {
        setErroresValidacion(faltantes.map((f) => `Campo requerido faltante: "${f}"`));
        setEstado("error");
        return false;
      }
      if (!Array.isArray(datos.competencias) || datos.competencias.length === 0) {
        setErroresValidacion(["El campo 'competencias' debe ser un arreglo no vacío"]);
        setEstado("error");
        return false;
      }
    }
    setErroresValidacion([]);
    return true;
  };

  const manejarImportar = async () => {
    setErrorMensaje("");
    setErroresValidacion([]);
    setResultado(null);

    try {
      setEstado("validando");

      const onProgreso = (actual, total, docId) => {
        setProgreso({ actual, total, ultimo: docId });
      };

      let res;

      if (modo === "archivo") {
        if (!archivo) {
          setErrorMensaje("Selecciona un archivo JSON antes de importar.");
          setEstado("idle");
          return;
        }
        const texto = await archivo.text();
        let datos;
        try {
          datos = JSON.parse(texto);
        } catch {
          setErrorMensaje("El archivo no contiene JSON válido.");
          setEstado("error");
          return;
        }
        if (!validarAntes(datos)) return;
        setEstado("importando");
        res = await importarDesdeArchivo(archivo, onProgreso);

      } else if (modo === "json") {
        if (!jsonTexto.trim()) {
          setErrorMensaje("Pega el JSON del currículo antes de importar.");
          setEstado("idle");
          return;
        }
        let datos;
        try {
          datos = JSON.parse(jsonTexto);
        } catch {
          setErrorMensaje("El texto no es JSON válido.");
          setEstado("error");
          return;
        }
        if (!validarAntes(datos)) return;
        setEstado("importando");
        res = await importarDesdeJSON(jsonTexto, onProgreso);

      } else {
        // modo "asignatura"
        if (!asignaturaTexto.trim()) {
          setErrorMensaje("Pega el JSON de la asignatura antes de importar.");
          setEstado("idle");
          return;
        }
        let datos;
        try {
          datos = JSON.parse(asignaturaTexto);
        } catch {
          setErrorMensaje("El texto no es JSON válido.");
          setEstado("error");
          return;
        }
        const camposReq = ["nivel", "grado", "area", "competencias"];
        const faltantes = camposReq.filter((f) => !datos[f]);
        if (faltantes.length > 0) {
          setErroresValidacion(faltantes.map((f) => `Campo requerido faltante: "${f}"`));
          setEstado("error");
          return;
        }
        if (!Array.isArray(datos.competencias) || datos.competencias.length === 0) {
          setErroresValidacion(["El campo 'competencias' debe ser un arreglo no vacío"]);
          setEstado("error");
          return;
        }
        setEstado("importando");
        res = await importarAsignaturaSingle(datos, onProgreso);
      }

      setResultado(res);
      setEstado(res.errores.length === 0 ? "exito" : "exito_parcial");
    } catch (error) {
      setErrorMensaje(error.message || "Error desconocido durante la importación.");
      setEstado("error");
    }
  };

  const descargarPlantilla = () => {
    const plantilla =
      modo === "asignatura" ? PLANTILLA_ASIGNATURA_EJEMPLO : PLANTILLA_COMPLETA_EJEMPLO;
    const nombre =
      modo === "asignatura"
        ? "plantilla_asignatura_minerd.json"
        : "plantilla_curriculo_minerd.json";
    const blob = new Blob([JSON.stringify(plantilla, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
  };

  const porcentaje =
    progreso.total > 0
      ? Math.round((progreso.actual / progreso.total) * 100)
      : 0;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ color: "#1d4ed8", marginBottom: 4 }}>
        Importar Diseño Curricular Oficial
      </h1>
      <p style={{ color: "#64748b", marginBottom: 28 }}>
        Carga el Diseño Curricular de Secundaria del MINERD a la base de datos de
        DocenteOS. Una vez importado, el sistema consultará la información oficial
        en tiempo real al generar planificaciones, unidades, secuencias e instrumentos.
      </p>

      {/* ── Instrucciones ── */}
      <section
        style={{
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 24,
        }}
      >
        <h3 style={{ margin: "0 0 8px", color: "#1d4ed8", fontSize: 15 }}>
          Campos del esquema extendido
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px", marginBottom: 10 }}>
          {[
            ["nivel, ciclo, grado, area", "Obligatorios"],
            ["competencias[]", "Obligatorio — id, descripcion, indicadoresLogro[]"],
            ["temasCurriculares[]", "Temas funcionales oficiales del grado"],
            ["nivelDominio", "Nivel MCER (A1, A2, B1, B2...)"],
            ["competenciasFundamentales[]", "Las 7 competencias fundamentales"],
            ["criteriosCombinacionTematica[]", "Agrupaciones de temas para unidades largas"],
            ["contenidosGenerales{}", "Conceptuales, procedimentales, actitudinales"],
            ["orientacionesMetodologicas[]", "Enfoques pedagógicos recomendados"],
            ["posiblesProductosFinales[]", "Tipos de evidencia sugeridos"],
          ].map(([campo, desc]) => (
            <div key={campo} style={{ fontSize: 13 }}>
              <code style={{ color: "#1d4ed8" }}>{campo}</code>
              <span style={{ color: "#64748b" }}> — {desc}</span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={descargarPlantilla}
          style={{
            marginTop: 8,
            padding: "8px 18px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Descargar plantilla{modo === "asignatura" ? " (asignatura)" : " completa"}
        </button>
      </section>

      {/* ── Selector de modo ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {MODOS.map((op) => (
          <button
            key={op.key}
            type="button"
            onClick={() => { setModo(op.key); setErrorMensaje(""); setErroresValidacion([]); }}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: `2px solid ${modo === op.key ? "#2563eb" : "#e2e8f0"}`,
              background: modo === op.key ? "#eff6ff" : "#f8fafc",
              color: modo === op.key ? "#1d4ed8" : "#64748b",
              fontWeight: modo === op.key ? 700 : 500,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {op.label}
          </button>
        ))}
      </div>

      {/* ── Descripción del modo ── */}
      {modo === "asignatura" && (
        <div style={{
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 16,
          fontSize: 13,
          color: "#166534",
        }}>
          <strong>Modo Por asignatura:</strong> pega el bloque JSON de una sola asignatura
          (sin el wrapper <code>asignaturas[]</code>). Ideal para archivos grandes o para
          actualizar una asignatura específica sin re-importar todo el currículo.
          Los campos <code>nivel</code>, <code>grado</code>, <code>area</code> y <code>competencias</code> son obligatorios.
        </div>
      )}

      {/* ── Input según modo ── */}
      {modo === "archivo" ? (
        <div
          style={{
            border: "2px dashed #bfdbfe",
            borderRadius: 10,
            padding: "32px 24px",
            textAlign: "center",
            background: "#f8faff",
            marginBottom: 20,
          }}
        >
          <p style={{ color: "#64748b", marginBottom: 12 }}>
            Selecciona el archivo JSON con el diseño curricular
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={manejarArchivo}
            style={{ display: "none" }}
            id="file-input-curriculo"
          />
          <label
            htmlFor="file-input-curriculo"
            style={{
              padding: "10px 24px",
              background: "#2563eb",
              color: "#fff",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Seleccionar archivo
          </label>
          {archivo && (
            <p style={{ marginTop: 12, color: "#059669", fontWeight: 600 }}>
              Archivo: {archivo.name} ({(archivo.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>
      ) : modo === "json" ? (
        <div style={{ marginBottom: 20 }}>
          <label
            htmlFor="json-textarea"
            style={{ display: "block", fontWeight: 600, marginBottom: 6, color: "#374151" }}
          >
            Pega el JSON completo del currículo aquí:
          </label>
          <textarea
            id="json-textarea"
            rows={14}
            value={jsonTexto}
            onChange={(e) => setJsonTexto(e.target.value)}
            placeholder='{ "nivel": "Secundaria", "ciclo": "Primer Ciclo", "asignaturas": [...] }'
            style={{
              width: "100%",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              padding: "12px",
              fontFamily: "monospace",
              fontSize: 13,
              boxSizing: "border-box",
              resize: "vertical",
            }}
          />
        </div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          <label
            htmlFor="asignatura-textarea"
            style={{ display: "block", fontWeight: 600, marginBottom: 6, color: "#374151" }}
          >
            Pega el JSON de la asignatura (sin wrapper <code>asignaturas[]</code>):
          </label>
          <textarea
            id="asignatura-textarea"
            rows={16}
            value={asignaturaTexto}
            onChange={(e) => setAsignaturaTexto(e.target.value)}
            placeholder={'{\n  "nivel": "Secundaria",\n  "ciclo": "Primer Ciclo",\n  "grado": "1ro",\n  "area": "Lenguas Extranjeras",\n  "asignatura": "Inglés",\n  "nivelDominio": "A1",\n  "temasCurriculares": [...],\n  "competencias": [...]\n}'}
            style={{
              width: "100%",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              padding: "12px",
              fontFamily: "monospace",
              fontSize: 13,
              boxSizing: "border-box",
              resize: "vertical",
            }}
          />
        </div>
      )}

      {/* ── Barra de progreso ── */}
      {(estado === "importando" || estado === "validando") && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: "#2563eb", fontWeight: 600, marginBottom: 6 }}>
            {estado === "validando"
              ? "Validando estructura..."
              : `Importando... ${modo === "asignatura" ? "" : `${porcentaje}%`}`}
          </p>
          <div
            style={{
              background: "#e2e8f0",
              borderRadius: 8,
              height: 10,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${estado === "validando" ? 10 : (modo === "asignatura" ? 80 : porcentaje)}%`,
                background: "#2563eb",
                height: "100%",
                transition: "width 0.3s",
              }}
            />
          </div>
          {progreso.ultimo && (
            <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              Último guardado: <code>{progreso.ultimo}</code>
            </p>
          )}
        </div>
      )}

      {/* ── Errores de validación ── */}
      {erroresValidacion.length > 0 && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <h4 style={{ margin: "0 0 8px", color: "#dc2626" }}>
            Errores de validación
          </h4>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {erroresValidacion.map((e, i) => (
              <li key={i} style={{ fontSize: 13, color: "#991b1b", marginBottom: 2 }}>
                {e}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Error general ── */}
      {errorMensaje && estado !== "importando" && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 20,
            color: "#dc2626",
            fontSize: 14,
          }}
        >
          {errorMensaje}
        </div>
      )}

      {/* ── Resultado exitoso ── */}
      {resultado && (estado === "exito" || estado === "exito_parcial") && (
        <div
          style={{
            background: estado === "exito" ? "#f0fdf4" : "#fffbeb",
            border: `1px solid ${estado === "exito" ? "#bbf7d0" : "#fde68a"}`,
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <h4 style={{ margin: "0 0 8px", color: estado === "exito" ? "#15803d" : "#92400e" }}>
            {estado === "exito"
              ? `Importación completada: ${resultado.importados.length} asignatura(s) guardada(s)`
              : `Importación parcial: ${resultado.importados.length} importada(s), ${resultado.errores.length} con errores`}
          </h4>

          {resultado.importados.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 4px" }}>
                Documentos guardados en Firestore:
              </p>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {resultado.importados.map((id) => (
                  <li key={id} style={{ fontSize: 12, color: "#166534", fontFamily: "monospace" }}>
                    {id}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resultado.errores.length > 0 && (
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 4px", color: "#92400e" }}>
                Errores:
              </p>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {resultado.errores.map((e, i) => (
                  <li key={i} style={{ fontSize: 12, color: "#92400e" }}>
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Botones de acción ── */}
      <div style={{ display: "flex", gap: 12 }}>
        <button
          type="button"
          onClick={manejarImportar}
          disabled={estado === "importando" || estado === "validando"}
          style={{
            padding: "12px 32px",
            background:
              estado === "importando" || estado === "validando" ? "#93c5fd" : "#1d4ed8",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 15,
            cursor:
              estado === "importando" || estado === "validando"
                ? "not-allowed"
                : "pointer",
          }}
        >
          {estado === "validando"
            ? "Validando..."
            : estado === "importando"
            ? `Importando ${progreso.actual}/${Math.max(progreso.total, 1)}...`
            : "Importar a Firestore"}
        </button>

        {estado !== "idle" && (
          <button
            type="button"
            onClick={resetear}
            style={{
              padding: "12px 24px",
              background: "#f1f5f9",
              color: "#374151",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            {estado === "exito" || estado === "exito_parcial"
              ? "Importar otra asignatura"
              : "Limpiar"}
          </button>
        )}
      </div>

      {/* ── Estructura Firestore ── */}
      <section
        style={{
          marginTop: 40,
          background: "#1e293b",
          borderRadius: 10,
          padding: "20px 24px",
          color: "#e2e8f0",
        }}
      >
        <h3 style={{ margin: "0 0 12px", color: "#93c5fd", fontSize: 15 }}>
          Estructura de documentos en Firestore (esquema extendido)
        </h3>
        <pre
          style={{
            fontSize: 12,
            lineHeight: 1.7,
            margin: 0,
            overflowX: "auto",
            color: "#94a3b8",
          }}
        >
{`diseñoCurricular/
  {nivel}__{grado}__{area}/          ← ID: secundaria__1ro__lenguas_extranjeras
    nivel, ciclo, grado, area, asignatura
    nivelDominio:                "A1"
    competenciasFundamentales:   ["Comunicativa", ...]
    temasCurriculares:           ["Identificación personal", ...]
    criteriosCombinacionTematica: [
      { nombre, temas[], duracionSugerida, razon }
    ]
    contenidosGenerales: { conceptuales[], procedimentales[], actitudinales[] }
    orientacionesMetodologicas:  ["Enfoque Comunicativo (CLT)...", ...]
    posiblesProductosFinales:    ["Tarjeta de presentación personal", ...]
    competencias: [
      {
        id:                     "CE-ING-1-COM"
        competenciaFundamental: "Comunicativa"
        descripcion:            "..."
        indicadoresLogro: [{ id, descripcion }]
        contenidos: { conceptuales[], procedimentales[], actitudinales[] }
      }
    ]`}
        </pre>
        <p style={{ fontSize: 12, color: "#64748b", marginTop: 12, marginBottom: 0 }}>
          Consulta bajo demanda desde: Planificación · Secuencias Didácticas ·
          Unidades de Aprendizaje · Instrumentos · Registro
        </p>
      </section>
    </div>
  );
}
