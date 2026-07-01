import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { guardarPerfilInstitucional } from "../services/perfilInstitucionalService.js";
import "./ConfiguracionPage.css";

const REGIONALES = [
  "Regional 01 - Santo Domingo", "Regional 02 - Santiago", "Regional 03 - San Francisco de Macorís",
  "Regional 04 - La Vega", "Regional 05 - San Pedro de Macorís", "Regional 06 - San Juan de la Maguana",
  "Regional 07 - Barahona", "Regional 08 - Mao - Valverde", "Regional 09 - San Cristóbal",
  "Regional 10 - Baní", "Regional 11 - Higüey", "Regional 12 - Cotuí",
  "Regional 13 - Azua", "Regional 14 - Nagua", "Regional 15 - Montecristi",
  "Regional 16 - Bonao", "Regional 17 - Pedernales", "Regional 18 - Comendador",
];

const NIVELES = ["Inicial", "Primaria", "Secundaria"];

const MODALIDADES = ["General", "Técnico-Vocacional", "Artes", "Especial"];

const JORNADAS = ["Matutina", "Vespertina", "Nocturna", "Extended Day"];

export default function ConfiguracionPage() {
  const { user, perfil } = useAuth();
  const [form, setForm] = useState({
    nombreDocente: "",
    centroEducativo: "",
    codigoCentro: "",
    regional: "",
    distrito: "",
    nivelesDocente: [],
    modalidad: "",
    jornadaEscolar: "",
    periodoEscolar: "",
  });
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!perfil) return;
    setForm({
      nombreDocente:   perfil.nombreDocente   ?? "",
      centroEducativo: perfil.centroEducativo ?? "",
      codigoCentro:    perfil.codigoCentro    ?? "",
      regional:        perfil.regional        ?? "",
      distrito:        perfil.distrito        ?? "",
      nivelesDocente:  Array.isArray(perfil.nivelesDocente) ? perfil.nivelesDocente : perfil.nivel ? [perfil.nivel] : [],
      modalidad:       perfil.modalidad       ?? "",
      jornadaEscolar:  perfil.jornadaEscolar  ?? "",
      periodoEscolar:  perfil.periodoEscolar  ?? "",
    });
  }, [perfil]);

  const set = (campo) => (e) =>
    setForm((prev) => ({ ...prev, [campo]: e.target.value }));

  const toggleNivel = (nivel) =>
    setForm((prev) => ({
      ...prev,
      nivelesDocente: prev.nivelesDocente.includes(nivel)
        ? prev.nivelesDocente.filter((n) => n !== nivel)
        : [...prev.nivelesDocente, nivel],
    }));

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!user?.uid) return;
    setGuardando(true);
    setError("");
    setExito(false);
    try {
      await guardarPerfilInstitucional(user.uid, form);
      setExito(true);
      setTimeout(() => setExito(false), 3000);
    } catch (err) {
      setError(err.message || "No se pudo guardar el perfil.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="cfg-root">
      <header className="cfg-header">
        <h1>Configuración</h1>
        <p className="cfg-sub">Perfil docente y datos del centro educativo</p>
      </header>

      <form className="cfg-form" onSubmit={handleGuardar}>

        <section className="cfg-seccion">
          <h2>Datos del docente</h2>
          <div className="cfg-grid">
            <label className="cfg-campo">
              <span>Nombre completo</span>
              <input
                type="text"
                value={form.nombreDocente}
                onChange={set("nombreDocente")}
                placeholder="Ej. María García"
                required
              />
            </label>
            <label className="cfg-campo">
              <span>Correo electrónico</span>
              <input type="email" value={user?.email ?? ""} disabled />
            </label>
          </div>
        </section>

        <section className="cfg-seccion">
          <h2>Centro educativo</h2>
          <div className="cfg-grid">
            <label className="cfg-campo">
              <span>Nombre del centro</span>
              <input
                type="text"
                value={form.centroEducativo}
                onChange={set("centroEducativo")}
                placeholder="Ej. Escuela Básica Dr. Hugo Tolentino"
              />
            </label>
            <label className="cfg-campo">
              <span>Código del centro</span>
              <input
                type="text"
                value={form.codigoCentro}
                onChange={set("codigoCentro")}
                placeholder="Ej. 01-001-00123"
              />
            </label>
            <label className="cfg-campo">
              <span>Regional</span>
              <select value={form.regional} onChange={set("regional")}>
                <option value="">Seleccionar regional</option>
                {REGIONALES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="cfg-campo">
              <span>Distrito educativo</span>
              <input
                type="text"
                value={form.distrito}
                onChange={set("distrito")}
                placeholder="Ej. Distrito 01-01"
              />
            </label>
          </div>
        </section>

        <section className="cfg-seccion">
          <h2>Información académica</h2>
          <div className="cfg-grid">
            <div className="cfg-campo">
              <span>Niveles que imparte</span>
              <div className="cfg-checkgroup">
                {NIVELES.map((n) => (
                  <label key={n} className="cfg-check">
                    <input
                      type="checkbox"
                      checked={form.nivelesDocente.includes(n)}
                      onChange={() => toggleNivel(n)}
                    />
                    {n}
                  </label>
                ))}
              </div>
            </div>
            <label className="cfg-campo">
              <span>Modalidad</span>
              <select value={form.modalidad} onChange={set("modalidad")}>
                <option value="">Seleccionar modalidad</option>
                {MODALIDADES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="cfg-campo">
              <span>Jornada escolar</span>
              <select value={form.jornadaEscolar} onChange={set("jornadaEscolar")}>
                <option value="">Seleccionar jornada</option>
                {JORNADAS.map((j) => (
                  <option key={j} value={j}>{j}</option>
                ))}
              </select>
            </label>
            <label className="cfg-campo">
              <span>Período / Año escolar</span>
              <input
                type="text"
                value={form.periodoEscolar}
                onChange={set("periodoEscolar")}
                placeholder="Ej. 2025-2026"
              />
            </label>
          </div>
        </section>

        {error && <p className="cfg-error">{error}</p>}
        {exito && <p className="cfg-exito">Perfil guardado correctamente.</p>}

        <div className="cfg-acciones">
          <button type="submit" className="cfg-btn-guardar" disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
