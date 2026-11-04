/**
 * Situación de aprendizaje dentro de la vista previa del plan maestro (Etapa 4
 * de docs/DISENO_CORAZON_DOCENTEOS.md, reglas 4.1 y 4.7). El docente elige una
 * situación propuesta o escribe la suya por elementos, ve la estrategia que
 * recomienda DocenteOS (Guía 1.2.4) y elige libremente; si cambia la
 * estrategia, ve la situación realineada antes de aceptarla. También ajusta
 * las secciones del producto. Sin IA; todo vive en datos.planMaestro.
 */
import { ESTRATEGIAS_FASES_GUIA_2025 } from "../data/estrategiasFasesGuia2025.js";
import { elegirEstrategia } from "../services/vistaPreviaPlanMaestroService.js";
import {
  COMPETENCIAS_LLEGADA, CRITERIOS_ESTRATEGIA, MAX_CARACTERES_SITUACION, estrategiaDisponible,
  propuestasParaTemas, elementosSituacion, validarSituacion, recomendarEstrategia, compararRealineacion,
  alinearSiNoHay, usarSemilla, escribirSituacionPropia, aceptarRealineacion, fijarCampoSituacion,
  fijarRasgo, alternarCompetenciaLlegada, validarSecciones, agregarSeccion, renombrarSeccion,
  quitarSeccion, moverSeccion,
} from "../services/situacionAprendizajeService.js";

const cajaError = { background: "#fff1f2", border: "1px solid #fda4af", borderRadius: 8, padding: "8px 10px", color: "#7f1d1d", fontSize: 13, margin: "8px 0" };
const caja = { border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px", marginTop: 8 };
const chip = (activo) => ({
  border: `1px solid ${activo ? "#7c3aed" : "#cbd5e1"}`, background: activo ? "#ede9fe" : "#fff",
  color: activo ? "#4c1d95" : "#334155", borderRadius: 999, padding: "2px 9px", fontSize: 12,
  fontWeight: activo ? 700 : 400, cursor: "pointer", margin: "2px 4px 2px 0",
});

function ListaErrores({ errores }) {
  if (!errores.length) return null;
  return (
    <div style={cajaError} role="alert">
      <ul style={{ margin: 0, paddingLeft: 18 }}>{errores.map((e) => <li key={e}>{e}</li>)}</ul>
    </div>
  );
}

function Recomendacion({ rasgos, estrategia, onElegir }) {
  let rec;
  try {
    rec = recomendarEstrategia(rasgos);
  } catch (e) {
    return <p className="pd-hint">{e.message} Responde los criterios de la Guía para ver la recomendación.</p>;
  }
  const boton = (e) => (e.disponible && e.clave !== estrategia
    ? <button type="button" style={{ ...chip(false), marginLeft: 6 }} onClick={() => onElegir(e.clave)}>Elegir</button>
    : null);
  return (
    <div style={{ ...caja, background: "#f8fafc" }}>
      <div style={{ fontSize: 13 }}>
        DocenteOS recomienda: <strong>{rec.recomendada.nombre}</strong>
        {!rec.recomendada.disponible && <em> · todavía no disponible en el plan maestro</em>}
        {boton(rec.recomendada)}
      </div>
      <ul style={{ fontSize: 13, margin: "4px 0", paddingLeft: 18 }}>
        {rec.recomendada.porque.map((p) => <li key={p}>{p}</li>)}
      </ul>
      <p className="pd-hint" style={{ margin: "2px 0 6px" }}>{rec.recomendada.sentido}</p>
      {!rec.recomendada.disponible && rec.mejorDisponible && (
        <p style={{ fontSize: 13, margin: "2px 0 6px" }}>
          La mejor que ya puedes usar: <strong>{rec.mejorDisponible.nombre}</strong>{boton(rec.mejorDisponible)}
        </p>
      )}
      {rec.alternativas.length > 0 && (
        <div style={{ fontSize: 13 }}>
          Alternativas:
          <ul style={{ margin: "2px 0 0", paddingLeft: 18 }}>
            {rec.alternativas.map((a) => (
              <li key={a.clave}>
                {a.nombre}
                {!a.disponible && <em> (todavía no disponible)</em>}
                {boton(a)}
                <span className="pd-hint"> — {a.porque.join(" ")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="pd-hint" style={{ margin: "6px 0 0" }}>Tú eliges: puedes usar cualquier estrategia.</p>
    </div>
  );
}

export default function SituacionAprendizajePanel({ datos, onChange, pm, temas }) {
  const actualizar = (siguiente) => onChange({ ...datos, planMaestro: siguiente });
  const s = pm.situacion;
  const producto = datos.productoFinalTexto || "";
  const propuestas = propuestasParaTemas(temas);
  const elegir = (clave) => actualizar(alinearSiNoHay(elegirEstrategia(pm, clave)));
  const campo = (nombre) => (e) => actualizar(fijarCampoSituacion(pm, nombre, e.target.value));

  const validacion = validarSituacion({ situacion: s, producto, estrategia: pm.estrategia });
  const realineacion = s ? compararRealineacion({ situacion: s, producto, estrategia: pm.estrategia }) : null;
  const rolEstrategia = s ? elementosSituacion({ situacion: { ...s, rolPropio: "" }, producto, estrategia: pm.estrategia }).rolEstudiante : "";
  const erroresSecciones = s ? validarSecciones(pm.secciones || []) : [];

  return (
    <>
      <div className="pd-section-title" style={{ marginTop: 4 }}>Situación de aprendizaje</div>
      {propuestas.length ? (
        <p className="pd-hint" style={{ margin: "0 0 4px" }}>DocenteOS propone (simulada; puedes adaptarla):</p>
      ) : (
        <p className="pd-hint" style={{ margin: "0 0 4px" }}>
          {s?.borrador
            ? "Todavía no hay situaciones propuestas para este tema: DocenteOS preparó un borrador (abajo) que puedes usar tal cual o adaptar."
            : "Todavía no hay situaciones propuestas para este tema: escribe la tuya con los cinco elementos."}
        </p>
      )}
      {propuestas.map((p) => (
        <div key={p.id} style={{ ...caja, borderColor: s?.semillaId === p.id ? "#7c3aed" : "#e2e8f0" }}>
          <strong style={{ fontSize: 13 }}>{p.producto.nombre}</strong>
          <span className="pd-hint"> · {p.tema}</span>
          <div style={{ fontSize: 13, marginTop: 2 }}>{p.problema}</div>
          <button
            type="button"
            style={{ ...chip(s?.semillaId === p.id), marginTop: 4 }}
            onClick={() => onChange({ ...datos, productoFinalTexto: p.producto.nombre, planMaestro: usarSemilla(pm, p, { centro: datos.centro }) })}
          >
            {s?.semillaId === p.id ? "En uso" : "Usar esta situación"}
          </button>
        </div>
      ))}
      <button type="button" style={{ ...chip(Boolean(s) && !s.semillaId), marginTop: 6 }} onClick={() => actualizar(escribirSituacionPropia(pm))}>
        Escribir la mía
      </button>

      {s && (
        <div style={caja}>
          {s.borrador && (
            <p style={{ fontSize: 13, margin: "0 0 8px", color: "#92400e" }} role="note">
              Borrador sugerido por DocenteOS con el título de la unidad. Si quieres, cámbialo por algo real de tu grupo.
            </p>
          )}
          <div className="pd-field">
            <label>¿Real o simulada?</label>
            <select value={s.origen} onChange={campo("origen")}>
              <option value="real">Real (del entorno de mis estudiantes)</option>
              <option value="simulada">Simulada</option>
            </select>
          </div>
          <div className="pd-field pd-field-full">
            <label>1. Contexto</label>
            <textarea rows={2} value={s.contexto} onChange={campo("contexto")} placeholder="Dónde ocurre y a quién afecta" />
          </div>
          <div className="pd-field pd-field-full">
            <label>2. Problema o necesidad</label>
            <textarea rows={2} value={s.problema} onChange={campo("problema")} placeholder="Una necesidad que el idioma ayuda a resolver (no «no saben inglés»)" />
          </div>
          <div className="pd-field pd-field-full">
            <label>3. Producto central</label>
            <input value={producto} onChange={(e) => onChange({ ...datos, productoFinalTexto: e.target.value })} placeholder="Nombre, p. ej. Our School Survival Guide" />
            <input style={{ marginTop: 4 }} value={s.productoDescripcion} onChange={campo("productoDescripcion")} placeholder="Qué es, p. ej. una guía bilingüe de la escuela" />
            <input style={{ marginTop: 4 }} value={s.audiencia} onChange={campo("audiencia")} placeholder="A quién va dirigido, p. ej. los estudiantes de nuevo ingreso" />
          </div>
          <div className="pd-field pd-field-full">
            <label>4. Punto de llegada</label>
            <textarea rows={2} value={s.puntoDeLlegada} onChange={campo("puntoDeLlegada")} placeholder="Qué actitud o valor transforma la unidad" />
            <div>
              {Object.entries(COMPETENCIAS_LLEGADA).map(([clave, nombre]) => (
                <button key={clave} type="button" style={chip(s.competenciasLlegada.includes(clave))} aria-pressed={s.competenciasLlegada.includes(clave)} onClick={() => actualizar(alternarCompetenciaLlegada(pm, clave))}>
                  {nombre}
                </button>
              ))}
            </div>
          </div>

          <div className="pd-section-title" style={{ marginTop: 10 }}>Criterios de la Guía para elegir la estrategia (1.2.4)</div>
          {Object.entries(CRITERIOS_ESTRATEGIA).map(([criterio, def]) => (
            <div key={criterio} className="pd-field pd-field-full">
              <label>{def.etiqueta}</label>
              <select value={s.rasgos[criterio] || ""} onChange={(e) => actualizar(fijarRasgo(pm, criterio, e.target.value))}>
                <option value="">Elige…</option>
                {Object.entries(def.opciones).map(([valor, op]) => <option key={valor} value={valor}>{op.texto}</option>)}
              </select>
            </div>
          ))}
          <Recomendacion rasgos={s.rasgos} estrategia={pm.estrategia} onElegir={elegir} />
        </div>
      )}

      <div className="pd-section-title" style={{ marginTop: 12 }}>5. Estrategia</div>
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {ESTRATEGIAS_FASES_GUIA_2025.map((e) => {
          const disponible = estrategiaDisponible(e.clave);
          return (
            <button
              key={e.clave}
              type="button"
              style={{ ...chip(pm.estrategia === e.clave), opacity: disponible ? 1 : 0.5, cursor: disponible ? "pointer" : "not-allowed" }}
              disabled={!disponible}
              title={disponible ? "" : "Sus fases todavía no tienen papeles aprobados"}
              aria-pressed={pm.estrategia === e.clave}
              onClick={() => elegir(e.clave)}
            >
              {e.nombre}
            </button>
          );
        })}
      </div>

      {s && (
        <>
          <div className="pd-field pd-field-full" style={{ marginTop: 8 }}>
            <label>Rol del estudiante (opcional; si lo dejas vacío, lo pone la estrategia)</label>
            <input value={s.rolPropio} onChange={campo("rolPropio")} placeholder={rolEstrategia} />
          </div>

          {realineacion ? (
            <div style={{ ...caja, borderColor: "#f59e0b", background: "#fffbeb" }} role="status">
              <strong style={{ fontSize: 13 }}>Cambiaste de {realineacion.desde} a {realineacion.hacia}: la situación se realinea.</strong>
              <div style={{ fontSize: 13, marginTop: 6 }}><em>Antes:</em> {realineacion.antes}</div>
              <div style={{ fontSize: 13, marginTop: 6 }}><em>Después:</em> {realineacion.despues}</div>
              <div style={{ marginTop: 6 }}>
                <button type="button" style={chip(true)} onClick={() => actualizar(aceptarRealineacion(pm))}>Aceptar la situación realineada</button>
                <button type="button" style={chip(false)} onClick={() => elegir(s.estrategiaAlineada)}>Volver a {realineacion.desde}</button>
              </div>
            </div>
          ) : (
            <div style={caja}>
              <div className="pd-hint">
                Situación compuesta · {validacion.texto.length} de {MAX_CARACTERES_SITUACION} caracteres (unas 8 líneas)
              </div>
              <p style={{ fontSize: 13, margin: "4px 0 0" }}>{validacion.texto || "—"}</p>
            </div>
          )}
          <ListaErrores errores={validacion.errores.map((e) => `Situación: ${e}`)} />

          <div className="pd-section-title" style={{ marginTop: 12 }}>Secciones del producto</div>
          <p className="pd-hint" style={{ margin: "0 0 4px" }}>
            Las piezas de las actividades se nombran por la sección a la que aportan.
          </p>
          {(pm.secciones || []).map((nombre, i) => (
            <div key={i} style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 4 }}>
              <span className="pd-hint" style={{ width: 18 }}>{i + 1}.</span>
              <input value={nombre} onChange={(e) => actualizar(renombrarSeccion(pm, i, e.target.value))} style={{ flex: 1 }} aria-label={`Sección ${i + 1}`} />
              <button type="button" style={chip(false)} disabled={i === 0} onClick={() => actualizar(moverSeccion(pm, i, -1))} aria-label="Subir">↑</button>
              <button type="button" style={chip(false)} disabled={i === pm.secciones.length - 1} onClick={() => actualizar(moverSeccion(pm, i, 1))} aria-label="Bajar">↓</button>
              <button type="button" style={chip(false)} onClick={() => actualizar(quitarSeccion(pm, i))} aria-label="Quitar">✕</button>
            </div>
          ))}
          <button type="button" style={{ ...chip(false), marginTop: 6 }} onClick={() => actualizar(agregarSeccion(pm))}>+ Añadir sección</button>
          <ListaErrores errores={erroresSecciones.map((e) => `Secciones: ${e}`)} />
        </>
      )}
    </>
  );
}
