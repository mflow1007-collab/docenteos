import { useEffect, useState } from "react";
import { claseDeAhora, nombreHora } from "../utils/horarioSemanal.js";
import "./HorarioSemanal.css";

/**
 * Modo Aula: avisa si a esta hora toca otro curso según el horario. Nunca
 * cambia de curso solo; lo decide el docente con el botón.
 */
export default function AvisoClaseAhora({ cursos = [], cursoActivo = null, onCambiar }) {
  const [ahora, setAhora] = useState(() => new Date());

  useEffect(() => {
    const reloj = setInterval(() => setAhora(new Date()), 60 * 1000);
    return () => clearInterval(reloj);
  }, []);

  const clase = claseDeAhora(cursos, ahora);
  if (!clase || String(clase.cursoId) === String(cursoActivo?.id)) return null;

  return (
    <div className="hs-aviso-aula" role="status">
      <span>Ahora te toca <strong>{clase.etiqueta}</strong> ({nombreHora(clase.hora)} hora{clase.extra ? " extra" : ""}).</span>
      <button type="button" onClick={() => onCambiar(clase.cursoId)}>Cambiar a este curso</button>
    </div>
  );
}
