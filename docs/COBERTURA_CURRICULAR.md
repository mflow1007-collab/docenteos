# Cobertura Curricular Local — DocenteOS

> **A5.4 — Inventario** (generado 2026-07-04). Solo inventario: no carga datos.
> Fuente: JSON locales en `curriculum/**` (Diseño Curricular MINERD v2016).
> Para cargarlos al Banco de Conocimiento: subirlos tal cual en
> Admin → Banco de Conocimiento (el normalizador `normalizeCurricularJson`
> acepta el formato local directamente) o adaptarlos por script con
> `src/services/curriculoAdapter.js`.

## Lo que existe localmente

| Archivo | Nivel | Grado | Área / Asignatura | Versión | CE | Indicadores | Temas |
|---|---|---|---|---|---|---|---|
| `curriculum/secundaria/primer_ciclo/1ro/ingles.json` | Secundaria | 1ro | Lenguas Extranjeras / Inglés | 2016 | 7 | 21 | 14 |
| `curriculum/secundaria/primer_ciclo/2do/ingles.json` | Secundaria | 2do | Lenguas Extranjeras / Inglés | 2016 | 7 | 21 | 13 |
| `curriculum/secundaria/primer_ciclo/3ro/ingles.json` | Secundaria | 3ro | Lenguas Extranjeras / Inglés | 2016 | 7 | 21 | 14 |

Los tres archivos traen IDs oficiales estables (`CE-ING-{grado}-*`,
`IL-ING-{grado}-*-n`), competencias fundamentales, criterios de combinación
temática, contenidos generales (gramática/funciones), orientaciones
metodológicas, productos finales sugeridos y nivel MCER (A1/A1+/A2).

## Matriz de cobertura (currículo MINERD vigente)

Leyenda: ✅ existe local · ⬜ falta

### Secundaria — Primer Ciclo (1ro–3ro)

| Área / Asignatura | 1ro | 2do | 3ro |
|---|---|---|---|
| Lenguas Extranjeras — **Inglés** | ✅ | ✅ | ✅ |
| Lenguas Extranjeras — Francés | ⬜ | ⬜ | ⬜ |
| Lengua Española | ⬜ | ⬜ | ⬜ |
| Matemática | ⬜ | ⬜ | ⬜ |
| Ciencias Sociales | ⬜ | ⬜ | ⬜ |
| Ciencias de la Naturaleza | ⬜ | ⬜ | ⬜ |
| Educación Artística | ⬜ | ⬜ | ⬜ |
| Educación Física | ⬜ | ⬜ | ⬜ |
| Formación Integral Humana y Religiosa | ⬜ | ⬜ | ⬜ |

### Secundaria — Segundo Ciclo (4to–6to)

Sin cobertura local (⬜ en todas las áreas, incluidas las modalidades
Académica, Técnico-Profesional y Artes).

### Primaria (1ro–6to) e Inicial

Sin cobertura local (⬜ en todas las áreas de ambos ciclos de Primaria y en
el Nivel Inicial).

## Resumen

- **Cobertura actual**: 3 de ~117 combinaciones grado×asignatura del
  currículo vigente (~2.5%) — concentrada en Inglés de 1er ciclo de
  Secundaria, que es el caso de uso piloto (Fase 14: "Parts of the House").
- **Prioridad sugerida para ampliar** (por uso típico del piloto):
  1. Inglés 4to–6to Secundaria (completa la asignatura piloto).
  2. Lengua Española y Matemática 1ro–3ro Secundaria (mayor matrícula docente).
  3. Francés 1ro–3ro (comparte área y estructura con Inglés — menor esfuerzo).
- **Vías de carga**: (a) PDF oficial → convertidor IA del Banco de
  Conocimiento (con auditoría de literalidad), o (b) JSON estructurado
  siguiendo el formato de `curriculum/secundaria/primer_ciclo/1ro/ingles.json`.
- Colecciones destino: `diseñoCurricular` (importador clásico,
  `CurriculumImportPage`) y `curricularContent` (Banco de Conocimiento /
  Motor Especializado). Hoy conviven ambas; el hilo pedagógico consulta
  `diseñoCurricular` y el Motor de Unidades consulta `curricularContent`.
