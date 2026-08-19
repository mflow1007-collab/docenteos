# Selección de indicadores en el paso 0 del generador — Especificación

> **Estado: ESPECIFICADA, NO IMPLEMENTADA** (2026-08-03). Guardada como diseño
> durable. NO se ha tocado el generador. Retomar por capas con OK del dueño,
> después de resolver el bug de peso del documento (`planificaciones` > 1 MB).
>
> **Relación con el bug de 1.36 MB:** la §4 (anexos emparejados contra 4
> evaluables en vez de los 21 indicadores de la malla) probablemente REDUCE el
> tamaño del documento del plan. Verificar esa hipótesis antes de tratar el peso
> como problema independiente.

---

## Objetivo

Añadir un **paso 0** al generador que SELECCIONA los indicadores de logro que la
unidad va a trabajar, antes de generar clases, actividades o instrumentos. Hoy
los anexos se emparejan contra los 21 indicadores de la malla por solapamiento
léxico; esto los reduce a 4 evaluables con su criterio oficial ya resuelto, y
elimina la dependencia del umbral léxico para asignar indicador por fila.

---

## 1. Prompt del paso 0 (selección de indicadores)

```
Eres especialista en diseño curricular del MINERD (República Dominicana), Nivel Secundario.

Tu única tarea en este paso es SELECCIONAR los indicadores de logro que la unidad va a
trabajar. No generes clases, actividades ni instrumentos.

## Datos de la unidad

Título: {{tituloUnidad}}
Asignatura / Grado / Nivel: {{asignatura}} · {{grado}} · {{nivel}}
Producto final: {{productoFinal}}
Audiencia real del producto: {{audienciaProducto}}
Temas curriculares de la unidad: {{temas}}
Contenidos gramaticales y funcionales: {{gramatica}} · {{funcionesComunicativas}}
Número total de clases: {{totalClases}}

## Indicadores disponibles en la malla

{{#each indicadores}}
- {{codigo}} — {{texto}}
  Competencia fundamental: {{competenciaCodigo}} — {{competenciaNombre}}
  Criterios de evaluación asociados: {{#each criterios}}{{id}} — {{texto}} | {{/each}}
{{/each}}

## Indicadores ya evaluados en unidades anteriores de este curso

{{indicadoresYaEvaluados}}   ← despriorízalos salvo que sean actitudinales recurrentes

## Reglas de selección (obligatorias)

R1. CANTIDAD. Indicadores EVALUABLES = floor({{totalClases}} / 5), con mínimo 2 y máximo 4.
    Indicadores de APOYO FORMATIVO = 1 o 2. No declares ningún otro indicador.

R2. ORIGEN. Los evaluables se derivan del PRODUCTO FINAL y de lo que el estudiante
    tendrá que hacer para construirlo. Nunca del orden de la lista ni del calendario.

R3. COBERTURA. Cada evaluable debe pertenecer a una COMPETENCIA FUNDAMENTAL distinta.
    Dos evaluables de la misma competencia es un error.

R4. EVIDENCIA REAL. Solo puedes elegir un indicador si su contenido está efectivamente
    presente en los temas, la gramática o las funciones comunicativas listados arriba, y
    si podrías señalar al menos 3 momentos distintos de la unidad donde se evidencia.
    Si un indicador suena pertinente pero la unidad no tiene contenido que lo sustente,
    NO lo selecciones. Ejemplo de error a evitar: elegir un indicador de salud y medio
    ambiente cuando ningún tema de la unidad es ambiental.

R5. ANDAMIAJE. Los de apoyo formativo deben ser el escalón previo de algún evaluable
    (p. ej. un indicador de producción de textos breves antes de uno de interacción) o
    de comprensión oral/lectora trabajada a diario. NO se califican: alimentan lista de
    cotejo y retroalimentación, nunca el Registro de calificaciones.

R6. RECURRENTE. Uno de los evaluables debe ser el actitudinal de interacción (cortesía,
    respeto, asertividad) si el producto incluye socialización oral.

R7. CRITERIO OFICIAL. Para cada indicador seleccionado, elige de su lista de criterios
    asociados el que mejor describa la evidencia concreta de ESTA unidad. Si dos
    indicadores distintos terminan con el mismo criterio, revisa la selección: es señal
    de que uno de los dos no aporta algo diferente.

R8. FASES. Asigna cada evaluable a las fases donde se trabaja (1 a 4). Cada evaluable
    debe aparecer en 2 fases como mínimo y la Fase 4 debe cerrar con los evaluables que
    sostienen la valoración sumativa del producto.

R9. JUSTIFICACIÓN. Cada evaluable lleva una justificación de una frase que nombre la
    pieza o momento concreto del producto donde se evidencia. Si no puedes nombrarlo,
    el indicador no cumple R4.

## Formato de salida

Devuelve ÚNICAMENTE un objeto JSON válido, sin texto previo, sin explicación, sin
```json ni marcas de código:

{
  "evaluables": [
    {
      "codigo": "ING-2-I03",
      "competenciaCodigo": "ING-2-C01",
      "criterioOficialId": "CR-INGLES-2DO-S-14ARWAA",
      "fases": [2, 3, 4],
      "clasesEstimadas": 6,
      "justificacion": "Es la interacción para pedir ayuda y orientar que sostiene la galería oral del producto.",
      "evidenciaEnProducto": "diálogo de peticiones y permisos + presentación final"
    }
  ],
  "apoyoFormativo": [
    {
      "codigo": "ING-2-I02",
      "competenciaCodigo": "ING-2-C01",
      "andamiaDe": "ING-2-I03",
      "justificacion": "Escalón escrito previo a la interacción oral del producto."
    }
  ],
  "descartados": [
    { "codigo": "ING-2-I16", "motivo": "Ningún tema de la unidad es ambiental (R4)." }
  ]
}
```

---

## 2. Validador determinista (código, no prompt)

Las restricciones duras se comprueban en código y fallan cerrado. No se le pide al modelo
que se autolimite: se le rechaza la salida y se reintenta con el motivo del rechazo inyectado.

```js
export function validarSeleccionIndicadores(seleccion, ctx) {
  const errores = [];
  const max = Math.min(4, Math.max(2, Math.floor(ctx.totalClases / 5)));
  const ev = seleccion.evaluables ?? [];

  if (ev.length < 2 || ev.length > max)
    errores.push(`R1: ${ev.length} evaluables; se esperaban entre 2 y ${max}.`);

  if ((seleccion.apoyoFormativo?.length ?? 0) > 2)
    errores.push('R1: máximo 2 indicadores de apoyo formativo.');

  const comps = ev.map(i => i.competenciaCodigo);
  if (new Set(comps).size !== comps.length)
    errores.push('R3: dos evaluables comparten competencia fundamental.');

  const codigosMalla = new Set(ctx.indicadores.map(i => i.codigo));
  for (const i of [...ev, ...(seleccion.apoyoFormativo ?? [])]) {
    if (!codigosMalla.has(i.codigo))
      errores.push(`Indicador inexistente en la malla: ${i.codigo}.`);
  }

  for (const i of ev) {
    const permitidos = ctx.criteriosPorIndicador[i.codigo] ?? [];
    if (!permitidos.includes(i.criterioOficialId))
      errores.push(`R7: ${i.criterioOficialId} no está asociado a ${i.codigo}.`);
    if ((i.fases?.length ?? 0) < 2)
      errores.push(`R8: ${i.codigo} aparece en menos de 2 fases.`);
    if (!i.evidenciaEnProducto?.trim())
      errores.push(`R9: ${i.codigo} sin evidencia nombrada en el producto.`);
  }

  const criterios = ev.map(i => i.criterioOficialId);
  if (new Set(criterios).size !== criterios.length)
    errores.push('R7: dos evaluables resuelven al mismo criterio oficial.');

  return { valido: errores.length === 0, errores };
}
```

Si `valido === false`, se reintenta el paso 0 una sola vez pasando `errores` al prompt como
bloque `## Correcciones requeridas`. Si el segundo intento también falla, se aborta la
generación con el motivo visible — no se cae a plantilla.

---

## 3. Verificación posterior a las clases

Después de generar las 20 clases, con las evidencias ya escritas:

```js
// Un evaluable con menos de 3 clases que lo evidencien se degrada a "abordado":
// sigue apareciendo en la unidad, deja de alimentar rúbrica y Registro.
const degradados = evaluables.filter(i => contarClasesConEvidencia(i, clases) < 3);
```

Esto es la red que atrapa el caso I16 / I10 aunque el modelo los haya justificado bien en
el paso 0.

---

## 4. Efecto sobre el ensamblaje de anexos

Los anexos dejan de emparejar contra los 21 indicadores de la malla y lo hacen contra los
4 evaluables, cada uno con su `criterioOficialId` **ya resuelto**. El orden de resolución
por fila pasa a ser:

1. Indicador explícito de la pieza, si la evidencia lo trae.
2. Evaluable de la fase a la que pertenece la pieza (fallback determinista, siempre existe).
3. Solo si ninguno aplica: revisión docente.

Con 4 candidatos y un fallback por fase, el paso de solapamiento léxico deja de ser el que
decide, y las filas sin indicador tienden a cero sin tocar el umbral.

---

## 5. Cambio de contrato en los prompts de clase

Los prompts de generación de clases reciben `indicadoresPriorizados` y añaden una línea:

```
Los indicadores de esta unidad son EXCLUSIVAMENTE los siguientes. No introduzcas ningún
otro código de indicador en actividades, evidencias, resúmenes semanales ni anexos:
{{indicadoresPriorizados}}
```
