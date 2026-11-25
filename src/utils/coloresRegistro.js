/**
 * Colores de la portada del Registro Escolar del MINERD (Secundaria, 2023) por
 * grado. `fuerte` y `suave` salen de la portada; en 3.º y 4.º `fuerte` está
 * oscurecido para que el nombre del curso se lea. El nivel lo dice el curso,
 * nunca se deduce del grado: sin nivel o sin grado conocido, null.
 */
export const CREMA_REGISTRO = "#f9eece";

const SECUNDARIA = {
  1: { fuerte: "#0c5c36", suave: "#d5debf" },
  2: { fuerte: "#276aa6", suave: "#bbd9c7" },
  3: { fuerte: "#a23d1f", suave: "#f6cc8e" },
  4: { fuerte: "#04756b", suave: "#bcd5b1" },
  5: { fuerte: "#b81c4b", suave: "#ebada7" },
  6: { fuerte: "#25365f", suave: "#b8cec8" },
};

export const coloresRegistro = (curso) => {
  if (curso?.nivel !== "Secundaria") return null;
  const grado = String(curso.nombre || "").match(/^\s*([1-6])(?!\d)/)?.[1];
  return SECUNDARIA[grado] || null;
};
