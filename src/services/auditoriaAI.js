/**
 * Servicio de Auditoría Pedagógica con IA
 * Usa AIService.generate() → AI Gateway (api/ai/generate.js)
 * Las API keys viven en el servidor — nunca en el frontend.
 */

import { registrarEventoAuditoria, registrarEventoIA } from "../firebase";
import { AIService } from "./ai/AIService";

// ─── PROMPT MAESTRO ───────────────────────────────────────────────────────────

const PROMPT_MAESTRO = `# PROMPT MAESTRO — DOCENTEOS AI
## Auditoría Pedagógica Universal (multi-asignatura · multi-grado · multi-nivel)

Un solo prompt para todas las áreas. El conocimiento específico de cada asignatura NO vive aquí: se carga desde su módulo de área. Este prompt define **cómo se comporta el motor**, no el contenido de ninguna materia en particular.

---

## REGLA DE ORO

DOCENTEOS AI no funciona como un generador de texto. Se comporta como un **docente especialista del área seleccionada**.

Antes de generar o sugerir cualquier actividad, identifica: la naturaleza de la asignatura, el enfoque metodológico recomendado por el MINERD para esa área, las competencias específicas, los indicadores de logro, los contenidos, la carga horaria, el nivel educativo y las características del grupo.

Solo entonces selecciona y adapta actividades desde el **banco pedagógico especializado de esa asignatura**, garantizando progresión lógica, evitando repeticiones y **preservando la identidad propia de cada área del conocimiento**.

Si la información del área no está disponible en su módulo, lo declara explícitamente. **No improvisa la pedagogía de una asignatura que no conoce.**

---

## ARQUITECTURA EN DOS MOTORES

### Motor General (siempre se ejecuta primero)
Detecta automáticamente, a partir de la unidad recibida:
- Área y **asignatura**
- Grado, nivel y ciclo
- Carga horaria y **duración real definida por el docente**
- Enfoque metodológico MINERD del área
- Competencias e indicadores de logro declarados
- Contenidos (conceptuales, procedimentales, actitudinales)
- Perfil del grupo y contexto
- Producto final declarado y su naturaleza

### Motor Especializado (se carga según la asignatura detectada)
Carga el **ADN del área**. Cada área tiene dimensiones propias que el motor debe respetar:

| Área | Dimensiones / ADN que el motor debe verificar y fortalecer |
|------|-----------------------------------------------------------|
| Inglés / Francés | Listening · Speaking · Reading · Writing · Vocabulary · Grammar in Context · Pronunciation · funciones comunicativas |
| Matemática | Resolución de problemas · razonamiento y argumentación · modelación · conexiones · representación |
| Ciencias de la Naturaleza | Indagación · experimentación · observación · explicación científica · uso de evidencia |
| Ciencias Sociales | Análisis de fuentes · pensamiento histórico y geográfico · ciudadanía · interpretación de procesos |
| Lengua Española | Comprensión y producción oral · comprensión y producción escrita · reflexión sobre la lengua |
| Educación Física | Dominio motriz · expresión corporal · juego · condición física · convivencia activa |
| Educación Artística | Expresión · apreciación · creación · contextualización cultural |

---

## FASE 1 — AUDITORÍA

Analiza la unidad completa **desde la mirada del especialista del área detectada** y evalúa:
- Coherencia curricular y alineación con el enfoque MINERD de la asignatura
- Competencias específicas e indicadores de logro
- Situación de aprendizaje y su pertinencia al contexto
- Secuencia didáctica y **progresión real** entre fases (¿avanza o se repite?)
- Coherencia entre actividades, evidencias e instrumentos de evaluación
- Desarrollo equilibrado de las **dimensiones propias del área**
- Atención a la diversidad y a los distintos niveles de desempeño
- Metacognición, producto final progresivo, recursos y transferencia

Identifica fortalezas, debilidades y oportunidades de manera clara y organizada.

---

## FASE 2 — MEJORAS QUIRÚRGICAS

Inserta solo lo que aporte valor pedagógico real, exactamente donde corresponde, **sin alterar el formato ni la estructura original**. Todas las inserciones se adaptan al área detectada:

**1. Contenido clave del área** — vocabulario específico, funciones/operaciones del área, estructura o procedimiento en contexto, formas de representación, expresiones funcionales y recursos auténticos.

**2. Indicadores de avance por fase** — para cada fase de la unidad. Cada indicador evidencia progresión real hacia la competencia.

**3. Criterios de éxito visibles** ("Hoy tendrás éxito si…") — Claros, observables y medibles. La cantidad y exigencia se derivan de grado + área + minutos disponibles.

**4. Banco de expresiones / recursos reutilizable** — organizado por función: saludos, preguntas, instrucciones, trabajo colaborativo, retroalimentación. Tomado del ADN del área.

**5. Atención por niveles de desempeño** — apoyo, nivel esperado, avanzado.

**6. Resultados diagnósticos y decisiones pedagógicas** — dificultades detectadas, fortalezas del grupo y decisiones de enseñanza derivadas.

**7. Transferencia a la vida real** al cierre de cada fase o bloque.

**8. Producto final progresivo** — verificar que se construya por partes; si solo aparece al final, insertar evidencias parciales.

**9. Posibles dificultades del área y gestión del tiempo**.

**10. Revisión crítica** — cualquier otra mejora que fortalezca la calidad sin romper la estructura.

---

## REGLAS DURAS

1. **Identidad de área.** Si es Matemática, no genera actividades de Ciencias. Si es Inglés, parece clase de idioma, no de Sociales.
2. **Nada cableado a una unidad.** Todo se deriva del análisis del tema + grado + nivel.
3. **Duración del docente.** Se respeta la arquitectura temporal definida.
4. **Cantidades por regla.** Toda cifra se deriva de parámetros explícitos.
5. **Formato intacto.** Solo se insertan mejoras; no se elimina, reescribe ni reorganiza.
6. **Honestidad de cobertura.** Si falta conocimiento, se declara; no se simula.

---

Responde en español. Sé específico, pedagógicamente riguroso y orientado a la acción. Organiza tu respuesta en FASE 1 (Auditoría) y FASE 2 (Mejoras quirúrgicas) claramente diferenciadas.`;

// ─── Serialización de la unidad a texto legible ───────────────────────────────

const serializarUnidad = (unidad) => {
  const m = unidad.metadatos || {};
  const c = unidad.competencias || {};
  const con = unidad.contenidos || {};
  const lines = [];

  lines.push("=== DATOS GENERALES ===");
  lines.push(`Docente: ${m.nombreDocente || "—"}`);
  lines.push(`Centro: ${m.centro || "—"} | Regional: ${m.regional || "—"} | Distrito: ${m.distrito || "—"}`);
  lines.push(`Nivel: ${m.nivel || "—"} | Ciclo: ${m.ciclo || "—"} | Modalidad: ${m.modalidad || "—"} | Jornada: ${m.jornada || "—"}`);
  lines.push(`Grado: ${m.grado || "—"} ${m.seccion || ""}  |  Área: ${m.area || "—"}  |  Asignatura: ${m.asignatura || "—"}`);
  lines.push(`Título de la unidad: ${m.titulo || "—"}`);
  lines.push(`Duración: ${m.duracion || "—"}`);
  lines.push(`Horario: ${m.horario || "—"}`);
  lines.push(`Producto final: ${m.productoFinal || "—"}`);
  lines.push(`Asignaturas vinculadas: ${(m.asignaturasVinculadas || []).join(", ") || "N/A"}`);

  lines.push("\n=== SITUACIÓN DE APRENDIZAJE ===");
  lines.push(unidad.situacionAprendizaje || "—");

  lines.push("\n=== AMBIENTE DE APRENDIZAJE ===");
  lines.push(unidad.ambienteAprendizaje || "—");

  lines.push("\n=== COMPETENCIAS E INDICADORES ===");
  lines.push(`Competencias fundamentales: ${(c.fundamentales || []).join(", ") || "—"}`);
  if (c.nivelMCERL) lines.push(`Nivel MCERL: ${c.nivelMCERL}`);
  lines.push(`Competencia específica: ${c.especifica || "—"}`);
  lines.push("Indicadores de logro:");
  (c.indicadores || []).forEach((ind, i) => lines.push(`  ${i + 1}. ${ind}`));

  lines.push("\n=== CONTENIDOS ===");
  lines.push("Conceptuales:");
  (con.conceptuales || []).forEach((ct) => lines.push(`  • ${ct}`));
  lines.push("Procedimentales:");
  (con.procedimentales || []).forEach((ct) => lines.push(`  • ${ct}`));
  lines.push("Actitudinales:");
  (con.actitudinales || []).forEach((ct) => lines.push(`  • ${ct}`));

  lines.push("\n=== FASES Y CLASES ===");
  (unidad.fasesSemanales || []).forEach((fase) => {
    lines.push(`\n${"─".repeat(60)}`);
    lines.push(`FASE ${fase.numero}: ${fase.nombre}`);
    lines.push(`Estrategia: ${fase.estrategia}`);
    lines.push(`Indicadores de avance declarados: ${(fase.indicadoresAvance || []).join(" | ") || "N/A"}`);

    (fase.dias || []).forEach((dia) => {
      lines.push(`\n  CLASE ${dia.numeroGlobal} (Semana ${dia.semana}, ${dia.diaCalendario}): "${dia.titulo}"`);
      lines.push(`  Etapa: ${dia.etapaProgresion || "—"} | Intención: ${dia.intencionPedagogica || "—"}`);
      lines.push(`  Criterios de éxito: ${(dia.criteriosExito || []).join(" / ") || "N/A"}`);
      lines.push(`  Aporte al producto: ${dia.aporteProducto || "N/A"}`);

      (dia.momentos || []).forEach((mom) => {
        lines.push(`\n    [${mom.nombre} — ${mom.tiempo}]`);
        (mom.actividades || []).forEach((act, i) => lines.push(`      ${i + 1}) ${act}`));
        lines.push(`    Evidencias: ${mom.evidencias || "—"}`);
        const ev = mom.evaluacion || {};
        lines.push(`    Evaluación: ${ev.tipo || "—"} / ${ev.agente || "—"} / ${ev.tecnica || "—"} / ${ev.instrumento || "—"}`);
        lines.push(`    Metacognición: ${(mom.metacognicion || []).join(" · ") || "—"}`);
        lines.push(`    Recursos: ${mom.recursos?.didacticos || "—"}`);
      });
    });

    const neae = fase.dias?.[0]?.adaptacionesNEAE;
    if (neae) {
      lines.push(`\n  ADAPTACIONES NEAE:`);
      lines.push(`    Acceso: ${neae.acceso}`);
      lines.push(`    Metodológicas: ${neae.metodologicas}`);
      lines.push(`    Evaluación: ${neae.evaluacion}`);
    }

    const res = fase.dias?.[0]?.resumenEvaluacion;
    if (res) {
      lines.push(`  RESUMEN EVALUACIÓN: Técnicas: ${(res.tecnicas || []).join(", ")} | Instrumentos: ${(res.instrumentos || []).join(", ")}`);
    }

    if (fase.posiblesDificultades) {
      lines.push(`  POSIBLES DIFICULTADES: ${fase.posiblesDificultades}`);
    }
  });

  return lines.join("\n");
};

// ─── Llamada al AI Gateway ────────────────────────────────────────────────────

export const auditarUnidad = async (unidad, { onChunk, onFinish, onError }) => {
  const textoUnidad = serializarUnidad(unidad);
  const prompt = `Realiza la AUDITORÍA PEDAGÓGICA AVANZADA completa de la siguiente Unidad de Aprendizaje generada por DocenteOS.

Ejecuta:
- FASE 1: Auditoría diagnóstica integral — evalúa todas las dimensiones pedagógicas del área detectada
- FASE 2: Mejoras quirúrgicas completas — inserta exactamente donde corresponde, sin eliminar ni reorganizar

---

${textoUnidad}`;

  await AIService.generate({
    module: "auditoria-ia",
    prompt,
    system: PROMPT_MAESTRO,
    maxTokens: 8000,
    onChunk,
    onFinish: async (respuesta) => {
      await registrarEventoIA({
        modulo: "auditoria-ia",
        accion: "auditar-unidad",
        prompt,
        respuesta,
        estado: "exito",
        meta: { longitudRespuesta: respuesta.length },
      });
      await registrarEventoAuditoria({
        tipo: "ia",
        evento: "auditoria_exitosa",
        modulo: "auditoria-ia",
        detalle: { longitudRespuesta: respuesta.length },
      });
      onFinish();
    },
    onError: async (msg) => {
      await registrarEventoIA({
        modulo: "auditoria-ia",
        accion: "auditar-unidad",
        prompt,
        respuesta: "",
        estado: "error",
        meta: { mensaje: msg },
      });
      await registrarEventoAuditoria({
        tipo: "ia",
        evento: "auditoria_error",
        modulo: "auditoria-ia",
        detalle: { mensaje: msg },
      });
      onError(msg);
    },
  });
};
