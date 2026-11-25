/**
 * Guarda los estudiantes nuevos en su registro y, si alguno falla, lo dice y
 * ofrece reintentar. Repetir es seguro: cada uno conserva su ID (merge).
 * Devuelve los que quedaron sin guardar.
 */
export async function guardarNuevosConAviso(cursoId, nuevos, guardar, preguntar = (m) => window.confirm(m)) {
  let pendientes = nuevos;
  while (pendientes.length) {
    const resultados = await Promise.allSettled(pendientes.map((est) => guardar(cursoId, est.nombre, est.id)));
    const fallidos = pendientes.filter((_, i) => resultados[i].status === "rejected");
    if (fallidos.length) {
      console.error("[Estudiantes] No se guardaron en su registro:", resultados.find((r) => r.status === "rejected").reason);
    }
    pendientes = fallidos;
    if (pendientes.length && !preguntar(`${pendientes.length} de ${nuevos.length} estudiantes no se guardaron en su registro. Revisa tu conexión. ¿Reintentar ahora?`)) break;
  }
  return pendientes;
}
