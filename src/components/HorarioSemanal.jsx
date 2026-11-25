import { useMemo, useState } from "react";
import {
  DIAS_HORARIO, cambiosPorGuardar, construirBorrador, cursosEnHora, etiquetaCurso,
  hora12, horasDelCurso, leerHorarioAnterior, nombreHora, tocarHora,
} from "../utils/horarioSemanal.js";
import "./HorarioSemanal.css";

const COLORES = ["#6d4bc4", "#1d6fb8", "#0f7a5a", "#b4530a", "#a8325e", "#4b5d1f", "#0e7490", "#7a3e9d"];

// En la celda no cabe «2do Secundaria A» en un teléfono
const nombreCorto = (nombre) => String(nombre || "").replace("Secundaria", "Sec.").replace("Primaria", "Prim.");

/**
 * Cuadrícula semanal: se elige grado y materia y se tocan las horas clase.
 * `onGuardar([{ cursoId, horarioSemanal }])` devuelve una promesa; si falla, lo
 * marcado se queda en pantalla con el error a la vista.
 */
export default function HorarioSemanal({ cursos = [], cursoInicialId = null, onGuardar }) {
  const [elegidoId, setElegidoId] = useState(cursoInicialId);
  const [ediciones, setEdiciones] = useState({});
  const [choque, setChoque] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const elegido = cursos.find((c) => String(c.id) === String(elegidoId)) || cursos[0] || null;
  const borrador = useMemo(() => construirBorrador(cursos, ediciones), [cursos, ediciones]);
  const porGuardar = useMemo(() => cambiosPorGuardar(cursos, borrador), [cursos, borrador]);

  const grados = useMemo(() => [...new Set(cursos.map((c) => c.nombre))], [cursos]);
  const horasElegido = useMemo(() => (elegido ? horasDelCurso(elegido) : []), [elegido]);
  const filas = useMemo(() => [...new Set([
    ...cursos.flatMap((c) => horasDelCurso(c).map((h) => h.hora)),
    ...Object.values(borrador).flat().map((m) => m.hora),
  ])].sort((a, b) => a - b), [cursos, borrador]);

  if (!elegido) {
    return <p className="hs-vacio">Crea un curso para poder marcar sus horas de clase.</p>;
  }

  const cursoPorId = (id) => cursos.find((c) => String(c.id) === String(id));
  const colorDe = (id) => COLORES[Math.max(0, cursos.findIndex((c) => String(c.id) === String(id))) % COLORES.length];
  const materias = cursos.filter((c) => c.nombre === elegido.nombre);
  const anteriores = cursos
    .filter((c) => !Array.isArray(c.horarioSemanal))
    .map((c) => ({ curso: c, ...leerHorarioAnterior(c) }));
  const hayAnterior = anteriores.some((a) => a.marcas.length);
  const sinUbicar = anteriores.flatMap((a) => a.sinUbicar.map((texto) => `${texto} (en ${etiquetaCurso(a.curso)})`));

  const elegir = (id) => { setElegidoId(id); setChoque(null); };

  const tocar = (dia, hora, opciones) => {
    const resultado = tocarHora(borrador, elegido.id, dia, hora, opciones);
    setMensaje(null);
    setChoque(resultado.choque.length ? { dia, hora, ids: resultado.choque } : null);
    if (!resultado.choque.length) setEdiciones((prev) => ({ ...prev, ...resultado.cambios }));
  };

  const guardar = async () => {
    setGuardando(true);
    setMensaje(null);
    try {
      await onGuardar(porGuardar);
      setEdiciones({});
      setMensaje({ tipo: "ok", texto: "Horario guardado." });
    } catch (error) {
      console.error("[HorarioSemanal] No se pudo guardar:", error);
      setMensaje({ tipo: "error", texto: "No se pudo guardar el horario. Lo que marcaste sigue aquí: revisa la conexión y vuelve a guardar." });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="hs">
      <div className="hs-selector" role="group" aria-label="Grado">
        <span className="hs-rotulo">Grado</span>
        {grados.map((grado) => (
          <button
            key={grado}
            type="button"
            aria-pressed={grado === elegido.nombre}
            onClick={() => elegir(cursos.find((c) => c.nombre === grado).id)}
          >{grado}</button>
        ))}
      </div>
      <div className="hs-selector" role="group" aria-label="Materia">
        <span className="hs-rotulo">Materia</span>
        {materias.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={c.id === elegido.id}
            style={{ "--hs-color": colorDe(c.id) }}
            onClick={() => elegir(c.id)}
          >{c.area || "Sin materia"}</button>
        ))}
        <span className="hs-total">{(borrador[elegido.id] || []).length} h por semana</span>
      </div>

      <p className="hs-ayuda">Toca las horas en que das <strong>{etiquetaCurso(elegido)}</strong>. Tócalas de nuevo para quitarlas.</p>
      {hayAnterior && (
        <p className="hs-nota">Algunas horas vienen de tu horario anterior. Revísalas y guarda para confirmarlas.</p>
      )}
      {sinUbicar.length > 0 && (
        <p className="hs-nota">De tu horario anterior no se pudieron ubicar: {sinUbicar.join("; ")}. Márcalas en el curso que corresponda.</p>
      )}

      <div className="hs-marco">
        <table className="hs-tabla">
          <thead>
            <tr>
              <th scope="col">Hora</th>
              {DIAS_HORARIO.map((dia) => (
                <th key={dia} scope="col"><span className="hs-dia-largo">{dia}</span><span className="hs-dia-corto" aria-hidden="true">{dia.slice(0, 3)}</span></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((hora) => {
              const bloque = horasElegido.find((h) => h.hora === hora);
              return (
                <tr key={hora}>
                  <th scope="row">
                    {nombreHora(hora)}
                    {bloque && <small>{hora12(bloque.inicio)}</small>}
                  </th>
                  {DIAS_HORARIO.map((dia) => {
                    const ids = cursosEnHora(borrador, dia, hora);
                    const propia = ids.includes(String(elegido.id));
                    const nombres = ids.map((id) => etiquetaCurso(cursoPorId(id)));
                    const clase = propia ? "hs-celda propia" : ids.length ? "hs-celda ocupada" : "hs-celda";
                    return (
                      <td key={dia}>
                        <button
                          type="button"
                          className={ids.length > 1 ? `${clase} doble` : clase}
                          aria-pressed={propia}
                          aria-label={`${dia}, ${nombreHora(hora)} hora: ${nombres.join(" y ") || "libre"}`}
                          style={ids.length ? { "--hs-color": colorDe(propia ? elegido.id : ids[0]) } : undefined}
                          onClick={() => tocar(dia, hora)}
                        >
                          {ids.map((id) => {
                            const c = cursoPorId(id);
                            return <span key={id}><b>{c.area}</b><small>{nombreCorto(c.nombre)}</small></span>;
                          })}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {choque && (
        <div className="hs-choque" role="alert">
          <span>
            {choque.dia}, {nombreHora(choque.hora)} hora ya es de {choque.ids.map((id) => etiquetaCurso(cursoPorId(id))).join(" y ")}.
            ¿Ponerla a {etiquetaCurso(elegido)}?
          </span>
          <span className="hs-choque-botones">
            <button type="button" onClick={() => tocar(choque.dia, choque.hora, { reemplazar: true })}>Reemplazar</button>
            <button type="button" onClick={() => setChoque(null)}>Dejar como está</button>
          </span>
        </div>
      )}

      <div className="hs-pie">
        <button type="button" className="hs-guardar" disabled={guardando || !porGuardar.length} onClick={guardar}>
          {guardando ? "Guardando…" : "Guardar horario"}
        </button>
        {Object.keys(ediciones).length > 0 && !guardando && (
          <button type="button" className="hs-descartar" onClick={() => { setEdiciones({}); setChoque(null); setMensaje(null); }}>
            Descartar cambios
          </button>
        )}
        {mensaje && <span className={`hs-mensaje ${mensaje.tipo}`} role={mensaje.tipo === "error" ? "alert" : "status"}>{mensaje.texto}</span>}
      </div>
    </div>
  );
}
