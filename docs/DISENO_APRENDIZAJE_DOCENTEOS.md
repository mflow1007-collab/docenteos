# Diseño: DocenteOS que aprende (banco + perfil del grupo + IA auditora)

Propuesta para conversar con César (2026-11-03). Estado: **propuesta, nada implementado.** Recoge su visión ([[project-banco-ia-audita]], [[project-conocer-al-grupo]], [[feedback-docente-solo-resultado]]) y la contrasta con lo que el código ya tiene.

---

## 1. Lo que César pide (en sus palabras, resumido)

1. **El docente siempre recibe su plan.** Si la generación falla, es un error del sistema, no del docente.
2. **El mismo tema con otro grupo no es el mismo plan.** El 1ro de hoy será el 2do del año próximo y seguirá siendo *ese* grupo: el perfil viaja con los estudiantes, no con el grado.
3. **DocenteOS aprende con el tiempo.** Al principio la IA planifica mientras el banco se enriquece; después el banco hace el trabajo y la IA se usa menos. Si no aprende, los tokens dejan quebrado al creador.
4. **La IA revisa siempre antes de entregar**, para que el plan no sea genérico ni «robótico». DocenteOS debe ser distinto de las páginas que reparten planes.
5. **Todo eso ocurre por dentro.** El docente solo ve su plan; el admin ve el proceso.
6. **Sin que se escape de la mano de su creador.**

## 2. Lo que ya existe (comprobado en el código)

| Pieza | Dónde | Estado |
|---|---|---|
| Banco de actividades `bp_actividades` con estados `draft → pending → approved → official → obsolete` | `bancoPedagogicoService.js` | En producción |
| Semilla del banco: actividades reales de los documentos modelo de César | `bancoActividadesModelo.js` | Pendiente sembrar en prod (memoria) |
| Cosecha: guarda en el banco la mecánica nueva de cada unidad como `cosechada`, con consentimiento del docente y visto bueno del dueño | `cosechaActividadesService.js` + botón «Guardar sus actividades nuevas en el banco» | En producción |
| Auditor del banco: archiva duplicados, referencias muertas y cosechadas sin validar (nunca borra) | `auditorBancoService.js` | En producción |
| El generador consulta el banco | `elegirActividadBanco` en `unidadAprendizajeService.js` | **Solo** en la base curricular de contingencia y en el motor anterior; la ruta del plan maestro redacta todo con IA |
| Indicadores débiles del grupo (diagnóstico + evaluaciones) llegan al generador y se marcan «REFORZAR» | `useUnidadAprendizaje.js`, `diagnosticoIntegrationService.js` (umbral 50 %) | En producción |
| Punto de partida que escribe el docente | `puntoPartidaTexto` | En producción |
| ID único de estudiante, registro anecdótico, logro por indicador, informes | PR #40, recorrido actividad → informe (F1–F7) | En producción |
| Costo por plan y por llamada | `aiLogs` + «Costo por plan» | En producción |
| Auditoría con IA | `auditoriaAI.js` (botón «Auditar con IA») | Manual, general, hasta 12.000 tokens; **no** es el paso de revisión que se propone |
| Contingencia si la IA falla una fase | `construirWeekPlanBaseCurricular` | Arma desde la malla y **el docente ve el aviso** |

**Lo que falta:** el banco no sabe **con qué grupo funcionó** cada actividad; la ruta del plan maestro no usa el banco; no hay revisión automática antes de entregar; algunas fallas todavía detienen la generación.

## 3. El ciclo que aprende

```
Perfil del grupo ──► Plan (banco primero, IA rellena) ──► Revisión IA (por dentro) ──► Plan al docente
      ▲                                                                                     │
      │                                                                                     ▼
Resultados (logro por indicador, participación, registro) ◄── Aula (evidencias, evaluaciones)
      │
      └──► Banco: «esta actividad funcionó con este tipo de grupo»
```

### 3.1 Perfil del grupo (viaja con la cohorte)

- Se arma por **curso** y se enlaza por el **ID único de estudiante**, así que pasa de 1ro a 2do con los mismos estudiantes.
- Contiene solo lo **observado**: logro por indicador (diagnóstico y evaluaciones), participación e interés registrados por el docente, cómo trabajó mejor (parejas, equipos, oral, escrito), punto de partida, comunidad.
- No supone conductas por sexo ni por otro rasgo; la composición del grupo es dato descriptivo (p. ej. para armar equipos).
- **Decisión pendiente:** cómo registra el docente la participación e interés sin trabajo extra (¿desde el registro anecdótico y Modo Aula, que ya existen?).

### 3.2 Banco con memoria de resultados

- Cada actividad del banco guarda, además de su mecánica, **dónde se usó y cómo le fue**: perfil del grupo en que se aplicó y resultado (logro de los indicadores que trabajaba, si el docente la marcó como útil).
- Lo que llega al banco sigue pasando por el visto bueno del dueño (la cosecha queda como está). El auditor del banco sigue limpiando.

### 3.3 Plan: banco primero, IA rellena

- Para cada clase y sección, DocenteOS busca primero en el banco una actividad **validada** que encaje con la sección, el tema y el **perfil del grupo**. Si la hay, la adapta (código + IA corta). Si no, la IA la escribe como hoy.
- Con el tiempo, más clases salen del banco y bajan las llamadas a la IA.
- **Siempre entrega:** si la IA falla, la clase se completa desde el banco o la base curricular. El docente no ve la caída; el admin sí (aiLogs).
- **El fail-closed del currículo no cambia:** sin malla oficial no hay plan. Eso es un error de datos, no algo que el banco tape.

### 3.4 Revisión de la IA antes de entregar (invisible al docente)

- Una llamada **corta** con una lista fija, no la auditoría completa. Revisa el plan **contra el perfil del grupo** y contra lo que el código no entiende:
  - ¿Refuerza los indicadores débiles de este grupo?
  - ¿Dos secciones producen lo mismo? (el caso Healthy Choices / Ordering Food)
  - ¿La clase 1 habla de clases anteriores? ¿Se anticipa el producto final?
  - ¿La técnica encaja con la organización? ¿El producto responde a la situación?
- Si encuentra un fallo grave, **corrige la clase** (regenera) con un tope por unidad. Lo que encontró y corrigió queda para el admin.
- Además varía lo que sale del banco para que dos grupos distintos no reciban el mismo plan.

## 4. Cómo se mide que aprende

En aiLogs y en el panel del admin, por mes:
- **Costo por unidad** (hoy $0.24–0.33 en 9 clases).
- **% de clases servidas desde el banco** frente a escritas por la IA.
- **Correcciones de la revisión** por unidad (deberían bajar).
- **Logro de los indicadores reforzados** en el grupo (¿mejoró después del plan?).

## 5. Límites fijos (que no se escape de las manos)

- Currículo oficial MINERD intocable; tres capas separadas (currículo / banco / salida IA).
- Al banco solo entra lo que el dueño valida; nada se borra (archivar es reversible).
- El admin ve todas las decisiones del sistema y puede revertirlas.
- La IA es una herramienta que se paga por uso; DocenteOS no entrena una IA propia: aprende con sus propios datos.
- **El diseño curricular puede cambiar** (César, 2026-11-03): nada puede quedar anclado al diseño actual del MINERD. Todo lo que DocenteOS aprende se guarda **junto a la versión del currículo** con la que se generó:
  - el banco y el perfil del grupo guardan los **códigos de indicadores y competencias con su versión de malla**, no el texto copiado;
  - cuando el MINERD publique un diseño nuevo, se carga como **versión nueva** en `curricularContent` (la anterior se archiva, no se borra) y lo aprendido se **vuelve a enlazar** a los indicadores nuevos con una tabla de equivalencias que valida César;
  - lo que no tenga equivalencia queda archivado (no se pierde) y el auditor del banco ya sabe retirar referencias curriculares que dejaron de existir (`auditorBancoService.js`, «refs curriculares muertas»);
  - la revisión de la IA y los textos que recibe la IA leen el currículo **vigente**, nunca uno fijo en el código.

## 6. Etapas (una sesión de trabajo por etapa, para controlar el consumo)

Cada etapa es **pequeña, cerrada y medible**: se implementa en su propia sesión, se prueba con una unidad real, se mide el costo y se revisa con César **antes** de abrir la siguiente. Si una etapa no da el resultado esperado, se ajusta o se detiene ahí, sin arrastrar las demás.

Para cada etapa: qué hace · qué toca · cómo se sabe que funciona · cuánto añade al costo de IA por unidad (hoy $0.24–0.33 en 9 clases) · qué decide César antes.

### Etapa 1A — Secciones con propósito (sin IA nueva)
- **Qué hace:** cada sección de las situaciones semilla lleva una línea de qué contiene (p. ej. Healthy Choices = «qué alimentos recomendamos y por qué»; Ordering Food = «cómo pedirlos en inglés»), y la IA la recibe con el nombre.
- **Toca:** `situacionesSemillaIngles2do.js` (datos) y una línea del texto de la IA.
- **Se verifica:** una «Alimentación» nueva sin solapamiento entre Healthy Choices y Ordering Food.
- **Costo añadido:** casi cero (unas palabras más en el texto que recibe la IA).
- **César decide antes:** el texto de cada sección (yo propongo, tú apruebas).

### Etapa 1B — Revisión de la IA antes de entregar (solo detectar y registrar)
- **Qué hace:** al terminar la unidad, una llamada corta con la lista fija (secciones que se pisan, clase 1 que habla del pasado, producto anticipado, técnica vs organización, producto vs situación, refuerzo de indicadores débiles). **No corrige todavía:** solo deja el resultado para el admin.
- **Toca:** un servicio nuevo de revisión + registro en aiLogs + bloque «solo administración».
- **Se verifica:** en 2–3 unidades, la revisión encuentra lo que ya vimos a mano.
- **Costo añadido:** medir; estimado unos centavos por unidad.
- **César decide antes:** dónde corre (navegador oculto o servidor) y la lista de preguntas.

### Etapa 1C — La revisión corrige (con tope)
- **Qué hace:** si la revisión marca un fallo grave, regenera esa clase y entrega el plan corregido. El docente no ve nada; el admin ve qué se corrigió.
- **Toca:** el paso de revisión de 1B + la regeneración de una clase.
- **Se verifica:** las correcciones mejoran la clase sin romper los validadores; el tope se respeta.
- **Costo añadido:** una llamada por clase corregida, como máximo el tope.
- **César decide antes:** el tope (propuesta: 2 clases por unidad) y qué cuenta como «grave».

### Etapa 2 — Siempre entregar
- **Qué hace:** ninguna falla deja al docente sin plan: la clase que falla se completa desde el banco o la base curricular; el aviso de caída pasa a ser solo del admin.
- **Toca:** el manejo de errores de la generación (ruta del plan maestro) y los avisos.
- **Se verifica:** simulando una falla de la IA, la unidad se entrega igual y el admin ve la caída.
- **Costo añadido:** ninguno (ahorra reintentos).
- **César decide antes:** cómo se reconcilia con la regla «sin fallback silencioso a plantillas» de CLAUDE.md.

### Etapa 3 — Perfil del grupo (con lo que ya existe)
- **Qué hace:** reúne por curso/cohorte lo que ya se registra (diagnóstico, evaluaciones, registro anecdótico, punto de partida) en un perfil que pasa al generador y a la revisión.
- **Toca:** un servicio de perfil + su lectura al generar. No pide datos nuevos al docente. Los indicadores del perfil se guardan con su **versión de malla** (ver punto 5).
- **Se verifica:** dos cursos con datos distintos reciben planes distintos en lo que refuerzan.
- **Costo añadido:** pocas palabras más en el texto que recibe la IA.
- **César decide antes:** qué datos entran al perfil y cómo se registra la participación sin trabajo extra.

### Etapa 4A — Banco con memoria de resultados
- **Qué hace:** cada actividad del banco anota en qué perfil de grupo se usó y cómo le fue (logro de sus indicadores).
- **Toca:** `bp_actividades` (campos nuevos, con `merge`) + el cálculo de resultados. Cada resultado guarda la **versión de malla** de sus indicadores (ver punto 5).
- **Se verifica:** después de evaluar un curso, sus actividades muestran su resultado.
- **Costo añadido:** ninguno de IA.
- **César decide antes:** qué cuenta como «funcionó».

### Etapa 4B — Banco primero en el plan maestro
- **Qué hace:** para cada clase, primero se busca en el banco una actividad validada que encaje con la sección, el tema y el perfil; la IA solo adapta o rellena.
- **Toca:** la redacción por fase (`redaccionFaseService.js`, `phaseAService.js`).
- **Se verifica:** con el banco poblado, parte de las clases salen del banco y baja el costo; la revisión sigue aprobando.
- **Costo añadido:** **negativo** (es la etapa que ahorra).
- **César decide antes:** cuánto puede venir del banco por unidad para que no se vuelva repetitivo.

### Etapa 5 — Panel de aprendizaje del admin
- **Qué hace:** muestra por mes el costo por unidad, el % de clases desde el banco, las correcciones de la revisión y el logro de los indicadores reforzados.
- **Toca:** una vista de admin sobre aiLogs y el banco.
- **Se verifica:** las cifras cuadran con aiLogs.
- **Costo añadido:** ninguno de IA.

## 7. Decisiones pendientes de César

1. ¿La revisión corre en el navegador (oculta) o en el servidor?
2. ¿Tope de correcciones por unidad (propuesta: 2) y de costo de la revisión?
3. ¿Cómo registra el docente participación e interés sin trabajo extra?
4. ¿Cómo se reconcilia «siempre entregar» con la regla «sin fallback silencioso a plantillas» de CLAUDE.md? (Propuesta: el banco no es plantilla; la caída es visible al admin; el fail-closed del currículo se mantiene.)
5. ¿Empezamos por la etapa 1A (secciones con propósito)?
6. Cuando cambie el diseño curricular: ¿quién arma la tabla de equivalencias entre indicadores viejos y nuevos (propuesta: DocenteOS la propone y César la valida)?
