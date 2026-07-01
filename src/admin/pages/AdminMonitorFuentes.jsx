import { useEffect, useMemo, useState } from "react";
import { useAdmin } from "../../context/AdminContext.jsx";
import {
  aprobarCambioMonitor,
  eliminarFuenteMonitor,
  FUENTES_OFICIALES_BASE,
  guardarMaterialesEducando,
  guardarMaterialesLibroAbierto,
  guardarFuenteMonitor,
  listarCambiosMonitor,
  listarFuentesMonitor,
  obtenerEducandoMateriales,
  obtenerLibroAbiertoMateriales,
  rechazarCambioMonitor,
  verificarFuenteMonitor,
} from "../../services/fuenteMonitorService.js";

const nuevaFuenteInicial = {
  nombre: "",
  url: "",
  categoria: "MINERD",
  destino: "Revisión manual",
  activa: true,
  auth: {
    type: "none",
    usernameEnv: "",
    passwordEnv: "",
    tokenEnv: "",
  },
};

function formatearFecha(valor) {
  if (!valor) return "Sin revisar";
  if (typeof valor?.toDate === "function") return valor.toDate().toLocaleString("es-DO");
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? "Sin revisar" : fecha.toLocaleString("es-DO");
}

function estadoBadge(estado) {
  if (estado === "aprobado") return "badge-activo";
  if (estado === "rechazado") return "badge-inactivo";
  return "badge-pendiente";
}

function materialKey(material) {
  return material.idOrigen || material.id || `${material.titulo}-${material.grado}-${material.asignatura}`;
}

const FILTRO_TODOS = "todos";

function opcionesUnicas(items, campo) {
  return [
    FILTRO_TODOS,
    ...new Set(items.map((item) => String(campo === "grado" ? gradoVisible(item) : item?.[campo] || "").trim()).filter(Boolean)),
  ];
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

export default function AdminMonitorFuentes() {
  const { user } = useAdmin();
  const [fuentes, setFuentes] = useState([]);
  const [cambios, setCambios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [verificando, setVerificando] = useState(null);
  const [importandoMateriales, setImportandoMateriales] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [previewMateriales, setPreviewMateriales] = useState(null);
  const [materialesSeleccionados, setMaterialesSeleccionados] = useState([]);
  const [filtroMateriales, setFiltroMateriales] = useState({
    busqueda: "",
    nivel: FILTRO_TODOS,
    grado: FILTRO_TODOS,
    asignatura: FILTRO_TODOS,
  });
  const [nuevaFuente, setNuevaFuente] = useState(nuevaFuenteInicial);
  const [fuenteEditandoId, setFuenteEditandoId] = useState(null);

  const pendientes = useMemo(
    () => cambios.filter((cambio) => cambio.estado === "pendiente"),
    [cambios]
  );

  const materialesPreview = useMemo(
    () => previewMateriales?.materiales || [],
    [previewMateriales]
  );
  const materialesFiltrados = useMemo(() => {
    const q = filtroMateriales.busqueda.trim().toLowerCase();
    return materialesPreview.filter((material) => {
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
        (filtroMateriales.nivel === FILTRO_TODOS || material.nivel === filtroMateriales.nivel) &&
        (filtroMateriales.grado === FILTRO_TODOS || gradoVisible(material) === filtroMateriales.grado) &&
        (filtroMateriales.asignatura === FILTRO_TODOS || material.asignatura === filtroMateriales.asignatura)
      );
    });
  }, [materialesPreview, filtroMateriales]);

  const materialesSeleccionadosSet = useMemo(
    () => new Set(materialesSeleccionados),
    [materialesSeleccionados]
  );
  const nivelesMateriales = useMemo(() => opcionesUnicas(materialesPreview, "nivel"), [materialesPreview]);
  const gradosMateriales = useMemo(() => opcionesUnicas(materialesPreview, "grado"), [materialesPreview]);
  const asignaturasMateriales = useMemo(() => opcionesUnicas(materialesPreview, "asignatura"), [materialesPreview]);
  const previewEsEducando = previewMateriales?.fuenteId === "educando-documentos";
  const previewNombreFuente = previewEsEducando ? "Educando" : "Libro Abierto";
  const previewTipoRecurso = previewEsEducando ? "documentos" : "materiales";

  const cargar = async () => {
    setCargando(true);
    try {
      const [fuentesData, cambiosData] = await Promise.all([
        listarFuentesMonitor(),
        listarCambiosMonitor(),
      ]);
      setFuentes(fuentesData);
      setCambios(cambiosData);
    } catch (error) {
      console.error("[AdminMonitorFuentes] cargar:", error);
      setMensaje({ tipo: "error", texto: "No fue posible cargar el monitor de fuentes." });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const fuenteUsaCredencialesUsuarioClave =
    (nuevaFuente.auth?.type || "none") === "basic" ||
    nuevaFuente.id === "minerd-libro-abierto" ||
    Boolean(nuevaFuente.auth?.usernameEnv || nuevaFuente.auth?.passwordEnv);

  const cancelarEdicion = () => {
    setFuenteEditandoId(null);
    setNuevaFuente(nuevaFuenteInicial);
  };

  const editarFuente = (fuente) => {
    setFuenteEditandoId(fuente.id);
    setNuevaFuente({
      ...nuevaFuenteInicial,
      ...fuente,
      auth: {
        type: fuente.auth?.type || "none",
        usernameEnv: fuente.auth?.usernameEnv || "",
        passwordEnv: fuente.auth?.passwordEnv || "",
        tokenEnv: fuente.auth?.tokenEnv || "",
      },
    });
    setMensaje({ tipo: "info", texto: `Editando ${fuente.nombre}. Guarda para aplicar los cambios.` });
  };

  const guardarFuente = async (event) => {
    event.preventDefault();
    if (!nuevaFuente.nombre.trim() || !nuevaFuente.url.trim()) {
      setMensaje({ tipo: "warning", texto: "Completa nombre y URL de la fuente." });
      return;
    }

    try {
      await guardarFuenteMonitor({
        ...nuevaFuente,
        id: fuenteEditandoId || nuevaFuente.id || `fuente-${Date.now()}`,
        nombre: nuevaFuente.nombre.trim(),
        url: nuevaFuente.url.trim(),
        categoria: nuevaFuente.categoria?.trim() || "General",
        destino: nuevaFuente.destino?.trim() || "Revisión manual",
        auth: {
          type: nuevaFuente.auth?.type || "none",
          usernameEnv: nuevaFuente.auth?.usernameEnv?.trim() || "",
          passwordEnv: nuevaFuente.auth?.passwordEnv?.trim() || "",
          tokenEnv: nuevaFuente.auth?.tokenEnv?.trim() || "",
        },
      });
      cancelarEdicion();
      setMensaje({
        tipo: "success",
        texto: fuenteEditandoId ? "Fuente actualizada." : "Fuente agregada al monitor.",
      });
      await cargar();
    } catch (error) {
      console.error("[AdminMonitorFuentes] guardarFuente:", error);
      setMensaje({ tipo: "error", texto: "No fue posible guardar la fuente." });
    }
  };

  const sembrarFuentesBase = async () => {
    try {
      await Promise.all(FUENTES_OFICIALES_BASE.map((fuente) => guardarFuenteMonitor(fuente)));
      setMensaje({ tipo: "success", texto: "Fuentes base de MINERD activadas." });
      await cargar();
    } catch (error) {
      console.error("[AdminMonitorFuentes] sembrar:", error);
      setMensaje({ tipo: "error", texto: "No fue posible activar las fuentes base." });
    }
  };

  const verificarUna = async (fuente) => {
    setVerificando(fuente.id);
    setMensaje(null);
    try {
      const resultado = await verificarFuenteMonitor(fuente);
      if (resultado.tipo === "baseline") {
        setMensaje({ tipo: "info", texto: `${fuente.nombre}: línea base creada. La próxima revisión detectará cambios.` });
      } else if (resultado.tipo === "sin-cambios") {
        setMensaje({ tipo: "success", texto: `${fuente.nombre}: sin cambios nuevos.` });
      } else {
        setMensaje({ tipo: "warning", texto: `${fuente.nombre}: cambio detectado y enviado a revisión.` });
      }
      await cargar();
    } catch (error) {
      console.error("[AdminMonitorFuentes] verificar:", error);
      setMensaje({ tipo: "error", texto: `${fuente.nombre}: ${error.message}` });
    } finally {
      setVerificando(null);
    }
  };

  const verificarTodas = async () => {
    for (const fuente of fuentes.filter((item) => item.activa !== false)) {
      await verificarUna(fuente);
    }
  };

  const getFuenteLibroAbierto = () =>
    fuentes.find((fuente) => fuente.id === "minerd-libro-abierto") ||
    FUENTES_OFICIALES_BASE.find((fuente) => fuente.id === "minerd-libro-abierto") ||
    {};

  const getFuenteEducando = () =>
    fuentes.find((fuente) => fuente.id === "educando-adecuacion-curricular") ||
    fuentes.find((fuente) => fuente.fuenteId === "educando-documentos") ||
    FUENTES_OFICIALES_BASE.find((fuente) => fuente.id === "educando-adecuacion-curricular") ||
    {};

  const previsualizarLibroAbierto = async () => {
    const fuenteLibroAbierto =
      getFuenteLibroAbierto();

    setImportandoMateriales(true);
    setMensaje(null);
    try {
      const resultado = await obtenerLibroAbiertoMateriales(fuenteLibroAbierto);
      setPreviewMateriales(resultado);
      setMaterialesSeleccionados((resultado.materiales || []).map(materialKey));
      setFiltroMateriales({
        busqueda: "",
        nivel: FILTRO_TODOS,
        grado: FILTRO_TODOS,
        asignatura: FILTRO_TODOS,
      });
      setMensaje({
        tipo: "info",
        texto: `Libro Abierto listo para revisión: ${resultado.total || resultado.materiales?.length || 0} materiales encontrados.`,
      });
    } catch (error) {
      console.error("[AdminMonitorFuentes] previsualizarLibroAbierto:", error);
      setMensaje({ tipo: "error", texto: error.message || "No fue posible revisar Libro Abierto." });
    } finally {
      setImportandoMateriales(false);
    }
  };

  const previsualizarEducando = async () => {
    const fuenteEducando = getFuenteEducando();

    setImportandoMateriales(true);
    setMensaje(null);
    try {
      const resultado = await obtenerEducandoMateriales(fuenteEducando);
      setPreviewMateriales(resultado);
      setMaterialesSeleccionados((resultado.materiales || []).map(materialKey));
      setFiltroMateriales({
        busqueda: "",
        nivel: FILTRO_TODOS,
        grado: FILTRO_TODOS,
        asignatura: FILTRO_TODOS,
      });
      setMensaje({
        tipo: "info",
        texto: `Educando listo para revisión: ${resultado.total || resultado.materiales?.length || 0} documentos encontrados.`,
      });
    } catch (error) {
      console.error("[AdminMonitorFuentes] previsualizarEducando:", error);
      setMensaje({ tipo: "error", texto: error.message || "No fue posible revisar documentos de Educando." });
    } finally {
      setImportandoMateriales(false);
    }
  };

  const confirmarImportacionLibroAbierto = async () => {
    if (!previewMateriales) return;
    const seleccionados = (previewMateriales.materiales || [])
      .filter((material) => materialesSeleccionadosSet.has(materialKey(material)));
    if (!seleccionados.length) {
      setMensaje({ tipo: "warning", texto: "Selecciona al menos un material para importar." });
      return;
    }

    setImportandoMateriales(true);
    setMensaje(null);
    try {
      const guardar = previewEsEducando ? guardarMaterialesEducando : guardarMaterialesLibroAbierto;
      const resultado = await guardar({
        ...previewMateriales,
        materiales: seleccionados,
        total: seleccionados.length,
      });
      setPreviewMateriales(null);
      setMaterialesSeleccionados([]);
      setMensaje({
        tipo: "success",
        texto: `${previewNombreFuente} importado: ${resultado.guardados || 0} ${previewTipoRecurso} guardados en la colección materiales.`,
      });
    } catch (error) {
      console.error("[AdminMonitorFuentes] confirmarImportacionLibroAbierto:", error);
      setMensaje({ tipo: "error", texto: error.message || "No fue posible guardar los recursos." });
    } finally {
      setImportandoMateriales(false);
    }
  };

  const toggleMaterial = (material) => {
    const key = materialKey(material);
    setMaterialesSeleccionados((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  const seleccionarFiltrados = () => {
    const claves = materialesFiltrados.map(materialKey);
    setMaterialesSeleccionados((prev) => [...new Set([...prev, ...claves])]);
  };

  const limpiarFiltrados = () => {
    const claves = new Set(materialesFiltrados.map(materialKey));
    setMaterialesSeleccionados((prev) => prev.filter((item) => !claves.has(item)));
  };

  const aprobar = async (cambio) => {
    try {
      await aprobarCambioMonitor(cambio, user?.email);
      setMensaje({ tipo: "success", texto: "Cambio aprobado. La fuente quedó actualizada para próximas revisiones." });
      await cargar();
    } catch (error) {
      console.error("[AdminMonitorFuentes] aprobar:", error);
      setMensaje({ tipo: "error", texto: "No fue posible aprobar el cambio." });
    }
  };

  const rechazar = async (cambio) => {
    try {
      await rechazarCambioMonitor(cambio, user?.email);
      setMensaje({ tipo: "success", texto: "Cambio rechazado. No se aplicó ninguna actualización." });
      await cargar();
    } catch (error) {
      console.error("[AdminMonitorFuentes] rechazar:", error);
      setMensaje({ tipo: "error", texto: "No fue posible rechazar el cambio." });
    }
  };

  const eliminar = async (fuenteId) => {
    try {
      await eliminarFuenteMonitor(fuenteId);
      setMensaje({ tipo: "success", texto: "Fuente eliminada del monitor." });
      await cargar();
    } catch (error) {
      console.error("[AdminMonitorFuentes] eliminar:", error);
      setMensaje({ tipo: "error", texto: "No fue posible eliminar la fuente." });
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-header-text">
          <h2>Monitor MINERD y fuentes oficiales</h2>
          <p>Detecta cambios en páginas oficiales y los deja pendientes hasta que el administrador los apruebe.</p>
        </div>
        <div className="admin-row-actions">
          <button className="admin-btn admin-btn-secondary" onClick={cargar} disabled={cargando}>↻ Actualizar</button>
          <button
            className="admin-btn admin-btn-secondary"
            onClick={previsualizarLibroAbierto}
            disabled={cargando || importandoMateriales}
          >
            {importandoMateriales ? "Revisando libros..." : "Ver Libro Abierto"}
          </button>
          <button
            className="admin-btn admin-btn-secondary"
            onClick={previsualizarEducando}
            disabled={cargando || importandoMateriales}
          >
            {importandoMateriales ? "Revisando documentos..." : "Ver Educando"}
          </button>
          <button className="admin-btn admin-btn-primary" onClick={verificarTodas} disabled={cargando || Boolean(verificando)}>
            {verificando ? "Revisando..." : "Comprobar fuentes"}
          </button>
        </div>
      </div>

      {mensaje && <div className={`admin-alert ${mensaje.tipo}`}>{mensaje.texto}</div>}

      <div className="admin-stats-grid">
        <div className="admin-stat-card accent">
          <span className="admin-stat-icon">🌐</span>
          <strong className="admin-stat-valor">{fuentes.length}</strong>
          <span className="admin-stat-label">Fuentes monitoreadas</span>
        </div>
        <div className="admin-stat-card yellow">
          <span className="admin-stat-icon">⚠️</span>
          <strong className="admin-stat-valor">{pendientes.length}</strong>
          <span className="admin-stat-label">Cambios pendientes</span>
        </div>
        <div className="admin-stat-card green">
          <span className="admin-stat-icon">✅</span>
          <strong className="admin-stat-valor">{cambios.filter((c) => c.estado === "aprobado").length}</strong>
          <span className="admin-stat-label">Aprobados</span>
        </div>
        <div className="admin-stat-card red">
          <span className="admin-stat-icon">⛔</span>
          <strong className="admin-stat-valor">{cambios.filter((c) => c.estado === "rechazado").length}</strong>
          <span className="admin-stat-label">Rechazados</span>
        </div>
      </div>

      <form className="admin-info-panel" onSubmit={guardarFuente}>
        <h3>{fuenteEditandoId ? "Editar fuente oficial" : "Agregar fuente oficial"}</h3>
        <div className="admin-form-grid cols-3">
          <label className="admin-form-group">
            <span className="admin-form-label">Nombre</span>
            <input
              className="admin-form-input"
              value={nuevaFuente.nombre}
              onChange={(e) => setNuevaFuente((prev) => ({ ...prev, nombre: e.target.value }))}
              placeholder="MINERD - Comunicados"
            />
          </label>
          <label className="admin-form-group">
            <span className="admin-form-label">Categoría</span>
            <input
              className="admin-form-input"
              value={nuevaFuente.categoria}
              onChange={(e) => setNuevaFuente((prev) => ({ ...prev, categoria: e.target.value }))}
              placeholder="Currículo, calendario..."
            />
          </label>
          <label className="admin-form-group">
            <span className="admin-form-label">Destino interno</span>
            <input
              className="admin-form-input"
              value={nuevaFuente.destino}
              onChange={(e) => setNuevaFuente((prev) => ({ ...prev, destino: e.target.value }))}
              placeholder="Banco curricular"
            />
          </label>
          <label className="admin-form-group full">
            <span className="admin-form-label">URL</span>
            <input
              className="admin-form-input"
              value={nuevaFuente.url}
              onChange={(e) => setNuevaFuente((prev) => ({ ...prev, url: e.target.value }))}
              placeholder="https://..."
            />
            <small className="admin-form-hint">La primera revisión crea una línea base. Las siguientes generan alertas si cambia el contenido.</small>
          </label>
          <label className="admin-form-group">
            <span className="admin-form-label">Credenciales</span>
            <select
              className="admin-form-select"
              value={nuevaFuente.auth?.type || "none"}
              onChange={(e) => setNuevaFuente((prev) => ({
                ...prev,
                auth: { ...(prev.auth || {}), type: e.target.value },
              }))}
            >
              <option value="none">Sin credenciales</option>
              <option value="basic">Basic Auth</option>
              <option value="bearer">Bearer token</option>
            </select>
            <small className="admin-form-hint">No escribas contraseñas aquí; solo nombres de variables del servidor.</small>
          </label>
          {fuenteUsaCredencialesUsuarioClave && (
            <>
              <label className="admin-form-group">
                <span className="admin-form-label">Variable usuario</span>
                <input
                  className="admin-form-input"
                  value={nuevaFuente.auth?.usernameEnv || ""}
                  onChange={(e) => setNuevaFuente((prev) => ({
                    ...prev,
                    auth: { ...(prev.auth || {}), usernameEnv: e.target.value },
                  }))}
                  placeholder="LIBRO_ABIERTO_USER"
                />
              </label>
              <label className="admin-form-group">
                <span className="admin-form-label">Variable contraseña</span>
                <input
                  className="admin-form-input"
                  value={nuevaFuente.auth?.passwordEnv || ""}
                  onChange={(e) => setNuevaFuente((prev) => ({
                    ...prev,
                    auth: { ...(prev.auth || {}), passwordEnv: e.target.value },
                  }))}
                  placeholder="LIBRO_ABIERTO_PASSWORD"
                />
              </label>
            </>
          )}
          {(nuevaFuente.auth?.type || "none") === "bearer" && (
            <label className="admin-form-group">
              <span className="admin-form-label">Variable token</span>
              <input
                className="admin-form-input"
                value={nuevaFuente.auth?.tokenEnv || ""}
                onChange={(e) => setNuevaFuente((prev) => ({
                  ...prev,
                  auth: { ...(prev.auth || {}), tokenEnv: e.target.value },
                }))}
                placeholder="LIBRO_ABIERTO_TOKEN"
              />
            </label>
          )}
        </div>
        <div className="admin-row-actions">
          <button className="admin-btn admin-btn-primary" type="submit">
            {fuenteEditandoId ? "Guardar cambios" : "Agregar fuente"}
          </button>
          {fuenteEditandoId && (
            <button className="admin-btn admin-btn-secondary" type="button" onClick={cancelarEdicion}>
              Cancelar edición
            </button>
          )}
          <button className="admin-btn admin-btn-secondary" type="button" onClick={sembrarFuentesBase}>Activar fuentes base</button>
        </div>
      </form>

      {cargando ? (
        <div className="admin-loading"><div className="admin-spinner" />Cargando monitor...</div>
      ) : (
        <>
          <div className="admin-page-header" style={{ marginTop: 28 }}>
            <div className="admin-page-header-text">
              <h2>Fuentes conectadas</h2>
              <p>Estas páginas se revisan contra la última versión aprobada.</p>
            </div>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fuente</th>
                  <th>Categoría</th>
                  <th>Última revisión</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {fuentes.map((fuente) => (
                  <tr key={fuente.id}>
                    <td>
                      <strong>{fuente.nombre}</strong>
                      <br /><small>{fuente.url}</small>
                    </td>
                    <td><small>{fuente.categoria || "General"} · {fuente.destino || "Manual"}</small></td>
                    <td><small>{formatearFecha(fuente.lastCheckedAt)}</small></td>
                    <td>
                      <span className={`admin-badge ${fuente.activa !== false ? "badge-activo" : "badge-inactivo"}`}>
                        {fuente.activa !== false ? "Activa" : "Inactiva"}
                      </span>
                      {fuente.auth?.type && fuente.auth.type !== "none" && (
                        <>
                          <br /><small>Credenciales: {fuente.auth.type}</small>
                        </>
                      )}
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <button className="admin-btn-sm blue" onClick={() => verificarUna(fuente)} disabled={verificando === fuente.id}>
                          {verificando === fuente.id ? "Revisando" : "Comprobar"}
                        </button>
                        <button className="admin-btn-sm ghost" onClick={() => editarFuente(fuente)}>Editar</button>
                        <button className="admin-btn-sm ghost" onClick={() => eliminar(fuente.id)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {fuentes.length === 0 && (
                  <tr><td className="admin-table-empty" colSpan={5}>No hay fuentes configuradas.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="admin-page-header" style={{ marginTop: 28 }}>
            <div className="admin-page-header-text">
              <h2>Revisión de cambios</h2>
              <p>Solo los cambios aprobados pasan a ser la nueva versión de referencia.</p>
            </div>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Cambio detectado</th>
                  <th>Destino</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cambios.map((cambio) => (
                  <tr key={cambio.id}>
                    <td>
                      <strong>{cambio.titulo || cambio.fuenteNombre}</strong>
                      <br /><small>{cambio.fuenteNombre} · {cambio.url}</small>
                    </td>
                    <td><small>{cambio.categoria} · {cambio.destino}</small></td>
                    <td><small>{formatearFecha(cambio.detectadoEn)}</small></td>
                    <td><span className={`admin-badge ${estadoBadge(cambio.estado)}`}>{cambio.estado || "pendiente"}</span></td>
                    <td>
                      <div className="admin-row-actions">
                        <button className="admin-btn-sm blue" onClick={() => setDetalle(cambio)}>Ver</button>
                        {cambio.estado === "pendiente" && (
                          <>
                            <button className="admin-btn-sm green" onClick={() => aprobar(cambio)}>Aprobar</button>
                            <button className="admin-btn-sm red" onClick={() => rechazar(cambio)}>Rechazar</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {cambios.length === 0 && (
                  <tr><td className="admin-table-empty" colSpan={5}>Todavía no hay cambios detectados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {detalle && (
        <div className="admin-modal-overlay" onClick={() => setDetalle(null)}>
          <div className="admin-modal admin-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Revisión: {detalle.titulo || detalle.fuenteNombre}</h3>
              <button className="admin-modal-close" onClick={() => setDetalle(null)}>✕</button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-grid cols-1">
                <div className="admin-form-group">
                  <span className="admin-form-label">Extracto anterior aprobado</span>
                  <pre className="admin-prompt-preview">{detalle.extractoAnterior || "Sin versión anterior."}</pre>
                </div>
                <div className="admin-form-group">
                  <span className="admin-form-label">Nuevo extracto detectado</span>
                  <pre className="admin-prompt-preview">{detalle.extractoNuevo || "Sin extracto disponible."}</pre>
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              {detalle.estado === "pendiente" && (
                <>
                  <button className="admin-btn admin-btn-primary" onClick={() => aprobar(detalle)}>Aprobar actualización</button>
                  <button className="admin-btn admin-btn-danger" onClick={() => rechazar(detalle)}>Rechazar</button>
                </>
              )}
              <button className="admin-btn admin-btn-secondary" onClick={() => setDetalle(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {previewMateriales && (
        <div className="admin-modal-overlay" onClick={() => setPreviewMateriales(null)}>
          <div className="admin-modal admin-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Revisar {previewTipoRecurso} de {previewNombreFuente}</h3>
              <button className="admin-modal-close" onClick={() => setPreviewMateriales(null)}>✕</button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-grid cols-1">
                <div className="admin-form-group">
                  <span className="admin-form-label">
                    {materialesSeleccionados.length} de {previewMateriales.materiales?.length || 0} {previewTipoRecurso} seleccionados
                  </span>
                  <small className="admin-form-hint">
                    Filtra y marca solo los recursos que quieres guardar como metadatos en la colección materiales.
                  </small>
                </div>
              </div>

              <div className="admin-form-grid cols-4" style={{ marginBottom: 16 }}>
                <label className="admin-form-group">
                  <span className="admin-form-label">Buscar</span>
                  <input
                    className="admin-form-input"
                    value={filtroMateriales.busqueda}
                    onChange={(e) => setFiltroMateriales((prev) => ({ ...prev, busqueda: e.target.value }))}
                    placeholder="Título, autor, área..."
                  />
                </label>
                <label className="admin-form-group">
                  <span className="admin-form-label">Nivel</span>
                  <select
                    className="admin-form-select"
                    value={filtroMateriales.nivel}
                    onChange={(e) => setFiltroMateriales((prev) => ({ ...prev, nivel: e.target.value }))}
                  >
                    {nivelesMateriales.map((item) => (
                      <option key={item} value={item}>{item === FILTRO_TODOS ? "Todos" : item}</option>
                    ))}
                  </select>
                </label>
                <label className="admin-form-group">
                  <span className="admin-form-label">Grado</span>
                  <select
                    className="admin-form-select"
                    value={filtroMateriales.grado}
                    onChange={(e) => setFiltroMateriales((prev) => ({ ...prev, grado: e.target.value }))}
                  >
                    {gradosMateriales.map((item) => (
                      <option key={item} value={item}>{item === FILTRO_TODOS ? "Todos" : item}</option>
                    ))}
                  </select>
                </label>
                <label className="admin-form-group">
                  <span className="admin-form-label">Área</span>
                  <select
                    className="admin-form-select"
                    value={filtroMateriales.asignatura}
                    onChange={(e) => setFiltroMateriales((prev) => ({ ...prev, asignatura: e.target.value }))}
                  >
                    {asignaturasMateriales.map((item) => (
                      <option key={item} value={item}>{item === FILTRO_TODOS ? "Todas" : item}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="admin-row-actions" style={{ marginBottom: 16 }}>
                <button className="admin-btn admin-btn-secondary" type="button" onClick={seleccionarFiltrados}>
                  Seleccionar visibles ({materialesFiltrados.length})
                </button>
                <button className="admin-btn admin-btn-secondary" type="button" onClick={limpiarFiltrados}>
                  Quitar visibles
                </button>
              </div>

              {previewMateriales.resumen?.porNiveles?.length > 0 && (
                <div className="admin-stats-grid" style={{ marginBottom: 16 }}>
                  {previewMateriales.resumen.porNiveles.map((item) => (
                    <div className="admin-stat-card accent" key={item.nivel}>
                      <span className="admin-stat-icon">📚</span>
                      <strong className="admin-stat-valor">{item.libros || 0}</strong>
                      <span className="admin-stat-label">
                        {item.nivel} · {item.grados || 0} grados · {item.asignaturas || 0} asignaturas
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {previewMateriales.resumen?.porGrado && (
                <div className="admin-info-panel" style={{ marginBottom: 16 }}>
                  <h3>Libros encontrados por grado</h3>
                  <div className="admin-tags">
                    {Object.entries(previewMateriales.resumen.porGrado).map(([grado, total]) => (
                      <span className="admin-tag" key={grado}>{grado}: {total}</span>
                    ))}
                  </div>
                </div>
              )}

              {previewEsEducando && previewMateriales.resumen?.porTipo && (
                <div className="admin-info-panel" style={{ marginBottom: 16 }}>
                  <h3>Documentos encontrados</h3>
                  <div className="admin-tags">
                    {Object.entries(previewMateriales.resumen.porTipo).map(([tipo, total]) => (
                      <span className="admin-tag" key={tipo}>{tipo}: {total}</span>
                    ))}
                  </div>
                  {previewMateriales.resumen?.porNivel && (
                    <div className="admin-tags" style={{ marginTop: 10 }}>
                      {Object.entries(previewMateriales.resumen.porNivel).map(([nivel, total]) => (
                        <span className="admin-tag" key={nivel}>{nivel}: {total}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Importar</th>
                      <th>Material</th>
                      <th>Contexto</th>
                      <th>Fuente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialesFiltrados.map((material) => (
                      <tr key={materialKey(material)}>
                        <td>
                          <input
                            type="checkbox"
                            checked={materialesSeleccionadosSet.has(materialKey(material))}
                            onChange={() => toggleMaterial(material)}
                            aria-label={`Importar ${material.titulo || "material"}`}
                          />
                        </td>
                        <td>
                          <div className="admin-material-preview">
                            {material.portadaUrl && (
                              <img src={material.portadaUrl} alt="" loading="lazy" />
                            )}
                            <div>
                              <strong>{material.titulo || "Sin título"}</strong>
                              {material.raw?.autor && (
                                <>
                                  <br /><small>Autor: {material.raw.autor}</small>
                                </>
                              )}
                              {material.raw?.publisher && (
                                <>
                                  <br /><small>Editorial: {material.raw.publisher}</small>
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <small>
                            {[material.nivel, gradoVisible(material), material.asignatura].filter(Boolean).join(" · ") || "Sin clasificar"}
                          </small>
                        </td>
                        <td>
                          <small>{material.raw?.libraryName || material.fuente || "Libro Abierto"}</small>
                        </td>
                      </tr>
                    ))}
                    {materialesFiltrados.length === 0 && (
                      <tr>
                        <td className="admin-table-empty" colSpan={4}>No hay recursos con esos filtros.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="admin-form-group" style={{ marginTop: 16 }}>
                <span className="admin-form-label">Datos técnicos recibidos</span>
                <pre className="admin-prompt-preview">
                  {JSON.stringify({
                    total: previewMateriales.total,
                    seleccionados: materialesSeleccionados.length,
                    checkedAt: previewMateriales.checkedAt,
                    resumen: previewMateriales.resumen,
                    muestra: materialesFiltrados.slice(0, 2),
                  }, null, 2)}
                </pre>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button
                className="admin-btn admin-btn-primary"
                onClick={confirmarImportacionLibroAbierto}
                disabled={importandoMateriales || !materialesSeleccionados.length}
              >
                {importandoMateriales ? "Guardando..." : `Importar seleccionados (${materialesSeleccionados.length})`}
              </button>
              <button className="admin-btn admin-btn-secondary" onClick={() => setPreviewMateriales(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
