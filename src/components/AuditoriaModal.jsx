import { useEffect, useRef, useState } from "react";
import { auditarUnidad } from "../services/auditoriaAI.js";
import {
  parseAuditoria,
  soloInforme,
  etiquetaSeccion,
} from "../services/auditAcciones.js";

export default function AuditoriaModal({ unidad, onClose, onAplicarAcciones }) {
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState("iniciando"); // iniciando | streaming | listo | error
  const [copiado, setCopiado] = useState(false);
  const [acciones, setAcciones] = useState([]);        // acciones pendientes
  const [editandoId, setEditandoId] = useState(null);  // id de la acción en edición
  const [borrador, setBorrador] = useState("");        // texto editable
  const [aplicadas, setAplicadas] = useState(0);       // contador para feedback
  const contenedorRef = useRef(null);
  const abortRef = useRef(false);

  useEffect(() => {
    abortRef.current = false;
    setTexto("");
    setEstado("iniciando");
    setAcciones([]);
    setAplicadas(0);

    auditarUnidad(unidad, {
      onChunk: (chunk) => {
        if (abortRef.current) return;
        setTexto((prev) => prev + chunk);
        setEstado("streaming");
        // auto-scroll
        if (contenedorRef.current) {
          contenedorRef.current.scrollTop = contenedorRef.current.scrollHeight;
        }
      },
      onFinish: () => {
        if (abortRef.current) return;
        setTexto((prev) => {
          const { acciones: acc } = parseAuditoria(prev);
          setAcciones(acc);
          return prev;
        });
        setEstado("listo");
      },
      onError: (msg) => {
        if (!abortRef.current) {
          setTexto(msg);
          setEstado("error");
        }
      },
    });

    return () => { abortRef.current = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Durante el streaming solo se muestra el informe; el JSON queda oculto.
  const informeVisible =
    estado === "listo" ? parseAuditoria(texto).informe : soloInforme(texto);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(informeVisible);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  };

  // ── Normaliza el contenidoNuevo a texto editable (una línea por ítem) ──
  const contenidoATexto = (accion) => {
    const cn = accion.contenidoNuevo;
    if (Array.isArray(cn)) return cn.join("\n");
    if (cn && typeof cn === "object") {
      return [
        `Acceso: ${cn.acceso || ""}`,
        `Metodológicas: ${cn.metodologicas || ""}`,
        `Evaluación: ${cn.evaluacion || ""}`,
      ].join("\n");
    }
    return String(cn ?? "");
  };

  // ── Reconstruye contenidoNuevo desde el texto editado ──
  const textoAContenido = (accion, valor) => {
    const cn = accion.contenidoNuevo;
    if (Array.isArray(cn)) {
      return valor.split("\n").map((l) => l.trim()).filter(Boolean);
    }
    if (cn && typeof cn === "object") {
      const obj = { ...cn };
      valor.split("\n").forEach((linea) => {
        const [clave, ...resto] = linea.split(":");
        const v = resto.join(":").trim();
        const c = clave.trim().toLowerCase();
        if (c.startsWith("acceso")) obj.acceso = v;
        else if (c.startsWith("metodol")) obj.metodologicas = v;
        else if (c.startsWith("evalua")) obj.evaluacion = v;
      });
      return obj;
    }
    return valor;
  };

  const quitarAccion = (id) =>
    setAcciones((prev) => prev.filter((a) => a.id !== id));

  const aplicarUna = (accion) => {
    if (accion.requiereConfirmacion !== false) {
      const ok = window.confirm(
        `Esta acción modificará la sección «${etiquetaSeccion(accion.seccion)}». ¿Deseas aplicarla?`
      );
      if (!ok) return;
    }
    const res = onAplicarAcciones?.([accion]);
    if (res?.ok) {
      setAplicadas((n) => n + (res.aplicadas || 1));
      quitarAccion(accion.id);
    } else if (res?.error) {
      window.alert(`No se pudo aplicar: ${res.error}`);
    }
  };

  const aplicarTodas = () => {
    if (acciones.length === 0) return;
    const ok = window.confirm(
      `Se aplicarán ${acciones.length} mejoras a la planificación. ¿Deseas continuar?`
    );
    if (!ok) return;
    const res = onAplicarAcciones?.(acciones);
    if (res?.ok) {
      setAplicadas((n) => n + (res.aplicadas || acciones.length));
      setAcciones([]);
    } else if (res?.error) {
      window.alert(`No se pudieron aplicar todas: ${res.error}`);
    }
  };

  const iniciarEdicion = (accion) => {
    setEditandoId(accion.id);
    setBorrador(contenidoATexto(accion));
  };

  const guardarEdicion = (accion) => {
    const nuevoContenido = textoAContenido(accion, borrador);
    setAcciones((prev) =>
      prev.map((a) => (a.id === accion.id ? { ...a, contenidoNuevo: nuevoContenido } : a))
    );
    setEditandoId(null);
    setBorrador("");
  };

  const estadoLabel = {
    iniciando: "Iniciando auditoría…",
    streaming: "Analizando unidad…",
    listo: "Auditoría completa",
    error: "Error",
  }[estado];

  return (
    <div className="audit-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="audit-modal">
        <div className="audit-header">
          <div className="audit-title">
            <span className="audit-icon">🔍</span>
            Auditoría Pedagógica IA
            <span className={`audit-estado audit-estado-${estado}`}>{estadoLabel}</span>
          </div>
          <div className="audit-actions">
            {(estado === "streaming" || estado === "listo") && (
              <button className="audit-btn-copy" onClick={copiar}>
                {copiado ? "✓ Copiado" : "Copiar informe"}
              </button>
            )}
            <button className="audit-btn-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="audit-body" ref={contenedorRef}>
          {estado === "iniciando" && (
            <div className="audit-loading">
              <div className="audit-spinner" />
              <p>Enviando unidad al motor de auditoría…</p>
            </div>
          )}

          {informeVisible && (
            <pre className="audit-text">{informeVisible}</pre>
          )}
          {estado === "streaming" && (
            <span className="audit-cursor">▋</span>
          )}

          {/* ── Acciones aplicables ── */}
          {estado === "listo" && acciones.length > 0 && (
            <div className="audit-acciones">
              <div className="audit-acciones-head">
                <span className="audit-acciones-titulo">
                  💡 Mejoras aplicables ({acciones.length})
                </span>
                <span className="audit-acciones-nota">
                  Aplicar no consume tokens. Recuerda guardar la unidad al terminar.
                </span>
              </div>

              {acciones.map((accion) => (
                <div className="audit-card" key={accion.id}>
                  <div className="audit-card-head">
                    <span className="audit-card-titulo">{accion.titulo}</span>
                    <span className="audit-card-seccion">
                      {etiquetaSeccion(accion.seccion)}
                      {accion.tipo === "insertar" ? " · agregar" : " · reemplazar"}
                    </span>
                  </div>

                  {accion.descripcion && (
                    <p className="audit-card-desc">{accion.descripcion}</p>
                  )}

                  {editandoId === accion.id ? (
                    <>
                      <textarea
                        className="audit-card-editor"
                        value={borrador}
                        onChange={(e) => setBorrador(e.target.value)}
                        rows={Math.min(12, Math.max(3, borrador.split("\n").length + 1))}
                      />
                      <div className="audit-card-btns">
                        <button className="audit-mini-btn aplicar" onClick={() => guardarEdicion(accion)}>
                          ✓ Guardar cambios
                        </button>
                        <button className="audit-mini-btn ignorar" onClick={() => { setEditandoId(null); setBorrador(""); }}>
                          Cancelar
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <pre className="audit-card-preview">{contenidoATexto(accion)}</pre>
                      <div className="audit-card-btns">
                        <button className="audit-mini-btn aplicar" onClick={() => aplicarUna(accion)}>
                          Aplicar
                        </button>
                        <button className="audit-mini-btn editar" onClick={() => iniciarEdicion(accion)}>
                          Editar
                        </button>
                        <button className="audit-mini-btn ignorar" onClick={() => quitarAccion(accion.id)}>
                          Ignorar
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {estado === "listo" && acciones.length === 0 && aplicadas === 0 && (
            <p className="audit-acciones-vacio">
              La auditoría no generó acciones aplicables automáticamente. Revisa el informe para aplicar mejoras manualmente.
            </p>
          )}

          {aplicadas > 0 && (
            <p className="audit-aplicadas-ok">
              ✓ {aplicadas} mejora{aplicadas > 1 ? "s" : ""} aplicada{aplicadas > 1 ? "s" : ""} a la planificación. No olvides pulsar «Guardar».
            </p>
          )}
        </div>

        {/* ── Barra inferior de acciones globales ── */}
        {estado === "listo" && (
          <div className="audit-footer">
            <button
              className="audit-foot-btn aplicar-todas"
              onClick={aplicarTodas}
              disabled={acciones.length === 0}
            >
              ✓ Aplicar todas ({acciones.length})
            </button>
            <button className="audit-foot-btn cerrar" onClick={onClose}>
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

