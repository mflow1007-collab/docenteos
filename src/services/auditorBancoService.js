/**
 * auditorBancoService.js — Auditor del Banco Pedagógico
 *
 * QUÉ ES: mantiene limpio bp_actividades. No queremos llenar DocenteOS de
 * basura; solo debe quedar lo útil. Detecta actividades candidatas a retirar
 * según criterios MEDIBLES y las clasifica en:
 *   - AUTO (objetivas, el cron las archiva solo): refs curriculares muertas,
 *     duplicado exacto de una actividad ya `official`.
 *   - REVISAR (subjetivas, requieren visto bueno del dueño): cosechada sin
 *     validar en 90 días, nunca usada por el generador.
 *
 * REGLAS DE ORO (no negociables):
 *   1. NUNCA borra. Archiva a estado `obsolete` (reversible). Ver
 *      [[feedback_firebase_produccion]] — nada destructivo en producción.
 *   2. NUNCA toca `official` ni `approved` — lo que el dueño validó es intocable.
 *      Solo audita `cosechada` y `draft` (la "sala de espera").
 *   3. Tope de seguridad: si una corrida quisiera archivar >50% del banco
 *      auditable, se detiene y avisa (un criterio mal calibrado no debe arrasar).
 *
 * La LÓGICA de este archivo es PURA (sin Firestore): recibe datos, devuelve el
 * veredicto. La ejecución (marcar obsolete) vive en quien lo llame (botón admin
 * o cron), respetando el híbrido auto/revisar.
 */

import { getActividades, cambiarEstado } from './bancoPedagogicoService.js';

const _norm = (s) => String(s ?? '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

// Similaridad Jaccard sobre tokens (título + instrucciones). Umbral alto para
// no fusionar cosas apenas parecidas: solo duplicados casi idénticos.
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

// ms por día, para calcular antigüedad sin depender de librerías de fecha.
const MS_DIA = 24 * 60 * 60 * 1000;
const UMBRAL_DIAS_SIN_VALIDAR = 90;
const UMBRAL_DUPLICADO = 0.85;
const TOPE_ARCHIVADO = 0.5; // no archivar más del 50% del banco auditable

const AUDITABLES = new Set(['cosechada', 'draft']);

// Fecha de un doc Firestore/plano → epoch ms (o null si no resoluble).
const _fecha = (v) => {
  if (!v) return null;
  if (typeof v?.toMillis === 'function') return v.toMillis();
  if (typeof v?.seconds === 'number') return v.seconds * 1000;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
};

/**
 * Audita el banco. PURO: no toca Firestore.
 *
 * @param actividades  todas las bp_actividades (cualquier estado)
 * @param opts.ahora   epoch ms de referencia (inyectado para tests/resume)
 * @param opts.refsVivas  Set de refs curriculares (indicadores/temas) que SÍ
 *                        existen en la malla activa. Si es null, el criterio de
 *                        refs muertas se OMITE (no se puede juzgar sin malla).
 * @returns { auto[], revisar[], revisadas, tope, excedeTope }
 *          auto/revisar: [{ id, titulo, motivo, criterio }]
 */
export const auditarBanco = (actividades = [], { ahora = null, refsVivas = null } = {}) => {
  const ahoraMs = typeof ahora === 'number' ? ahora : null;
  const auditables = (actividades || []).filter((a) => AUDITABLES.has(a?.estado));
  const oficiales = (actividades || []).filter((a) => a?.estado === 'official' || a?.estado === 'approved');

  const auto = [];
  const revisar = [];
  const yaMarcado = new Set(); // un id cae en un solo cubo (auto gana sobre revisar)

  for (const act of auditables) {
    const id = act?.id;
    const titulo = act?.titulo || '(sin título)';
    if (!id) continue;

    // ── AUTO 1: refs curriculares muertas ──────────────────────────────────
    // Solo si nos pasaron la malla; sin ella no se puede afirmar que murieron.
    if (refsVivas instanceof Set) {
      const refs = [
        ...(Array.isArray(act?.temas) ? act.temas : []),
        ...(Array.isArray(act?.indicadores) ? act.indicadores : []),
        ...(Array.isArray(act?.curricularRefs) ? act.curricularRefs : []),
      ].map((r) => _norm(typeof r === 'string' ? r : (r?.codigo || r?.id || ''))).filter(Boolean);
      // "muerta" solo si TENÍA refs y NINGUNA sigue viva (no penalizar sin refs).
      if (refs.length && !refs.some((r) => refsVivas.has(r))) {
        auto.push({ id, titulo, criterio: 'refs_muertas', motivo: 'sus referencias curriculares ya no existen en la malla activa' });
        yaMarcado.add(id);
        continue;
      }
    }

    // ── AUTO 2: duplicado casi exacto de una ya `official`/`approved` ───────
    const gemela = oficiales.find((o) => _similitud(act, o) >= UMBRAL_DUPLICADO);
    if (gemela) {
      auto.push({ id, titulo, criterio: 'duplicado', motivo: `casi idéntica a "${gemela.titulo || gemela.id}" (ya oficial)` });
      yaMarcado.add(id);
      continue;
    }

    // ── REVISAR 1: cosechada, sin validar en 90 días ───────────────────────
    if (act?.estado === 'cosechada' && ahoraMs) {
      const creada = _fecha(act?.cosechadaEn) ?? _fecha(act?.creadoEn);
      if (creada && (ahoraMs - creada) > UMBRAL_DIAS_SIN_VALIDAR * MS_DIA) {
        const dias = Math.floor((ahoraMs - creada) / MS_DIA);
        revisar.push({ id, titulo, criterio: 'sin_validar', motivo: `cosechada hace ${dias} días y nunca validada` });
        yaMarcado.add(id);
        continue;
      }
    }

    // ── REVISAR 2: nunca usada por el generador ────────────────────────────
    // Solo cuenta si lleva tiempo disponible (evita castigar recién creadas).
    if (Number(act?.usosTotal || 0) === 0 && ahoraMs) {
      const creada = _fecha(act?.creadoEn) ?? _fecha(act?.cosechadaEn);
      if (creada && (ahoraMs - creada) > UMBRAL_DIAS_SIN_VALIDAR * MS_DIA) {
        revisar.push({ id, titulo, criterio: 'sin_usar', motivo: 'el generador nunca la eligió' });
        yaMarcado.add(id);
      }
    }
  }

  // Tope de seguridad: si el veredicto tocaría >50% del banco auditable, algo
  // está mal calibrado — no se ejecuta hasta que un humano lo revise.
  const totalMarcado = auto.length + revisar.length;
  const tope = Math.floor(auditables.length * TOPE_ARCHIVADO);
  const excedeTope = auditables.length > 0 && totalMarcado > tope;

  return { auto, revisar, revisadas: auditables.length, tope, excedeTope };
};

export const AUDITOR_CONST = {
  UMBRAL_DIAS_SIN_VALIDAR, UMBRAL_DUPLICADO, TOPE_ARCHIVADO,
};

// ─── Ejecutor (con Firestore) ────────────────────────────────────────────────
// Carga el banco, corre la auditoría pura y archiva según el MODO:
//   'reportar' → no archiva nada, solo devuelve el veredicto (para previsualizar
//                en el botón admin antes de confirmar).
//   'auto'     → archiva SOLO los objetivos (refs muertas, duplicados). Es lo que
//                ejecuta el cron sin supervisión (híbrido por criterio).
//   'todo'     → archiva auto + revisar (lo confirma el dueño desde el admin).
// SIEMPRE marca `obsolete` (reversible), NUNCA borra. Respeta el tope de
// seguridad: si excede, no archiva y devuelve excedeTope=true para que un humano
// mire antes.

export const ejecutarAuditoria = async ({ modo = 'reportar', ahora = null, refsVivas = null, adminId = 'auditor' } = {}) => {
  // Carga todas (cualquier estado) para poder comparar contra las official.
  const todas = await getActividades({});
  const nowMs = typeof ahora === 'number' ? ahora : Date.parse(new Date().toISOString());
  const veredicto = auditarBanco(todas, { ahora: nowMs, refsVivas });

  if (modo === 'reportar') {
    return { ...veredicto, archivadas: 0, modo };
  }
  if (veredicto.excedeTope) {
    // Salvaguarda: no ejecutar una poda sospechosamente grande sin revisión.
    return { ...veredicto, archivadas: 0, modo, bloqueadoPorTope: true };
  }

  const objetivo = modo === 'auto' ? veredicto.auto : [...veredicto.auto, ...veredicto.revisar];
  let archivadas = 0;
  const errores = [];
  for (const item of objetivo) {
    try {
      await cambiarEstado('bp_actividades', item.id, 'obsolete', adminId);
      archivadas += 1;
    } catch (e) {
      errores.push({ id: item.id, error: e?.message || 'no se pudo archivar' });
    }
  }
  return { ...veredicto, archivadas, modo, errores };
};
