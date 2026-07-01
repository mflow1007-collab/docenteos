import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  eliminarMaterialBiblioteca,
  listarMaterialesBiblioteca,
} from "../services/fuenteMonitorService.js";
import "./BibliotecaPage.css";

const FILTRO_TODOS = "todos";
const TIPOS_CURRICULARES = new Set([
  "adecuacion_curricular",
  "diseno_curricular",
  "ordenanza",
]);

const LABEL_TIPOS = {
  adecuacion_curricular: "Adecuación curricular",
  diseno_curricular: "Diseño curricular",
  ordenanza: "Ordenanza",
};

function etiquetaOpcion(valor, todosLabel) {
  return valor === FILTRO_TODOS ? todosLabel : valor;
}

function opcionesUnicas(items, campo) {
  return [
    FILTRO_TODOS,
    ...new Set(items.map((item) => String(item?.[campo] || "").trim()).filter(Boolean)),
  ];
}

function guardarSeleccionMaterial(key, material) {
  try {
    localStorage.setItem(key, JSON.stringify({
      ...material,
      seleccionadoEn: new Date().toISOString(),
    }));
  } catch {
    // La acción de selección no debe bloquear el flujo docente.
  }
}

function getReaderUrl(material) {
  return material?.lectorUrl || material?.archivoUrl || material?.origen || "";
}

function getFuenteUrl(material) {
  return material?.archivoUrl || material?.lectorUrl || material?.origen || "";
}

function actualizadoVisible(material) {
  if (material?.actualizadoEtiqueta) return `Actualizado ${material.actualizadoEtiqueta}`;
  const fecha = material?.actualizadoEnFuente || material?.fuenteActualizadaEn;
  const year = fecha ? new Date(fecha).getFullYear() : 0;
  return year ? `Actualizado ${year}` : "";
}

export default function CurricularPage({ onIrA = () => {} }) {
  const { user } = useAuth();
  const [materiales, setMateriales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState(null);
  const [materialLeyendo, setMaterialLeyendo] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [nivel, setNivel] = useState(FILTRO_TODOS);
  const [tipo, setTipo] = useState(FILTRO_TODOS);
  const [portadasFallidas, setPortadasFallidas] = useState(() => new Set());
  const [eliminandoId, setEliminandoId] = useState("");
  const puedeEliminar = String(user?.email || "").toLowerCase() === "admin@docenteos.com";

  useEffect(() => {
    let activo = true;
    listarMaterialesBiblioteca()
      .then((data) => {
        if (!activo) return;
        setMateriales(
          data.filter((material) =>
            material?.fuenteId === "educando-documentos" &&
            TIPOS_CURRICULARES.has(material?.tipo)
          )
        );
      })
      .catch((error) => {
        console.error("[CurricularPage] cargar materiales:", error);
        if (activo) setMensaje({ tipo: "error", texto: "No fue posible cargar los documentos curriculares." });
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  const niveles = useMemo(() => opcionesUnicas(materiales, "nivel"), [materiales]);
  const tipos = useMemo(() => [
    FILTRO_TODOS,
    ...new Set(materiales.map((material) => material.tipo).filter(Boolean)),
  ], [materiales]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return materiales.filter((material) => {
      const texto = [
        material.titulo,
        material.descripcion,
        LABEL_TIPOS[material.tipo] || material.tipo,
        material.nivel,
        material.asignatura,
        material.formato,
      ].filter(Boolean).join(" ").toLowerCase();

      return (
        (!q || texto.includes(q)) &&
        (nivel === FILTRO_TODOS || material.nivel === nivel) &&
        (tipo === FILTRO_TODOS || material.tipo === tipo)
      );
    });
  }, [materiales, busqueda, nivel, tipo]);

  const totalAdecuaciones = materiales.filter((material) => material.tipo === "adecuacion_curricular").length;
  const totalDisenos = materiales.filter((material) => material.tipo === "diseno_curricular").length;

  const usarEnPlanificacion = (material) => {
    guardarSeleccionMaterial("docenteos_material_planificacion_activo", material);
    setMensaje({ tipo: "ok", texto: `${material.titulo} quedó listo como referencia curricular.` });
  };

  const usarConIA = (material) => {
    guardarSeleccionMaterial("docenteos_material_ia_activo", material);
    setMensaje({ tipo: "ok", texto: `${material.titulo} quedó marcado como contexto oficial para IA.` });
  };

  const eliminarMaterial = async (material) => {
    const id = material.id || "";
    if (!id || eliminandoId) return;
    setEliminandoId(id);
    try {
      await eliminarMaterialBiblioteca(id);
      setMateriales((prev) => prev.filter((item) => item.id !== id));
      setMensaje({ tipo: "ok", texto: `${material.titulo || "Documento"} fue eliminado del dashboard docente.` });
    } catch (error) {
      console.error("[CurricularPage] eliminar material:", error);
      setMensaje({ tipo: "error", texto: error.message || "No fue posible eliminar el documento." });
    } finally {
      setEliminandoId("");
    }
  };

  const limpiarFiltros = () => {
    setBusqueda("");
    setNivel(FILTRO_TODOS);
    setTipo(FILTRO_TODOS);
  };

  return (
    <div className="biblioteca-page">
      <section className="biblioteca-header">
        <div>
          <p className="biblioteca-kicker">Diseño y adecuación curricular</p>
          <h1>Documentos curriculares oficiales</h1>
          <p>
            Accede a diseños curriculares, adecuaciones y ordenanzas importadas desde Educando/MINERD para planificar con fuente oficial.
          </p>
        </div>
        <div className="biblioteca-kpis">
          <div>
            <strong>{totalDisenos}</strong>
            <span>diseños</span>
          </div>
          <div>
            <strong>{totalAdecuaciones}</strong>
            <span>adecuaciones</span>
          </div>
        </div>
      </section>

      {mensaje && <div className={`biblioteca-alert ${mensaje.tipo}`}>{mensaje.texto}</div>}

      <section className="biblioteca-filtros" aria-label="Filtros curriculares">
        <label>
          <span>Buscar</span>
          <input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Adecuación, nivel, modalidad..."
          />
        </label>
        <label>
          <span>Nivel</span>
          <select value={nivel} onChange={(event) => setNivel(event.target.value)}>
            {niveles.map((item) => <option key={item} value={item}>{etiquetaOpcion(item, "Todos")}</option>)}
          </select>
        </label>
        <label>
          <span>Tipo</span>
          <select value={tipo} onChange={(event) => setTipo(event.target.value)}>
            {tipos.map((item) => (
              <option key={item} value={item}>
                {item === FILTRO_TODOS ? "Todos" : LABEL_TIPOS[item] || item}
              </option>
            ))}
          </select>
        </label>
        <button className="biblioteca-filter-reset" type="button" onClick={limpiarFiltros}>
          Ver todos
        </button>
      </section>

      {cargando ? (
        <div className="biblioteca-empty">Cargando documentos curriculares...</div>
      ) : filtrados.length === 0 ? (
        <div className="biblioteca-empty">
          <h2>No hay documentos curriculares importados</h2>
          <p>Ve al Monitor MINERD, pulsa Ver Educando e importa los documentos seleccionados.</p>
          <div className="biblioteca-footer-actions" style={{ justifyContent: "center", marginTop: 14 }}>
            <button className="biblioteca-secondary" type="button" onClick={() => onIrA("biblioteca")}>
              Ver Biblioteca
            </button>
          </div>
        </div>
      ) : (
        <section className="biblioteca-grid">
          {filtrados.map((material) => {
            const id = material.id || material.idOrigen || material.titulo;
            const readerUrl = getReaderUrl(material);
            const fuenteUrl = getFuenteUrl(material);
            const portadaDisponible = material.portadaUrl && !portadasFallidas.has(id);

            return (
              <article className="biblioteca-card" key={id}>
                <div className="biblioteca-cover">
                  {portadaDisponible ? (
                    <img
                      src={material.portadaUrl}
                      alt=""
                      loading="lazy"
                      onError={() => setPortadasFallidas((prev) => new Set(prev).add(id))}
                    />
                  ) : (
                    <div className="biblioteca-cover-generated">
                      <small>{LABEL_TIPOS[material.tipo] || "Currículo"}</small>
                      <strong>{material.titulo || "Documento curricular"}</strong>
                      <span>{material.nivel || "MINERD"}</span>
                    </div>
                  )}
                </div>
                <div className="biblioteca-card-body">
                  <h2>{material.titulo || "Documento curricular"}</h2>
                  <p className="biblioteca-meta">
                    {[LABEL_TIPOS[material.tipo] || material.tipo, material.nivel, material.formato]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {actualizadoVisible(material) && (
                    <p className="biblioteca-fuente">{actualizadoVisible(material)}</p>
                  )}
                </div>
                <div className="biblioteca-actions">
                  <button
                    className="biblioteca-btn primary"
                    type="button"
                    onClick={() => setMaterialLeyendo({ ...material, readerUrl, fuenteUrl })}
                    disabled={!readerUrl}
                  >
                    Leer
                  </button>
                  <button className="biblioteca-btn" type="button" onClick={() => usarEnPlanificacion(material)}>
                    Planificar
                  </button>
                  <button className="biblioteca-btn" type="button" onClick={() => usarConIA(material)}>
                    IA
                  </button>
                  {puedeEliminar && (
                    <button
                      className="biblioteca-btn danger"
                      type="button"
                      onClick={() => eliminarMaterial(material)}
                      disabled={eliminandoId === id}
                    >
                      {eliminandoId === id ? "..." : "Eliminar"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      <div className="biblioteca-footer-actions">
        <button className="biblioteca-secondary" type="button" onClick={() => onIrA("planificacion")}>
          Ir a planificación
        </button>
      </div>

      {materialLeyendo && (
        <div className="biblioteca-reader-overlay" role="dialog" aria-modal="true" aria-labelledby="curricular-reader-title">
          <div className="biblioteca-reader">
            <div className="biblioteca-reader-header">
              <div>
                <span>Fuente oficial Educando/MINERD</span>
                <h2 id="curricular-reader-title">{materialLeyendo.titulo || "Documento curricular"}</h2>
                <p>
                  {[LABEL_TIPOS[materialLeyendo.tipo] || materialLeyendo.tipo, materialLeyendo.nivel, materialLeyendo.formato]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="biblioteca-reader-actions">
                <a href={materialLeyendo.fuenteUrl || materialLeyendo.readerUrl || materialLeyendo.origen} target="_blank" rel="noreferrer">
                  Abrir fuente
                </a>
                <button type="button" onClick={() => setMaterialLeyendo(null)}>
                  Cerrar
                </button>
              </div>
            </div>
            <div className="biblioteca-reader-frame">
              {materialLeyendo.readerUrl ? (
                <iframe
                  title={materialLeyendo.titulo || "Documento curricular"}
                  src={materialLeyendo.readerUrl}
                  loading="lazy"
                />
              ) : (
                <div className="biblioteca-reader-empty">
                  Este documento no tiene una vista previa disponible.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
