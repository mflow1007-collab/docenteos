import { useEffect, useState } from "react";
import { obtenerPlanDelCurso } from "../services/planificacionDataService.js";
import { corregirFechasCapa, fechaLocalISO } from "../services/hiloPedagogico.js";
import { etiquetaCurso, hora12, horasDelCurso, nombreHora } from "../utils/horarioSemanal.js";
import { clasesPendientes, fechaLegible, horasOcupadasHoy } from "../utils/horaExtra.js";
import "./HorarioSemanal.css";

const horaSugerida = (horas, ocupadas, ahora) => {
  const reloj = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;
  return horas.find((h) => h.fin > reloj && !ocupadas[h.hora])?.hora ?? null;
};

/**
 * Modo Aula: tomar una hora de hoy fuera del horario (p. ej. faltó un maestro)
 * y elegir qué clase adelantar. Todo se selecciona; el horario fijo no cambia.
 */
export default function HoraExtra({ cursos = [], cursoActivo = null, onGuardarLista, onAbrirCurso }) {
  const [abierto, setAbierto] = useState(false);
  const [cursoId, setCursoId] = useState(null);
  const [horaElegida, setHoraElegida] = useState(null);
  const [plan, setPlan] = useState({ estado: "cargando" });
  const [claseElegida, setClaseElegida] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const curso = cursos.find((c) => String(c.id) === String(cursoId ?? cursoActivo?.id)) || cursos[0] || null;
  const idCurso = curso?.id ?? null;

  useEffect(() => {
    if (!abierto || !idCurso) return undefined;
    let vigente = true;
    setPlan({ estado: "cargando" });
    setClaseElegida(null);
    obtenerPlanDelCurso(idCurso, { curso })
      .then(({ plan: p, avisos, sinCurso }) => {
        if (!vigente) return;
        if (p) setPlan({ estado: "listo", id: p.id, capa: corregirFechasCapa(p.capaCurricular, p.contenido?.metadatos?.fechaInicio) });
        else setPlan(sinCurso ? { estado: "error" } : { estado: avisos.length ? "no-encaja" : "sin-plan", avisos });
      })
      .catch((e) => {
        console.error("[HoraExtra] No se pudo leer el plan:", e);
        if (vigente) setPlan({ estado: "error" });
      });
    return () => { vigente = false; };
    // El curso cambia de identidad al guardar la hora; solo importan su id, grado y materia
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, idCurso, curso?.nombre, curso?.area]);

  if (!curso) return null;

  const ahora = new Date();
  const hoy = fechaLocalISO(ahora);
  const ocupadas = horasOcupadasHoy(cursos, ahora);
  const horas = horasDelCurso(curso);
  const hora = horaElegida ?? horaSugerida(horas, ocupadas, ahora);
  const horaLibre = hora !== null && !ocupadas[hora] && horas.some((h) => h.hora === hora);
  const { siguientes, atrasadas } = clasesPendientes(plan.estado === "listo" ? plan.capa : null, curso, plan.id, ahora);
  // Sin clases por venir no se adivina cuál de las atrasadas toca: la elige el docente
  const claseId = claseElegida ?? siguientes[0]?.claseId ?? null;
  const extrasHoy = cursos.flatMap((c) => (Array.isArray(c.horasExtra) ? c.horasExtra : [])
    .filter((x) => x?.fecha === hoy).map((x) => ({ curso: c, extra: x })));
  const grados = [...new Set(cursos.map((c) => c.nombre))];

  const elegirCurso = (id) => { setCursoId(id); setHoraElegida(null); setError(""); };

  const conAviso = async (accion, textoError) => {
    setGuardando(true);
    setError("");
    try {
      await accion();
    } catch (e) {
      console.error("[HoraExtra]", e);
      setError(textoError);
    } finally {
      setGuardando(false);
    }
  };

  const comenzar = () => conAviso(async () => {
    const extra = { fecha: hoy, hora, ...(claseId ? { planId: String(plan.id), claseId } : {}) };
    await onGuardarLista(curso.id, "horasExtra", { agregar: extra });
    setAbierto(false);
    setHoraElegida(null);
    onAbrirCurso(curso.id);
  }, "No se pudo guardar la hora extra. Revisa la conexión y vuelve a intentarlo.");

  const quitar = (item) => conAviso(
    () => onGuardarLista(item.curso.id, "horasExtra", { quitar: item.extra }),
    "No se pudo quitar la hora extra. Revisa la conexión y vuelve a intentarlo.",
  );

  return (
    <div className="hs-extra">
      <div className="hs-extra-barra">
        <button type="button" className="hs-boton-horario" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)}>
          {abierto ? "Cerrar hora extra" : "＋ Hora extra"}
        </button>
        {extrasHoy.map((item) => (
          <span key={`${item.curso.id}-${item.extra.hora}-${item.extra.claseId || ""}`} className="hs-extra-hoy">
            Hora extra de hoy: {nombreHora(item.extra.hora)} · {etiquetaCurso(item.curso)}
            <button type="button" disabled={guardando} onClick={() => quitar(item)}>Quitar</button>
          </span>
        ))}
      </div>
      {error && <p className="hs-mensaje error" role="alert">{error}</p>}

      {abierto && (
        <section className="hs-panel hs" aria-label="Hora extra">
          <p className="hs-ayuda">Toma una hora libre de hoy para avanzar con un grado. Tu horario fijo no cambia.</p>
          <div className="hs-selector" role="group" aria-label="Grado">
            <span className="hs-rotulo">Grado</span>
            {grados.map((g) => (
              <button key={g} type="button" aria-pressed={g === curso.nombre} onClick={() => elegirCurso(cursos.find((c) => c.nombre === g).id)}>{g}</button>
            ))}
          </div>
          <div className="hs-selector" role="group" aria-label="Materia">
            <span className="hs-rotulo">Materia</span>
            {cursos.filter((c) => c.nombre === curso.nombre).map((c) => (
              <button key={c.id} type="button" aria-pressed={c.id === curso.id} onClick={() => elegirCurso(c.id)}>{c.area || "Sin materia"}</button>
            ))}
          </div>
          <div className="hs-selector" role="group" aria-label="Hora de hoy">
            <span className="hs-rotulo">Hora</span>
            {horas.map((h) => (
              <button
                key={h.hora}
                type="button"
                disabled={Boolean(ocupadas[h.hora])}
                aria-pressed={horaLibre && h.hora === hora}
                title={ocupadas[h.hora] ? `Ocupada: ${ocupadas[h.hora].etiqueta}` : undefined}
                onClick={() => setHoraElegida(h.hora)}
              >
                {nombreHora(h.hora)} <small>{ocupadas[h.hora] ? "ocupada" : hora12(h.inicio)}</small>
              </button>
            ))}
          </div>

          {plan.estado === "cargando" && <p className="hs-ayuda">Buscando las clases pendientes…</p>}
          {plan.estado === "error" && <p className="hs-nota">No se pudieron leer las clases del plan. Cierra y vuelve a abrir para intentarlo de nuevo.</p>}
          {plan.estado === "sin-plan" && <p className="hs-nota">{etiquetaCurso(curso)} aún no tiene planificación: no hay una clase que adelantar.</p>}
          {plan.estado === "no-encaja" && (
            <div className="hs-mensaje error" role="alert">
              {plan.avisos.map((aviso) => <div key={aviso}>⚠️ {aviso}</div>)}
              No se usa: no hay una clase que adelantar.
            </div>
          )}
          {plan.estado === "listo" && !siguientes.length && !atrasadas.length && <p className="hs-nota">Este plan no tiene clases pendientes.</p>}
          {[["Clase", siguientes, " — la siguiente"], ["Atrasadas", atrasadas, ""]].map(([rotulo, clases, marca]) => clases.length > 0 && (
            <div key={rotulo} className="hs-extra-clases" role="radiogroup" aria-label={rotulo === "Clase" ? "Clase que vas a adelantar" : "Clases atrasadas"}>
              <span className="hs-rotulo">{rotulo}</span>
              {clases.map((c, i) => (
                <label key={c.claseId}>
                  <input type="radio" name="hs-clase-extra" checked={c.claseId === claseId} onChange={() => setClaseElegida(c.claseId)} />
                  <span>Clase {c.numeroClase}: {c.titulo}{c.fechaSugerida ? ` (${fechaLegible(c.fechaSugerida)})` : ""}{i === 0 ? marca : ""}</span>
                </label>
              ))}
            </div>
          ))}

          <div className="hs-pie">
            <button type="button" className="hs-guardar" disabled={guardando || !horaLibre || !claseId} onClick={comenzar}>
              {guardando ? "Guardando…" : "Comenzar"}
            </button>
            {!horaLibre && <span className="hs-ayuda">Elige una hora libre.</span>}
            {horaLibre && !claseId && atrasadas.length > 0 && <span className="hs-ayuda">Elige la clase que vas a dar.</span>}
          </div>
        </section>
      )}
    </div>
  );
}
