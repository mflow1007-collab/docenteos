export default function ModalConfirmacion({ mensaje, onConfirmar, onCancelar }) {
  return (
    <div className="modal-overlay-instrumentos" role="dialog" aria-modal="true">
      <div className="modal-card-instrumentos" style={{ maxWidth: 420, padding: "2rem" }}>
        <p style={{ margin: "0 0 1.5rem", lineHeight: 1.5 }}>{mensaje}</p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button className="btn-secondary" onClick={onCancelar}>Cancelar</button>
          <button className="btn-danger" onClick={onConfirmar}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}
