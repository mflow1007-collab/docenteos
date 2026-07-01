import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  eliminarMaterialBiblioteca,
  listarMaterialesBiblioteca,
} from "../services/fuenteMonitorService.js";
import "./BibliotecaPage.css";

const FILTRO_TODOS = "todos";

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
    // La selección del recurso no debe interrumpir el flujo docente.
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

export default function RegistrosEducandoPage({ onIrA = () => {} }) {
  const { user } = useAuth();
  const [materiales, setMateriales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState(null);
  const [materialLeyendo, setMaterialLeyendo] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [nivel, setNivel] = useState(FILTRO_TODOS);
  const [formato, setFormato] = useState(FILTRO_TODOS);
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
            material?.tipo === "registro"
          )
        );
      })
      .catch((error) => {
        console.error("[RegistrosEducandoPage] cargar registros:", error);
        if (activo) setMensaje({ tipo: "error", texto: "No fue posible cargar los registros oficiales." });
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  const niveles = useMemo(() => opcionesUnicas(materiales, "nivel"), [materiales]);
  const formatos = useMemo(() => opcionesUnicas(materiales, "formato"), [materiales]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return materiales.filter((material) => {
      const texto = [
        material.titulo,
        material.descripcion,
        material.nivel,
        material.asignatura,
        material.formato,
      ].filter(Boolean).join(" ").toLowerCase();

      return (
        (!q || texto.includes(q)) &&
        (nivel === FILTRO_TODOS || material.nivel === nivel) &&
        (formato === FILTRO_TODOS || material.formato === formato)
      );
    });
  }, [materiales, busqueda, nivel, formato]);

  const totalPrimario = materiales.filter((material) => material.nivel === "Primario").length;
  const totalSecundario = materiales.filter((material) => material.nivel === "Secundario").length;
  const portadasRepetidas = useMemo(() => {
    const conteo = new Map();
    materiales.forEach((material) => {
      const portada = String(material.portadaUrl || "").trim();
      if (!portada || portada.startsWith("data:")) return;
      conteo.set(portada, (conteo.get(portada) || 0) + 1);
    });
    return new Set([...conteo.entries()].filter(([, total]) => total > 1).map(([portada]) => portada));
  }, [materiales]);

  const usarEnPlanificacion = (material) => {
    guardarSeleccionMaterial("docenteos_material_planificacion_activo", material);
    setMensaje({ tipo: "ok", texto: `${material.titulo} quedó listo como recurso de apoyo.` });
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
      setMensaje({ tipo: "ok", texto: `${material.titulo || "Registro"} fue eliminado del dashboard docente.` });
    } catch (error) {
      console.error("[RegistrosEducandoPage] eliminar registro:", error);
      setMensaje({ tipo: "error", texto: error.message || "No fue posible eliminar el registro." });
    } finally {
      setEliminandoId("");
    }
  };

  const limpiarFiltros = () => {
    setBusqueda("");
    setNivel(FILTRO_TODOS);
    setFormato(FILTRO_TODOS);
  };

  return (
    <div className="biblioteca-page">
      <section className="biblioteca-header">
        <div>
          <p className="biblioteca-kicker">Registro oficial Educando/MINERD</p>
          <h1>Registro del MINERD</h1>
          <p>
            Consulta los registros oficiales importados desde Educando, separados de Mi Registro de DocenteOS.
          </p>
        </div>
        <div className="biblioteca-kpis">
          <div>
            <strong>{totalPrimario}</strong>
            <span>primario</span>
          </div>
          <div>
            <strong>{totalSecundario}</strong>
            <span>secundario</span>
          </div>
        </div>
      </section>

      {mensaje && <div className={`biblioteca-alert ${mensaje.tipo}`}>{mensaje.texto}</div>}

      <section className="biblioteca-filtros" aria-label="Filtros de registros oficiales">
        <label>
          <span>Buscar</span>
          <input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Registro, nivel, formato..."
          />
        </label>
        <label>
          <span>Nivel</span>
          <select value={nivel} onChange={(event) => setNivel(event.target.value)}>
            {niveles.map((item) => <option key={item} value={item}>{etiquetaOpcion(item, "Todos")}</option>)}
          </select>
        </label>
        <label>
          <span>Formato</span>
          <select value={formato} onChange={(event) => setFormato(event.target.value)}>
            {formatos.map((item) => <option key={item} value={item}>{etiquetaOpcion(item, "Todos")}</option>)}
          </select>
        </label>
        <button className="biblioteca-filter-reset" type="button" onClick={limpiarFiltros}>
          Ver todos
        </button>
      </section>

      {cargando ? (
        <div className="biblioteca-empty">Cargando registros oficiales...</div>
      ) : filtrados.length === 0 ? (
        <div className="biblioteca-empty">
          <h2>No hay registros oficiales importados</h2>
          <p>Ve al Monitor MINERD, pulsa Ver Educando e importa los registros seleccionados.</p>
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
            const portadaRepetida = portadasRepetidas.has(String(material.portadaUrl || "").trim());
            const portadaDisponible = material.portadaUrl && !portadasFallidas.has(id) && !portadaRepetida;

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
                      <small>Registro oficial</small>
                      <strong>{material.titulo || "Registro MINERD"}</strong>
                      <span>{material.nivel || "Educando"}</span>
                    </div>
                  )}
                </div>
                <div className="biblioteca-card-body">
                  <h2>{material.titulo || "Registro MINERD"}</h2>
                  <p className="biblioteca-meta">
                    {["Registro oficial", material.nivel, material.formato]
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
        <button className="biblioteca-secondary" type="button" onClick={() => onIrA("mi-registro")}>
          Ir a Mi Registro
        </button>
      </div>

      {materialLeyendo && (
        <div className="biblioteca-reader-overlay" role="dialog" aria-modal="true" aria-labelledby="registros-reader-title">
          <div className="biblioteca-reader">
            <div className="biblioteca-reader-header">
              <div>
                <span>Fuente oficial Educando/MINERD</span>
                <h2 id="registros-reader-title">{materialLeyendo.titulo || "Registro MINERD"}</h2>
                <p>
                  {["Registro oficial", materialLeyendo.nivel, materialLeyendo.formato]
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
                  title={materialLeyendo.titulo || "Registro MINERD"}
                  src={materialLeyendo.readerUrl}
                  loading="lazy"
                />
              ) : (
                <div className="biblioteca-reader-empty">
                  Este registro no tiene una vista previa disponible.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
