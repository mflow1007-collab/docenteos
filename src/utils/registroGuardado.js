/**
 * Guardado del Registro de calificaciones en Firestore.
 * Firestore rechaza el documento ENTERO si algún campo vale `undefined`; así el
 * Registro no se guardaba en la nube desde v0.6.0 (resumenEvaluacionesInstrumentos
 * llegaba vacío desde la página). PURO.
 */

const esObjetoPlano = (v) => v !== null && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype;

/**
 * Quita los `undefined` de los mapas (con merge, lo que había se conserva) y los
 * cambia por null dentro de las listas. No toca Timestamps ni centinelas.
 */
export const sinIndefinidos = (valor) => {
  if (Array.isArray(valor)) return valor.map((v) => (v === undefined ? null : sinIndefinidos(v)));
  if (!esObjetoPlano(valor)) return valor;
  return Object.fromEntries(Object.entries(valor)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => [k, sinIndefinidos(v)]));
};

/**
 * Lo que la página del Registro sube a la nube: todo menos
 * evaluacionesInstrumentos, que solo escribe el puente de Modo Aula/Instrumentos
 * (la página solo lo lee; una copia vieja del navegador no debe pisarlo).
 */
export const payloadRemotoDePagina = ({ evaluacionesInstrumentos: _soloLectura, ...resto } = {}) => resto;
