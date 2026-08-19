# Rediseño del módulo de Evaluación Diagnóstica

> **Estado: PLAN, no implementado** (2026-08-18). Escrito tras 5 parches
> sucesivos que fallaron ("Sin indicadores vinculados"). El objetivo es dejar
> el módulo con la MISMA arquitectura sólida que la planificación, no seguir
> parcheando.

## Diagnóstico de la raíz

No es un bug único: es un patrón. Cada arreglo destapó otra capa —
colección equivocada → perfil no pasado → área vs asignatura → grado anterior
vs actual → filtro interno. **El módulo adivina el contexto en vez de recibirlo
resuelto, y falla en silencio cuando adivina mal.**

Contraste con la planificación (lo que SÍ funciona):

| | Planificación | Diagnóstico (hoy) |
|---|---|---|
| Contexto | El docente elige grado+área; el código usa eso | Adivina desde curso.area / perfil / deriva asignatura / grado anterior |
| Falta malla | BLOQUEA con mensaje claro | Sigue en silencio: "Sin indicadores vinculados" |
| Fuente currículo | Una: `getCurricularContentForUnit` | Tres en cascada, cada una con su normalización |
| Ítems | Derivados de la malla | Banco genérico fijo de 48 ítems, vinculación por palabras a posteriori |

## Principios del rediseño

1. **No adivinar: recibir el contexto resuelto**, igual que el generador de planes.
2. **Una sola fuente de currículo**: `getCurricularContentForUnit(subject, gradoActual, nivel)` — la misma malla activa que la planificación (grado ACTUAL, decisión del dueño 2026-08-18).
3. **Fail-loud**: si falta la malla, decir QUÉ falta y por qué, con acción para resolverlo. Nunca "Sin indicadores" mudo.
4. **Los indicadores son el ancla, no decoración**: los ítems se derivan de la malla oficial (indicadores + criterios + contenidos), no de un banco genérico.

## Arquitectura propuesta

### Capa 1 — Resolver contexto (función pura, testeable sin Firestore)

`resolverContextoCurricular(curso, perfil) → { nivel, grado, area, asignatura }`

- Un solo lugar (hoy la lógica está esparcida en App.jsx + useEffect + servicio).
- Normaliza a valores CANÓNICOS MINERD:
  - `area`: si el curso guarda la asignatura ("Inglés") en `area`, convertir a área MINERD ("Lenguas Extranjeras") vía `getAreaCurricularDeAsignatura`.
  - `asignatura`: derivar de la asignatura guardada, del área si es única, o dejar para que el docente elija.
  - `grado`: base sin sufijo de nivel ("2do Secundaria" → "2do").
  - `nivel`: inferido del grado o del perfil.
- Fuentes en orden: diagnóstico guardado → curso → perfil. Sin cascadas ocultas.

### Capa 2 — Cargar malla (una sola fuente, fail-loud)

`cargarMallaDiagnostico({ nivel, grado, area, asignatura }) → { malla, indicadores, estado }`

- Llama SOLO a `getCurricularContentForUnit(asignatura||area, grado, nivel)` (grado actual).
- `estado`: `"ok"` | `"sin_malla"` | `"error_permiso"` — explícito, para UI fail-loud.
- `indicadores`: aplanados de `payload.competencias[].indicadoresLogro[]` con su `criteriosEvaluacion` asociado (hoy los criterios se ignoran; el diagnóstico debe exponerlos).
- Fallbacks `diseñoCurricular` y referencia local se conservan SOLO como respaldo etiquetado, nunca ocultando el estado real.

### Capa 3 — Derivar ítems de la malla (no banco genérico)

`generarItemsDesdeMalla(malla, naturaleza) → items[]`

- Para idiomas se mantiene el molde comunicativo (12 temas actuales sirven de estructura), PERO cada ítem se ancla a un indicador real de la malla, no por coincidencia léxica a posteriori.
- Cada ítem lleva: `indicadorId`, `indicadorDescripcion`, `criterioOficialId` (de la malla), dimensión, dificultad.
- Si la malla no trae suficientes indicadores para una dimensión, el hueco se marca (no se rellena con genérico silencioso).

### Capa 4 — UI fail-loud

- Recuadro de estado con 3 estados visibles:
  - 🟢 `ok`: "X indicadores de la malla oficial de [grado]".
  - 🟠 `sin_malla`: "No hay malla de [asignatura] [grado] en el Banco. [Importar] / [Revisar]". Con botón que lleva a importar.
  - 🔴 `error_permiso`: "No se pudo leer el currículo (sesión/permisos)".
- El selector por ítem muestra los indicadores reales; si `sin_malla`, explica por qué está vacío en vez de "Sin referente curricular".

## Orden de implementación

1. **[dato primero]** Confirmar con los logs `[DIAG]` si la malla de 2do Inglés está activa. Determina si el rediseño se prueba solo o requiere reimportar.
2. Capa 1 (`resolverContextoCurricular` pura) + test.
3. Capa 2 (`cargarMallaDiagnostico` fail-loud, grado actual).
4. Capa 4 (UI de estado) — para que el docente vea qué pasa.
5. Capa 3 (derivar ítems de la malla) — la mejora de fondo.
6. Quitar los logs `[DIAG]` temporales.

## Riesgos / decisiones abiertas

- Los cursos guardan `area` inconsistente ("Inglés" como área). Capa 1 lo normaliza, pero conviene además CORREGIR el dato del curso al guardar (fuera de alcance de este módulo; anotar).
- Derivar ítems de la malla (Capa 3) cambia el banco que el docente ya conoce. Validar con el dueño contra su examen modelo del taller ([MODELO_DIAGNOSTICO_INGLES_TALLER.md]).
