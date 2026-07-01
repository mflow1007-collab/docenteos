import BibliotecaPage from "./BibliotecaPage.jsx";

export default function LibroAbiertoPage({ onIrA = () => {} }) {
  return (
    <BibliotecaPage
      onIrA={onIrA}
      fuenteId="minerd-libro-abierto"
      titulo="Libro Abierto"
      kicker="Libro Abierto MINERD"
      descripcion="Consulta los libros oficiales importados desde Libro Abierto, organizados por nivel, grado y área."
      emptyTitle="No hay libros importados"
      emptyDescription="Importa libros desde Monitor MINERD → Ver Libro Abierto."
    />
  );
}

