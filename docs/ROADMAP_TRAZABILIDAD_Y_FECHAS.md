# Roadmap — Trazabilidad curricular, fechas y unificación de planes

> Origen: auditoría 2026-07-25 sobre las secuencias didácticas de Inglés 2do
> Secundaria ("Escuela y educación", secciones A y B + versión revisada).
> Estado del código verificado: 133 tests ✓, lógica de trazabilidad sólida
> (cada indicador mapea a un criterio de SU competencia, no por umbral genérico).

## Estado actual

| Área | Estado |
|------|--------|
| Trazabilidad criterio↔indicador (código) | ✅ Sólida y verificada |
| Criterios oficiales en mallas 1ro/2do (repo) | ✅ Corregido (commit `87df8b3`, 21 oficiales c/u) |
| Criterios en Firestore producción | ❌ Sin reimportar — producción sigue rota |
| Unificación de secciones A/B | ⚠️ Divergencia por versión de generador |
| Validación de fecha de inicio | ⚠️ Incompleta (no valida semana lectiva ni lunes) |
| Malla de 3ro Inglés | ❌ No existe en el repo |

---

## Hito 1 — Cerrar la trazabilidad (bloqueante) 🔴

**H1.1 — Reimportar mallas corregidas a Firestore.**
La verdad de producción vive en `curricularContent`, no en el repo. Las mallas
`malla_ingles_1ro_*.json` y `malla_ingles_2do_*.json` tienen ya los 21 criterios
oficiales, pero producción no los verá hasta reimportar.
- Correr el flujo de importación del Banco de Conocimiento con las mallas del commit `87df8b3`.
- Verificar en la app que un plan de 2do ya NO muestre "Indicador: —" en los anexos.
- Criterio de aceptación: rúbrica A del producto final con indicador real en las 6 filas.

**H1.2 — Regenerar los 3 PDF afectados.**
Los PDF adjuntos son artefactos de antes del fix. Regenerar 2do A, 2do B y el
revisado desde la app tras H1.1.

---

## Hito 2 — Unificar secciones gemelas 🟠

**H2.1 — Regenerar A y B con el generador actual.**
La divergencia de Semana 1 entre A/B (viejos) y el revisado NO es aleatoria
(no hay `Math.random`/shuffle; los `Date.now()` son solo telemetría). Es
diferencia de versión del generador (commits `a034d79`, `4b09ae1`).
Regenerar ambas secciones con el código actual → gemelas salvo Grado/Sección.
- Criterio de aceptación: Semana 1, checkpoint y Anexo H idénticos entre A y B.

**H2.2 (opcional) — Snapshot de determinismo.**
Test que genere la misma unidad dos veces y compare el HTML (excluyendo
timestamps) para garantizar que dos secciones nunca divergen por versión.

---

## Hito 3 — Validación de fecha de inicio 🟠

Hallazgos: los 3 planes arrancan **2026-07-27/28**, pero el calendario oficial
2026-2027 (`calendarioEscolarMINERD.js`) fija inicio de docentes el **2026-08-03**
y de estudiantes el **2026-08-24**. Además, el revisado arranca **martes**, lo que
acorta la Semana 1 a 3 días (la numeración `numeroEnSemana` cuenta clases por
semana calendario, no ancla al lunes).

**H3.1 — Endurecer `validarFechaInicioHorario`** (`unidadAprendizajeService.js:1468`):
1. Que use `esDiaLectivo()`/`estadoDocencia()` para rechazar (o advertir) fechas
   fuera del calendario lectivo MINERD.
2. Advertir (no bloquear) cuando la fecha de inicio no sea el primer día lectivo
   de su semana → Semana 1 corta. Puede ser intencional; que sea warning, no error.
- Criterio de aceptación: iniciar 2026-07-28 produce una advertencia clara.

**H3.2 — Default de fecha sugerida.**
Al crear una unidad, sugerir como inicio el próximo día lectivo (`proximoDiaLectivo`)
en vez de dejar la fecha libre.

---

## Hito 4 — Completar cobertura curricular 🟡

**H4.1 — Malla de 3ro Inglés.**
No existe `malla_ingles_3ro_*.schema1_3.json` en el repo. Los criterios oficiales
del Primer Ciclo (documentados en memoria) son POR CICLO → los mismos 21 aplican
a 3ro. Al crear la malla de 3ro, poblar con ellos.

**H4.2 — Auditar otras áreas.**
Esta auditoría cubrió Inglés. Verificar que las mallas de otras áreas/asignaturas
en `curricularContent` tengan criterios de evaluación (mismo patrón de fallo).
- Herramienta: `extraerCriteriosEvaluacionCanonicos` sobre cada payload; si sale 0,
  la trazabilidad de esa área está rota.

---

## Nota de diseño — criterios de rúbrica transversales

Tras el fix, la rúbrica del producto (Anexo A) traza ~5 de sus 6 filas con un
indicador real. La fila **"Revisión y mejora"** queda legítimamente SIN indicador:
es un criterio de PROCESO ("incorporar retroalimentación y entregar versión
final"), no de contenido curricular, y no corresponde a ningún indicador de logro.
`seleccionarRelacionParaEvidencia` lo deja bajo umbral y NO fuerza la relación —
forzarla sería inventar una vinculación falsa. **Esto es correcto, no un bug
pendiente.** Verificado end-to-end con la malla corregida: pasó de 6/6 filas
"Requiere revisión docente" (bug de datos) a 1/6 (diseño intencional).

Acción opcional: en el render del PDF, distinguir visualmente "criterio de
proceso, sin indicador de contenido" del antiguo "Requiere revisión docente"
para que el docente no lo lea como un error.

## Deuda menor (no bloqueante) 🟢

- **Redundancia raíz+competencia en criterios:** cada criterio aparece 2× en el
  inventario canónico (uno con `competenciaFundamental`, otro como string raíz).
  Inofensivo (confianza alta igual), pero podría limpiarse dejando solo la versión
  por competencia. Se conservó el espejo raíz por consistencia con el formato
  histórico de 1ro.
- **69 warnings de ESLint** benignos (catch vacíos, vars sin usar con prefijo `_`).
- **Regex de uid en Firestore rules** (`docId.matches(uid + '_.*')`): inofensivo
  porque los UIDs de Firebase no llevan metacaracteres.
