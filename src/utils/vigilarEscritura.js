// E1b2 (auditoría 2026-11-27): avisa si una escritura no se confirma a tiempo.
// Sin persistencia offline, Firestore deja setDoc pendiente sin rechazar
// mientras no hay conexión. No cancela la escritura: solo avisa.
export function vigilarEscritura(promesa, { esperaMs = 10000, alEmpezar, alTardar, alTerminar } = {}) {
  let tardo = false;
  alEmpezar?.();
  const temporizador = setTimeout(() => { tardo = true; alTardar?.(); }, esperaMs);
  return Promise.resolve(promesa).finally(() => {
    clearTimeout(temporizador);
    alTerminar?.({ tardo });
  });
}
