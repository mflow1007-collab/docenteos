import { useEffect, useRef, useState } from "react";
import { AIService } from "../services/ai/AIService.js";
import { IMAGEN_IA_MIME, prepararImagenParaIA } from "../utils/imagenParaIA.js";

/**
 * Lector único de listas por foto: subir, analizar con IA y revisar los nombres.
 * Lo usan Estudiantes y Nuevo Curso. No guarda nada: los nombres y el error son
 * del componente que lo abre. Al desmontarse descarta lo que esté en curso.
 *
 * @param {{id: number, nombre: string}[]} nombres
 * @param {Function} onNombres - setState de los nombres
 * @param {Function} onError   - recibe el mensaje o null
 * @param {Function} [onEstado] - "vacio" | "preparando" | "foto" | "analizando" | "lista"
 */
export default function LectorFotoLista({ nombres, onNombres, error, onError, onEstado }) {
  const [preview, setPreview] = useState(null);
  const [preparando, setPreparando] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const turnoRef = useRef(0); // descarta una foto o un análisis que termina tarde

  useEffect(() => {
    const turno = turnoRef;
    return () => { turno.current += 1; };
  }, []);

  const estado = analizando ? "analizando" : preparando ? "preparando" : nombres.length ? "lista" : preview ? "foto" : "vacio";
  useEffect(() => { onEstado?.(estado); }, [estado, onEstado]);

  const elegirFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // permite volver a elegir el mismo archivo tras un error
    onError(null);
    onNombres([]);
    const turno = ++turnoRef.current;
    setPreparando(true);
    try {
      const dataURL = await prepararImagenParaIA(file);
      if (turno !== turnoRef.current) return;
      setPreview(dataURL);
    } catch (err) {
      if (turno === turnoRef.current) onError(err.message);
    } finally {
      if (turno === turnoRef.current) setPreparando(false);
    }
  };

  const cambiarImagen = () => {
    turnoRef.current += 1;
    setPreview(null);
    setAnalizando(false);
    onNombres([]);
    onError(null);
  };

  const analizar = () => {
    if (!preview) return;
    const turno = ++turnoRef.current;
    const vigente = () => turno === turnoRef.current;
    setAnalizando(true);
    onError(null);
    let accumulated = "";
    AIService.generate({
      module: "vision-estudiantes",
      prompt: "Observa esta imagen de una lista de estudiantes y extrae todos los nombres. Devuelve SOLO un JSON array de strings con los nombres completos, sin texto adicional, sin markdown. Ejemplo: [\"Juan Pérez\",\"María López\",\"Carlos García\"]",
      imageBase64: preview.split(",")[1],
      imageMediaType: IMAGEN_IA_MIME,
      onChunk: (chunk) => { accumulated += chunk; },
      onFinish: () => {
        if (!vigente()) return;
        try {
          const match = accumulated.match(/\[[\s\S]*?\]/);
          if (!match) throw new Error("respuesta sin lista");
          const leidos = JSON.parse(match[0]).filter(Boolean);
          onNombres(leidos.map((n, i) => ({ id: i, nombre: String(n) })));
          if (leidos.length === 0) onError("No se encontraron nombres. Intenta con una imagen más clara.");
        } catch {
          onError("La IA no devolvió la lista. Intenta de nuevo o agrega los nombres manualmente.");
        }
        setAnalizando(false);
      },
      onError: (err) => {
        if (!vigente()) return;
        onError(err);
        setAnalizando(false);
      },
    });
  };

  return (
    <>
      {!preview ? (
        <label className="ma-upload-zone">
          <input type="file" accept="image/*" onChange={elegirFoto} />
          <div className="ma-upload-icon">📷</div>
          <p className="ma-upload-title">{preparando ? "Preparando la foto…" : "Arrastra la foto aquí o haz clic"}</p>
          <p className="ma-upload-desc">JPG, PNG, HEIC — hasta 20 MB</p>
        </label>
      ) : (
        <>
          <img src={preview} alt="Lista de estudiantes" className="ma-preview" />
          <button
            type="button"
            style={{ fontSize: 12, background: "none", border: "none", color: "#64748b", cursor: "pointer", textDecoration: "underline", padding: 0, textAlign: "left" }}
            onClick={cambiarImagen}
          >Cambiar imagen</button>
        </>
      )}

      {preview && nombres.length === 0 && (
        <button
          type="button"
          className={`ma-btn-ia${analizando ? " analyzing" : ""}`}
          onClick={analizar}
          disabled={analizando}
        >
          {analizando ? (
            <><span style={{ display: "inline-block", animation: "ma-spin 0.8s linear infinite" }}>⏳</span> Analizando imagen…</>
          ) : (
            <><span>✨</span> Analizar con IA</>
          )}
        </button>
      )}

      {error && (
        <div className="ma-error" role="alert">
          <span>⚠️</span> {error}
        </div>
      )}

      {nombres.length > 0 && (
        <div>
          <div className="ma-names-header">
            <span>Revisa y edita los nombres</span>
            <span className="ma-names-count">{nombres.filter((n) => n.nombre.trim()).length} estudiantes</span>
          </div>
          <div className="ma-names-list">
            {nombres.map((item, idx) => (
              <div key={item.id} className="ma-name-row">
                <span className="ma-name-num">{idx + 1}</span>
                <input
                  className="ma-name-input"
                  value={item.nombre}
                  onChange={(e) => onNombres((prev) => prev.map((n, i) => i === idx ? { ...n, nombre: e.target.value } : n))}
                  placeholder="Nombre completo…"
                />
                <button type="button" className="ma-name-del" onClick={() => onNombres((prev) => prev.filter((_, i) => i !== idx))}>✕</button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="ma-add-link"
            onClick={() => onNombres((prev) => [...prev, { id: Date.now(), nombre: "" }])}
          >
            <span>＋</span> Agregar nombre manualmente
          </button>
        </div>
      )}
    </>
  );
}
