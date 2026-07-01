import { useEffect, useMemo, useState } from "react";
import { listarMaterialesBiblioteca } from "../services/fuenteMonitorService.js";
import "./BibliotecaPage.css";

const FILTRO_TODOS = "todos";

function valorMaterial(material, campo) {
  if (campo === "grado") {
    return String(material?.gradoEtiqueta || material?.grado || "").trim();
  }
  return String(material?.[campo] || "").trim();
}

function gradoVisible(material) {
  if (material?.gradoEtiqueta) return material.gradoEtiqueta;
  const grado = String(material?.grado || "").trim();
  const nivel = String(material?.nivel || "").trim();
  const ordinales = {
    Primero: "1ro",
    Segundo: "2do",
    Tercero: "3ro",
    Cuarto: "4to",
    Quinto: "5to",
    Sexto: "6to",
  };
  if (!grado) return "";
  if (!nivel || nivel === "Inicial") return ordinales[grado] || grado;
  return `${ordinales[grado] || grado} ${nivel}`;
}

function actualizadoVisible(material) {
  if (material?.actualizadoEtiqueta) return `Actualizado ${material.actualizadoEtiqueta}`;
  const fecha = material?.actualizadoEnFuente || material?.fuenteActualizadaEn;
  const year = fecha ? new Date(fecha).getFullYear() : 0;
  return year ? `Actualizado ${year}` : "";
}

function opcionesUnicas(materiales, campo) {
  return [
    FILTRO_TODOS,
    ...new Set(materiales.map((material) => valorMaterial(material, campo)).filter(Boolean)),
  ];
}

function etiquetaOpcion(valor, todosLabel) {
  return valor === FILTRO_TODOS ? todosLabel : valor;
}

function guardarSeleccionMaterial(key, material) {
  try {
    localStorage.setItem(key, JSON.stringify({
      ...material,
      seleccionadoEn: new Date().toISOString(),
    }));
  } catch {
    // La selección visual ya ocurrió; si localStorage falla no bloqueamos al docente.
  }
}

function esPdfDirecto(url) {
  return /^https?:\/\/.+\.pdf(\?.*)?$/i.test(String(url || ""));
}

function getLibroAbiertoBookId(material) {
  const idOrigen = String(material?.idOrigen || "").trim();
  if (idOrigen) return idOrigen;

  const id = String(material?.id || "").trim();
  if (id.startsWith("libro-abierto-")) {
    return id.replace(/^libro-abierto-/, "");
  }
  return "";
}

function buildLibroAbiertoLectorUrl(material) {
  if (material?.lectorUrl) return material.lectorUrl;
  const bookId = getLibroAbiertoBookId(material);
  if (!bookId || !material?.nivel || !material?.grado || !material?.asignatura) return "";
  return `https://libroabierto.minerd.gob.do/${encodeURIComponent(material.nivel)}/${encodeURIComponent(material.grado)}/${encodeURIComponent(material.asignatura)}/${encodeURIComponent(bookId)}/lector`;
}

function getReaderUrl(material) {
  const bookId = getLibroAbiertoBookId(material);
  if ((material?.fuenteId === "minerd-libro-abierto" || bookId) && bookId) {
    return `/api/materiales/libro-abierto-pdf?id=${encodeURIComponent(bookId)}&stream=1`;
  }
  if (material?.lectorUrl) {
    return material.lectorUrl;
  }
  if (esPdfDirecto(material?.archivoUrl)) {
    return material.archivoUrl;
  }
  return material?.archivoUrl || material?.origen || "";
}

export default function BibliotecaPage({
  onIrA = () => {},
  fuenteId = "",
  titulo = "Recursos oficiales listos para usar",
  kicker = "Biblioteca MINERD",
  descripcion = "Busca libros y documentos importados por metadatos. DocenteOS guarda fichas ligeras y abre el material desde su fuente oficial.",
  emptyTitle = "No hay materiales con esos filtros",
  emptyDescription = "Importa recursos desde el Monitor MINERD o cambia los filtros.",
}) {
  const [materiales, setMateriales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState(null);
  const [materialLeyendo, setMaterialLeyendo] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [nivel, setNivel] = useState(FILTRO_TODOS);
  const [grado, setGrado] = useState(FILTRO_TODOS);
  const [asignatura, setAsignatura] = useState(FILTRO_TODOS);
  const [portadasFallidas, setPortadasFallidas] = useState(() => new Set());
  const [favoritos, setFavoritos] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("docenteos_biblioteca_favoritos") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    let activo = true;
    listarMaterialesBiblioteca()
      .then((data) => {
        if (activo) {
          setMateriales(fuenteId ? data.filter((material) => material.fuenteId === fuenteId) : data);
        }
      })
      .catch((error) => {
        console.error("[BibliotecaPage] cargar materiales:", error);
        if (activo) setMensaje({ tipo: "error", texto: "No fue posible cargar la biblioteca." });
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [fuenteId]);

  const niveles = useMemo(() => opcionesUnicas(materiales, "nivel"), [materiales]);
  const grados = useMemo(() => opcionesUnicas(materiales, "grado"), [materiales]);
  const asignaturas = useMemo(() => opcionesUnicas(materiales, "asignatura"), [materiales]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return materiales.filter((material) => {
      const texto = [
        material.titulo,
        material.nivel,
        material.grado,
        material.asignatura,
        material.autor,
        material.editorial,
        material.fuente,
      ].filter(Boolean).join(" ").toLowerCase();

      return (
        (!q || texto.includes(q)) &&
        (nivel === FILTRO_TODOS || valorMaterial(material, "nivel") === nivel) &&
        (grado === FILTRO_TODOS || valorMaterial(material, "grado") === grado) &&
        (asignatura === FILTRO_TODOS || valorMaterial(material, "asignatura") === asignatura)
      );
    });
  }, [materiales, busqueda, nivel, grado, asignatura]);

  const favoritosSet = useMemo(() => new Set(favoritos), [favoritos]);

  const alternarFavorito = (material) => {
    const id = material.id || material.idOrigen || material.titulo;
    const siguiente = favoritosSet.has(id)
      ? favoritos.filter((item) => item !== id)
      : [...favoritos, id];
    setFavoritos(siguiente);
    localStorage.setItem("docenteos_biblioteca_favoritos", JSON.stringify(siguiente));
  };

  const usarEnPlanificacion = (material) => {
    guardarSeleccionMaterial("docenteos_material_planificacion_activo", material);
    setMensaje({ tipo: "ok", texto: `${material.titulo} quedó listo como recurso para planificación.` });
  };

  const usarConIA = (material) => {
    guardarSeleccionMaterial("docenteos_material_ia_activo", material);
    setMensaje({ tipo: "ok", texto: `${material.titulo} quedó marcado como contexto para IA.` });
  };

  const limpiarFiltros = () => {
    setBusqueda("");
    setNivel(FILTRO_TODOS);
    setGrado(FILTRO_TODOS);
    setAsignatura(FILTRO_TODOS);
  };

  return (
    <div className="biblioteca-page">
      <section className="biblioteca-header">
        <div>
          <p className="biblioteca-kicker">{kicker}</p>
          <h1>{titulo}</h1>
          <p>{descripcion}</p>
        </div>
        <div className="biblioteca-kpis">
          <div>
            <strong>{materiales.length}</strong>
            <span>materiales</span>
          </div>
          <div>
            <strong>{filtrados.length}</strong>
            <span>visibles</span>
          </div>
        </div>
      </section>

      {mensaje && <div className={`biblioteca-alert ${mensaje.tipo}`}>{mensaje.texto}</div>}

      <section className="biblioteca-filtros" aria-label="Filtros de biblioteca">
        <label>
          <span>Buscar</span>
          <input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Título, área, autor..."
          />
        </label>
        <label>
          <span>Nivel</span>
          <select value={nivel} onChange={(event) => setNivel(event.target.value)}>
            {niveles.map((item) => <option key={item} value={item}>{etiquetaOpcion(item, "Todos")}</option>)}
          </select>
        </label>
        <label>
          <span>Grado</span>
          <select value={grado} onChange={(event) => setGrado(event.target.value)}>
            {grados.map((item) => <option key={item} value={item}>{etiquetaOpcion(item, "Todos")}</option>)}
          </select>
        </label>
        <label>
          <span>Área</span>
          <select value={asignatura} onChange={(event) => setAsignatura(event.target.value)}>
            {asignaturas.map((item) => <option key={item} value={item}>{etiquetaOpcion(item, "Todas")}</option>)}
          </select>
        </label>
        <button className="biblioteca-filter-reset" type="button" onClick={limpiarFiltros}>
          Ver todos
        </button>
      </section>

      {cargando ? (
        <div className="biblioteca-empty">Cargando biblioteca...</div>
      ) : filtrados.length === 0 ? (
        <div className="biblioteca-empty">
          <h2>{emptyTitle}</h2>
          <p>{emptyDescription}</p>
        </div>
      ) : (
        <section className="biblioteca-grid">
          {filtrados.map((material) => {
            const id = material.id || material.idOrigen || material.titulo;
            const readerUrl = getReaderUrl(material);
            const fuenteUrl = buildLibroAbiertoLectorUrl(material) || material.archivoUrl || material.origen || readerUrl;
            const esFavorito = favoritosSet.has(id);
            const portadaDisponible = material.portadaUrl && !portadasFallidas.has(id);

            return (
              <article className="biblioteca-card" key={id}>
                <div className="biblioteca-cover">
                  <button
                    className={`biblioteca-icon-btn${esFavorito ? " active" : ""}`}
                    type="button"
                    onClick={() => alternarFavorito(material)}
                    aria-label={esFavorito ? "Quitar de favoritos" : "Agregar a favoritos"}
                    title={esFavorito ? "Quitar de favoritos" : "Agregar a favoritos"}
                  >
                    ★
                  </button>
                  {portadaDisponible ? (
                    <img
                      src={material.portadaUrl}
                      alt=""
                      loading="lazy"
                      onError={() => setPortadasFallidas((prev) => new Set(prev).add(id))}
                    />
                  ) : (
                    <div className="biblioteca-cover-generated">
                      <small>{material.fuente || "Libro Abierto MINERD"}</small>
                      <strong>{material.titulo || "Material"}</strong>
                      <span>{gradoVisible(material) || material.nivel || "Recurso oficial"}</span>
                    </div>
                  )}
                </div>
                <div className="biblioteca-card-body">
                  <h2>{material.titulo || "Material sin título"}</h2>
                  <p className="biblioteca-meta">
                    {[material.nivel, gradoVisible(material), material.asignatura].filter(Boolean).join(" · ") || "Sin clasificar"}
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
        <div className="biblioteca-reader-overlay" role="dialog" aria-modal="true" aria-labelledby="biblioteca-reader-title">
          <div className="biblioteca-reader">
            <div className="biblioteca-reader-header">
              <div>
                <span>Lectura en DocenteOS</span>
                <h2 id="biblioteca-reader-title">{materialLeyendo.titulo || "Material"}</h2>
                <p>
                  {[materialLeyendo.nivel, gradoVisible(materialLeyendo), materialLeyendo.asignatura]
                    .filter(Boolean)
                    .join(" · ") || "Libro Abierto MINERD"}
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
                  title={materialLeyendo.titulo || "Libro"}
                  src={materialLeyendo.readerUrl}
                  loading="lazy"
                />
              ) : (
                <div className="biblioteca-reader-empty">
                  Este material no tiene un PDF disponible para lectura interna.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
