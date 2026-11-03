# Diseño: secciones repartidas por fase y secuencia encadenada

Estado: **diseño acordado con César (2026-11-03), sin implementar.** Se hace por etapas; cada etapa se verifica antes de abrir la siguiente.

Relacionado: `docs/DISENO_APRENDIZAJE_DOCENTEOS.md` (Etapa 1A: propósito y pieza visible por sección, en producción con PR #76 y #77).

---

## 1. El problema (comprobado)

Unidad «Alimentación», Inglés 2do, estrategia *Inserción en el entorno*, 3 semanas = 9 clases, 5 secciones.

- El plan reparte las secciones **cortando la lista en orden** (`asignarEntregas`, `src/services/planMaestroService.js`), sin mirar qué fase es.
- Las fases 6, 7 y 8 (Socialización · Elaboración de propuestas · Aplicación) se tratan igual: las tres son «Versión final» (rol `aplicacion`).
- Resultado reproducido sin IA, idéntico al de producción:

| Fase | Estado | Secciones | Principal |
|---|---|---|---|
| 5 Análisis | Borrador (2 de 2) | Bilingual Menus, Healthy Choices, Ordering Food | Ordering Food |
| 6 Socialización | Versión final (1 de 3) | Our Local Food | Our Local Food |
| 7 Elaboración de propuestas | Versión final (2 de 3) | Interviews, Bilingual Menus | Bilingual Menus |
| 8 Aplicación | Versión final (3 de 3) | **Healthy Choices, Ordering Food** | Healthy Choices |

- Por eso la clase de Healthy Choices acaba con *role play* de pedidos (la regla vigente: la clase avanza su principal y «toca» las demás de su lista). Healthy Choices, Ordering Food e Interviews son principal de **una sola clase** cada una.
- El vínculo entre clases hoy es casi solo **negativo**: la IA recibe las piezas ya entregadas con «prohibido repetirlas»; no se le dice qué tomar de lo anterior.

## 2. Lo que dicen los documentos

- **Guía 2025 (pp. 20-22):** «toda actividad debe estar enmarcada en una fase específica de la estrategia». Inserción en el entorno: recolección previa · instrumentos · visita-recolección · descripción y reflexión · análisis · socialización · elaboración de propuestas · aplicación · evaluación y reconocimiento.
- **Guía 2025 (p. 24), secuencia didáctica:** **interrelación** (cada actividad con la siguiente), **progresión** (simple → complejo), **proporción** (suficientes y con tiempo).
- **Adecuación 2023 (p. 27):** la inserción busca mayor involucramiento con el entorno para percibir, comprender y **proponer soluciones**.
- **Referente 2022:** un **producto integrador con entregas parciales**, mejorado de principio a fin; advierte contra «demasiadas evidencias».
- Ninguno dice que cada fase sea una clase ni cómo repartir las secciones: eso lo decide DocenteOS.

## 3. El diseño (cuatro reglas)

1. **Cada fase hace un trabajo distinto.** Mapa fase → tipo de trabajo, tomado de la Guía: recoger · preparar instrumentos · visitar · describir · analizar · socializar · proponer · aplicar · evaluar.
2. **Cada sección dice qué trabajo la construye y de qué piezas se alimenta** (datos en la semilla, junto a propósito y pieza visible).
3. **Una sección nace en su fase, no en la primera.** Los estados (acuerdo → borrador → final → revisado) son del producto entero; cada sección no necesita pasar por todos.
4. **Una clase, una sección principal.** Otras secciones solo se tocan si son del mismo tipo de trabajo.

Más dos reglas de secuencia:

5. **Hilo positivo:** cada clase recibe «parten de <la pieza de la clase X>», no solo «no repitan».
6. **Variedad:** el tipo de trabajo cambia de fase a fase; el plan pone el esqueleto (sección, pieza, de dónde parte) y la IA escribe libre dentro. Nada de plantillas de frases.

Respaldo: secciones **sin** tipo de trabajo (las del docente, otras áreas) y estrategias **sin** mapa se reparten como hoy. Nada se rompe.

### Objetivo para «Alimentación» (9 clases)

| Clase · fase | Principal | Pieza | Parte de |
|---|---|---|---|
| 1 Recolección previa | Toda la guía | Acuerdo y plan | — |
| 2 Instrumentos | Interviews | Preguntas de la entrevista | el acuerdo |
| 3 Visita-recolección | Interviews (+ Our Local Food) | Entrevistas transcritas, platos recogidos | las preguntas |
| 4 Descripción y reflexión | Our Local Food | Fichas de los platos | lo que contaron los dueños |
| 5 Análisis | Bilingual Menus | Borrador del menú bilingüe | las fichas |
| 6 Socialización | Our Local Food + Interviews | Versión final compartida | fichas y entrevistas |
| 7 Elaboración de propuestas | Healthy Choices (+ menú final) | Etiquetas «Healthy pick» | el menú y las entrevistas |
| 8 Aplicación | Ordering Food | Diálogo de pedido modelo, practicado | el menú y sus etiquetas |
| 9 Evaluación y reconocimiento | Toda la guía | Versión revisada | todo lo anterior |

Cadena: entrevistan → describen los platos → arman el menú → marcan las opciones sanas → practican pedirlas → revisan la guía.

## 4. Etapas

Cada etapa: qué hace · toca · cómo se verifica · costo de IA · qué decide César antes. Una sesión por etapa.

### Etapa S1 — Mapa de fases de Inserción (datos, sin cambio visible)
- **Hace:** asigna a cada una de las 9 fases de Inserción su tipo de trabajo.
- **Toca:** `src/data/rolesFasesEstrategias.js` o un dato nuevo a su lado; prueba.
- **Se verifica:** prueba que lista las 9 fases con su tipo; `npm test` en 0 fallos; el plan de «Alimentación» simulado sin IA sale **idéntico** al de hoy (no cambia nada todavía).
- **Costo IA:** cero.
- **César decide antes:** el tipo de trabajo de cada fase.

### Etapa S2 — Tipo de trabajo y «se alimenta de» por sección (datos)
- **Hace:** cada sección de las 3 semillas de Inglés 2do lleva su tipo de trabajo y de qué secciones parte.
- **Toca:** `src/data/situacionesSemillaIngles2do.js` + el recorrido semilla → plan (igual que propósitos y piezas); pruebas.
- **Se verifica:** pruebas de datos (toda sección con tipo válido; «parte de» solo nombra secciones de su semilla y sin ciclos); el plan simulado sigue **idéntico** al de hoy.
- **Costo IA:** cero.
- **César decide antes:** los textos de las 16 secciones.

### Etapa S3 — Reparto por fase en el plan maestro (código, sin IA)
- **Hace:** `asignarEntregas` reparte por tipo de trabajo cuando la estrategia tiene mapa y las secciones tienen tipo; si no, como hoy.
- **Toca:** `src/services/planMaestroService.js` (y `seccionesPrincipalesUnidad` si hace falta); pruebas.
- **Se verifica sin gastar créditos:** el plan simulado de «Alimentación» a 3 semanas reproduce la tabla del §3; cada sección es principal de al menos una clase; Healthy Choices y Ordering Food en clases distintas; los estados del producto en orden; a 4 semanas también cuadra; una unidad sin datos (p. ej. «My family and friends») sale igual que hoy.
- **Costo IA:** cero.
- **César decide antes:** la tabla objetivo.

### Etapa S4 — Hilo positivo a la IA (cambia el prompt)
- **Hace:** cada clase recibe una línea «Parten de: <pieza> (clase X)» con lo que dejaron las clases anteriores de sus secciones de origen.
- **Toca:** contrato de fase (`redaccionFaseService.js`) y una línea en `seccionesTx` (`phaseAService.js`); pruebas.
- **Se verifica:** generar «Alimentación» (3 semanas, socialización cambiada para evitar la caché): cada clase usa en sus actividades la pieza de la que parte; la clase de Healthy Choices no tiene *role play* de pedidos; Inglés 2do sigue en 21 criterios; sin aumento de «Requiere revisión docente»; documento < 1 MiB; costo en aiLogs comparado con $0.30.
- **Costo IA:** unas palabras más por llamada.
- **César decide antes:** el texto exacto de la línea.

### Etapa S5 — Variedad (opcional, cambia el prompt o el validador)
- **Hace:** evita repetir la misma técnica (*role play*, video de apertura…) en dos clases seguidas.
- **Se verifica:** contar técnicas repetidas en clases seguidas en una «Alimentación» nueva, contra las de hoy.
- **Costo IA:** posible aumento de rechazos si es validador; medir.
- **César decide antes:** si se hace, y si como instrucción o como validador.

### Etapa S6 — Aviso de capacidad
- **Hace:** si hay menos clases que secciones + 2, sugiere más semanas o juntar secciones.
- **César decide antes:** quién lo ve (docente en la vista previa o solo admin; ver «el docente solo ve el resultado»).

### Etapa S7 — Extender
- Mapa de fases para las otras estrategias (ABProyecto, ABProblemas, Estudio de caso…) y tipo de trabajo en otras semillas. Solo si S3–S4 mejoran a la vista.

## 5. Lo que este diseño no arregla
- Glosario (Anexo F) con palabras de la malla ajenas al tema.
- Rechazos de la IA (4.4, contrato) que suben el costo.
- Calidad del texto en sí: el plan pone el hilo; la redacción se vigila con la revisión de la Etapa 1B.
