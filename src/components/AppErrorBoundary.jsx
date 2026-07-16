import { Component } from "react";

function esErrorChunk(error) {
  const texto = String(error?.message || error || "").toLowerCase();
  return texto.includes("dynamically imported module")
    || texto.includes("failed to fetch")
    || texto.includes("loading chunk")
    || texto.includes("importing a module script");
}

function detalleError(error) {
  const mensaje = String(error?.message || error || "Error sin mensaje").trim();
  const stack = String(error?.stack || "").trim();
  return stack && !stack.startsWith(mensaje) ? `${mensaje}\n${stack}` : mensaje;
}

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.resetKey) {
      return { error: null, resetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error, info) {
    console.error("[DocenteOS] Error de modulo:", error, info);
    try {
      localStorage.setItem("docenteos_ultimo_error_modulo", JSON.stringify({
        fecha: new Date().toISOString(),
        ruta: window.location.pathname || "",
        mensaje: String(error?.message || error || "Error sin mensaje"),
        stack: String(error?.stack || ""),
        componente: String(info?.componentStack || ""),
      }));
    } catch {
      // El diagnostico es auxiliar; no debe romper la pantalla de recuperacion.
    }
    if (esErrorChunk(error) && this.props.autoReloadOnChunkError) {
      const key = "docenteos_chunk_reload_once";
      try {
        if (sessionStorage.getItem(key) !== "1") {
          sessionStorage.setItem(key, "1");
          window.location.reload();
        }
      } catch {
        // Si sessionStorage no esta disponible, mostramos la pantalla de recuperacion.
      }
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunk = esErrorChunk(error);
    const detalleTecnico = detalleError(error);
    const ruta = typeof window !== "undefined" ? window.location.pathname || "/" : this.props.resetKey || "/";
    const titulo = chunk
      ? "Necesitamos recargar este modulo"
      : "Este modulo no pudo abrir correctamente";
    const detalle = chunk
      ? "Parece que el navegador tenia una version vieja de DocenteOS mientras se actualizaba la web."
      : "La navegacion no se perdio; puedes volver al inicio o recargar esta pantalla.";

    return (
      <div className="app-recovery-card" role="alert">
        <div className="app-recovery-icon">!</div>
        <div>
          <h2>{titulo}</h2>
          <p>{detalle}</p>
          <div className="app-recovery-details" aria-label="Detalle tecnico del error">
            <strong>Ruta:</strong> <code>{ruta}</code>
            <strong>Detalle tecnico:</strong>
            <code>{detalleTecnico}</code>
          </div>
          <div className="app-recovery-actions">
            <button type="button" onClick={() => window.location.reload()}>
              Recargar pagina
            </button>
            {this.props.onGoHome && (
              <button type="button" className="secondary" onClick={this.props.onGoHome}>
                Ir al inicio
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
