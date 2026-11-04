/**
 * cupoGrado.js — Etapa E: límite de planes por grado y asignatura.
 *
 * Lógica PURA (sin Firebase) para que las pruebas la ejerciten en Node.
 * Reglas aprobadas por César (2026-10-30):
 *  - 1 plan activo por grado + asignatura; las secciones comparten el cupo.
 *  - El cupo se libera al empezar la penúltima semana del plan, nunca antes
 *    de 2 semanas desde la generación. La penúltima semana se cuenta desde la
 *    generación o desde la fecha de inicio, la que sea posterior.
 *  - Los créditos desbloquean antes de tiempo.
 *  - Si la generación falla, el mismo plan se puede volver a generar durante
 *    24 h sin gastar otro cupo.
 *
 * La clave del cupo NO es un normalizador de grado: solo arma un id de
 * documento estable. firestore.rules acepta exactamente REGEX_CLAVE_CUPO
 * (mantener ambos en sincronía; scripts/test-cupo-grado.mjs lo comprueba).
 */

const DIA_MS = 24 * 60 * 60 * 1000;
export const SEMANA_MS = 7 * DIA_MS;
export const PISO_DESBLOQUEO_MS = 14 * DIA_MS;
export const VENTANA_REINTENTO_MS = DIA_MS;

// Copia exacta de la expresión de firestore.rules (match cuposGrado).
export const REGEX_CLAVE_CUPO = /^(inicial|primaria|secundaria)__(pre-kinder|kinder|preprimario|[1-6](ro|do|to)-(primaria|secundaria))__(lengua-espanola|matematica|ciencias-sociales|geografia|historia|moral-y-civica|ciencias-de-la-naturaleza|biologia|quimica|fisica|ingles|frances|educacion-fisica|educacion-artistica|formacion-integral-humana-y-religiosa|tecnologia)$/;

export const slugCupo = (valor) => String(valor || "")
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

/**
 * Clave del cupo: nivel__grado__asignatura. El nivel es el que eligió el
 * docente (nunca se deduce del grado). Fail-closed: si algo falta o no está
 * en la lista oficial, devuelve ok:false con el motivo visible.
 */
export const claveCupoGrado = ({ nivel, grado, asignatura } = {}) => {
  const partes = { nivel: slugCupo(nivel), grado: slugCupo(grado), asignatura: slugCupo(asignatura) };
  const faltan = Object.entries(partes).filter(([, v]) => !v).map(([k]) => k);
  if (faltan.length) {
    return { ok: false, clave: "", error: `Falta ${faltan.join(", ")} para controlar el cupo del plan.` };
  }
  const clave = `${partes.nivel}__${partes.grado}__${partes.asignatura}`;
  if (!REGEX_CLAVE_CUPO.test(clave)) {
    return { ok: false, clave, error: `No se reconoce la combinación nivel/grado/asignatura (${nivel} · ${grado} · ${asignatura}) para el cupo del plan.` };
  }
  return { ok: true, clave, error: "" };
};

const aFecha = (valor) => {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor?.toDate === "function") return valor.toDate();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor));
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const f = new Date(valor);
  return Number.isNaN(f.getTime()) ? null : f;
};

/**
 * Momento en que el grado+asignatura vuelve a quedar libre.
 * base = máx(generación, inicio); penúltima = base + (semanas − 2) semanas;
 * resultado = máx(penúltima, generación + 14 días).
 */
export const calcularDesbloqueo = ({ generadoEn, fechaInicio, numSemanas } = {}) => {
  const generado = aFecha(generadoEn);
  if (!generado) throw new Error("calcularDesbloqueo: falta la fecha de generación");
  const inicio = aFecha(fechaInicio);
  const base = inicio && inicio > generado ? inicio : generado;
  const semanas = Math.max(Math.floor(Number(numSemanas) || 0), 1);
  const penultima = new Date(base.getTime() + Math.max(semanas - 2, 0) * SEMANA_MS);
  const piso = new Date(generado.getTime() + PISO_DESBLOQUEO_MS);
  return penultima > piso ? penultima : piso;
};

/**
 * Estado del cupo para un nuevo intento de generación.
 *  - ilimitado: correo sin límite.
 *  - libre: no hay plan o ya pasó el desbloqueo.
 *  - reintento: mismo tema, generado hace menos de 24 h → se reutiliza su planId.
 *  - bloqueado: hay un plan activo; solo un crédito lo libera antes.
 */
export const evaluarCupo = ({ cupo = null, ahora = new Date(), ilimitado = false, tituloNormalizado = "" } = {}) => {
  if (ilimitado) return { estado: "ilimitado", desbloqueoEn: null };
  if (!cupo) return { estado: "libre", desbloqueoEn: null };
  const desbloqueoEn = aFecha(cupo.desbloqueoEn);
  const generadoEn = aFecha(cupo.generadoEn);
  if (
    tituloNormalizado && cupo.tituloNormalizado === tituloNormalizado
    && generadoEn && ahora.getTime() - generadoEn.getTime() < VENTANA_REINTENTO_MS
  ) {
    return { estado: "reintento", desbloqueoEn, planId: cupo.planId };
  }
  if (!desbloqueoEn || ahora >= desbloqueoEn) return { estado: "libre", desbloqueoEn };
  return { estado: "bloqueado", desbloqueoEn };
};

// Campos de crédito que firestore.rules protege (el docente no los sube) y
// de los que se descuenta, en el mismo orden que resolverCreditosDisponibles.
export const CAMPOS_CREDITO = ["creditosPlanificacionDisponibles", "creditosDisponibles", "creditos"];

/** Parche que descuenta 1 crédito, o null si no hay créditos descontables. */
export const parcheDescuentoCredito = (usuarioData = {}) => {
  const campo = CAMPOS_CREDITO.find((c) => typeof usuarioData?.[c] === "number");
  if (!campo || usuarioData[campo] < 1) return null;
  return { [campo]: usuarioData[campo] - 1 };
};
