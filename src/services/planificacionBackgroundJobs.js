const STORAGE_KEY = "docenteos_planificacion_background_jobs_v1";
const MAX_JOBS = 5;

let jobs = cargarJobs();
const listeners = new Set();

function esBrowser() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function cargarJobs() {
  if (!esBrowser()) return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistirJobs() {
  if (!esBrowser()) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(jobs.slice(0, MAX_JOBS)));
  } catch {
    // Si sessionStorage está lleno/no disponible, el trabajo vivo sigue en memoria.
  }
}

function notificar() {
  persistirJobs();
  const snapshot = getGenerationJobs();
  listeners.forEach((listener) => listener(snapshot));
}

function upsertJob(job) {
  jobs = [job, ...jobs.filter((item) => item.id !== job.id)].slice(0, MAX_JOBS);
  notificar();
  return job;
}

function actualizarJob(id, patch) {
  jobs = jobs.map((job) => (job.id === id ? { ...job, ...patch, updatedAt: new Date().toISOString() } : job));
  notificar();
  return getGenerationJob(id);
}

export function getGenerationJobs() {
  return jobs.map((job) => ({ ...job }));
}

export function getGenerationJob(id) {
  return jobs.find((job) => job.id === id) || null;
}

export function subscribeGenerationJobs(listener) {
  listeners.add(listener);
  listener(getGenerationJobs());
  return () => listeners.delete(listener);
}

export function clearGenerationJob(id) {
  jobs = jobs.filter((job) => job.id !== id);
  notificar();
}

export function startGenerationJob({
  id,
  tipo = "planificacion",
  titulo = "Planificación",
  initialMessage = "DocenteOS está generando...",
  run,
  onSuccess,
  onError,
}) {
  const activo = getGenerationJob(id);
  if (activo?.status === "running") return activo;

  const now = new Date().toISOString();
  const job = upsertJob({
    id,
    tipo,
    titulo,
    status: "running",
    mensaje: initialMessage,
    error: "",
    result: null,
    startedAt: now,
    updatedAt: now,
    finishedAt: null,
  });

  Promise.resolve()
    .then(() => run({
      setProgress: (mensaje) => actualizarJob(id, { mensaje: mensaje || initialMessage }),
    }))
    .then((result) => {
      actualizarJob(id, {
        status: "success",
        result,
        error: "",
        mensaje: "✅ Generación lista. Puedes volver a Planificación para revisarla.",
        finishedAt: new Date().toISOString(),
      });
      onSuccess?.(result);
    })
    .catch((error) => {
      const message = error?.message || "No fue posible completar la generación.";
      actualizarJob(id, {
        status: "error",
        result: null,
        error: message,
        mensaje: `❌ ${message}`,
        finishedAt: new Date().toISOString(),
      });
      onError?.(error);
    });

  return job;
}
