// Control del límite de tamaño de Firestore (A4).
//
// Firestore rechaza cualquier documento de más de 1 MiB (1.048.576 bytes), y lo
// hace DESPUÉS de que la generación ya gastó créditos. Aquí se mide antes de
// escribir y, si el documento no cabe, se falla con un error visible en vez de
// intentar el guardado. Lo generado no se pierde: sigue en pantalla y en la
// sesión del navegador.
//
// La medida sigue la fórmula oficial de Firestore (docs "Storage size
// calculations"): string = bytes UTF-8 + 1 (también los nombres de campo);
// número, fecha y timestamp = 8; booleano y null = 1; array = suma de sus
// valores; mapa = suma de nombres + valores; documento = nombre del documento
// (colección + id + 16) + campos + 32. Comprobado con planificaciones reales ya
// aceptadas: los mapas anidados NO suman los 32 bytes del documento.
// El margen de 8 KB cubre lo que se añade al escribir (timestamps del servidor).

export const LIMITE_DOCUMENTO_FIRESTORE = 1024 * 1024;
export const UMBRAL_SEGURO_DOCUMENTO = LIMITE_DOCUMENTO_FIRESTORE - 8 * 1024;

const encoder = new TextEncoder();
const tamanoString = (s) => encoder.encode(s).length + 1;

// Valores que Firestore guarda como hoja de 8 bytes: Date, Timestamp y los
// centinelas de FieldValue (serverTimestamp()).
const esHoja8 = (v) => v instanceof Date || typeof v?.toMillis === "function" || typeof v?._methodName === "string";

const tamanoValor = (v) => {
  if (v === null || v === undefined) return 1;
  if (typeof v === "string") return tamanoString(v);
  if (typeof v === "number" || typeof v === "bigint") return 8;
  if (typeof v === "boolean") return 1;
  if (Array.isArray(v)) return v.reduce((suma, x) => suma + tamanoValor(x), 0);
  if (esHoja8(v)) return 8;
  if (v instanceof Uint8Array) return v.length;
  if (typeof v === "object") return tamanoCampos(v);
  return 0;
};

const tamanoCampos = (obj) => Object.entries(obj).reduce(
  (suma, [clave, valor]) => (valor === undefined ? suma : suma + tamanoString(clave) + tamanoValor(valor)),
  0,
);

/**
 * Tamaño de un documento según Firestore. `idDocumento` por defecto tiene la
 * longitud de un id automático (20 caracteres).
 */
export const medirTamanoDocumento = (datos, { coleccion = "planificaciones", idDocumento = "x".repeat(20) } = {}) =>
  tamanoString(coleccion) + tamanoString(idDocumento) + 16 + tamanoCampos(datos ?? {}) + 32;

const esMapaPlano = (v) => v !== null && typeof v === "object" && !Array.isArray(v) && !esHoja8(v) && !(v instanceof Uint8Array);

/**
 * Documento resultante de setDoc(..., { merge: true }): los mapas se fusionan
 * campo a campo; arrays y demás valores se reemplazan.
 */
export const fusionarComoFirestore = (existente = {}, parche = {}) => {
  const resultado = { ...existente };
  for (const [clave, valor] of Object.entries(parche)) {
    resultado[clave] = esMapaPlano(valor) && esMapaPlano(existente[clave])
      ? fusionarComoFirestore(existente[clave], valor)
      : valor;
  }
  return resultado;
};

const kb = (bytes) => `${Math.round(bytes / 1024).toLocaleString("es-DO")} KB`;

/**
 * Lanza un error visible si el documento no cabe en Firestore con margen.
 * Devuelve los bytes medidos si cabe.
 * @param {object} datos - el documento completo tal como se va a escribir.
 * @param {object} [opciones] - { que, coleccion, idDocumento }.
 */
export const verificarTamanoDocumento = (datos, { que = "La planificación", ...ruta } = {}) => {
  const bytes = medirTamanoDocumento(datos, ruta);
  if (bytes > UMBRAL_SEGURO_DOCUMENTO) {
    const error = new Error(
      `${que} pesa ${kb(bytes)} y no cabe en un documento de Firestore ` +
      `(máximo 1 MiB; límite seguro ${kb(UMBRAL_SEGURO_DOCUMENTO)}). No se guardó. ` +
      `Lo generado sigue en pantalla: descárgalo como PDF para no perderlo.`
    );
    error.code = "documento-demasiado-grande";
    error.bytes = bytes;
    throw error;
  }
  return bytes;
};
