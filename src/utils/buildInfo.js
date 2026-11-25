// Rama y commit de la versión. Vite los inyecta al compilar (vite.config.js).
// Fuera de Vite (pruebas con node) no existen: se devuelve vacío.
import { esUsuarioDocenteOS } from "./permisos.js";

/* global __BUILD_RAMA__, __BUILD_COMMIT__, __BUILD_SUCIO__ */
const rama = typeof __BUILD_RAMA__ !== "undefined" ? __BUILD_RAMA__ : "";
const commit = typeof __BUILD_COMMIT__ !== "undefined" ? __BUILD_COMMIT__ : "";
const sucio = typeof __BUILD_SUCIO__ !== "undefined" ? Boolean(__BUILD_SUCIO__) : false;

/** Versión del código que corre ahora; se guarda en la unidad al generarla. Null fuera de Vite. */
export const versionDeBuild = () => (rama || commit ? { rama, commit, cambiosSinCommit: sucio } : null);

const textoVersion = (v) => `Versión: rama ${v.rama || "—"} · commit ${v.commit || "—"}${v.cambiosSinCommit ? " +cambios sin commit" : ""}`;

/**
 * Pie de la unidad: solo para administradores; el docente no lo ve. Muestra la versión con la que se GENERÓ
 * la unidad (guardada en sus metadatos), no la que la imprime; si la unidad no la trae, la versión actual.
 */
export const pieDeVersion = (email, unidad = null) => {
  if (!esUsuarioDocenteOS(email)) return "";
  const v = unidad?.metadatos?.versionGenerador || versionDeBuild();
  return v ? textoVersion(v) : "";
};

/** El mismo texto, sin control de permisos: para scripts que imprimen la unidad (pruebas, revisión). */
export const textoVersionDeUnidad = (unidad) => (unidad?.metadatos?.versionGenerador ? textoVersion(unidad.metadatos.versionGenerador) : "");
