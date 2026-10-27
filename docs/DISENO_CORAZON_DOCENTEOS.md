# Diseño del corazón de DocenteOS + hoja de ruta

Acordado con César el 2026-10-25. Fuentes normativas: [Guía de planificación integral](recursos/GUIA_PLANIFICACION_INTEGRAL_SECUNDARIA.md) (MINERD, Jornada 2025) y [Referente de planificación por proyecto](recursos/REFERENTE_PLANIFICACION_POR_PROYECTO_2022.txt) (2022; texto completo solo local, no versionado).

Estado: **diseño acordado, nada implementado.** Cada etapa de la hoja de ruta se implementa, se verifica y se revisa con César antes de pasar a la siguiente.

---

## 1. Por qué (diagnóstico de la unidad "Escuela y educación", Inglés 2do)

- Las Fases 3-4 salieron de la **base curricular determinista** porque `generateWeekPlan` falló la fase entera (todo o nada) y el `catch` rellenó con plantilla (`unidadAprendizajeService.js`, `construirWeekPlanBaseCurricular`). El aviso existe pero la UI solo muestra `advertencias[0]` y no queda registro propio en `aiLogs`.
- De esa plantilla salen: Inicio fijo, oración genérica del Desarrollo (`estructurarActividadesVivas`), gramática en ciclo (`resolverProtagonistaDia`), metacognición en ciclo (`metacogDia`), indicadores "trabajados" por ventana rotativa (`tomarIndicadoresBase`) y el sufijo duplicado "(aporte a X) a X".
- Causa de fondo, en las dos rutas: la unidad se organiza **por tema y semana**; el producto llega al final y hay que "reorientar". La situación se redacta desde el tema ("no saben inglés").
- Confirmado en `aiLogs` (2026-10-25): la Fase 3 falló por **validación**, no por créditos ni por tiempo. En las corridas de la unidad del 2026-10-22, los lotes de las semanas 3 y 4 agotaron sus dos intentos (openai → abacus) porque el validador "Foco" rechazó el `focoLinguistico` de la IA (no coincidía con ninguna estructura del foco del bloque; también R9, R11 y R12). Un fallo de validación no parte el lote (solo lo hace un corte por tiempo), así que la semana entera cayó a la base curricular.

## 2. Principio rector (Guía 1.2.2 y Referente)

- La **situación de aprendizaje** es el eje articulador. Cinco elementos: problema · contexto · estrategia + rol del estudiante · producto · punto de llegada. Máximo 8 líneas.
- El **contenido curricular es el medio** para comprender, analizar o responder a la situación.
- **Un único producto central** construido por entregas parciales (Referente pp. 25, 28, 31).
- Toda actividad vive **dentro de una fase de la estrategia**; las fases determinan cómo se agrupan las sesiones (Guía 1.2.4 y pp. 28-30).

## 3. Arquitectura: el código decide la estructura, la IA redacta

```
1. ENTRADA        docente: área, grado, unidad, horario, estrategia
                  (opcional: problema, contexto, producto)
2. SITUACIÓN      real (la escribe el docente) o simulada (DocenteOS propone 2-3)
3. PLAN MAESTRO   código determinista: estrategia → fases → sesiones;
                  entrega por fase; competencias e indicadores/aspectos por fase;
                  contenidos de la malla por fase. El docente lo ve y ajusta.
4. REDACCIÓN      IA fase por fase con contrato (propósito, entrega, contenidos,
                  indicadores). Reintento POR FASE; nunca plantilla silenciosa.
5. VALIDACIÓN     código: cada indicador declarado tiene actividad; cada fase deja
                  su entrega; sin repeticiones en ciclo; documento < 1 MiB.
```

## 4. Reglas acordadas

### 4.1 Situación de aprendizaje
- Puede ser **real o simulada** (Guía 1.2.2: "reales del entorno o simulados"). DocenteOS nunca se estanca: si el docente no escribe una, propone.
- Aunque sea simulada, es un problema o necesidad que el idioma ayuda a resolver, no "los estudiantes no saben inglés".
- **Estrategia: el docente elige con libertad; DocenteOS recomienda.** DocenteOS analiza la situación según los criterios de la Guía 1.2.4 (naturaleza de la situación, contexto, producto y su alcance, punto de llegada) y sugiere la estrategia que mejor se ajusta, **explicando por qué**, junto con 1-2 alternativas. El docente puede elegir cualquiera de las de la Guía; DocenteOS no lo corrige.
- Si el docente cambia la estrategia, la situación se **realinea** (enfoque, producto y rol del estudiante), porque los cinco elementos deben ser coherentes entre sí. El docente ve el cambio antes de aceptarlo.
- Una **estrategia principal** por unidad (Referente p. 31: "centrarse en una única estrategia didáctica para darle uniformidad, consistencia e impacto"), con técnicas de otras metodologías activas dentro de sus fases (Guía 1.2.8).
- Hoy ya existe una base: `seleccionarEstrategiaPorSituacion` (señales del texto) con desempate por área (`ESTRATEGIA_AFIN_POR_AREA`, que hoy da Indagación dialógica por defecto a Inglés). Se rehace en la Etapa 4 con los criterios de la Guía y la explicación visible.

### 4.2 Estrategias de enseñanza-aprendizaje
- Se usan **todas las de la Guía (p. 22) con sus fases completas y literales**:
  - Aprendizaje basado en proyecto: visión compartida · análisis de saberes previos · gestión del conocimiento · metodología y ejemplificación · aplicación · evaluación · socialización y cierre
  - Aprendizaje basado en problemas: selección y análisis del problema · definición del problema · formulación de objetivos · análisis e investigación · reestructuración del problema · aprendizaje individual · puesta en común
  - Estudio de caso: conocimiento o saberes previos del caso · indagación o estudio del caso · socialización del caso · elaboración de conclusiones · evaluación
  - Indagación dialógica: recogida de conocimientos previos · validación de las fuentes · análisis y organización de la información · diseño y construcción · presentación de resultados · evaluación
  - Inserción de docentes y estudiantes en el entorno: recolección de información previa · elaboración de instrumentos de recolección · visita-recolección de los datos · descripción y reflexión · análisis de los datos e información · socialización del conocimiento · elaboración de propuestas · aplicación de los conocimientos · evaluación y reconocimiento del proceso
  - Exploración de conocimientos previos: presentación de la situación de aprendizaje · recogida de saberes recuperados · socialización reflexiva y crítica · introducción del nuevo conocimiento · evaluación
  - Expositiva de conocimientos elaborados: recogida de conocimientos previos · búsqueda y análisis · producción de la exposición · exposición de producciones · reflexión metacognitiva · sistematización · evaluación
- Las fases **se pueden unir, subdividir o reordenar** según las circunstancias (Referente p. 28, punto 6; el propio Referente fusiona "Visión compartida y análisis de saberes previos", p. 30). Una fase puede durar una, dos o más sesiones (Referente p. 30).
- Debate, sociodrama y juego de roles (Guía p. 21) no tienen fases en la Guía → por ahora, **técnicas dentro de las fases** de otra estrategia.
- Hoy el código (`FASES_POR_ESTRATEGIA`) comprime todo a 4 fases, tiene un ABProyecto distinto al de la Guía y una estrategia "Descubrimiento e indagación" que no está en la matriz. Se reemplaza en la Etapa 1.

### 4.3 Competencias e indicadores de logro
- **El docente elige las competencias** de la unidad. DocenteOS sugiere por cada una: "encaja con este tema" (marcada) o "se puede trabajar si…" (sin marcar). La selección del docente manda.
- De cada competencia se pueden tomar **uno o varios indicadores**. Cada indicador es una **acción distinta** (responde / produce / interactúa) que se identifica antes de diseñar actividades, porque cada acción pide actividades, evidencias y fase distintas (responde → gestión del conocimiento; produce → metodología y ejemplo; interactúa → aplicación).
- Cada indicador se **recorta**: tronco + **aspectos del tema (uno o varios)** + **cierre** (el cierre se conserva siempre). Texto siempre literal de la malla.
- Indicadores sin lista de aspectos (p. ej. I11, I19-I21) se toman completos. Indicadores con dos listas (p. ej. I09: qué se pide + sobre qué) permiten marcar en ambas.
- **Dos salidas del mismo indicador:**
  - **Plantilla de la planificación** (tabla Competencias | Indicadores de logro): indicador **completo** con los aspectos elegidos **resaltados**; no trabajados en normal; trabajados antes, tachados; competencia no elegida, toda en normal con nota. Misma lógica que la tabla de contenidos.
  - **Registro de calificaciones, campo "Aspecto"**: el indicador **recortado**.

### 4.4 Actividades y banco de actividades
- **Redacción (regla de César):** verbo en tercera persona plural y presente PRIMERO → organización entre paréntesis → resto de la actividad. Ej.: "Elaboran (en equipos) un mapa mental sobre {tema} con lo que ya saben en inglés y marcan lo que necesitan aprender." Coherente con la regla de voz R1 existente. **Si el trabajo es individual, no se pone paréntesis** (lo individual es lo implícito): "Escuchan un audio sobre {tema}…". Cuando hay técnica, va en el MISMO paréntesis que la organización (opción A elegida por César): "Representan (en parejas, juego de roles) una situación de…".
- Cada actividad incluye los cinco elementos de la Guía (p. 26): organización, acción, evidencia, condiciones, recogida.
- **Síntesis (regla de César):** en la planificación la actividad va SINTETIZADA (~25-35 palabras); el detalle (roles, expresiones modelo, pasos, tiempos internos, lista de cotejo) va en la **Guía del Maestro** (`guiaMaestroService.js`, ficha por clase). Ej. plan: "Representan (en parejas, juego de roles) la llegada de un estudiante nuevo: piden y ofrecen ayuda para ubicarse en la escuela con can / could y preposiciones de lugar, y graban el diálogo."
- **Expresiones en la actividad (regla de César):** cuando la actividad trabaja lengua concreta, se mencionan solo **una o dos** expresiones o palabras, **en cursiva** y terminadas en **puntos suspensivos**, para indicar con qué se trabaja: "…piden y ofrecen ayuda para ubicarse en la escuela (*Excuse me, could you help me?*, *It's next to the gym*…) y graban el diálogo." La lista completa va en la Guía del Maestro (también en cursiva). Actividades sin lengua nueva (revisión, coevaluación) no llevan expresiones.
- **Sin repeticiones:** lo que es común a la clase (fase, foco lingüístico, aporte al producto) se dice UNA vez en el encabezado del día; las actividades no repiten el tema ni el nombre del producto. El producto se nombra una vez por clase (encabezado o cierre). El tema se expresa con elementos concretos (el plano de la escuela, el estudiante nuevo), no con "sobre {tema}". El validador global (capa 5) debe detectar repeticiones del tema/producto entre actividades.
- **Verbos de las actividades (Referente pp. 36-37, taxonomía socioformativa):** el verbo principal sale de estas listas, en 3ª persona plural; mínimo nivel Resolutivo en el conjunto, nunca solo Preformal.
  - Preformal: Abordan, Atienden, Codifican, Enumeran, Enuncian, Exploran, Memorizan, Nombran, Observan, Reaccionan, Repiten, Rotulan, Señalan, Siguen
  - Receptivo: Buscan, Citan, Definen, Describen, Determinan, Identifican, Indagan, Reconocen, Recuperan, Registran, Relatan, Reproducen, Resumen, Organizan, Seleccionan, Subrayan
  - Resolutivo: Aplican, Caracterizan, Categorizan, Comparan, Comprenden, Comprueban, Diagnostican, Diferencian, Ejecutan, Elaboran, Emplean, Implementan, Interpretan, Planifican, Resuelven, Sistematizan, Verifican
  - Autónomo: Analizan, Aportan, Argumentan, Autoevalúan, Coevalúan, Comentan, Contextualizan, Critican, Ejemplifican, Evalúan, Explican, Formulan, Infieren, Integran, Mejoran, Reflexionan, Relacionan, Retroalimentan, Valoran
  - Estratégico: Adaptan, Asesoran, Ayudan, Co-crean, Componen, Crean, Generan, Innovan, Juzgan, Lideran, Predicen, Proponen, Proyectan, Reconstruyen, Transfieren, Transforman, Vinculan
  - **Progresión por fase** (ABProyecto): visión compartida y saberes previos → Receptivo; gestión del conocimiento → Receptivo/Resolutivo; metodología y ejemplificación → Resolutivo/Autónomo; aplicación → Resolutivo/Autónomo; evaluación, socialización y cierre → Autónomo/Estratégico. El validador lo comprueba.
  - **Verbos de idioma** (añadido de DocenteOS, no del Referente), por acción del indicador: responde → Escuchan, Leen, Identifican, Señalan, Responden; produce → Escriben, Redactan, Describen, Narran, Presentan; interactúa → Conversan, Preguntan, Entrevistan, Representan, Intercambian.
- **Banco único, etiquetado por fase:** la mayoría de las actividades sirven en casi todas las estrategias; cada actividad lleva las fases de cada estrategia donde encaja, el momento (inicio/desarrollo/cierre) y la acción del indicador (responde/produce/interactúa). La mecánica tiene huecos {tema}, {estructura}, {producto} (misma idea que el combinador: mecánica + contenido).
- El generador pide al banco por fase + momento + acción; cascada ya decidida: banco → combinador → molde → IA. Las fases asignadas a cada actividad las valida César.

### 4.5 Plan maestro y entregas
- Cada fase deja **una entrega del mismo producto** (p. ej. plan → datos → borrador → versión final → presentación).
- Los temas no tienen semana propia: entran en la fase donde sirven al producto.
- El docente ve el plan maestro (sin gastar créditos) y ajusta sesiones por fase; el total debe cuadrar con su horario.

## 5. Auditoría de producción (2026-10-25)

Resultado inicial: 35/100, bloqueado. El detalle técnico vive en una **auditoría privada fuera de git** (`.claude/auditoria/AUDITORIA_PRIVADA_2026-10-25.md`), porque este repositorio es público y algunos hallazgos siguen abiertos.

- **Etapa S (endpoints de administración):** resuelta en el PR #9 y verificada en producción.
- **Etapa S+ (integridad de datos compartidos y control de costos de IA):** resuelta (PR #11, #12 y #13), con las reglas de Firestore publicadas y una prueba de humo como docente y admin el 2026-10-25. Queda pendiente la cuota diaria de IA por docente: se retiró (PR #12) hasta crear la cuenta de servicio que la cuenta en el servidor.
- **Etapa 0+ (red de seguridad):** resuelta (PR #14): CI en GitHub Actions, control del límite de 1 MiB antes de guardar y avisos visibles con registro en `aiLogs` de cada caída a la base curricular.
- **Deuda:** `catch` vacíos, avisos de lint, migración de IDs de estudiantes (ID-17), reimportación de mallas.

## 6. Hoja de ruta

Forma de trabajo en cada etapa: una rama por etapa · cambios quirúrgicos · pruebas con la malla real de Inglés 2do · `npm test` en verde · revisión con César · nada de commit ni deploy sin su visto bueno · Firebase siempre `merge: true`, nunca destructivo · sesiones cortas, una etapa por sesión.

| Etapa | Qué se entrega | Cómo se verifica | Hecho cuando |
|---|---|---|---|
| **S. Seguridad urgente** (antes que todo) — ✅ fusionado (PR #9) y verificado en www.docenteos.com el 2026-10-25 (los 5 endpoints responden 401 sin token); falta rotar las claves y configurar `LIBRO_ABIERTO_USER`/`LIBRO_ABIERTO_PASSWORD` en Vercel Production (la Biblioteca devuelve "Configura LIBRO_ABIERTO_USER…"; no lo causó el PR #9) | S1: quitar la elección de variable de entorno desde el cliente en `/api/fuentes/check`, exigir token de admin y limitar los dominios permitidos. S2-S4: exigir token verificado (y admin donde aplique) en `educando`, `ai/test` y `ai/optimize`. César: revisar en los logs de Vercel si hubo llamadas sospechosas a esos endpoints y rotar las claves de IA y de Libro Abierto por precaución | Prueba local de cada endpoint sin token (401) y con token de no-admin (403); revisión del código | Ningún endpoint del servidor responde sin token verificado; claves rotadas |
| **S+. Integridad de datos compartidos y costos de IA** — ✅ fusionado (PR #11, #12, #13); reglas de Firestore publicadas y verificadas el 2026-10-25 (la versión activa coincide con `main`; prueba de humo como docente y admin). Hecho: bancos compartidos (`bp_*`, `bic_*`, `ke_estilos`) solo aceptan creaciones en estado inicial y a nombre propio; caché de IA por docente; el gateway lee `config/ia-gateway` en el servidor, decide el modelo y exige correo verificado; `npm run test:rules` con el emulador (59 casos). Falta: cuota diaria por docente (retirada en el PR #12 hasta crear la cuenta de servicio con `roles/datastore.user` y cargar `FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY` en Vercel; para recuperarla, revertir el PR #12) | Cerrar los hallazgos pendientes de la auditoría privada (datos compartidos entre docentes y control de costos de IA en el servidor) | Pruebas de reglas con el emulador de Firestore y pruebas del gateway | Ningún usuario puede alterar lo que reciben otros ni decidir costos de IA |
| **0. Cerrar pendientes** — ✅ 2026-10-25 salvo la reimportación de mallas (M5, César): FASE 5/6 y R16/R17 traídos a la rama `etapa-0/cerrar-pendientes`; la capa de componentes queda aparcada en `aparcado/componentes-producto`; causa de la Fase 3 confirmada (sección 1); Guía leída completa salvo pp. 5-7 | Decidir los cambios sin commitear (R16, R17, componentes, `CLAUDE.md`, notas en `docs/`); subir o descartar los 2 commits locales; confirmar en `aiLogs` la causa del fallo de Fase 3; leer Guía pp. 12-15 y 32-58 (evaluación); reimportar mallas de Inglés 1ro/2do sin el "144" (M5, lo hace César) | Revisión con César | Rama limpia y diagnóstico confirmado |
| **0+. Red de seguridad** — ✅ fusionado (PR #14) el 2026-10-25. Hecho: CI (`.github/workflows/ci.yml`) con lint, build, `npm test` y un job de reglas en el emulador; antes de guardar o actualizar se mide el documento con la fórmula oficial de Firestore y, si pasa de 1 MiB − 8 KB, no se escribe y se avisa (contrastado con planificaciones reales: ninguna ya guardada queda bloqueada); cada fase armada sin IA queda en `fasesBaseCurricular`, en `aiLogs` (`fase_base_curricular`) y en la vista, que muestra todos los avisos. Falta: que la CI corra (la cuenta de GitHub tiene bloqueado Actions por facturación) y probar en el navegador los avisos nuevos. No se parte la planificación en varios documentos: queda como decisión futura | M1: CI en GitHub Actions con `npm test`, `lint` y `build`. A4: medir el tamaño de la planificación antes de guardar y avisar o partir antes de llegar a 1 MiB (sin perder lo generado). A5: mostrar todas las advertencias y registrar en `aiLogs` cada caída a la base curricular | CI en verde en un PR; prueba con una unidad de más de 1 MiB | Ningún fallo de guardado ni de generación pasa en silencio |
| **1. Datos oficiales** — ✅ fusionado (PR #18) el 2026-10-26. Hecho: `src/data/estrategiasFasesGuia2025.js` (las 7 estrategias con sus fases tal como están impresas en la Guía, p. 22, incluidos los puntos finales; claves iguales a las de `FASES_POR_ESTRATEGIA`) y `src/data/indicadoresIngles2doEstructurados.js` (21 indicadores: tronco, listas de aspectos con su puntuación literal, cierre y acción según la posición en la tríada; 11 con aspectos, I09 con dos listas, 10 completos; I21 sin el número de página "144"), con `scripts/test-datos-oficiales.mjs` en `npm test`. Segmentación aprobada por César. Nada los consume todavía; la forma de unir los aspectos del indicador recortado se decide en la Etapa 6 | (a) Archivo de las 7 estrategias con fases literales de la Guía. (b) Indicadores de Inglés 2do estructurados en tronco / aspectos / cierre (21), revisados por César | Prueba que compara cada fase y cada indicador recompuesto con el texto oficial | Pruebas en verde y estructura aprobada por César. No cambia lo que se genera hoy |
| **2. Plan maestro (código)** — ✅ fusionado (PR #20) el 2026-10-27. Hecho: `src/services/planMaestroService.js` (`construirPlanMaestro`, puro, sin IA ni Firebase; falla con error visible si algo falta o no cuadra) y `src/data/rolesFasesEstrategias.js`, con `scripts/test-plan-maestro.mjs` en `npm test` (malla real de Inglés 2do) y `scripts/ejemplo-plan-maestro.mjs`; plan de ejemplo revisado por César. Decisiones aprobadas por César (2026-10-26): (A) papel de cada fase (apertura / conocimiento / modelado / aplicación / evaluación / socialización) solo para ABProyecto y ABProblemas; las otras 5 estrategias dan error hasta aprobar sus papeles. (B) Sesiones = semanas × días × horas, repartidas por peso del papel (aplicación 3; conocimiento y modelado 2; el resto 1), restos mayores y mínimo 1 por fase; si el docente las fija, deben sumar el total. (C) El plan reparte los contenidos que recibe, intercalados por tema, entre las fases de conocimiento, modelado y aplicación; no los selecciona (la selección se decide en la Etapa 3). (D) Los aspectos los marca el docente; sin marcar quedan vacíos, sin sugerencia automática. (E) Cada indicador va a la primera fase cuyo papel coincide con su acción; si la fase está subdividida, a la primera parte. (F) Entrega por estado del mismo producto: acuerdo y plan → insumos recopilados → borrador → versión final → versión revisada → presentación. Se unen fases contiguas y se subdivide en N partes; reordenar no entra. Nada lo consume todavía: el generador sigue con `FASES_POR_ESTRATEGIA` hasta la Etapa 5 | Objeto plan maestro: fases (con unir/subdividir), sesiones por fase, entregas, competencias e indicadores/aspectos sugeridos, contenidos por fase | Pruebas con Inglés 2do: total de sesiones, cada indicador en una fase acorde a su acción, temas mezclados | Pruebas en verde; plan de ejemplo revisado por César |
| **2+. Banco de actividades por fase** | (a) Formato del banco ampliado: mecánica con huecos, fases por estrategia, momento, acción del indicador (responde/produce/interactúa), los cinco elementos de la Guía. (b) Reglas de redacción de la sección 4.4 (verbo primero, paréntesis, síntesis, expresiones en cursiva con "…", sin repeticiones). (c) Etiquetar las actividades actuales y las 8 del modelo, con revisión de César. (d) El generador busca por fase + momento + acción (banco → combinador → molde → IA). (e) El detalle (roles, expresiones completas, pasos) va a la Guía del Maestro | Pruebas: cada actividad empieza por verbo en 3ª plural; sin paréntesis si es individual; ≤2 expresiones en cursiva con "…"; ni tema ni producto repetidos entre actividades de una clase | Las actividades de una unidad real cumplen las reglas y César las aprueba |
| **3. Vista previa del plan maestro** | Pantalla donde el docente ve y ajusta situación, estrategia, fases, sesiones, competencias y aspectos | Prueba en el navegador con una unidad real | César la aprueba |
| **4. Situación de aprendizaje** | Real o simulada, 5 elementos, máx. 8 líneas; reemplaza `construirSituacionNarrativa`. Recomendación de estrategia con explicación y alternativas; elección libre del docente; realineación de la situación si cambia la estrategia | Validador de los 5 elementos; la misma situación probada con varias estrategias; ejemplos revisados | César aprueba 3 situaciones de ejemplo y la recomendación de estrategia |
| **5. Redacción por fase** | El generador consume el plan maestro; IA por fase con contrato; reintento por fase; aviso visible y registro en `aiLogs` si una fase falla | Generar la unidad "Escuela y educación" completa | Sin plantilla silenciosa; cada fase deja su entrega |
| **6. Salidas** | Plantilla con indicador completo + aspectos resaltados; registro con indicador recortado; validador global | Pruebas de render + documento real | Coincide con las maquetas aprobadas |
| **7. Verificación final** | Unidad completa generada y revisada contra la Guía | Revisión con César sobre el PDF | Ajustes cerrados |
| **Deuda (en paralelo, sin bloquear)** | M3: revisar los 41 `catch` vacíos y convertir en error visible los que ocultan fallos reales. M2: bajar los 60 avisos de lint. M4: migración de IDs de estudiantes (ID-17) | Pruebas existentes en verde | Cada punto cerrado en su propio PR |

## 7. Decisiones pendientes de César

1. ¿El docente pasa por la vista previa del plan maestro antes de generar? (recomendado: sí)
2. ¿Con qué estrategias se empieza a generar? (recomendado: ABProyecto y ABProblemas; las 7 quedan en los datos desde la Etapa 1)
3. ¿Se quita "Descubrimiento e indagación" o viene de otro documento oficial?
4. Debate, sociodrama y juego de roles: ¿técnicas dentro de las fases, o hay un fascículo oficial con sus fases?
5. ~~¿Qué pasa con los cambios sin commitear de la rama `fix/alerta-rutinas-accionable`?~~ Decidido (2026-10-25): R16 y R17 entran; la capa de componentes queda aparcada en `aparcado/componentes-producto` porque la sustituye el plan maestro.
