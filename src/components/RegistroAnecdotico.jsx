import { useEffect, useState } from "react";
import { CAMPOS_REGISTRO_ANECDOTICO, fechaHoyISO, validarAnotacion } from "../utils/registroAnecdotico.js";
import { crearAnotacionAnecdotica, obtenerAnotacionesAnecdoticas } from "../services/registroAnecdoticoService.js";

const estiloCampo = {
  width: "100%", border: "1px solid #e2e8f0", borderRadius: 7, padding: "6px 10px",
  fontSize: 13, color: "#374151", background: "#fff", boxSizing: "border-box", fontFamily: "inherit",
};

/**
 * Formulario de una anotación. Lo usan la ficha del estudiante y Modo Aula.
 * `estudiante` = { id, nombre, cursoId }; `contextoInicial` rellena el contexto (editable).
 */
export function FormularioAnotacion({ estudiante, contextoInicial = "", origen, claseTitulo = "", onGuardada, onCancelar }) {
  const [datos, setDatos] = useState(() => ({
    fecha: fechaHoyISO(), contexto: contextoInicial, hecho: "", interpretacion: "", accion: "", compromisos: "",
  }));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const guardar = async () => {
    const completa = {
      ...datos, origen, claseTitulo,
      estudianteId: estudiante?.id, estudianteNombre: estudiante?.nombre, cursoId: estudiante?.cursoId,
    };
    const errores = validarAnotacion(completa);
    if (errores.length) { setError(errores.join(" ")); return; }
    setGuardando(true);
    setError("");
    try {
      const guardada = await crearAnotacionAnecdotica(completa);
      onGuardada?.(guardada);
    } catch (err) {
      console.error("[RegistroAnecdotico] No se pudo guardar la anotación:", err);
      setError(`No se pudo guardar la anotación: ${err?.message || "error desconocido"}`);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
        Fecha
        <input type="date" value={datos.fecha} onChange={(e) => setDatos((p) => ({ ...p, fecha: e.target.value }))} style={estiloCampo} />
      </label>
      {CAMPOS_REGISTRO_ANECDOTICO.map(({ clave, etiqueta, ayuda }) => (
        <label key={clave} style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
          {etiqueta}{clave === "hecho" ? " *" : ""}
          <textarea
            rows={clave === "hecho" ? 3 : 2}
            value={datos[clave]}
            placeholder={ayuda}
            onChange={(e) => setDatos((p) => ({ ...p, [clave]: e.target.value }))}
            style={{ ...estiloCampo, resize: "vertical", fontWeight: 400 }}
          />
        </label>
      ))}
      {error && <p role="alert" style={{ color: "#b91c1c", fontSize: 12, margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        {onCancelar && <button type="button" onClick={onCancelar} disabled={guardando}>Cancelar</button>}
        <button type="button" onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar anotación"}</button>
      </div>
    </div>
  );
}

/** Pestaña «Registro anecdótico» de la ficha: lista cronológica + nueva anotación. */
export function RegistroAnecdoticoPanel({ estudiante }) {
  const [anotaciones, setAnotaciones] = useState(null); // null = cargando
  const [errorCarga, setErrorCarga] = useState("");
  const [formAbierto, setFormAbierto] = useState(false);

  useEffect(() => {
    let vigente = true;
    if (!estudiante?.id) { setAnotaciones([]); return () => { vigente = false; }; }
    setAnotaciones(null);
    setErrorCarga("");
    obtenerAnotacionesAnecdoticas(estudiante.id, { cursoId: estudiante.cursoId || "" })
      .then((datos) => { if (vigente) setAnotaciones(datos); })
      .catch((err) => {
        if (!vigente) return;
        setErrorCarga(`No se pudo cargar el registro anecdótico: ${err?.message || "error desconocido"}`);
        setAnotaciones([]);
      });
    return () => { vigente = false; };
  }, [estudiante?.id, estudiante?.cursoId]);

  return (
    <div className="detalle-tab-lista">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <strong>Registro anecdótico{anotaciones ? `: ${anotaciones.length}` : ""}</strong>
        {!formAbierto && <button type="button" onClick={() => setFormAbierto(true)}>+ Nueva anotación</button>}
      </div>
      {formAbierto && (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <FormularioAnotacion
            estudiante={estudiante}
            origen="ficha_estudiante"
            onGuardada={(nueva) => { setAnotaciones((prev) => [nueva, ...(prev || [])]); setFormAbierto(false); }}
            onCancelar={() => setFormAbierto(false)}
          />
        </div>
      )}
      {errorCarga && <p role="alert" style={{ color: "#b91c1c" }}>{errorCarga}</p>}
      {anotaciones === null && <p className="detalle-sin-datos">Cargando registro…</p>}
      {anotaciones?.length === 0 && !errorCarga && (
        <p className="detalle-sin-datos">Sin anotaciones todavía. Usa «Nueva anotación» o el botón de Modo Aula.</p>
      )}
      {anotaciones?.map((a) => (
        <article key={a.id || a.evidenciaId} style={{ borderLeft: "3px solid #4ade80", padding: "6px 10px", marginBottom: 10 }}>
          <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
            {a.fecha}{a.origen === "modo_aula" ? " · Modo Aula" : ""}{a.claseTitulo ? ` · ${a.claseTitulo}` : ""}
          </p>
          {CAMPOS_REGISTRO_ANECDOTICO.filter(({ clave }) => a[clave]).map(({ clave, etiqueta }) => (
            <p key={clave} style={{ margin: "2px 0" }}><strong>{etiqueta}:</strong> {a[clave]}</p>
          ))}
        </article>
      ))}
    </div>
  );
}
