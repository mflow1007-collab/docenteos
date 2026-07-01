function SidebarGrupo({ label, abierto, onToggle, activo, children }) {
  return (
    <div className={`sb-grupo${activo ? " sb-grupo-activo" : ""}`}>
      <button
        className={`sb-grupo-header${abierto ? " abierto" : ""}${activo ? " activo" : ""}`}
        onClick={onToggle}
      >
        <span>{label}</span>
        <span className="sb-chevron">{abierto ? "▾" : "▸"}</span>
      </button>
      {abierto && (
        <div className="sb-grupo-items">
          {children}
        </div>
      )}
    </div>
  );
}

function SidebarItem({ id, label, pagina, onClick }) {
  return (
    <button
      className={`sb-item${pagina === id ? " active" : ""}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export { SidebarGrupo, SidebarItem };
