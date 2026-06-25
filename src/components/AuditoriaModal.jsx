import { useEffect, useRef, useState } from "react";
import { auditarUnidad } from "../services/auditoriaAI.js";

export default function AuditoriaModal({ unidad, onClose }) {
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState("iniciando"); // iniciando | streaming | listo | error
  const [copiado, setCopiado] = useState(false);
  const contenedorRef = useRef(null);
  const abortRef = useRef(false);

  useEffect(() => {
    abortRef.current = false;
    setTexto("");
    setEstado("iniciando");

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
        if (!abortRef.current) setEstado("listo");
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

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {}
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
                {copiado ? "✓ Copiado" : "Copiar"}
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
          {texto && (
            <pre className="audit-text">{texto}</pre>
          )}
          {estado === "streaming" && (
            <span className="audit-cursor">▋</span>
          )}
        </div>
      </div>
    </div>
  );
}
