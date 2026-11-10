// Rama y commit de la versión desplegada. Vite los inyecta al compilar (vite.config.js).
// Fuera de Vite (pruebas con node) no existen: se devuelve cadena vacía.
import { esUsuarioDocenteOS } from "./permisos.js";

/* global __BUILD_RAMA__, __BUILD_COMMIT__ */
const rama = typeof __BUILD_RAMA__ !== "undefined" ? __BUILD_RAMA__ : "";
const commit = typeof __BUILD_COMMIT__ !== "undefined" ? __BUILD_COMMIT__ : "";

// Pie de la unidad: solo para administradores; el docente no lo ve.
export const pieDeVersion = (email) =>
  esUsuarioDocenteOS(email) && (rama || commit) ? `Versión: rama ${rama || "—"} · commit ${commit || "—"}` : "";
