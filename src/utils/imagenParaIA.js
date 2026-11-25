/**
 * Prepara una foto para la IA: la reduce y la convierte a JPEG.
 *
 * Anthropic solo acepta JPEG, PNG, GIF y WebP, y una foto de teléfono sin
 * reducir puede pasar del tamaño que admite la petición. Un HEIC se convierte
 * si el navegador sabe abrirlo (Safari); si no, se lanza un error visible.
 */
const LADO_MAXIMO = 2000;
const CALIDAD_JPEG = 0.85;

export const IMAGEN_IA_MIME = "image/jpeg";

/** Devuelve el dataURL JPEG; lanza Error con mensaje para el docente. */
export async function prepararImagenParaIA(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new Error("El navegador no puede abrir esta imagen. Si es HEIC (iPhone), conviértela a JPG y súbela de nuevo.");
    }
    const escala = Math.min(1, LADO_MAXIMO / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * escala));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; // un PNG transparente saldría negro en JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataURL = canvas.toDataURL(IMAGEN_IA_MIME, CALIDAD_JPEG);
    if (!dataURL.startsWith(`data:${IMAGEN_IA_MIME};base64,`)) {
      throw new Error("No se pudo preparar la imagen. Intenta con otra foto.");
    }
    return dataURL;
  } finally {
    URL.revokeObjectURL(url);
  }
}
