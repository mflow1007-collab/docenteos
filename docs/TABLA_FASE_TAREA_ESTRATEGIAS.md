# Tabla fase → tarea característica (7 estrategias) — BORRADOR PARA APROBAR

Estado: **propuesta, sin cablear.** Nada de `src/` cambia hasta que César apruebe cada estrategia.
Fecha del borrador: 2026-11-06.

## Reglas de la tabla (decididas por César)
1. Las fases mostradas son las **literales de la Guía 2025 p. 22** (`src/data/estrategiasFasesGuia2025.js`).
2. **Cada fase tiene al menos una tarea** en la tabla, para que ninguna fase se fusione sin tarea propia.
3. El texto de las tareas puede usar el vocabulario del Referente.
4. Toda tarea sin respaldo oficial se marca en el código: «interpretación DocenteOS, aprobada por César, <fecha>». La fecha se pone al aprobar, no antes.

## Textos oficiales en `docs/recursos/oficiales/`
- `GUIA_2025_estrategias_pp21-22.md` — Guía pp. 21–22. **Solo nombres de fases**; remite a fascículos 2017.
- `REFERENTE_2025_estrategias_pp17-25.md` — Referente pp. 17–25: fases y técnicas de cada estrategia.
- `ADECUACION_2023_estrategias_pp24-28.md` — Adecuación 2023, páginas impresas 23–28: pasos de ABP, caso, proyectos, debate.

Abreviaturas de la columna «Respaldo»: **Ref** = Referente 2025 (página impresa), **Ad** = Adecuación 2023 (página impresa), **Guía** = Guía 2025, **INT** = interpretación DocenteOS (por aprobar).
Los nombres de tarea en `código` ya existen en `src/data/tareasPorTipoTrabajo.js`; los marcados **(nueva)** habría que crear.

> Ojo: las fases del Referente no siempre son las de la Guía. Se muestran las de la Guía y se cita el Referente solo donde su fase o sus técnicas se corresponden.

---

## 1. Indagación dialógica (Guía p. 22: 6 fases)
Referente p. 18 trae 8 fases (… «Definir el objeto de estudio · Selección de fuentes a indagar · Elaboración de preguntas y cuestionamientos…») y técnicas: encuesta, entrevista, fuentes bibliográficas, tablas de frecuencia, matriz, organizadores gráficos, SQA, lluvia de ideas.

| Fase (Guía) | Tarea característica | Respaldo |
|---|---|---|
| Recogida de conocimientos previos | `acordar` (acordar el plan y diagnóstico) con lluvia de ideas / SQA sobre la pregunta de indagación | Ref p. 18 (fase «Recogida de experiencias y análisis de saberes previos»; técnicas lluvia de ideas, SQA) |
| Validación de las fuentes | `indagar_disenar`: elaborar las preguntas (encuesta anónima) | Ref p. 18 («Elaboración de preguntas y cuestionamientos»; técnica Encuesta) |
| ″ | `indagar_aplicar`: aplicar la encuesta y resumir | Ref p. 18 (técnica Encuesta); la secuencia aplicar → resumir es INT |
| ″ | `indagar_contrastar`: contrastar con una fuente | Ref p. 18 («Selección de fuentes a indagar»; «Fuentes bibliográficas»); el contraste es INT |
| Análisis y organización de la información | **Decisión abierta (A):** hoy `analizar_ordenar` se omite en esta estrategia (24c74f2) y la fase queda sin tarea. Propuesta: reactivarla como «organizar los resultados en tabla de frecuencia / matriz» | Ref p. 18 (fase y técnicas tablas de frecuencia, matriz, organizadores) |
| Diseño y construcción | Secciones del producto (tareas por tipo de sección) | Ref p. 18 («Diseño y construcción del producto») |
| Presentación de resultados | `presentar`, `probar_audiencia` | Ref p. 18 («Presentación de los resultados») |
| Evaluación | `evaluar_comentarios`, `corregir_final`, `evaluar_proceso` | Ref p. 18 («Evaluación») |

## 2. Inserción de los docentes y estudiantes en el entorno (Guía: 9 fases)
Las 9 fases del Referente p. 24 coinciden con la Guía. Los tipos de trabajo ya están aprobados (2026-11-03) en `TIPO_TRABAJO_FASES_POR_ESTRATEGIA`; la tabla solo los pone a la vista.

| Fase (Guía) | Tarea característica | Respaldo |
|---|---|---|
| Recolección de información previa | `recorrer_lugares` / `acordar`; reunir información de fuentes antes de la visita | Ref p. 24 («Recolección de información previa a la visita»; fuentes bibliográficas, mapeo, fuentes tecnológicas) |
| Elaboración de instrumentos de recolección | `visitar_modelo`, `visitar_guion` (guion/cuestionario) | Ref p. 24 («Elaboración de instrumentos»; cuestionarios de entrevistas y encuestas) |
| Visita-recolección de los datos | `visitar_entrevistar`, `visitar_registrar`, `visitar_segunda` | Ref p. 24 («Visita-recolección de información in situ»; entrevistas, trabajo de campo) |
| Descripción y reflexión | `describir_modelo`, `describir_redactar` | Ref p. 24 («Descripción y reflexión a partir de experiencia vivida»; registro anecdótico, diario reflexivo) |
| Análisis de los datos e información | `analizar_ordenar`, `analizar_borrador`, `analizar_verificar` | Ref p. 24 («Análisis de la información recolectada»; cuadro comparativo, mapas) |
| Socialización del conocimiento | `socializar_reunir`, `socializar_redactar`, `socializar_leer` | Ref p. 24 («Socialización del conocimiento») |
| Elaboración de propuestas | `proponer_comparar`, `proponer_elegir`, `proponer_elaborar` | Ref p. 24 («Elaboración de propuestas») |
| Aplicación de los conocimientos | `aplicar_modelo`, `aplicar_escribir`, `aplicar_ensayar`, `aplicar_anotar`, `aplicar_segundo`, `aplicar_corregir` | Ref p. 24 («Aplicación de los conocimientos») |
| Evaluación y reconocimiento del proceso | `evaluar_proceso`, `evaluar_comentarios` | Ref p. 24 («Evaluación reconocimiento del proceso seguido») |

## 3. Aprendizaje Basado en Proyecto (Guía: 7 fases) — respaldo fuerte desde el Referente de proyecto 2022
Fuente nueva: `REFERENTE_PROYECTO_2022_completo.md` (DGNS, 2022; **Ref22**). Su p. 24 lista los 7 pasos de la secuencia y las pp. 31–36 definen cada fase con «actividades sugeridas». Los nombres del Ref22 son equivalentes, no idénticos, a los de la Guía; se muestran los de la Guía.

| Fase (Guía) | Nombre en Ref22 | Tarea característica | Respaldo |
|---|---|---|---|
| Visión compartida | Visión compartida | `acordar`: ver/leer algo sobre el problema, acordar con los estudiantes el problema y el producto central, acordar normas y trabajo colaborativo | Ref22 p. 31–32 («Acordar con los estudiantes el problema por resolver y el producto por lograr»; «Acordar las normas…») |
| Análisis de saberes previos. | Análisis de saberes previos | Diagnóstico: mapa mental del problema, preguntas abiertas del docente, análisis de un caso | Ref22 p. 32 (actividades sugeridas para activar saberes previos) |
| Gestión del conocimiento | Gestión y co-creación del conocimiento | Buscar, leer y sistematizar fuentes; `glosario`; `indagar_contrastar`-tipo | Ref22 pp. 32–33 («buscar, leer, sistematizar, analizar… Es importante integrar alguna actividad de evaluación») |
| Metodología y ejemplificación | Metodología y ejemplo | Analizar un ejemplo real o simulado del producto (`describir_modelo`, `visitar_modelo`) | Ref22 pp. 33–34 («revisen y comprendan un ejemplo real o simulado»; «Buscar en equipo un ejemplo pertinente del producto central») |
| Aplicación | Aplicación colaborativa real o simulada | Secciones del producto por tipo; `aplicar_*`; autoevaluar con rúbrica y coevaluar con un compañero | Ref22 pp. 34–35 |
| Evaluación | Valoración y metacognición | `corregir` / `corregir_final`: mejorar el producto con la heteroevaluación del docente hasta el nivel satisfactorio, varias oportunidades | Ref22 p. 35 («El producto se debe mejorar hasta lograr al menos el nivel aceptable o satisfactorio… varias oportunidades») |
| Socialización y cierre | Socialización | `presentar`, `probar_audiencia`, `evaluar_proceso` | Ref22 pp. 35–36 («comparte el producto central y la experiencia… pares, familia y/o comunidad») |

Orden que fija el Ref22 (p. 24, pasos 6 y 7): la mejora hasta el nivel satisfactorio va **antes** de la socialización. Ver la revisión de este punto más abajo.

**Estado actual de Proyectos (prueba de lectura del mapa, 2026-11-06, Alimentación 4 y 6 semanas, sin IA):** las 7 fases tienen clase, pero dos por tarea prestada y no propia: «Análisis de saberes previos» recibe `visitar_modelo` y «Evaluación» recibe `integrar`/`corregir`. Causa: ninguna tarea tiene el papel de esas fases (solo `acordar` es «apertura»; las «evaluación» van a la fase 7). Propuesta de cableado, por aprobar: (1) `corregir` e `integrar` fijadas a «Evaluación» para esta estrategia (dato en `rolesFasesEstrategias.js`, mismo mecanismo que `faseGuia`); (2) una tarea nueva de diagnóstico de saberes previos (mapa mental del problema y preguntas abiertas, Ref22 p. 32) para la fase 2, o fusionar las fases 1 y 2 en la clase 1 como hace el Referente por proyecto 2022 (p. 30, fila «Visión compartida y análisis de saberes previos»).

## 4. Aprendizaje Basado en Problemas (Guía: 7 fases)
Las 7 fases de la Guía coinciden con Ref p. 20. Los pasos de Ad p. 24 apoyan cada una.

| Fase (Guía) | Tarea característica | Respaldo |
|---|---|---|
| Selección y análisis del problema | Presentar el problema y leer datos / un caso (nueva) | Ad p. 24 («Identificación y comprensión del problema») |
| Definición del problema | Delimitar el problema en una frase y sus elementos (nueva) | Ad p. 24 («Delimitación del problema y de sus elementos») |
| Formulación de objetivos | Escribir los objetivos del grupo (nueva) | Ad p. 24 («Esquematización… propósitos fundamentales y específicos») |
| Análisis e investigación | `indagar_aplicar`-tipo: investigar con encuesta/entrevista y `indagar_contrastar` con fuente | Ref p. 20 (técnicas encuesta, entrevista, fuentes bibliográficas); Ad p. 24 («Planteamiento de la investigación») |
| Reestructuración del problema | Ajustar el problema con lo hallado (nueva) | Ad p. 24 («Evaluación de los cursos de acción para readecuarlos») |
| Aprendizaje individual | Pieza individual firmada (`describir_redactar`-tipo) | Ad p. 24 («indagación individual que luego será consensuada») |
| Puesta en común | `socializar_reunir`, `presentar` | Ref p. 20 («Socialización»); Ad p. 24 («puesta en común de los hallazgos», «comunicación de los resultados») |

**Umbral de clases (g28, 2026-11-10):** las tareas propias de las fases 1 a 3 (selección, definición, objetivos) entran con 13 clases o más; «recoger datos», con 15. Con 12 clases el mapa lo intenta y, si no cabe (versión breve, clases flexibles o tareas descartadas), vuelve a unir esas fases en la clase 2 y avisa. Rutinas a 4 semanas cabe; Escuela a 4 semanas no. Para ABP se recomiendan 15 clases.

**Decisión abierta (B):** ABProblemas no tiene fase de evaluación; la evaluación del producto (`evaluar_comentarios`, `evaluar_proceso`) iría en «Puesta en común». Hoy el código ya la manda a la última fase.

## 5. Estudio de caso (Guía: 5 fases)
Ref p. 23 cita 4 fases de Beltrán Peñuela: Conocimiento del caso · Estudio del caso · Elaboración de conclusiones · Evaluación de las conclusiones. No tiene «Socialización del caso».

| Fase (Guía) | Tarea característica | Respaldo |
|---|---|---|
| Conocimiento o saberes previos del caso | Leer el caso y anticipar qué se sabe (nueva) | Ref p. 23 («Fase 1. Conocimiento del caso»); Ad p. 25 (el caso real, claro, con datos concretos) |
| Indagación o estudio del caso | `analizar_ordenar`, `analizar_verificar` sobre los datos del caso | Ref p. 23 («Fase 2. Estudio del caso»); Ad p. 24 («analizar datos y hechos») |
| Socialización del caso | `socializar_reunir`: contrastar análisis entre grupos | Ad p. 24 («contrastar sus conclusiones con las de otros»); nombre de la fase: INT |
| Elaboración de conclusiones | `proponer_elegir`: decisión razonada del grupo con tiempo limitado | Ref p. 23 («Fase 3»); Ad p. 24–25 («decisión razonada de manera grupal», «limitar el tiempo») |
| Evaluación | `evaluar_comentarios`, `evaluar_proceso` | Ref p. 23 («Fase 4. Evaluación de las conclusiones») |

## 6. Exploración de conocimientos previos (Guía: 5 fases)
Ref p. 21 lista 4 fases (sin «Evaluación»); la Guía añade «Evaluación».

| Fase (Guía) | Tarea característica | Respaldo |
|---|---|---|
| Presentación de la situación de aprendizaje | `acordar`: leer la situación contextualizada | Ref p. 21 (parte de «una situación contextualizada» que es «el escenario de toda la unidad») |
| Recogida de saberes recuperados | Diagnóstico con lluvia de ideas / mapa mental | Ref p. 21 (técnicas lluvia de ideas, preguntas exploratorias, mapa mental) |
| Socialización reflexiva y crítica | Diálogo crítico-reflexivo en grupos (nueva) | Ref p. 21 (técnicas diálogo crítico-reflexivo, mesa redonda) |
| Introducción del nuevo conocimiento | Modelo → práctica guiada → pieza (`describir_modelo`, `aplicar_*`); la fase se divide en 3 partes por papel | Ref p. 21; reparto en 3 partes: INT |
| Evaluación | `evaluar_comentarios`, `evaluar_proceso` | Guía p. 22 (solo el nombre) |

## 7. Expositiva de conocimientos elaborados (Guía: 7 fases)
Ref p. 22 lista 6 fases (sin «Evaluación»): … «Búsqueda y análisis de información documentada · Producción de la exposición… · Exposición… · Reflexión metacognitiva · Sistematización».

| Fase (Guía) | Tarea característica | Respaldo |
|---|---|---|
| Recogida de conocimientos previos. | Diagnóstico con lluvia de ideas | Ref p. 22 (fase y técnica lluvia de ideas) |
| Búsqueda y análisis. | Leer y organizar información de una fuente documentada (`analizar_verificar`, `indagar_contrastar`) | Ref p. 22 («Búsqueda y análisis de información documentada»; técnica investigación) |
| Producción de la exposición | Preparar la exposición de cada sección (tareas por tipo de sección) | Ref p. 22 («Producción de la exposición… en su rol de expositores») |
| Exposición de producciones | `presentar`, `probar_audiencia` | Ref p. 22 («Exposición… en un acto comunicativo») |
| Reflexión metacognitiva | `evaluar_proceso` con preguntas metacognitivas | Ref p. 22 (técnicas preguntas metacognitivas, diario reflexivo) |
| Sistematización | `integrar`, `glosario` | Ref p. 22 («Sistematización») |
| Evaluación | `evaluar_comentarios`, `corregir_final` | Guía p. 22 (solo el nombre) |

---

## Hallazgos que afectan la aprobación
- **(A) Indagación fase 3 queda sin tarea** tras omitir `analizar_ordenar`: es exactamente el caso que la regla 2 quiere evitar. Hay que decidir su tarea.
- **(B) ABProblemas** no tiene fase de evaluación en la Guía ni en el Referente.
- **(C) ABProyecto**: ya tiene respaldo en el Referente de proyecto 2022 (pp. 24 y 31–36). Deja de ser interpretación.
- **(D)** Tareas «nueva»: 6 en total (ABP 4, Caso 1, Exploración 1; Expositiva sale de existentes). Cada una necesita secuencia en `secuenciasTareas.js`.
- **(E)** Para que la regla 2 se cumpla de forma automática, propondría una prueba en `scripts/test-invariantes.mjs` («cada fase de cada estrategia tiene ≥1 tarea»). No añadida.
- Los fascículos 2017 y «Planificando y evaluando por proyectos» (2021) no están en el repo; al llegar, hay que revisar sobre todo Proyectos y Caso.
