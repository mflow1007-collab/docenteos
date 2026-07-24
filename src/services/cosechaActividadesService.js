/**
 * cosechaActividadesService.js — Cosecha de actividades sueltas al Banco Pedagógico
 *
 * QUÉ ES: extrae las actividades con MECÁNICA que el generador produjo en una
 * unidad y las guarda en `bp_actividades` como `cosechada`, a la espera del
 * visto bueno del dueño. Así el banco de actividades crece SOLO, unidad tras
 * unidad, y el generador depende cada vez menos del molde (y de la IA).
 *
 * REGLA DE ORO — no llenar DocenteOS de basura ([[project_banco_actividades_generador]]):
 *   1. Cosecha SOLO "mecánica nueva": la actividad central de cada estructura
 *      que AÚN NO existe en el banco (por similitud de título+instrucciones,
 *      mismo criterio que el auditor). Si el día ya usó una del banco, no se
 *      re-cosecha.
 *   2. Cosecha en estado `cosechada` (sala de espera), NUNCA `official`. El
 *      dueño valida antes de que el generador la sirva.
 *   3. Opt-in: solo cosecha con consentimiento explícito del docente, jamás por
 *      defecto — igual que la cosecha de secuencias ([[feedback_firebase_produccion]]).
 *   4. Dentro de la misma unidad no cosecha dos veces la misma mecánica.
 *
 * La LÓGICA de extracción/dedup es PURA (sin Firestore). La ejecución (guardar)
 * vive en `cosecharActividadesDeUnidad`, y hay un ejecutor por unidad-id para el
 * botón de admin.
 */

import { getActividades, createActividad } from './bancoPedagogicoService.js';

const _norm = (s) => String(s ?? '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

// Similaridad Jaccard sobre tokens (título + instrucciones), mismo criterio que
// el auditor: umbral alto para no fusionar cosas apenas parecidas.
const _tokens = (act) => new Set(
  `${act?.titulo || ''} ${(Array.isArray(act?.instrucciones) ? act.instrucciones.join(' ') : '')}`
    .split(/\s+/).map(_norm).filter((w) => w.length > 3)
);
const _similitud = (a, b) => {
  const ta = _tokens(a);
  const tb = _tokens(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  ta.forEach((t) => { if (tb.has(t)) inter += 1; });
  return inter / (ta.size + tb.size - inter);
};
const UMBRAL_DUPLICADO = 0.85; // mismo umbral que el auditor

const _arr = (v) => (Array.isArray(v) ? v : []);
const _texto = (v) => String(v ?? '').trim();

// Un día del generador expone su mecánica en distintos campos según el molde.
// Recogemos las instrucciones reales (el bloque de desarrollo con verbos), el
// nombre de la actividad y las señales (estructura + tema) que el matcher usa.
const _instruccionesDelDia = (dia) => {
  // La unidad guardada puede traer las actividades como array de strings
  // (dia.actividades / dia.momentos.desarrollo) — tomamos las no vacías.
  const desarrollo = dia?.momentos?.desarrollo;
  const candidatas = [
    ..._arr(dia?.actividades),
    ...(Array.isArray(desarrollo) ? desarrollo : desarrollo ? [desarrollo] : []),
  ].map(_texto).filter(Boolean);
  return candidatas;
};

const _tituloActividad = (dia) =>
  _texto(dia?.actividadTitulo) ||
  _texto(dia?.tituloActividad) ||
  _texto(dia?.nombreActividad) ||
  _texto(dia?.titulo) ||
  '';

const _estructuraDia = (dia) =>
  _texto(dia?.estructura) ||
  _texto(dia?.protagonista?.texto) ||
  _texto(dia?.foco) ||
  '';

const _temaDia = (dia) =>
  _texto(dia?.temaCurricular) ||
  _texto(dia?.temaSemana) ||
  '';

/**
 * Extrae actividades cosechables de una unidad generada. PURO: no toca Firestore.
 *
 * @param unidad   la unidad generada/guardada (con fases[].dias[])
 * @param opts.area       área para etiquetar la actividad
 * @param opts.grado      grado para etiquetar
 * @param opts.bancoVivo  actividades ya en bp_actividades (para deduplicar)
 * @returns {{titulo, tipo, momento, area, grados, temas, habilidades, estrategia,
 *            competencia, instrucciones, duracion}[]}  candidatas ÚNICAS a cosechar
 */
export const extraerActividadesCosechables = (unidad, { area = '', grado = '', bancoVivo = [] } = {}) => {
  const fases = _arr(unidad?.fases);
  const dias = fases.flatMap((f) => _arr(f?.dias));
  if (!dias.length) return [];

  const vivas = _arr(bancoVivo);
  const cosechadasEnUnidad = []; // dedup DENTRO de la misma unidad
  const salida = [];

  for (const dia of dias) {
    // Si el día ya sirvió una actividad DEL BANCO, no hay mecánica nueva que
    // cosechar (sería una copia de algo que ya existe).
    if (dia?._actividadDeBanco || dia?.origenActividad === 'banco') continue;

    const instrucciones = _instruccionesDelDia(dia);
    // Descartar días sin mecánica real (solo andamiaje/listening genérico).
    const utiles = instrucciones.filter((x) => x.length > 25);
    if (utiles.length < 2) continue;

    const estructura = _estructuraDia(dia);
    const tema = _temaDia(dia);
    const titulo = _tituloActividad(dia) || (estructura ? `Actividad · ${estructura}` : '');
    if (!titulo) continue;

    const candidata = {
      titulo,
      tipo: _texto(dia?.tipoActividad) || 'Speaking',
      momento: 'Desarrollo',
      area,
      grados: grado ? [grado] : [],
      temas: [tema, estructura].map(_texto).filter(Boolean),
      habilidades: [estructura].map(_texto).filter(Boolean),
      estrategia: _texto(dia?.estrategia),
      competencia: _texto(dia?.competencia) || 'Comunicativa',
      instrucciones: utiles,
      duracion: Number(dia?.duracionMin) || 30,
    };

    // Dedup contra el banco vivo Y contra lo ya cosechado en esta misma unidad.
    const yaExiste =
      vivas.some((v) => _similitud(candidata, v) >= UMBRAL_DUPLICADO) ||
      cosechadasEnUnidad.some((c) => _similitud(candidata, c) >= UMBRAL_DUPLICADO);
    if (yaExiste) continue;

    cosechadasEnUnidad.push(candidata);
    salida.push(candidata);
  }

  return salida;
};

// ─── Ejecutor (con Firestore) ────────────────────────────────────────────────

/**
 * Cosecha las actividades de mecánica nueva de una unidad al banco.
 * Opt-in: sin consentimiento === true, no hace nada (devuelve null).
 * Guarda cada candidata como `cosechada` (sala de espera del dueño).
 *
 * @param opts.unidad         unidad generada/guardada
 * @param opts.area, grado    para etiquetar
 * @param opts.consentimiento debe ser true explícito
 * @param opts.userId         quién cosecha (autoría del doc)
 * @returns {{ cosechadas, omitidas, ids }} o null si no hay consentimiento
 */
export const cosecharActividadesDeUnidad = async ({
  unidad,
  area = '',
  grado = '',
  consentimiento = false,
  userId = '',
} = {}) => {
  if (consentimiento !== true) return null; // opt-in explícito, jamás por defecto

  // Banco vivo del área para deduplicar (cualquier estado — no re-cosechar algo
  // que ya existe aunque esté cosechado/obsolete).
  let bancoVivo = [];
  try {
    bancoVivo = await getActividades(area ? { area } : {});
  } catch {
    bancoVivo = [];
  }

  const candidatas = extraerActividadesCosechables(unidad, { area, grado, bancoVivo });
  if (!candidatas.length) return { cosechadas: 0, omitidas: 0, ids: [] };

  const ids = [];
  const errores = [];
  for (const act of candidatas) {
    try {
      const id = await createActividad({
        ...act,
        estado: 'cosechada',
        cosechadaEn: new Date().toISOString(),
        origen: 'cosecha_unidad',
        unidadOrigenId: _texto(unidad?.id),
      }, userId);
      ids.push(id);
    } catch (e) {
      errores.push(e?.message || 'no se pudo cosechar');
    }
  }

  return { cosechadas: ids.length, omitidas: 0, ids, errores };
};

// Extrae la unidad generada de un registro de planificación guardado (misma
// lógica de desenvoltura que guardarPlanificacionConHilo).
export const unidadDeRegistro = (registro) =>
  registro?.contenido?.unidad || registro?.unidad || registro?.contenido || registro || null;

/**
 * Cosecha desde un registro de planificación guardado (para el botón de admin).
 * Envuelve cosecharActividadesDeUnidad tomando área/grado/id del registro.
 *
 * @param registro  documento de la colección `planificaciones`
 * @param opts.consentimiento  debe ser true
 * @param opts.userId
 * @returns igual que cosecharActividadesDeUnidad
 */
export const cosecharActividadesDeRegistro = async (registro, { consentimiento = false, userId = '' } = {}) => {
  const unidad = unidadDeRegistro(registro);
  if (!unidad) return { cosechadas: 0, omitidas: 0, ids: [] };
  const area = unidad?.area || registro?.area || '';
  const grado = unidad?.grado || registro?.grado || '';
  return cosecharActividadesDeUnidad({
    unidad: { ...unidad, id: registro?.id || unidad?.id || '' },
    area, grado, consentimiento, userId,
  });
};

/**
 * Previsualiza qué se cosecharía de un registro SIN escribir (para el admin).
 * Devuelve las candidatas únicas (mecánica nueva) tras deduplicar contra el
 * banco vivo del área.
 */
export const previsualizarCosechaDeRegistro = async (registro) => {
  const unidad = unidadDeRegistro(registro);
  if (!unidad) return [];
  const area = unidad?.area || registro?.area || '';
  const grado = unidad?.grado || registro?.grado || '';
  let bancoVivo = [];
  try {
    bancoVivo = await getActividades(area ? { area } : {});
  } catch {
    bancoVivo = [];
  }
  return extraerActividadesCosechables({ ...unidad, id: registro?.id }, { area, grado, bancoVivo });
};

export const COSECHA_ACTIVIDADES_CONST = { UMBRAL_DUPLICADO };
