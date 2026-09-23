// Convierte src/data/curriculo/curriculo-lenguas-extranjeras-secundaria-2023.json
// (estructura literal del PDF: idiomas → ciclos → mallas_curriculares por grado, con
// los criterios de evaluación aparte en aportes_a_las_competencias_fundamentales)
// al formato de MALLA del Banco de Conocimiento (validateJsonSobre), un archivo por
// grado, listo para importar por la vía LITERAL ("Leer JSON").
//
// Uso:  node scripts/convertir_curriculo_lenguas.mjs [--out <dir>]
//   Sin --out escribe en src/data/curriculo/mallas/
//
// NO toca red ni Firestore. Solo lee el JSON fuente y escribe archivos locales.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FUENTE = join(ROOT, "src/data/curriculo/curriculo-lenguas-extranjeras-secundaria-2023.json");
const outArg = process.argv.indexOf("--out");
const OUT = outArg > -1 ? process.argv[outArg + 1] : join(ROOT, "src/data/curriculo/mallas");

// "1er. Grado" → "1ro", etc. (el formato de grade que usa el Banco).
const GRADO_A_SUFIJO = {
  "1er. Grado": "1ro", "2do. Grado": "2do", "3er. Grado": "3ro",
  "4to. Grado": "4to", "5to. Grado": "5to", "6to. Grado": "6to",
};
// Clave de columna por grado dentro de aportes/competencias_especificas_por_grado.
const GRADO_A_COLUMNA = {
  "1ro": "Primero", "2do": "Segundo", "3ro": "Tercero",
  "4to": "Cuarto", "5to": "Quinto", "6to": "Sexto",
};
const CICLO_DE_GRADO = { "1ro": "Primer Ciclo", "2do": "Primer Ciclo", "3ro": "Primer Ciclo",
  "4to": "Segundo Ciclo", "5to": "Segundo Ciclo", "6to": "Segundo Ciclo" };
const PREFIJO_IDIOMA = { ingles: "ING", frances: "FRA" };
const SUBJECT = { ingles: "Ingles", frances: "Frances" };

// Normaliza para comparar competencias fundamentales pese a erratas del PDF
// ("Pensamiento Lógico, Crítico y Creativo" vs "...Creativo y Crítico",
//  "Ambientaly de la Salud", etc.).
const normCF = (s = "") => s.toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z]/g, "");
const claveCF = (cf = "") => {
  const n = normCF(cf);
  if (n.includes("comunicativa")) return "comunicativa";
  if (n.includes("pensamiento")) return "pensamiento";
  if (n.includes("resolucion")) return "resolucion";
  if (n.includes("etica")) return "etica";
  if (n.includes("cientifica")) return "cientifica";
  if (n.includes("ambiental")) return "ambiental";
  if (n.includes("desarrollo") || n.includes("personalyespiritual")) return "desarrollo";
  return n;
};

// Extrae los TEMAS oficiales del bloque "Temas" de conceptos: son las viñetas
// (líneas que empiezan con •) entre el encabezado "Temas" y el siguiente
// sub-encabezado ("Vocabulario"). Une las líneas de continuación (sin viñeta)
// a la viñeta anterior, respetando la maquetación del PDF.
const extraerTemas = (conceptosLineas = []) => {
  const temas = [];
  let dentro = false;
  for (const raw of conceptosLineas) {
    const linea = String(raw).trim();
    if (/^temas:?$/i.test(linea)) { dentro = true; continue; }
    if (!dentro) continue;
    if (/^(vocabulario|expresiones|gram[aá]tica)/i.test(linea)) break;
    if (linea.startsWith("•")) {
      temas.push(linea.replace(/^•\s*/, "").trim());
    } else if (temas.length) {
      temas[temas.length - 1] = `${temas[temas.length - 1]} ${linea}`.trim();
    }
  }
  return temas.filter(Boolean);
};

const fuente = JSON.parse(readFileSync(FUENTE, "utf8"));
mkdirSync(OUT, { recursive: true });

const resumen = [];

for (const idiomaKey of ["ingles", "frances"]) {
  const idioma = fuente.idiomas[idiomaKey];
  const pref = PREFIJO_IDIOMA[idiomaKey];

  for (const ciclo of idioma.ciclos) {
    // Índice de criterios por competencia fundamental (vienen a nivel de CICLO).
    const criteriosPorCF = {};
    for (const aporte of ciclo.aportes_a_las_competencias_fundamentales || []) {
      criteriosPorCF[claveCF(aporte.competencia_fundamental)] =
        (aporte.criterios_de_evaluacion || []).filter(Boolean);
    }

    for (const malla of ciclo.mallas_curriculares || []) {
      const grade = GRADO_A_SUFIJO[malla.grado];
      if (!grade) { console.warn("grado no mapeado:", malla.grado); continue; }
      const nGrado = grade.replace(/\D/g, ""); // "1", "2"...

      const compsFuente = malla.competencias_especificas_del_grado || [];
      const indicadores = (malla.indicadores_de_logro || []).map((d) => String(d).trim()).filter(Boolean);

      // El PDF trae 21 indicadores por grado en el mismo orden de las 7 CF
      // (3 por competencia: comprensión, producción, interacción). Se reparten
      // en bloques de 3 para anidarlos bajo su competencia.
      const competencias = compsFuente.map((comp, i) => {
        const cf = comp.competencia_fundamental;
        const ck = claveCF(cf);
        const idComp = `${pref}-${nGrado}-C${String(i + 1).padStart(2, "0")}`;
        const bloque = indicadores.slice(i * 3, i * 3 + 3);
        return {
          id: idComp,
          fundamental: cf,
          competenciaFundamental: cf,
          especificaGrado: comp.competencia_especifica_del_grado || "",
          descripcion: comp.competencia_especifica_del_grado || "",
          indicadoresLogro: bloque.map((desc, j) => ({
            id: `${pref}-${nGrado}-I${String(i * 3 + j + 1).padStart(2, "0")}`,
            descripcion: desc,
            competenciaId: idComp,
          })),
          criteriosEvaluacion: criteriosPorCF[ck] || [],
        };
      });

      // Listas raíz (compatibilidad con el contador de los 3 orígenes).
      const indicadoresLogroRaiz = competencias.flatMap((c) => c.indicadoresLogro);
      const criteriosRaiz = [...new Set(competencias.flatMap((c) => c.criteriosEvaluacion))];

      // Contenidos: se conservan las líneas literales del PDF (con sus saltos de
      // maquetación). El validador (validateJsonSobre) lee conceptuales/procedimentales
      // desde `contenidosGenerales`, los temas desde la raíz `temas`, y los
      // actitudinales desde `contenidos.actitudesValores`.
      const contenidos = malla.contenidos || {};
      const conceptosLineas = (contenidos.conceptos || []).map((s) => String(s).trim()).filter(Boolean);
      const procedLineas = (contenidos.procedimientos || []).map((s) => String(s).trim()).filter(Boolean);
      const actitudLineas = (contenidos.actitudes_y_valores || []).map((s) => String(s).trim()).filter(Boolean);
      // Temas oficiales: las viñetas del bloque "Temas" (hasta el sub-encabezado
      // "Vocabulario"). Son las líneas con viñeta antes de esa marca.
      const temas = extraerTemas(conceptosLineas);

      const sobre = {
        schemaVersion: "1.3",
        level: "Secundaria",
        cycle: CICLO_DE_GRADO[grade],
        grade,
        area: "Lenguas Extranjeras",
        subject: SUBJECT[idiomaKey],
        contentType: "malla_curricular",
        contentId: `malla-${idiomaKey}-${grade}-secundaria-2023`,
        metadata: {
          fuente: "Adecuación Curricular Nivel Secundario MINERD 2023",
          paginas: malla.paginas_documento || null,
          mcer: (fuente.alineacion_mcer?.niveles_por_grado || [])
            .find((n) => n.grado === grade && n.nivel_y_ciclo?.includes("Secundario"))?.[idiomaKey] || null,
        },
        competenciasFundamentales: competencias.map((c) => c.competenciaFundamental),
        competencias,
        indicadoresLogro: indicadoresLogroRaiz,
        indicadores: indicadoresLogroRaiz,
        criteriosEvaluacion: criteriosRaiz,
        temas,
        // El validador lee conceptuales/procedimentales/actitudinales desde aquí.
        contenidosGenerales: {
          conceptuales: conceptosLineas,
          procedimentales: procedLineas,
          actitudinales: actitudLineas,
          actitudesValores: actitudLineas,
        },
        // Se conserva también la forma cruda del PDF para trazabilidad.
        contenidos: {
          conceptos: conceptosLineas,
          procedimientos: procedLineas,
          actitudesValores: actitudLineas,
        },
      };

      const nombre = `malla_${idiomaKey}_${grade}_secundaria_2023.json`;
      writeFileSync(join(OUT, nombre), JSON.stringify(sobre, null, 2) + "\n");
      resumen.push({
        archivo: nombre,
        competencias: competencias.length,
        indicadores: indicadoresLogroRaiz.length,
        criterios: criteriosRaiz.length,
      });
    }
  }
}

console.log(`Escritas ${resumen.length} mallas en ${OUT}\n`);
console.table(resumen);

// ─── Módulo derivado compacto para el diagnóstico (Paso 3) ───────────────────
// Expone SOLO los indicadores oficiales por idioma+grado (no las mallas enteras),
// para que referenciaLocal del diagnóstico ofrezca los 21 indicadores reales
// como respaldo cuando la malla no está en Firestore. Se regenera con este script.
const indicadoresPorIdiomaGrado = {};
for (const idiomaKey of ["ingles", "frances"]) {
  const idioma = fuente.idiomas[idiomaKey];
  const subject = SUBJECT[idiomaKey];
  indicadoresPorIdiomaGrado[subject] = {};
  for (const ciclo of idioma.ciclos) {
    for (const malla of ciclo.mallas_curriculares || []) {
      const grade = GRADO_A_SUFIJO[malla.grado];
      if (!grade) continue;
      const comps = malla.competencias_especificas_del_grado || [];
      const indics = (malla.indicadores_de_logro || []).map((d) => String(d).trim()).filter(Boolean);
      // Empareja cada indicador con su competencia (bloques de 3).
      indicadoresPorIdiomaGrado[subject][grade] = indics.map((descripcion, i) => ({
        descripcion,
        competencia: comps[Math.floor(i / 3)]?.competencia_fundamental || "",
      }));
    }
  }
}
const modulo = `// GENERADO por scripts/convertir_curriculo_lenguas.mjs — no editar a mano.
// Indicadores de logro OFICIALES (MINERD 2023) por asignatura y grado, para el
// respaldo del diagnóstico cuando la malla no está en el Banco de Conocimiento.
// Fuente: src/data/curriculo/curriculo-lenguas-extranjeras-secundaria-2023.json

export const INDICADORES_OFICIALES_IDIOMAS = ${JSON.stringify(indicadoresPorIdiomaGrado, null, 2)};

const TABLA_GRADO = {
  "1ro": "1ro", primero: "1ro", first: "1ro", "1": "1ro",
  "2do": "2do", segundo: "2do", second: "2do", "2": "2do",
  "3ro": "3ro", tercero: "3ro", third: "3ro", "3": "3ro",
  "4to": "4to", cuarto: "4to", fourth: "4to", "4": "4to",
  "5to": "5to", quinto: "5to", fifth: "5to", "5": "5to",
  "6to": "6to", sexto: "6to", sixth: "6to", "6": "6to",
};
const normGrado = (g = "") => TABLA_GRADO[String(g).toLowerCase().trim().split(/\\s+/)[0]] || "";
const normAsig = (a = "") => /fran|french/i.test(a) ? "Frances" : "Ingles";

/** Devuelve los 21 indicadores oficiales del idioma+grado, o [] si no hay. */
export const getIndicadoresOficialesIdioma = (asignatura, grado) => {
  const g = normGrado(grado);
  const banco = INDICADORES_OFICIALES_IDIOMAS[normAsig(asignatura)] || {};
  return banco[g] || [];
};
`;
writeFileSync(join(ROOT, "src/data/indicadoresIdiomasOficiales.js"), modulo);
console.log("\nMódulo derivado: src/data/indicadoresIdiomasOficiales.js");
