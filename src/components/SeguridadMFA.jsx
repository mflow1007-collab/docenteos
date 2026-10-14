import { useEffect, useState } from "react";
import { ShieldCheck, ShieldOff, Loader2 } from "lucide-react";
import {
  tieneMFA,
  iniciarEnrolamientoTOTP,
  confirmarEnrolamientoTOTP,
  desactivarMFA,
} from "../services/mfaService.js";

/**
 * SeguridadMFA — Activar/desactivar la verificación en dos pasos (TOTP).
 * El docente escanea el QR con su app autenticadora (Google Authenticator,
 * Authy…) y confirma con el código de 6 dígitos. OPCIONAL: añade una capa
 * frente al robo de contraseña. Requiere TOTP habilitado en la consola de
 * Firebase (ver docs/SEGURIDAD.md). Todo fail-soft: los errores se muestran.
 */
export default function SeguridadMFA() {
  const [activo, setActivo] = useState(false);
  const [paso, setPaso] = useState("idle"); // idle | enrolando | confirmando
  const [secret, setSecret] = useState(null);
  const [qrUri, setQrUri] = useState("");
  const [claveManual, setClaveManual] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => { setActivo(tieneMFA()); }, []);

  const comenzar = async () => {
    setError(""); setOk(""); setCargando(true);
    try {
      const { secret: s, qrUri: uri, clave } = await iniciarEnrolamientoTOTP();
      setSecret(s); setQrUri(uri); setClaveManual(clave); setPaso("confirmando");
    } catch (err) {
      setError(traducir(err));
    } finally { setCargando(false); }
  };

  const confirmar = async () => {
    setError(""); setCargando(true);
    try {
      await confirmarEnrolamientoTOTP(secret, codigo);
      setActivo(true); setPaso("idle"); setCodigo(""); setSecret(null);
      setOk("Verificación en dos pasos activada. La próxima vez que inicies sesión te pediremos el código.");
    } catch (err) {
      setError(traducir(err));
    } finally { setCargando(false); }
  };

  const desactivar = async () => {
    setError(""); setOk(""); setCargando(true);
    try {
      await desactivarMFA();
      setActivo(false);
      setOk("Verificación en dos pasos desactivada.");
    } catch (err) {
      setError(traducir(err));
    } finally { setCargando(false); }
  };

  return (
    <section className="cfg-seccion">
      <h3><ShieldCheck size={18} style={{ verticalAlign: "-3px", marginRight: 6 }} />Verificación en dos pasos</h3>
      <p style={{ color: "#4b5563", fontSize: 14, marginTop: 4 }}>
        Añade una segunda barrera al iniciar sesión: aunque alguien conozca tu contraseña, necesitará
        el código de tu app autenticadora (Google Authenticator, Authy, Microsoft Authenticator).
      </p>

      {ok && <p style={{ color: "#166534", background: "#dcfce7", padding: "8px 12px", borderRadius: 8, fontSize: 14 }}>{ok}</p>}
      {error && <p style={{ color: "#b91c1c", background: "#fee2e2", padding: "8px 12px", borderRadius: 8, fontSize: 14 }}>{error}</p>}

      {activo ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ color: "#166534", fontWeight: 600 }}>✓ Activada</span>
          <button type="button" onClick={desactivar} disabled={cargando}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid #fca5a5", background: "#fff", color: "#b91c1c", cursor: "pointer" }}>
            {cargando ? <Loader2 size={16} className="lp-spin" /> : <ShieldOff size={16} />} Desactivar
          </button>
        </div>
      ) : paso === "confirmando" ? (
        <div>
          <p style={{ fontSize: 14 }}><strong>1.</strong> Escanea este código con tu app autenticadora:</p>
          <img
            alt="Código QR para la app autenticadora"
            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUri)}`}
            width={180} height={180}
            style={{ border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff" }}
          />
          <p style={{ fontSize: 13, color: "#6b7280" }}>¿No puedes escanear? Ingresa esta clave manualmente: <code style={{ background: "#f3f4f6", padding: "1px 6px", borderRadius: 4 }}>{claveManual}</code></p>
          <p style={{ fontSize: 14 }}><strong>2.</strong> Escribe el código de 6 dígitos que muestra la app:</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric" maxLength={6} placeholder="000000"
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 16, letterSpacing: 4, width: 120 }} />
            <button type="button" onClick={confirmar} disabled={cargando || codigo.length !== 6}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "#2563eb", color: "#fff", cursor: "pointer" }}>
              {cargando ? <Loader2 size={16} className="lp-spin" /> : <ShieldCheck size={16} />} Confirmar
            </button>
            <button type="button" onClick={() => { setPaso("idle"); setError(""); setCodigo(""); }} disabled={cargando}
              style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={comenzar} disabled={cargando}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 8, border: "none", background: "#2563eb", color: "#fff", cursor: "pointer" }}>
          {cargando ? <Loader2 size={16} className="lp-spin" /> : <ShieldCheck size={16} />} Activar verificación en dos pasos
        </button>
      )}
    </section>
  );
}

// Traduce los errores más comunes de MFA a un mensaje claro para el docente.
function traducir(err) {
  const code = err?.code || "";
  if (code.includes("requires-recent-login")) return "Por seguridad, cierra sesión y vuelve a entrar antes de cambiar esta opción.";
  if (code.includes("invalid-verification-code") || code.includes("invalid-mfa")) return "Código incorrecto. Revisa tu app autenticadora e intenta de nuevo.";
  if (code.includes("operation-not-allowed") || code.includes("unsupported")) return "La verificación en dos pasos no está habilitada en la consola de Firebase todavía.";
  return err?.message || "No se pudo completar la operación.";
}
