# Prueba End-to-End del Hilo Pedagógico — Guion (Fase 14)

> **Caso oficial**: 1ro Secundaria · Inglés · "Parts of the House" · Juan Pérez
> Rúbrica 40/50 + Lista de cotejo 20/25 + Escala estimativa 22/25 → **82/100**
>
> Este guion se ejecuta EN TU SESIÓN de producción. Antes de empezar:
> 1. `firebase deploy --only firestore:rules,storage` (reglas de Fase 11 +
>    isAdmin — admin@docenteos.com tiene acceso completo por email exacto,
>    ver docs/FIRESTORE_RULES.md).
> 2. Currículo de 1ro Secundaria Inglés importado en `diseñoCurricular`
>    (Admin → Currículo) — necesario para que los indicadores salgan con IDs
>    oficiales `IL-ING-1-*`.
> 3. Un curso "1ro A — Inglés" con el estudiante **Juan Pérez** en
>    Cursos → Estudiantes.

## Paso 1 — Guardar la planificación (Fases 1-2-3 automáticas)

1. Planificación → Semanal → grado **1ro**, sección **A**, área **Inglés**,
   período **Periodo 2**, tema **Parts of the House**.
2. Selecciona la competencia oficial (los indicadores se autocompletan desde
   el currículo — no los edites).
3. Generar → **Guardar**.

**Verificar**:
- Mensaje verde: "✅ Planificación guardada en Firebase · N aspecto(s) creados
  en Mi Registro". Si sale ⚠️ "No se encontró un curso…", el matching
  grado+área+sección no encontró tu curso: revisa que el curso tenga
  grado "1ro", área "Inglés".
- Firestore: `planificaciones/{id}` tiene `capaCurricular` con
  `indicadoresSeleccionados[].id = IL-ING-1-*` y `clases[]` con `claseId`.
- `usuarios/{uid}/cursos/{cursoId}/registroAspectos` tiene un aspecto por
  indicador con ID `planId_IL-ING-1-*`, doble texto (original + visible).
- `usuarios/{uid}/instrumentos` tiene esqueletos `ins-{planId}-{tipo}-global`
  (deterministas — guarda el plan otra vez y confirma que NO se duplican).

## Paso 2 — Vincular los 3 instrumentos con ponderación

Hoy la UI de Instrumentos no expone la ponderación del hilo (pendiente
declarado), así que este paso se hace desde la consola del navegador con tu
sesión iniciada:

```js
const { crearInstrumentosDeEvaluacion } = await import('/src/services/instrumentosService.js');
const { obtenerPlanificacionesDetalladas } = await import('/src/firebase.js');
const { data } = await obtenerPlanificacionesDetalladas();
const plan = data.find(p => p.capaCurricular && p.tema?.includes('Parts of the House'));
const { instrumentos, ponderacion } = await crearInstrumentosDeEvaluacion(plan, [
  { tipo: 'rubrica',            valorMaximo: 50, ponderacion: 50 },
  { tipo: 'lista_cotejo',       valorMaximo: 25, ponderacion: 25 },
  { tipo: 'escala_estimativa',  valorMaximo: 25, ponderacion: 25 },
]);
console.log(ponderacion); // { total: 100, esCompleta: true, advertencia: null }
```

**Verificar**: `ponderacion.esCompleta === true`; en Mi Registro → pestaña
Instrumentos, los puntajes de los aspectos se re-derivaron de la ponderación
(34/33/33 si los 3 instrumentos alimentan los 3 indicadores).

## Paso 3 — Modo Aula muestra la clase del día (Fase 6)

1. Abrir **Modo Aula**.

**Verificar**:
- Carga la clase de HOY del plan; si hoy no toca clase, banner ámbar
  "Hoy no hay clase planificada… mostrando la próxima clase pendiente
  (fecha)" — nunca pantalla vacía.
- Encabezado con tema, título del día e intención pedagógica; recursos e
  instrumentos del día visibles.

## Paso 4 — Evaluar y registrar a Juan Pérez (Fases 7-4-5-8)

1. En Modo Aula, abre el instrumento **Rúbrica** → nota de Juan Pérez: **40**
   (ajusta el puntaje máximo del modal a 50) → Guardar.
2. Repite con **Lista de cotejo**: **20** (máximo 25).
3. Repite con **Escala**: **22** (máximo 25).

**Verificar tras cada guardado** (mensaje: "Evaluación registrada…"):
- `usuarios/{uid}/instrumentoResultados/{insId}__{estId}` con estado
  `evaluado`, `indicadorIds`, `aspectoRegistroIds`.
- Mi Registro → Instrumentos: la nota consolidada de Juan por aspecto sube
  con badge **🤖 Automática**.
- `evidenciasPedagogicas/evi-{resultadoId}` vinculada a plan + clase +
  indicadores + instrumento.

**Verificación final**: con los 3 resultados, el total de Juan = **82/100**
(40+20+22 puntos ponderados).

## Paso 5 — Casos borde obligatorios

### 5a. Evaluado en 2 de 3 (regla 11)
Evalúa a **otro estudiante** solo con Rúbrica (40) y Cotejo (20).
**Verificar**: su consolidado marca **parcial** (80 = 60/75 sobre lo
evaluado), NO 60 — el instrumento pendiente no cuenta como 0.

### 5b. Ajuste manual + recálculo (regla 12)
1. En Mi Registro → Instrumentos, edita a mano una nota de Juan (p. ej. el
   primer aspecto: escribe **32**). Badge **✏️ Editada**.
2. Re-evalúa la Rúbrica de Juan en Modo Aula con **45**.
**Verificar**: la celda mantiene **32** (tu ajuste), aparece
"⚠️ Nuevo cálculo: NN" con botón **Aceptar**. Pulsa Aceptar → la nota vuelve
a seguir al cálculo automático.

### 5c. Aspectos idempotentes
Vuelve a guardar la misma planificación.
**Verificar**: en `registroAspectos` siguen existiendo los mismos documentos
(sin duplicados) y tu aspecto editado conserva sus cambios.

### 5d. Ponderación incompleta (regla 10)
Crea (paso 2) solo Rúbrica 50 + Cotejo 25 en un plan de prueba.
**Verificar**: `ponderacion.advertencia === "Tus instrumentos suman 75/100"`
y Mi Registro → Instrumentos muestra el aviso ámbar del período.

## Paso 6 — Trazabilidad final

- **Estudiantes → Juan Pérez → Evidencias**: banco filtrable por período /
  tipo / indicador con las 3 evidencias y su nivel de logro.
- Mi Registro → Evaluaciones: bloque "Banco de evidencias del curso" con
  filtros por estudiante y tipo.

## Registro de resultados

| Paso | OK / Falla | Nota |
|---|---|---|
| 1 Plan + aspectos + instrumentos | | |
| 2 Ponderación 100 | | |
| 3 Clase del día / próxima | | |
| 4 Juan = 82 | | |
| 5a Parcial | | |
| 5b Ajuste 32 respetado | | |
| 5c Idempotencia | | |
| 5d Advertencia 75/100 | | |
| 6 Evidencias trazables | | |
