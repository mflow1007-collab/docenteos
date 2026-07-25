/**
 * Cerebro curricular MINERD
 *
 * Capa interna previa a la IA: convierte la malla oficial en una arquitectura
 * pedagogica de unidad. No renderiza template ni inventa curriculo; organiza
 * lo que ya trae el banco para que la IA solo redacte actividades coherentes.
 */

const limpiar = (value = "") => String(value || "").replace(/\s+/g, " ").trim();

const lista = (value) => {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [value];
  return [...new Set(arr.map((item) => {
    if (typeof item === "string") return limpiar(item);
    return limpiar(item?.descripcion || item?.texto || item?.nombre || item?.titulo || item?.criterio || item?.valor);
  }).filter(Boolean))];
};

const recortar = (value = "", max = 220) => {
  const text = limpiar(value);
  return text.length > max ? `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}...` : text;
};

const PERFIL_AREA = {
  "Lenguas Extranjeras": {
    enfoque: "Comunicativo: comprension, interaccion y produccion en situaciones reales o simuladas.",
    secuencia: ["input comprensible", "vocabulario y expresiones", "interaccion guiada", "produccion oral/escrita", "socializacion del producto"],
    evidencias: ["desempeno comunicativo oral", "produccion escrita breve", "producto comunicativo"],
    recursos: ["audio o video autentico breve", "flashcards o imagenes", "tarjetas de expresiones", "portafolio"],
  },
  "Inglés": {
    enfoque: "Comunicativo: comprension, interaccion y produccion en ingles en contextos cotidianos.",
    secuencia: ["input comprensible", "vocabulario y expresiones", "practica guiada", "interaccion", "produccion para el portafolio"],
    evidencias: ["desempeno comunicativo oral", "produccion escrita breve", "producto comunicativo"],
    recursos: ["audio o video breve", "imagenes del tema", "flashcards", "portafolio"],
  },
  "Francés": {
    enfoque: "Comunicativo: comprension, interaccion y produccion en frances en contextos cotidianos.",
    secuencia: ["input comprensible", "vocabulario y expresiones", "practica guiada", "interaccion", "produccion para el portafolio"],
    evidencias: ["desempeno comunicativo oral", "produccion escrita breve", "producto comunicativo"],
    recursos: ["audio o video breve", "imagenes del tema", "flashcards", "portafolio"],
  },
  "Lengua Española": {
    enfoque: "Textual, funcional y comunicativo: usar la lengua para comunicar, con el texto como eje.",
    secuencia: ["situacion comunicativa", "comprension textual", "analisis del genero", "produccion textual", "revision y publicacion"],
    evidencias: ["analisis de texto", "borrador revisado", "produccion textual final"],
    recursos: ["textos modelo", "organizador grafico", "rubrica de escritura", "portafolio"],
  },
  "Matemática": {
    enfoque: "Resolucion de problemas: herramienta para la vida, razonamiento y modelacion.",
    secuencia: ["situacion problema", "representacion concreta o grafica", "procedimiento", "argumentacion", "solucion y verificacion"],
    evidencias: ["procedimiento explicado", "representacion matematica", "solucion verificada"],
    recursos: ["material manipulativo", "graficos o tablas", "calculadora cuando proceda", "cuaderno de resolucion"],
  },
  "Ciencias Sociales": {
    enfoque: "Analisis critico de la persona en sociedad, el contexto, las fuentes y la ciudadania.",
    secuencia: ["contexto o problema social", "lectura de fuentes", "analisis causa-consecuencia", "posicion argumentada", "accion ciudadana"],
    evidencias: ["analisis de fuente", "organizador historico/social", "argumento ciudadano"],
    recursos: ["mapas", "fuentes historicas", "graficos", "noticias o documentos"],
  },
  "Ciencias de la Naturaleza": {
    enfoque: "Indagacion cientifica para explicar fenomenos y problemas naturales con evidencias.",
    secuencia: ["observacion del fenomeno", "pregunta o hipotesis", "exploracion/experimento", "analisis de datos", "explicacion con evidencias"],
    evidencias: ["registro de observacion", "datos organizados", "explicacion cientifica"],
    recursos: ["materiales del entorno", "laboratorio basico", "tablas de registro", "modelos o laminas"],
  },
  "Educación Artística": {
    enfoque: "Apreciacion estetica y expresion artistica como competencias para la vida.",
    secuencia: ["apreciacion de referente", "exploracion tecnica", "creacion guiada", "revision estetica", "exhibicion o socializacion"],
    evidencias: ["bitacora creativa", "pieza en proceso", "produccion artistica"],
    recursos: ["imagenes o piezas de referencia", "materiales artisticos", "bitacora", "espacio de exhibicion"],
  },
  "Educación Física": {
    enfoque: "Cuerpo y movimiento con enfoque holistico, salud, colaboracion y autocuidado.",
    secuencia: ["activacion corporal", "demostracion tecnica", "practica guiada", "juego o reto motor", "reflexion sobre salud"],
    evidencias: ["ejecucion motriz", "participacion colaborativa", "registro de progreso"],
    recursos: ["espacio seguro", "material deportivo", "cronometro", "lista de cotejo motriz"],
  },
  "Formación Integral Humana y Religiosa": {
    enfoque: "Desarrollo humano integral desde dimensiones antropologicas, axiologicas, religiosas y trascendentes.",
    secuencia: ["experiencia humana", "dialogo reflexivo", "analisis de valores", "discernimiento", "compromiso personal o comunitario"],
    evidencias: ["reflexion escrita", "dialogo argumentado", "compromiso observable"],
    recursos: ["casos de vida", "textos de valores", "diario reflexivo", "recursos comunitarios"],
  },
};

const PERFIL_DEFAULT = {
  enfoque: "Aprendizaje significativo por competencias, contextualizado y orientado a evidencias.",
  secuencia: ["situacion de aprendizaje", "exploracion", "construccion", "aplicacion", "socializacion"],
  evidencias: ["desempeno observable", "producto del proceso", "reflexion metacognitiva"],
  recursos: ["recursos del entorno", "material visual", "organizador de trabajo", "portafolio"],
};

export const obtenerPerfilPedagogicoArea = (area = "", asignatura = "") => (
  PERFIL_AREA[asignatura] || PERFIL_AREA[area] || PERFIL_DEFAULT
);

const normalizarClaveCriterio = (value = "") => limpiar(value)
  .toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

const hashCriterio = (value = "") => {
  let hash = 2166136261;
  for (const char of String(value || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase();
};

const textoCriterio = (item) => limpiar(
  typeof item === "string"
    ? item
    : item?.textoOficial || item?.descripcion || item?.texto || item?.criterio || item?.valor
);

/**
 * Convierte los criterios literales de la malla en objetos estables, sin
 * inventar relaciones. La competencia fundamental/origen solo se conserva
 * cuando el documento la declara en su propia estructura.
 */
export const extraerCriteriosEvaluacionCanonicos = (payload = {}, contexto = {}) => {
  const metadata = payload.metadata || {};
  const base = {
    nivel: limpiar(contexto.nivel || payload.nivel || payload.level || metadata.nivel || metadata.level),
    ciclo: limpiar(contexto.ciclo || payload.ciclo || payload.cycle || metadata.ciclo || metadata.cycle),
    grado: limpiar(contexto.grado || payload.grado || payload.grade || metadata.grado || metadata.grade),
    area: limpiar(contexto.area || payload.area || metadata.area),
    asignatura: limpiar(contexto.asignatura || payload.asignatura || payload.subject || metadata.asignatura || metadata.subject),
  };
  const fuentePayload = payload.fuente || metadata.fuente || {};
  const fuenteBase = {
    documento: limpiar(
      typeof fuentePayload === "string"
        ? fuentePayload
        : fuentePayload.documento || fuentePayload.titulo || fuentePayload.nombre
    ),
    institucion: limpiar(
      typeof fuentePayload === "object" ? fuentePayload.institucion || fuentePayload.organismo : ""
    ),
    url: limpiar(typeof fuentePayload === "object" ? fuentePayload.url : ""),
  };
  const candidatos = [];
  const agregar = (items, origen, extra = {}) => {
    (Array.isArray(items) ? items : items ? [items] : []).forEach((item) => {
      const textoOficial = textoCriterio(item);
      if (!textoOficial) return;
      candidatos.push({
        ...base,
        textoOficial,
        competenciaFundamental: limpiar(extra.competenciaFundamental),
        competenciaIdDeclarada: limpiar(extra.competenciaIdDeclarada),
        origen,
        fuente: {
          ...fuenteBase,
          pagina: Number(item?.pagina || item?.page || extra.pagina || 0) || null,
          fragmentoId: limpiar(item?.fragmentoId || item?.fragmentId || extra.fragmentoId),
        },
      });
    });
  };

  agregar(payload.criteriosEvaluacion, "criteriosEvaluacion");
  agregar(payload.criteriosDeEvaluacion, "criteriosDeEvaluacion");
  agregar(payload.evaluacion?.criterios, "evaluacion.criterios");
  (payload.aportesCompetenciasFundamentales || []).forEach((aporte) => {
    agregar(aporte?.criteriosEvaluacion || aporte?.criterios, "aportesCompetenciasFundamentales", {
      competenciaFundamental: aporte?.competenciaFundamental || aporte?.fundamental,
      fragmentoId: aporte?.fragmentoId,
    });
  });
  (payload.competencias || []).forEach((competencia) => {
    agregar(competencia?.criteriosEvaluacion || competencia?.criterios, "competencias", {
      competenciaFundamental: competencia?.competenciaFundamental || competencia?.fundamental,
      competenciaIdDeclarada: competencia?.id || competencia?.codigo || competencia?.codigoOficial,
      fragmentoId: competencia?.fragmentoId,
    });
  });

  const unicos = new Map();
  candidatos.forEach((criterio) => {
    const claveTexto = normalizarClaveCriterio(criterio.textoOficial);
    const clave = `${normalizarClaveCriterio(criterio.competenciaFundamental)}|${claveTexto}`;
    if (!unicos.has(clave)) {
      const prefijo = [
        "CR",
        normalizarClaveCriterio(criterio.asignatura || criterio.area).slice(0, 8).toUpperCase() || "AREA",
        normalizarClaveCriterio(criterio.grado).slice(0, 5).toUpperCase() || "GRADO",
      ].join("-");
      unicos.set(clave, {
        id: `${prefijo}-${hashCriterio(clave)}`,
        ...criterio,
        textoNormalizado: claveTexto,
        relaciones: {
          tipo: criterio.competenciaIdDeclarada || criterio.competenciaFundamental ? "declarada_en_fuente" : "sin_relacion_declarada",
          competenciaIds: criterio.competenciaIdDeclarada ? [criterio.competenciaIdDeclarada] : [],
        },
      });
    }
  });
  return [...unicos.values()];
};

export const inventariarCriteriosCurriculares = (documentos = []) =>
  (Array.isArray(documentos) ? documentos : []).map((documento) => {
    const payload = documento?.payload || documento || {};
    const criterios = extraerCriteriosEvaluacionCanonicos(payload);
    return {
      documentoId: documento?.id || payload.id || "",
      nivel: payload.nivel || payload.level || payload.metadata?.nivel || "",
      ciclo: payload.ciclo || payload.cycle || payload.metadata?.ciclo || "",
      grado: payload.grado || payload.grade || payload.metadata?.grado || "",
      area: payload.area || payload.metadata?.area || "",
      asignatura: payload.asignatura || payload.subject || payload.metadata?.asignatura || "",
      cantidadCriterios: criterios.length,
      conCompetenciaDeclarada: criterios.filter((c) =>
        c.relaciones.tipo === "declarada_en_fuente"
      ).length,
      cobertura: criterios.length ? "presente" : "ausente",
      criterios,
    };
  });

const PALABRAS_VACIAS_RELACION = new Set([
  "para", "como", "donde", "desde", "entre", "sobre", "mediante", "utilizando",
  "diferentes", "distintas", "situaciones", "forma", "manera", "serie", "mismo",
  "misma", "propios", "otras", "otros", "personas", "presentada", "concretas",
]);

const tokensRelacion = (texto = "") => normalizarClaveCriterio(texto)
  .split("-")
  .filter((token) => token.length >= 4 && !PALABRAS_VACIAS_RELACION.has(token));

const FAMILIAS_ACCION = [
  ["comprender", /comprend|identific|reconoc|interpre|respond/],
  ["producir", /produc|elabor|redact|escrib|constru|crear|present/],
  ["interactuar", /interact|dialog|convers|pregunt|respuest|comunic/],
  ["argumentar", /argument|justific|opinion|punto de vista|critic/],
  ["resolver", /resolv|solucion|calcular|procedimiento|estrategia/],
  ["investigar", /investig|indag|hipotes|experiment|evidencia|datos/],
  ["ejecutar", /ejecut|demostr|practic|motriz|movimiento/],
  ["valorar", /valor|actitud|respeto|responsab|conviv|cuidado/],
];

const familiasDeTexto = (texto = "") => FAMILIAS_ACCION
  .filter(([, patron]) => patron.test(normalizarClaveCriterio(texto).replaceAll("-", " ")))
  .map(([familia]) => familia);

/**
 * Propone relaciones DERIVADAS entre criterios e indicadores. Nunca las marca
 * como oficiales salvo que el documento declare el mismo competenciaId.
 */
export const relacionarCriteriosConIndicadores = ({
  criterios = [],
  indicadores = [],
  competencias = [],
} = {}) => {
  const comps = (competencias || []).map(normalizarCompetencia);
  const compPorId = new Map(comps.map((comp) => [comp.id, comp]));
  const criteriosCanonicos = (criterios || []).filter((c) => c?.textoOficial);

  return (indicadores || []).map(normalizarIndicador).filter((ind) => ind.id || ind.descripcion).map((indicador) => {
    const tokensIndicador = new Set(tokensRelacion(indicador.descripcion));
    const familiasIndicador = familiasDeTexto(indicador.descripcion);
    const compIndicador = compPorId.get(indicador.competenciaId);
    const candidatos = criteriosCanonicos.map((criterio) => {
      const tokensCriterio = new Set(tokensRelacion(criterio.textoOficial));
      const comunes = [...tokensIndicador].filter((token) => tokensCriterio.has(token));
      const familiasCriterio = familiasDeTexto(criterio.textoOficial);
      const familiasComunes = familiasIndicador.filter((familia) => familiasCriterio.includes(familia));
      const mismaCompetenciaDeclarada = Boolean(
        criterio.competenciaIdDeclarada
        && indicador.competenciaId
        && criterio.competenciaIdDeclarada === indicador.competenciaId
      );
      const mismaFundamentalDeclarada = Boolean(
        criterio.competenciaFundamental
        && compIndicador?.fundamental
        && normalizarClaveCriterio(criterio.competenciaFundamental)
          === normalizarClaveCriterio(compIndicador.fundamental)
      );
      const puntaje = comunes.length * 2
        + familiasComunes.length * 4
        + (mismaCompetenciaDeclarada ? 12 : 0)
        + (mismaFundamentalDeclarada ? 8 : 0);
      return {
        criterio,
        puntaje,
        comunes,
        familiasComunes,
        mismaCompetenciaDeclarada,
        mismaFundamentalDeclarada,
      };
    }).sort((a, b) => b.puntaje - a.puntaje);
    const mejor = candidatos[0] || null;
    if (!mejor || mejor.puntaje < 4) {
      return {
        indicadorId: indicador.id,
        indicadorDescripcion: indicador.descripcion,
        criterioId: "",
        criterioTexto: "",
        tipoRelacion: "sin_correspondencia_suficiente",
        confianza: "requiere_revision",
        puntaje: mejor?.puntaje || 0,
        justificacion: "No existe una correspondencia semántica suficiente con los criterios oficiales disponibles.",
      };
    }
    const declarada = mejor.mismaCompetenciaDeclarada;
    const confianza = declarada || mejor.puntaje >= 10
      ? "alta"
      : mejor.puntaje >= 6 ? "media" : "requiere_revision";
    return {
      indicadorId: indicador.id,
      indicadorDescripcion: indicador.descripcion,
      criterioId: mejor.criterio.id,
      criterioTexto: mejor.criterio.textoOficial,
      tipoRelacion: declarada ? "declarada_en_fuente" : "derivada",
      confianza,
      puntaje: mejor.puntaje,
      justificacion: [
        mejor.mismaCompetenciaDeclarada ? "La fuente declara la misma competencia específica." : "",
        mejor.mismaFundamentalDeclarada ? "Comparte la Competencia Fundamental declarada." : "",
        mejor.familiasComunes.length ? `Coincide en la acción cognitiva: ${mejor.familiasComunes.join(", ")}.` : "",
        mejor.comunes.length ? `Coincide en: ${mejor.comunes.slice(0, 4).join(", ")}.` : "",
      ].filter(Boolean).join(" "),
    };
  });
};

export const seleccionarRelacionParaEvidencia = ({
  texto = "",
  relaciones = [],
  umbral = 4,
} = {}) => {
  const tokensTexto = new Set(tokensRelacion(texto));
  const familiasTexto = familiasDeTexto(texto);
  const candidatos = (Array.isArray(relaciones) ? relaciones : [])
    .filter((relacion) => relacion?.criterioId && relacion?.indicadorId)
    .map((relacion) => {
      const referente = [
        relacion.criterioTexto,
        relacion.indicadorDescripcion,
      ].filter(Boolean).join(" ");
      const tokensReferente = new Set(tokensRelacion(referente));
      const comunes = [...tokensTexto].filter((token) => tokensReferente.has(token));
      const familiasReferente = familiasDeTexto(referente);
      const familiasComunes = familiasTexto.filter((familia) => familiasReferente.includes(familia));
      return {
        ...relacion,
        puntajeEvidencia: comunes.length * 2 + familiasComunes.length * 4,
        coincidenciasEvidencia: comunes,
        familiasEvidencia: familiasComunes,
      };
    })
    .sort((a, b) => b.puntajeEvidencia - a.puntajeEvidencia);
  const mejor = candidatos[0] || null;
  if (!mejor || mejor.puntajeEvidencia < umbral) return null;
  return mejor;
};

const normalizarCompetencia = (comp = {}) => ({
  id: limpiar(comp.id || comp.codigo || comp.codigoOficial),
  fundamental: limpiar(comp.competenciaFundamental || comp.fundamental),
  especifica: limpiar(comp.especificaGrado || comp.especifica || comp.descripcion || comp.texto),
});

const normalizarIndicador = (ind = {}, index = 0) => ({
  id: limpiar(ind.codigoOficial || ind.id || ind.codigo || `IL-${index + 1}`),
  competenciaId: limpiar(ind.competenciaId || ind.competencia),
  descripcion: limpiar(ind.descripcion || ind.texto),
});

export const construirArquitecturaUnidadMINERD = ({
  mallaPayload = {},
  titulo = "",
  area = "",
  asignatura = "",
  grado = "",
  ciclo = "",
  nivel = "",
  producto = "",
  contextoComunitario = "",
  mallaContenidos = {},
  competencias = [],
  indicadores = [],
  indicadoresTrabajo = [],
  estrategia = "",
} = {}) => {
  const perfilArea = obtenerPerfilPedagogicoArea(area, asignatura || area);
  const indicadoresActuales = indicadoresTrabajo.map(normalizarIndicador).filter((i) => i.descripcion || i.id);
  const indicadoresTotales = indicadores.map(normalizarIndicador).filter((i) => i.descripcion || i.id);
  const idsActuales = new Set(indicadoresActuales.map((i) => i.id).filter(Boolean));
  const competenciasNormalizadas = competencias.map(normalizarCompetencia).filter((c) => c.especifica || c.fundamental);
  const conceptuales = [
    ...lista(mallaContenidos.vocabulario),
    ...lista(mallaContenidos.gramatica),
    ...lista(mallaContenidos.expresiones),
  ];
  const procedimentales = lista(mallaContenidos.funcionales);
  const actitudinales = lista(mallaContenidos.actitudinales);
  const criteriosEvaluacionDetalle = extraerCriteriosEvaluacionCanonicos(mallaPayload, {
    nivel, ciclo, grado, area, asignatura,
  });
  const criteriosEvaluacion = criteriosEvaluacionDetalle.map((criterio) => criterio.textoOficial);
  const relacionesCriterioIndicador = relacionarCriteriosConIndicadores({
    criterios: criteriosEvaluacionDetalle,
    indicadores: indicadoresActuales,
    competencias: competenciasNormalizadas,
  });

  return {
    schemaVersion: "curriculumBrain-1.0",
    marcoMINERD: {
      enfoques: ["Historico-Cultural", "Socio-critico", "Competencias"],
      principios: [
        "aprendizaje significativo",
        "funcionalidad del aprendizaje",
        "integracion de conceptos, procedimientos, actitudes y valores",
        "contextualizacion al centro, comunidad y estudiante adolescente",
        "evaluacion continua, participativa y formativa",
      ],
    },
    contextoCurricular: {
      nivel: limpiar(nivel || mallaPayload.nivel || mallaPayload.metadata?.nivel),
      ciclo: limpiar(ciclo || mallaPayload.ciclo || mallaPayload.metadata?.ciclo),
      grado: limpiar(grado || mallaPayload.grado || mallaPayload.metadata?.grado),
      area: limpiar(area || mallaPayload.area || mallaPayload.metadata?.area),
      asignatura: limpiar(asignatura || mallaPayload.asignatura || mallaPayload.metadata?.asignatura || area),
      temaOficial: limpiar(titulo),
    },
    perfilArea,
    situacionAprendizaje: {
      ambienteOperativo: contextoComunitario
        ? `Contexto real aportado por el docente: ${recortar(contextoComunitario, 260)}`
        : `Aula y comunidad como espacios de aprendizaje para ${limpiar(titulo)}.`,
      problemaProducto: producto
        ? `Comprender y aplicar "${limpiar(titulo)}" para construir progresivamente ${limpiar(producto)}.`
        : `Comprender y aplicar "${limpiar(titulo)}" en una produccion o solucion contextualizada.`,
      puntoPartida: "Exploracion diagnostica de saberes previos, intereses, experiencias y vocabulario/conceptos que ya poseen los estudiantes.",
      aprendizajesRequeridos: [
        ...conceptuales.slice(0, 5).map((c) => `Conceptual: ${c}`),
        ...procedimentales.slice(0, 4).map((p) => `Procedimental: ${p}`),
        ...actitudinales.slice(0, 3).map((a) => `Actitud/valor: ${a}`),
      ],
      secuenciaOperaciones: perfilArea.secuencia,
      puntoLlegada: producto || "Producto, desempeno o solucion evaluable vinculada al tema.",
    },
    seleccionCurricular: {
      competencias: competenciasNormalizadas,
      indicadores: {
        actuales: indicadoresActuales,
        disponibles: indicadoresTotales.filter((i) => !idsActuales.has(i.id)),
      },
      contenidos: {
        conceptuales,
        procedimentales,
        actitudinales,
      },
    },
    evaluacion: {
      criterios: criteriosEvaluacion,
      criteriosDetalle: criteriosEvaluacionDetalle,
      coberturaCriterios: criteriosEvaluacionDetalle.length ? "presente" : "ausente",
      relacionesCriterioIndicador,
      momentos: ["diagnostica", "formativa", "sumativa"],
      agentes: ["autoevaluacion", "coevaluacion", "heteroevaluacion"],
      evidenciasPreferentes: perfilArea.evidencias,
    },
    estrategiaPrincipal: estrategia || perfilArea.secuencia[0],
    recursosSugeridosArea: perfilArea.recursos,
    reglasIA: [
      "No inventar competencias, indicadores ni contenidos.",
      "Usar los procedimientos como base de las actividades.",
      "Relacionar cada evidencia con indicador, producto o desempeno observable.",
      "Adaptar actividades a la naturaleza didactica del area.",
    ],
  };
};

export const resumirArquitecturaParaPrompt = (arquitectura = {}) => {
  if (!arquitectura || typeof arquitectura !== "object") return "";
  const perfil = arquitectura.perfilArea || {};
  const situacion = arquitectura.situacionAprendizaje || {};
  const seleccion = arquitectura.seleccionCurricular || {};
  const evaluacion = arquitectura.evaluacion || {};
  const contenidos = seleccion.contenidos || {};
  const indicadores = seleccion.indicadores || {};
  const actuales = lista((indicadores.actuales || []).map((i) => `[${i.id}] ${i.descripcion}`)).slice(0, 5);

  return [
    "CEREBRO CURRICULAR MINERD (preparado por DocenteOS; respetalo):",
    `- Enfoque del area: ${perfil.enfoque || PERFIL_DEFAULT.enfoque}`,
    `- Secuencia didactica del area: ${(perfil.secuencia || PERFIL_DEFAULT.secuencia).join(" -> ")}`,
    `- Situacion de aprendizaje: ${recortar(situacion.problemaProducto || situacion.puntoLlegada || "", 260)}`,
    `- Procedimientos base para actividades: ${lista(contenidos.procedimentales).slice(0, 8).join("; ") || "(usar procedimientos oficiales disponibles)"}`,
    `- Actitudes y valores a observar: ${lista(contenidos.actitudinales).slice(0, 5).join("; ") || "(usar actitudes oficiales disponibles)"}`,
    `- Indicadores de esta unidad: ${actuales.join(" | ") || "(copiar solo indicadores precargados)"}`,
    `- Criterios de evaluacion: ${lista(evaluacion.criterios).slice(0, 5).join("; ") || "definir desde los indicadores trabajados"}`,
    `- Evidencias preferentes del area: ${lista(evaluacion.evidenciasPreferentes).join("; ")}`,
    `- Recursos sugeridos por naturaleza del area: ${lista(arquitectura.recursosSugeridosArea).join("; ")}`,
  ].join("\n");
};

const ventanaCircular = (items = [], indice = 0, cantidad = 1) => {
  const arr = lista(items);
  if (!arr.length) return [];
  const start = Math.max(0, indice) % arr.length;
  return Array.from({ length: Math.min(cantidad, arr.length) }, (_, i) => arr[(start + i) % arr.length]);
};

export const resolverFocosCurriculares = ({
  arquitectura = {},
  contenidosClaves = {},
  semanaNum = 1,
  diaGlobal = 1,
  numSemanas = 4,
} = {}) => {
  const esIdioma = Boolean(arquitectura?.contextoCurricular?.asignatura?.match(/ingl[eé]s|franc[eé]s/i))
    || Boolean(arquitectura?.contextoCurricular?.area?.match(/lenguas extranjeras/i));
  const indice = Math.max(0, Number(diaGlobal || 1) - 1);
  const semana = Math.max(1, Number(semanaNum || 1));
  const contenidos = arquitectura?.seleccionCurricular?.contenidos || {};
  const perfil = arquitectura?.perfilArea || PERFIL_DEFAULT;

  const vocabulario = lista(contenidosClaves.vocabulario?.length ? contenidosClaves.vocabulario : contenidos.conceptuales);
  const gramatica = lista(contenidosClaves.gramatica);
  const expresiones = lista(contenidosClaves.expresiones);
  const procedimientos = lista(contenidosClaves.funcionales?.length ? contenidosClaves.funcionales : contenidos.procedimentales);
  const conceptos = lista(contenidos.conceptuales);
  const actitudes = lista(contenidos.actitudinales);
  const evidencias = lista(arquitectura?.evaluacion?.evidenciasPreferentes);
  const etapaArea = ventanaCircular(perfil.secuencia, Math.max(0, semana - 1), 1)[0] || "construccion del aprendizaje";

  if (semana === 1) {
    return {
      principal: "Apropiacion de la unidad / situacion de aprendizaje / producto / evaluacion",
      detalles: [
        etapaArea,
        ...ventanaCircular(vocabulario, indice, 2),
        ...ventanaCircular(procedimientos, indice, 1),
      ].filter(Boolean),
      fuente: "marco_introductorio_minerd",
    };
  }

  if (esIdioma) {
    const semanasConEstructura = Math.max(numSemanas - 1, 1);
    const perWeek = Math.max(1, Math.ceil(gramatica.length / semanasConEstructura));
    const start = Math.max(0, semana - 2) * perWeek;
    const estructura = gramatica.slice(start, start + perWeek);
    const estructuraReciclada = !estructura.length && gramatica.length
      ? [gramatica[(semana - 2) % gramatica.length]]
      : estructura;
    return {
      principal: estructuraReciclada[0] || ventanaCircular(procedimientos, indice, 1)[0] || etapaArea,
      detalles: [
        ...estructuraReciclada,
        ...ventanaCircular(vocabulario, indice, 3),
        ...ventanaCircular(expresiones, indice, 1),
        ...ventanaCircular(procedimientos, indice, 1),
      ].filter(Boolean),
      fuente: estructuraReciclada.length ? "estructura_idioma" : "procedimiento_idioma",
    };
  }

  const procedimiento = ventanaCircular(procedimientos, indice, 1)[0];
  const concepto = ventanaCircular(conceptos, indice, 1)[0];
  const evidencia = ventanaCircular(evidencias, indice, 1)[0];
  const actitud = ventanaCircular(actitudes, indice, 1)[0];

  return {
    principal: procedimiento || concepto || etapaArea,
    detalles: [etapaArea, procedimiento, concepto, evidencia, actitud].filter(Boolean),
    fuente: procedimiento ? "procedimiento_area" : "concepto_area",
  };
};
