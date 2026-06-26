import { useState, useRef, useCallback } from 'react'
import { llamarIALab } from '../services/centroIAService.js'
import { useContextoDocente } from '../hooks/useContextoDocente.js'
import './CentroIAPage.css'

// ── Prompt Bank Data ──────────────────────────────────────────────────────────
const BANCO = [
  {
    id: 'planif', icon: '📋', label: 'Planificación',
    prompts: [
      {
        id: 'p1', titulo: 'Plan Diario Completo',
        desc: 'Genera un plan de clase con los tres momentos pedagógicos',
        texto: 'Elabora un plan diario para [GRADO] de [ÁREA] sobre el tema "[TEMA]". Organiza la clase en tres momentos:\n• Inicio (10 min): actividad motivadora y exploración de conocimientos previos\n• Desarrollo (30 min): secuencia de actividades con estrategias activas y participativas\n• Cierre (10 min): síntesis, reflexión metacognitiva y evaluación formativa\nIncluye: competencia específica del MINERD, indicadores de logro, recursos necesarios y sugerencia de evaluación.',
      },
      {
        id: 'p2', titulo: 'Planificación Semanal',
        desc: 'Distribuye objetivos, actividades y evaluaciones en la semana',
        texto: 'Crea una planificación semanal para [GRADO] de [ÁREA] para el período [SEMANA/FECHAS]. Incluye para cada día: objetivo específico alineado a las competencias del MINERD, actividades de apertura y cierre, estrategia principal de aprendizaje, recursos y tipo de evaluación. Señala cuándo se aplicará evaluación formativa y cuándo sumativa.',
      },
      {
        id: 'p3', titulo: 'Unidad de Aprendizaje',
        desc: 'Diseña una unidad completa con situación de aprendizaje',
        texto: 'Diseña una unidad de aprendizaje de [NÚMERO] semanas sobre "[TEMA]" para [GRADO] de [ÁREA]. Incluye:\n• Título motivador e intención pedagógica\n• Situación de aprendizaje contextualizada en la realidad dominicana\n• Competencia fundamental y competencias específicas del MINERD\n• Indicadores de logro medibles\n• Secuencia de actividades con progresión (de menor a mayor complejidad)\n• Recursos y materiales\n• Evaluación auténtica con rúbrica o lista de cotejo\nModalidad: [MODALIDAD]. Ciclo: [CICLO].',
      },
      {
        id: 'p4', titulo: 'Planificación Anual',
        desc: 'Estructura el año escolar con unidades y competencias',
        texto: 'Diseña una planificación anual para [ÁREA] de [GRADO]. Distribuye los contenidos del currículo MINERD en [NÚMERO] unidades o bimestres. Para cada unidad incluye: título, competencias principales, indicadores centrales, contenidos clave, duración estimada en semanas, y tipo de evaluación sumativa. Período escolar: [PERÍODO]. Modalidad: [MODALIDAD].',
      },
      {
        id: 'p5', titulo: 'Planificación por Competencias',
        desc: 'Enfocada en el desarrollo de una competencia específica',
        texto: 'Crea una secuencia didáctica de [NÚMERO] sesiones para desarrollar la competencia "[COMPETENCIA]" en estudiantes de [GRADO] de [ÁREA]. Incluye: indicadores de logro progresivos, actividades por nivel cognitivo (recordar → comprender → aplicar → analizar → crear), recursos para cada nivel, y cómo evidenciarás el desarrollo de la competencia a lo largo del proceso.',
      },
    ],
  },
  {
    id: 'actividades', icon: '🎯', label: 'Actividades',
    prompts: [
      {
        id: 'a1', titulo: 'Actividades Creativas',
        desc: 'Ideas dinámicas y participativas para cualquier tema',
        texto: 'Crea 5 actividades creativas, participativas y significativas para enseñar [TEMA] a estudiantes de [GRADO]. Para cada actividad incluye: nombre de la actividad, objetivo de aprendizaje, instrucciones paso a paso, materiales necesarios, tiempo estimado, y cómo conecta con las competencias del MINERD.',
      },
      {
        id: 'a2', titulo: 'Situación de Aprendizaje',
        desc: 'Contexto real y motivador para anclar el aprendizaje',
        texto: 'Diseña una situación de aprendizaje contextualizada en la realidad dominicana para enseñar [TEMA] en [GRADO] de [ÁREA]. Debe presentar un reto o problema real que los estudiantes deban resolver aplicando los contenidos. Incluye: contexto narrativo, preguntas guía, secuencia de actividades, recursos, y cómo se evalúa el proceso y el producto.',
      },
      {
        id: 'a3', titulo: 'Proyecto Interdisciplinario',
        desc: 'Integra dos o más áreas del conocimiento en un proyecto',
        texto: 'Diseña un proyecto interdisciplinario que integre [ÁREA 1] y [ÁREA 2] para estudiantes de [GRADO]. El proyecto debe: estar basado en un problema o reto real de la comunidad, durar [NÚMERO] semanas, tener un producto final tangible y presentable, incluir roles diferenciados para los estudiantes, integrar competencias de ambas áreas, y culminar con una presentación o exhibición al centro educativo.',
      },
      {
        id: 'a4', titulo: 'Gamificación',
        desc: 'Mecánicas de juego para motivar y comprometer al estudiante',
        texto: 'Crea una actividad de gamificación para enseñar [TEMA] a estudiantes de [GRADO] de [ÁREA]. Incluye: narrativa o historia del juego (personajes y reto principal), reglas claras y simples, niveles de dificultad progresivos (al menos 3), sistema de puntos o recompensas simbólicas, retos individuales y colaborativos, y cómo se conecta con los indicadores de logro del MINERD.',
      },
      {
        id: 'a5', titulo: 'Clase Invertida',
        desc: 'El aprendizaje ocurre antes y se profundiza en clase',
        texto: 'Diseña una clase invertida para el tema "[TEMA]" en [GRADO] de [ÁREA]. Estructura:\n• Antes de la clase: recurso de 10-15 min que los estudiantes exploran en casa (video, lectura, podcast — indica cuál y describe el contenido)\n• Preguntas de verificación para confirmar que exploraron el material\n• Durante la clase (50 min): actividades de profundización, práctica y aplicación con apoyo docente, incluyendo trabajo colaborativo\nIncluye: guía para el estudiante y secuencia de actividades para el docente.',
      },
    ],
  },
  {
    id: 'evaluacion', icon: '📊', label: 'Evaluación',
    prompts: [
      {
        id: 'e1', titulo: 'Rúbrica Analítica',
        desc: 'Criterios claros para evaluar producciones y desempeños',
        texto: 'Crea una rúbrica analítica para evaluar [ACTIVIDAD/PRODUCTO] en [GRADO] de [ÁREA]. La rúbrica debe tener:\n• 4 criterios de evaluación relevantes y observables\n• 4 niveles de desempeño: Excelente (4), Bueno (3), En proceso (2), Necesita apoyo (1)\n• Descriptores específicos y medibles en cada celda\nIncluye escala de calificación total y cómo se relaciona con las competencias del MINERD.',
      },
      {
        id: 'e2', titulo: 'Lista de Cotejo',
        desc: 'Verificación rápida de indicadores presentes o ausentes',
        texto: 'Elabora una lista de cotejo para verificar el logro de [COMPETENCIA/HABILIDAD] en estudiantes de [GRADO] de [ÁREA]. Incluye:\n• 12-15 indicadores observables y verificables (SÍ / NO)\n• Organizados en 3 categorías lógicas: proceso, producto y actitud/valores\n• Instrucciones breves para el docente\n• Sección de observaciones cualitativas',
      },
      {
        id: 'e3', titulo: 'Banco de Preguntas',
        desc: 'Preguntas de selección múltiple por nivel cognitivo',
        texto: 'Genera 12 preguntas de selección múltiple sobre [TEMA] para [GRADO] de [ÁREA]. Para cada pregunta incluye: enunciado claro, 4 opciones (solo una correcta), respuesta correcta identificada, nivel cognitivo (Recordar / Comprender / Aplicar / Analizar), y nivel de dificultad (fácil / medio / difícil). Distribuye: 4 fáciles, 5 medias, 3 difíciles. Todas alineadas a indicadores del MINERD.',
      },
      {
        id: 'e4', titulo: 'Escala de Estimación',
        desc: 'Evalúa frecuencia o calidad de actitudes y procesos',
        texto: 'Crea una escala de estimación para evaluar [ACTITUD/PROCESO/COMPETENCIA] en estudiantes de [GRADO] de [ÁREA]. Incluye:\n• 10 ítems observables redactados en positivo\n• Escala de 4 niveles: Siempre (4), Frecuentemente (3), Ocasionalmente (2), Raramente (1)\n• Puntaje total e interpretación\n• Sección de reflexión del docente y plan de mejora',
      },
      {
        id: 'e5', titulo: 'Preguntas de Ensayo',
        desc: 'Preguntas abiertas que desarrollan el pensamiento crítico',
        texto: 'Diseña 5 preguntas de ensayo o desarrollo para evaluar comprensión profunda de [TEMA] en [GRADO] de [ÁREA]. Las preguntas deben: promover el pensamiento crítico y creativo, conectar el contenido con situaciones reales, permitir que el estudiante argumente y defienda su posición, y variar en nivel cognitivo (comprender → analizar → evaluar → crear). Incluye criterios básicos de evaluación para cada pregunta.',
      },
    ],
  },
  {
    id: 'materiales', icon: '📚', label: 'Materiales',
    prompts: [
      {
        id: 'm1', titulo: 'Guía de Estudio',
        desc: 'Material de apoyo para que el estudiante repase en casa',
        texto: 'Crea una guía de estudio sobre [TEMA] para estudiantes de [GRADO] de [ÁREA]. Incluye:\n• Objetivos de aprendizaje claros (qué sabrá/podrá hacer al finalizar)\n• Resumen de los conceptos principales con ejemplos concretos\n• Actividades de práctica (al menos 5, variadas)\n• Glosario de términos clave con definiciones simples\n• Recursos adicionales sugeridos (videos, lecturas, sitios web)\nUsa lenguaje apropiado para la edad y evita tecnicismos innecesarios.',
      },
      {
        id: 'm2', titulo: 'Historia Educativa',
        desc: 'Enseña un concepto a través de una narración',
        texto: 'Escribe una historia o cuento educativo para enseñar [CONCEPTO/VALOR/TEMA] a estudiantes de [GRADO]. La historia debe: tener personajes identificables para estudiantes dominicanos, incluir el concepto de forma natural, significativa y sin forzarlo, generar emoción o suspenso que mantenga el interés, y terminar con 4 preguntas de reflexión y comprensión. Extensión: 400-600 palabras. Ambientación: República Dominicana.',
      },
      {
        id: 'm3', titulo: 'Estructura de Infografía',
        desc: 'Organiza el contenido para diseñar en Canva u otro editor',
        texto: 'Estructura el contenido de una infografía educativa sobre [TEMA] para [GRADO] de [ÁREA], lista para diseñar en Canva. Organiza así:\n• Título impactante y subtítulo\n• 5-7 puntos clave (cada uno con su ícono sugerido)\n• 2-3 datos importantes o estadísticas llamativas\n• Flujo visual o proceso si aplica\n• Cita o reflexión motivadora al final\n• Paleta de colores y estilo sugerido (moderno, infantil, profesional, etc.)',
      },
      {
        id: 'm4', titulo: 'Juego Educativo',
        desc: 'Actividad lúdica con objetivo pedagógico claro',
        texto: 'Diseña un juego educativo para enseñar [TEMA] a estudiantes de [GRADO] de [ÁREA]. Incluye: nombre del juego, objetivo de aprendizaje, materiales necesarios (accesibles y de bajo costo), número de participantes, instrucciones paso a paso, variantes para diferentes niveles de desempeño, y cómo el docente puede evaluar el aprendizaje a través del juego.',
      },
      {
        id: 'm5', titulo: 'Cuestionario Exploratorio',
        desc: 'Activa conocimientos previos y genera curiosidad',
        texto: 'Elabora un cuestionario de exploración de conocimientos previos sobre [TEMA] para estudiantes de [GRADO] de [ÁREA]. Incluye:\n• 5 preguntas sobre lo que ya saben\n• 3 preguntas de predicción o hipótesis\n• 2 preguntas de experiencia personal relacionada\n• 1 pregunta sobre qué les gustaría aprender\nDiseñado para generar motivación, identificar concepciones previas y orientar la planificación.',
      },
    ],
  },
  {
    id: 'retroali', icon: '💬', label: 'Retroalimentación',
    prompts: [
      {
        id: 'r1', titulo: 'Retroalimentación Individual',
        desc: 'Comentario constructivo y motivador para un estudiante',
        texto: 'Genera un comentario de retroalimentación formativa para un estudiante de [GRADO] que realizó [DESCRIPCIÓN DEL TRABAJO] en [ÁREA]. El comentario debe:\n• Destacar 2-3 fortalezas específicas y observables\n• Señalar 1-2 áreas de mejora con sugerencias concretas de cómo mejorar\n• Usar lenguaje positivo, empático y alentador\n• Orientar claramente los próximos pasos\nTono: profesional pero cálido. Máximo 3 párrafos cortos.',
      },
      {
        id: 'r2', titulo: 'Retroalimentación Grupal',
        desc: 'Retroalimentación para toda la clase tras una actividad',
        texto: 'Elabora una retroalimentación grupal para compartir con estudiantes de [GRADO] después de [ACTIVIDAD/EVALUACIÓN] en [ÁREA]. Incluye:\n• Reconocimiento de los aspectos positivos observados en el grupo\n• Patrones de error más comunes (sin señalar estudiantes individuales) con explicación clara\n• Estrategias concretas de mejora para el grupo\n• Cómo continuarán avanzando en los próximos días\nTono: motivador, respetuoso y orientado al crecimiento colectivo.',
      },
      {
        id: 'r3', titulo: 'Informe a la Familia',
        desc: 'Comunicación clara para padres y tutores',
        texto: 'Redacta un informe de progreso para la familia de un estudiante de [GRADO] sobre su desempeño en [ÁREA] durante [PERÍODO]. El informe debe:\n• Estar en lenguaje claro y accesible (sin jerga técnica)\n• Describir fortalezas observadas con ejemplos concretos\n• Señalar áreas en proceso de mejora sin ser peyorativo\n• Explicar qué estrategias está aplicando el centro educativo\n• Dar recomendaciones prácticas para apoyar en casa\nTono: profesional, empático y positivo.',
      },
      {
        id: 'r4', titulo: 'Preguntas de Metacognición',
        desc: 'El estudiante evalúa su propio proceso de aprendizaje',
        texto: 'Crea 8 preguntas de reflexión metacognitiva para estudiantes de [GRADO] al finalizar [UNIDAD/PROYECTO/PERÍODO] en [ÁREA]. Las preguntas deben ayudar al estudiante a:\n• Identificar qué aprendió y qué todavía no comprende bien\n• Reconocer las estrategias que le funcionaron mejor\n• Valorar su propio esfuerzo y proceso\n• Identificar sus principales desafíos\n• Planificar cómo mejorar en adelante\nFormato: preguntas abiertas, escritas en primera persona.',
      },
    ],
  },
  {
    id: 'neae', icon: '♿', label: 'NEAE',
    prompts: [
      {
        id: 'n1', titulo: 'Adecuaciones Curriculares',
        desc: 'Adaptaciones para estudiantes con necesidades especiales',
        texto: 'Sugiere adecuaciones curriculares para un estudiante con [TIPO DE NECESIDAD: Discapacidad visual / auditiva / intelectual / motora / autismo / TDAH / dislexia / superdotación] en [GRADO] de [ÁREA]. Incluye adecuaciones en tres dimensiones:\n1. Acceso: adaptaciones físicas, comunicativas y de presentación\n2. Metodológicas: estrategias, tiempos, agrupamientos, recursos alternativos\n3. Evaluación: formatos alternativos, criterios ajustados, tiempo adicional\nBasado en el enfoque inclusivo del MINERD y la Orden 02-2011.',
      },
      {
        id: 'n2', titulo: 'Actividades Diferenciadas',
        desc: 'Tres versiones de la misma actividad para distintos niveles',
        texto: 'Diseña la actividad sobre [TEMA] para [GRADO] de [ÁREA] en tres versiones diferenciadas:\n• Nivel de apoyo: para estudiantes que necesitan acompañamiento adicional (más estructura, menos abstracción)\n• Nivel esperado: para el grupo general (competencia estándar del grado)\n• Nivel desafiante: para estudiantes que van más allá (mayor profundidad, autonomía y creación)\nCada versión debe alcanzar el mismo objetivo de aprendizaje adaptando la complejidad y los apoyos.',
      },
      {
        id: 'n3', titulo: 'Estrategias Inclusivas',
        desc: 'Estrategias para un aula diversa e inclusiva',
        texto: 'Sugiere 10 estrategias inclusivas prácticas para atender la diversidad en un aula de [GRADO] de [ÁREA] que incluye estudiantes con diferentes estilos de aprendizaje y ritmos de desarrollo. Las estrategias deben cubrir: ambientación del aula, presentación de contenidos en múltiples formatos, estrategias de participación activa para todos, sistemas de apoyo visual, y gestión de transiciones. Alineadas con el Diseño Universal para el Aprendizaje (DUA).',
      },
    ],
  },
]

// ── Course Library ────────────────────────────────────────────────────────────
const CURSOS = [
  {
    id: 'c1', icon: '🤖', titulo: 'IA para Docentes: Fundamentos',
    desc: 'Comprende qué es la IA, cómo funciona y cómo puede transformar tu práctica docente.',
    lecciones: 5, duracion: '45 min', nivel: 'Básico', color: '#2563EB', disponible: true,
  },
  {
    id: 'c2', icon: '📋', titulo: 'Planifica mejor con IA',
    desc: 'Aprende a crear planificaciones alineadas al MINERD usando inteligencia artificial.',
    lecciones: 6, duracion: '60 min', nivel: 'Intermedio', color: '#7C3AED', disponible: true,
  },
  {
    id: 'c3', icon: '💡', titulo: 'Arte del Prompting Educativo',
    desc: 'Domina el diseño de prompts efectivos para obtener resultados pedagógicos de calidad.',
    lecciones: 4, duracion: '40 min', nivel: 'Intermedio', color: '#059669', disponible: false,
  },
  {
    id: 'c4', icon: '📊', titulo: 'Evaluación Auténtica con IA',
    desc: 'Diseña instrumentos de evaluación alineados a competencias con apoyo de IA.',
    lecciones: 5, duracion: '50 min', nivel: 'Avanzado', color: '#D97706', disponible: false,
  },
  {
    id: 'c5', icon: '🛡️', titulo: 'Uso Ético y Responsable de la IA',
    desc: 'Principios, riesgos y buenas prácticas para usar la IA con integridad pedagógica.',
    lecciones: 4, duracion: '35 min', nivel: 'Básico', color: '#EF4444', disponible: false,
  },
  {
    id: 'c6', icon: '🌐', titulo: 'IA y Comunidad Educativa',
    desc: 'Cómo integrar la IA en proyectos que impacten positivamente a toda la comunidad escolar.',
    lecciones: 4, duracion: '40 min', nivel: 'Avanzado', color: '#0EA5E9', disponible: false,
  },
]

// ── Lab Suggestions ───────────────────────────────────────────────────────────
const SUGERENCIAS_LAB = [
  '💡 Crea 5 estrategias para motivar estudiantes de 3ro de Primaria en Matemática',
  '📋 Diseña una actividad de cierre para una clase de Lengua Española en 1ro de Secundaria',
  '🎯 Genera una rúbrica para evaluar una exposición oral en 6to de Primaria',
  '🔬 Propón un experimento sencillo para enseñar el ciclo del agua a 4to de Primaria',
  '📝 Redacta un circular para padres sobre el próximo proyecto interdisciplinario',
  '♿ Sugiere adaptaciones para un estudiante con dislexia en clases de Lectura',
]

// ── Main Component ────────────────────────────────────────────────────────────
export default function CentroIAPage({ seccion = 'bienvenida' }) {
  return (
    <div className="cia-shell">
      {seccion === 'bienvenida'   && <SecBienvenida />}
      {seccion === 'rol'          && <SecRol />}
      {seccion === 'planificar'   && <SecPlanificar />}
      {seccion === 'experiencias' && <SecExperiencias />}
      {seccion === 'prompts'      && <SecPrompts />}
      {seccion === 'materiales'   && <SecMateriales />}
      {seccion === 'evaluaciones' && <SecEvaluaciones />}
      {seccion === 'ev-autentica' && <SecEvAutentica />}
      {seccion === 'personal'     && <SecPersonal />}
      {seccion === 'etica'        && <SecEtica />}
      {seccion === 'laboratorio'  && <SecLaboratorio />}
      {seccion === 'academia'     && <SecAcademia />}
    </div>
  )
}

// ── Section Header helper ─────────────────────────────────────────────────────
function SH({ badge, title, desc }) {
  return (
    <div className="cia-sh">
      <div className="cia-sh-badge">{badge}</div>
      <h1>{title}</h1>
      {desc && <p>{desc}</p>}
    </div>
  )
}

// ── Info Box helper ───────────────────────────────────────────────────────────
function Info({ tipo = 'blue', icon, children }) {
  return (
    <div className={`cia-info-box ${tipo}`}>
      <span className="cia-info-icon">{icon}</span>
      <p>{children}</p>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 1 · Bienvenida
// ════════════════════════════════════════════════════════════════════════════
function SecBienvenida() {
  return (
    <div className="cia-section">
      <div className="cia-hero">
        <div className="cia-hero-eyebrow">DOCENTEOS AI PRO · CENTRO IA DOCENTE</div>
        <h2>Bienvenido a tu academia de Inteligencia Artificial</h2>
        <p>
          Aquí aprenderás a usar la IA como herramienta pedagógica potente, responsable y alineada
          al currículo del MINERD. No reemplaza tu juicio — lo amplifica.
        </p>
        <div className="cia-hero-stats">
          <div className="cia-hero-stat">
            <span className="cia-hero-stat-n">12</span>
            <span className="cia-hero-stat-l">Módulos</span>
          </div>
          <div className="cia-hero-stat">
            <span className="cia-hero-stat-n">50+</span>
            <span className="cia-hero-stat-l">Prompts</span>
          </div>
          <div className="cia-hero-stat">
            <span className="cia-hero-stat-n">6</span>
            <span className="cia-hero-stat-l">Cursos</span>
          </div>
          <div className="cia-hero-stat">
            <span className="cia-hero-stat-n">∞</span>
            <span className="cia-hero-stat-l">Laboratorio</span>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div className="cia-section-label">¿Qué es la Inteligencia Artificial?</div>
        <div className="cia-pillars">
          <div className="cia-pillar">
            <span className="cia-pillar-emoji">🧠</span>
            <div className="cia-pillar-title">Procesa lenguaje</div>
            <p className="cia-pillar-desc">Comprende y genera texto de forma fluida y coherente a partir de instrucciones (prompts).</p>
          </div>
          <div className="cia-pillar">
            <span className="cia-pillar-emoji">📚</span>
            <div className="cia-pillar-title">Aprendió de datos</div>
            <p className="cia-pillar-desc">Fue entrenada con millones de textos educativos, científicos y culturales de todo el mundo.</p>
          </div>
          <div className="cia-pillar">
            <span className="cia-pillar-emoji">⚡</span>
            <div className="cia-pillar-title">Trabaja al instante</div>
            <p className="cia-pillar-desc">Genera planificaciones, rúbricas, actividades y materiales en segundos en lugar de horas.</p>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div className="cia-section-label">Mitos y realidades</div>
        <div className="cia-mitos">
          <div className="cia-mitos-header">
            <span>❌ Mito</span>
            <span>✅ Realidad</span>
          </div>
          {[
            ['La IA va a reemplazar al docente', 'La IA automatiza tareas repetitivas, pero la relación humana, el juicio pedagógico y la empatía son insustituibles.'],
            ['La IA siempre tiene razón', 'Puede cometer errores. Siempre revisa y adapta lo que genera según tu contexto y criterio profesional.'],
            ['Usar IA es hacer trampa', 'Es una herramienta, como el libro de texto o la calculadora. Lo importante es cómo la usas pedagógicamente.'],
            ['La IA es para expertos en tecnología', 'Cualquier docente puede usarla con una instrucción bien redactada. No se necesita saber programar.'],
            ['La IA conoce a mis estudiantes', 'Tú conoces a tu grupo. La IA genera propuestas que tú adaptas a la realidad de tu aula.'],
          ].map(([mito, verdad], i) => (
            <div className="cia-mito-row" key={i}>
              <div className="cia-mito-falso"><span>✗</span>{mito}</div>
              <div className="cia-mito-verdad"><span>✓</span>{verdad}</div>
            </div>
          ))}
        </div>
      </div>

      <Info tipo="blue" icon="💡">
        <strong>Tu punto de partida:</strong> Explora cada módulo de este Centro IA en el orden que prefieras.
        Te recomendamos comenzar por <em>Banco de Prompts</em> para resultados inmediatos, y por <em>Laboratorio IA</em>
        para experimentar con total libertad.
      </Info>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 2 · Rol del Docente
// ════════════════════════════════════════════════════════════════════════════
function SecRol() {
  return (
    <div className="cia-section">
      <SH
        badge="👤 ROL DOCENTE"
        title="Tú eres el centro. La IA es la herramienta."
        desc="Comprender tu rol frente a la IA es la clave para usarla con criterio, responsabilidad y propósito pedagógico."
      />

      <div className="cia-grid cia-grid-2" style={{ marginBottom: 28 }}>
        {[
          { icon: '🎯', title: 'Diseñas la experiencia', desc: 'Decides qué aprenden los estudiantes, cómo y para qué. La IA puede proponer, pero tú validas, adaptas y decides.' },
          { icon: '🤝', title: 'Construyes la relación', desc: 'La conexión humana, la confianza y el vínculo con el estudiante no pueden ser generados por ningún algoritmo.' },
          { icon: '🔍', title: 'Evalúas con criterio', desc: 'Interpretas las evidencias de aprendizaje, consideras el contexto del estudiante y tomas decisiones pedagógicas informadas.' },
          { icon: '🌱', title: 'Acompañas el proceso', desc: 'Identificas cuándo un estudiante necesita apoyo, motivación o un reto mayor — algo que ninguna IA puede hacer en el aula.' },
          { icon: '🛡️', title: 'Garantizas la ética', desc: 'Aseguras que la IA se use de forma responsable, transparente y respetuosa con la dignidad de cada estudiante.' },
          { icon: '🎓', title: 'Formas ciudadanos', desc: 'Tu misión va más allá del contenido: formas personas con valores, pensamiento crítico y capacidad de vivir en sociedad.' },
        ].map((c) => (
          <div className="cia-card" key={c.title}>
            <span className="cia-card-icon">{c.icon}</span>
            <p className="cia-card-title">{c.title}</p>
            <p className="cia-card-desc">{c.desc}</p>
          </div>
        ))}
      </div>

      <div className="cia-section-label">¿Qué hace la IA por ti?</div>
      <Info tipo="green" icon="✅">
        <strong>Automatiza tareas repetitivas:</strong> Genera primeras versiones de planificaciones, rúbricas,
        preguntas, cartas e informes en segundos. Tú revisas, ajustas y personalizas según tu contexto.
      </Info>
      <Info tipo="green" icon="✅">
        <strong>Amplía tus opciones:</strong> Sugiere actividades, estrategias y recursos que quizás no habías
        considerado. Actúa como un colega siempre disponible para hacer lluvia de ideas contigo.
      </Info>
      <Info tipo="green" icon="✅">
        <strong>Reduce la carga cognitiva:</strong> Te libera tiempo y energía para dedicarlos a lo que más
        importa: el vínculo con tus estudiantes y la reflexión pedagógica profunda.
      </Info>

      <div className="cia-section-label" style={{ marginTop: 24 }}>¿Qué NO hace la IA por ti?</div>
      <Info tipo="red" icon="⚠️">
        <strong>No conoce a tus estudiantes:</strong> No sabe sus nombres, historias, dificultades específicas
        ni el contexto de tu comunidad. Esa información eres tú quien la aporta.
      </Info>
      <Info tipo="red" icon="⚠️">
        <strong>No garantiza calidad automática:</strong> Lo que genera debe ser revisado y validado por ti.
        Puede contener errores de contenido, desalineaciones curriculares o sugerencias inapropiadas para tu grado.
      </Info>
      <Info tipo="amber" icon="💡">
        <strong>Regla de oro:</strong> Usa la IA para el primer borrador. Tú haces el trabajo pedagógico
        real: contextualizar, adaptar, decidir y reflexionar. La calidad final siempre depende de tu criterio docente.
      </Info>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 3 · IA para Planificar
// ════════════════════════════════════════════════════════════════════════════
const TIPOS_PLAN = [
  { icon: '📅', title: 'Planificación Anual', desc: 'Distribuye el año en unidades con competencias, contenidos y períodos de evaluación.', badge: 'Macro' },
  { icon: '🗓️', title: 'Planificación Mensual', desc: 'Organiza las semanas del mes con objetivos, recursos y evaluaciones programadas.', badge: 'Meso' },
  { icon: '📋', title: 'Planificación Semanal', desc: 'Detalla los cinco días con actividades, estrategias y evaluación formativa diaria.', badge: 'Meso' },
  { icon: '📚', title: 'Unidad de Aprendizaje', desc: 'Diseña una unidad completa con situación de aprendizaje y evaluación auténtica.', badge: 'Unidad' },
  { icon: '☀️', title: 'Plan Diario',           desc: 'Estructura inicio, desarrollo y cierre con indicadores, recursos y evaluación.', badge: 'Micro' },
]

function SecPlanificar() {
  return (
    <div className="cia-section">
      <SH
        badge="📋 PLANIFICACIÓN"
        title="IA para Planificar"
        desc="Genera cualquier tipo de planificación alineada al currículo del MINERD. La IA crea el borrador; tú lo perfeccionas con tu conocimiento del grupo."
      />

      <div className="cia-section-label">Tipos de planificación que puedes crear</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
        {TIPOS_PLAN.map((t) => (
          <div className="cia-tipo-card" key={t.title}>
            <div className="cia-tipo-icon">{t.icon}</div>
            <div className="cia-tipo-body">
              <p className="cia-tipo-title">{t.title}</p>
              <p className="cia-tipo-desc">{t.desc}</p>
            </div>
            <span className="cia-tipo-badge">{t.badge}</span>
          </div>
        ))}
      </div>

      <div className="cia-section-label">Cómo escribir un buen prompt de planificación</div>
      <div className="cia-tips">
        <div className="cia-tips-title">🎯 Fórmula: TIPO + GRADO + ÁREA + TEMA + CONTEXTO</div>
        <ul>
          <li><strong>Tipo:</strong> "Plan diario / Unidad de aprendizaje / Planificación semanal"</li>
          <li><strong>Grado y nivel:</strong> "3er grado de Primaria / 2do grado de Secundaria"</li>
          <li><strong>Área y asignatura:</strong> "Lengua Española / Matemática / Ciencias Sociales"</li>
          <li><strong>Tema específico:</strong> "La célula / Los números decimales / La Independencia Dominicana"</li>
          <li><strong>Contexto adicional:</strong> duración, jornada, producto esperado, características del grupo</li>
        </ul>
      </div>

      <hr className="cia-divider" />

      <div className="cia-section-label">Ejemplo práctico</div>
      <div className="cia-card">
        <p className="cia-card-title" style={{ marginBottom: 8 }}>Prompt para un plan diario de Matemática</p>
        <div style={{ background: 'var(--cia-input-bg)', border: '1px solid var(--cia-border)', borderRadius: 10, padding: 14, fontSize: '0.85rem', lineHeight: 1.7, color: 'var(--cia-text)', marginBottom: 10 }}>
          "Elabora un plan diario para <strong>4to grado de Primaria de Matemática</strong> sobre el tema{' '}
          <strong>'Multiplicación de números de dos cifras'</strong>. Duración: 50 minutos. Jornada extendida.
          El grupo tiene 28 estudiantes, varios con dificultades de comprensión lectora. Incluye actividades
          manipulativas y un momento de práctica colaborativa. Alinea con las competencias del MINERD."
        </div>
        <Info tipo="green" icon="✅">
          Este prompt tiene: tipo, grado, área, tema, duración, característica del grupo y petición específica.
          Resultado: una planificación detallada y relevante.
        </Info>
      </div>

      <hr className="cia-divider" />
      <Info tipo="blue" icon="💡">
        <strong>Consejo:</strong> Ve al <em>Banco de Prompts</em> para encontrar más de 25 prompts de planificación
        listos para usar y copiar directamente al Laboratorio IA.
      </Info>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 4 · Diseñar Experiencias
// ════════════════════════════════════════════════════════════════════════════
const EXPERIENCIAS = [
  { icon: '🏗️', tag: 'ABP',     color: '#2563EB', name: 'Aprendizaje Basado en Proyectos',   desc: 'Los estudiantes resuelven un problema real del entorno con un producto tangible al final.', pasos: ['Define el reto o problema', 'Planifica el proyecto', 'Investiga y crea', 'Presenta y reflexiona'] },
  { icon: '🎮', tag: 'Gamif.',  color: '#7C3AED', name: 'Gamificación',                       desc: 'Mecánicas de juego (puntos, niveles, retos) para motivar y comprometer al estudiante.', pasos: ['Define la narrativa', 'Crea los niveles', 'Establece recompensas', 'Evalúa el logro'] },
  { icon: '🔄', tag: 'Flipped', color: '#059669', name: 'Clase Invertida',                    desc: 'El estudiante explora el contenido en casa; en clase practica y profundiza con el docente.', pasos: ['Comparte recurso en casa', 'Verifica la exploración', 'Practica en clase', 'Profundiza y aplica'] },
  { icon: '👥', tag: 'Collab.', color: '#D97706', name: 'Aprendizaje Colaborativo',            desc: 'Grupos heterogéneos construyen conocimiento juntos con roles definidos y responsabilidad compartida.', pasos: ['Forma los grupos', 'Asigna roles', 'Define la tarea grupal', 'Evalúa proceso y producto'] },
  { icon: '🔬', tag: 'STEAM',   color: '#EF4444', name: 'STEAM',                              desc: 'Integra ciencia, tecnología, ingeniería, arte y matemática en proyectos creativos e interdisciplinarios.', pasos: ['Selecciona el tema integrador', 'Conecta las áreas', 'Diseña el proyecto', 'Presenta el resultado'] },
  { icon: '📖', tag: 'ABR',     color: '#EC4899', name: 'Aprendizaje Basado en Retos',        desc: 'Un desafío real y significativo que requiere investigación, soluciones creativas y acción concreta.', pasos: ['Presenta el reto', 'Investiga y analiza', 'Propone soluciones', 'Implementa y evalúa'] },
]

function SecExperiencias() {
  const [sel, setSel] = useState(null)
  const exp = sel != null ? EXPERIENCIAS[sel] : null

  return (
    <div className="cia-section">
      <SH
        badge="🎨 EXPERIENCIAS"
        title="Diseñar Experiencias de Aprendizaje"
        desc="La IA te ayuda a diseñar experiencias activas, significativas y motivadoras usando metodologías modernas. Selecciona una para ver cómo implementarla."
      />

      <div className="cia-grid cia-grid-2" style={{ marginBottom: 24 }}>
        {EXPERIENCIAS.map((e, i) => (
          <div
            key={e.tag}
            className="cia-exp-card"
            style={{ cursor: 'pointer', borderColor: sel === i ? e.color : undefined }}
            onClick={() => setSel(sel === i ? null : i)}
          >
            <div className="cia-exp-top">
              <div className="cia-exp-icon" style={{ background: `${e.color}20` }}>{e.icon}</div>
              <div style={{ flex: 1 }}>
                <p className="cia-exp-name">{e.name}</p>
                <span className="cia-exp-tag" style={{ background: `${e.color}18`, color: e.color }}>{e.tag}</span>
              </div>
            </div>
            <p className="cia-exp-desc">{e.desc}</p>
          </div>
        ))}
      </div>

      {exp && (
        <div className="cia-card" style={{ borderColor: exp.color, borderWidth: 2 }}>
          <p className="cia-card-title" style={{ color: exp.color, marginBottom: 12 }}>
            {exp.icon} Cómo aplicar {exp.name}
          </p>
          <div className="cia-grid cia-grid-4" style={{ marginBottom: 16 }}>
            {exp.pasos.map((p, i) => (
              <div key={i} style={{ textAlign: 'center', background: 'var(--cia-input-bg)', borderRadius: 10, padding: '12px 8px' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: exp.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', margin: '0 auto 8px' }}>{i + 1}</div>
                <span style={{ fontSize: '0.8rem', color: 'var(--cia-text)', fontWeight: 600 }}>{p}</span>
              </div>
            ))}
          </div>
          <Info tipo="blue" icon="💡">
            <strong>Prompt sugerido:</strong> "Diseña una experiencia de {exp.name} para [GRADO] de [ÁREA] sobre el tema [TEMA].
            Incluye: objetivos, secuencia de actividades, roles de los estudiantes, recursos y evaluación."
            Pruébalo en el <em>Laboratorio IA</em>.
          </Info>
        </div>
      )}

      {!exp && (
        <Info tipo="blue" icon="👆">
          Selecciona una metodología arriba para ver cómo implementarla paso a paso con apoyo de IA.
        </Info>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 5 · Banco de Prompts
// ════════════════════════════════════════════════════════════════════════════
function SecPrompts() {
  const [cat, setCat] = useState('planif')
  const [copiado, setCopiado] = useState(null)
  const catActual = BANCO.find(c => c.id === cat) || BANCO[0]

  const copiar = useCallback((texto, id) => {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(id)
      setTimeout(() => setCopiado(null), 2000)
    }).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = texto
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopiado(id)
      setTimeout(() => setCopiado(null), 2000)
    })
  }, [])

  return (
    <div className="cia-section">
      <SH
        badge="💡 PROMPTS"
        title="Banco de Prompts Pedagógicos"
        desc="Prompts listos para usar, diseñados específicamente para docentes del sistema educativo dominicano. Cópialos y pégalos en el Laboratorio IA o en ChatGPT."
      />

      <div className="cia-prompts-tabs">
        {BANCO.map(c => (
          <button key={c.id} className={`cia-tab${cat === c.id ? ' active' : ''}`} onClick={() => setCat(c.id)}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {catActual.prompts.map(p => (
        <div className="cia-prompt-card" key={p.id}>
          <div className="cia-prompt-top">
            <p className="cia-prompt-title">{p.titulo}</p>
          </div>
          <p className="cia-prompt-desc">{p.desc}</p>
          <div className="cia-prompt-body">{p.texto}</div>
          <div className="cia-prompt-actions">
            <button
              className={`cia-btn ${copiado === p.id ? 'cia-btn-success' : 'cia-btn-ghost'}`}
              onClick={() => copiar(p.texto, p.id)}
            >
              {copiado === p.id ? '✓ Copiado' : '📋 Copiar'}
            </button>
            <span style={{ fontSize: '0.78rem', color: 'var(--cia-text-3)' }}>
              Personaliza los campos entre [CORCHETES] con tu información
            </span>
          </div>
        </div>
      ))}

      <Info tipo="blue" icon="💡">
        <strong>Tip:</strong> Los campos entre [CORCHETES] son los que debes personalizar.
        Por ejemplo, reemplaza [GRADO] por "3er grado de Primaria" y [ÁREA] por "Matemática".
        Cuantos más detalles des, mejor será el resultado.
      </Info>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 6 · Crear Materiales
// ════════════════════════════════════════════════════════════════════════════
const MATS = [
  { icon: '📄', label: 'Guía de Estudio',   desc: 'Repaso en casa' },
  { icon: '📋', label: 'Cuestionario',       desc: 'Comprensión y práctica' },
  { icon: '🗺️', label: 'Infografía',         desc: 'Resumen visual' },
  { icon: '📖', label: 'Historia Educativa', desc: 'Narrativa contextualizada' },
  { icon: '🎲', label: 'Juego Educativo',    desc: 'Actividad lúdica' },
  { icon: '🃏', label: 'Fichas de Trabajo',  desc: 'Tarjetas de actividades' },
  { icon: '📰', label: 'Texto Informativo',  desc: 'Lectura adaptada' },
  { icon: '🗣️', label: 'Guión de Debate',    desc: 'Argumentación oral' },
  { icon: '🎯', label: 'Mapa Conceptual',    desc: 'Organización de ideas' },
  { icon: '✅', label: 'Lista de Cotejo',    desc: 'Verificación de indicadores' },
  { icon: '📊', label: 'Rúbrica',            desc: 'Criterios de evaluación' },
  { icon: '🔬', label: 'Guía de Experimento',desc: 'Procedimiento científico' },
]

function SecMateriales() {
  const [sel, setSel] = useState(null)

  const promptMat = sel != null ? `Crea ${MATS[sel].label.toLowerCase()} sobre [TEMA] para estudiantes de [GRADO] de [ÁREA].
Incluye: objetivo claro, instrucciones detalladas, contenido completo y bien organizado, y actividades de aplicación.
Usa lenguaje apropiado para la edad y adapta el formato al tipo de material seleccionado.` : ''

  return (
    <div className="cia-section">
      <SH
        badge="📁 MATERIALES"
        title="Crear Materiales Didácticos"
        desc="La IA puede crear cualquier material educativo en segundos. Selecciona el tipo, personaliza el prompt y obtén un borrador listo para revisar y adaptar."
      />

      <div className="cia-section-label">Selecciona el tipo de material</div>
      <div className="cia-mat-grid">
        {MATS.map((m, i) => (
          <div
            key={i}
            className={`cia-mat-item${sel === i ? ' selected' : ''}`}
            onClick={() => setSel(sel === i ? null : i)}
          >
            <span className="cia-mat-emoji">{m.icon}</span>
            <span className="cia-mat-label">{m.label}</span>
            <span className="cia-mat-desc">{m.desc}</span>
          </div>
        ))}
      </div>

      {sel != null && (
        <div className="cia-card" style={{ marginTop: 8 }}>
          <p className="cia-card-title" style={{ marginBottom: 10 }}>
            {MATS[sel].icon} Prompt para {MATS[sel].label}
          </p>
          <div className="cia-prompt-body">{promptMat}</div>
          <button
            className="cia-btn cia-btn-primary"
            onClick={() => navigator.clipboard.writeText(promptMat)}
          >
            📋 Copiar prompt
          </button>
        </div>
      )}

      {sel == null && (
        <Info tipo="blue" icon="👆">
          Selecciona el tipo de material arriba para ver y copiar el prompt correspondiente.
        </Info>
      )}

      <hr className="cia-divider" />

      <div className="cia-section-label">Consejos para crear materiales de calidad</div>
      <ul className="cia-checklist">
        <li>Especifica el grado, área y tema con precisión — la IA usará ese nivel de detalle.</li>
        <li>Pide un lenguaje apropiado para la edad: "lenguaje simple y motivador para niños de 8 años".</li>
        <li>Solicita que incluya competencias del MINERD para asegurar alineación curricular.</li>
        <li>Pide ejemplos concretos relacionados con la realidad dominicana.</li>
        <li>Revisa y personaliza siempre el resultado antes de usar con los estudiantes.</li>
      </ul>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 7 · Crear Evaluaciones
// ════════════════════════════════════════════════════════════════════════════
const TIPOS_EVAL = [
  { icon: '🔘', label: 'Selección Múltiple',   desc: 'Preguntas con opciones', prompt: 'Genera 10 preguntas de selección múltiple con 4 opciones cada una sobre [TEMA] para [GRADO] de [ÁREA]. Incluye respuesta correcta y nivel cognitivo (Recordar/Comprender/Aplicar/Analizar).' },
  { icon: '❓', label: 'Preguntas Abiertas',   desc: 'Respuesta libre y reflexiva', prompt: 'Crea 5 preguntas abiertas de diferente nivel cognitivo sobre [TEMA] para [GRADO] de [ÁREA]. Incluye criterios básicos de evaluación para cada una.' },
  { icon: '✓✗', label: 'Verdadero / Falso',    desc: 'Verificación de conceptos', prompt: 'Elabora 12 proposiciones de verdadero o falso sobre [TEMA] para [GRADO] de [ÁREA]. Para las falsas, incluye la corrección.' },
  { icon: '↔️', label: 'Relacionar Columnas',   desc: 'Asociación de conceptos', prompt: 'Diseña un ejercicio de relacionar columnas sobre [TEMA] para [GRADO] de [ÁREA]. Columna A: 8 conceptos o preguntas. Columna B: 8 respuestas o definiciones (incluye 2 distractores).' },
  { icon: '_ _', label: 'Completar',             desc: 'Llenar espacios en blanco', prompt: 'Crea 8 oraciones incompletas sobre [TEMA] para [GRADO] de [ÁREA]. Cada oración debe tener 1-2 espacios clave. Incluye el banco de palabras.' },
  { icon: '📋', label: 'Rúbrica Analítica',    desc: 'Evaluación de producciones', prompt: 'Crea una rúbrica analítica con 4 criterios y 4 niveles (Excelente/Bueno/En proceso/Necesita apoyo) para evaluar [ACTIVIDAD/PRODUCTO] en [GRADO] de [ÁREA]. Descriptores específicos en cada celda.' },
  { icon: '✅', label: 'Lista de Cotejo',       desc: 'Verificación de indicadores', prompt: 'Elabora una lista de cotejo con 12 indicadores (Sí/No) para verificar el logro de [COMPETENCIA] en [GRADO] de [ÁREA]. Organiza en 3 categorías.' },
  { icon: '📈', label: 'Escala de Estimación',  desc: 'Frecuencia de actitudes', prompt: 'Crea una escala de estimación de 4 niveles con 10 ítems para evaluar [ACTITUD/PROCESO] en estudiantes de [GRADO] de [ÁREA].' },
]

function SecEvaluaciones() {
  const [sel, setSel] = useState(null)
  const [copiado, setCopiado] = useState(false)

  const copiar = () => {
    if (sel == null) return
    navigator.clipboard.writeText(TIPOS_EVAL[sel].prompt)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="cia-section">
      <SH
        badge="📊 EVALUACIÓN"
        title="Crear Instrumentos de Evaluación"
        desc="La IA genera instrumentos de evaluación alineados a las competencias del MINERD. Selecciona el tipo, copia el prompt y obtén tu instrumento en segundos."
      />

      <div className="cia-grid cia-grid-2" style={{ marginBottom: 20 }}>
        {TIPOS_EVAL.map((t, i) => (
          <div
            key={i}
            className="cia-tipo-card"
            style={{ borderColor: sel === i ? 'var(--cia-accent)' : undefined, cursor: 'pointer' }}
            onClick={() => setSel(sel === i ? null : i)}
          >
            <div className="cia-tipo-icon" style={{ fontSize: '1.1rem', fontFamily: 'monospace', fontWeight: 800 }}>
              {t.icon}
            </div>
            <div className="cia-tipo-body">
              <p className="cia-tipo-title">{t.label}</p>
              <p className="cia-tipo-desc">{t.desc}</p>
            </div>
            {sel === i && <span className="cia-tipo-badge">Seleccionado</span>}
          </div>
        ))}
      </div>

      {sel != null && (
        <div className="cia-card">
          <p className="cia-card-title" style={{ marginBottom: 10 }}>Prompt para {TIPOS_EVAL[sel].label}</p>
          <div className="cia-prompt-body">{TIPOS_EVAL[sel].prompt}</div>
          <button className={`cia-btn ${copiado ? 'cia-btn-success' : 'cia-btn-primary'}`} onClick={copiar}>
            {copiado ? '✓ Copiado' : '📋 Copiar prompt'}
          </button>
        </div>
      )}

      <hr className="cia-divider" />
      <div className="cia-section-label">Principios de evaluación con IA</div>
      <ul className="cia-checklist">
        <li>Siempre verifica que los indicadores generados correspondan al grado y área indicada.</li>
        <li>Adapta el vocabulario al nivel cognitivo y lingüístico de tus estudiantes.</li>
        <li>Combina diferentes tipos de instrumentos para una evaluación integral y justa.</li>
        <li>La evaluación no es castigo — es información para mejorar la enseñanza y el aprendizaje.</li>
        <li>Comparte siempre la rúbrica o criterios con los estudiantes antes de la actividad.</li>
      </ul>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 8 · Evaluación Auténtica
// ════════════════════════════════════════════════════════════════════════════
function SecEvAutentica() {
  return (
    <div className="cia-section">
      <SH
        badge="✅ EVALUACIÓN AUTÉNTICA"
        title="Evaluación Auténtica con IA"
        desc="La evaluación auténtica mide lo que los estudiantes realmente saben hacer. La IA te ayuda a diseñar situaciones de evaluación significativas, contextualizadas y alineadas al MINERD."
      />

      <Info tipo="purple" icon="✨">
        <strong>¿Qué es la evaluación auténtica?</strong> Es aquella que propone situaciones reales o simuladas
        que exigen que el estudiante aplique sus conocimientos y competencias, en lugar de solo recordar información.
        Es la evaluación que más se aproxima a lo que ocurre fuera del aula.
      </Info>

      <div className="cia-section-label" style={{ marginTop: 24 }}>Tipos de evidencias auténticas</div>
      <div className="cia-grid cia-grid-3" style={{ marginBottom: 24 }}>
        {[
          { icon: '🗣️', title: 'Presentación Oral',     desc: 'Exposición, debate, dramatización, lectura en voz alta con propósito comunicativo.' },
          { icon: '📝', title: 'Producción Escrita',     desc: 'Carta, artículo, historia, informe, proyecto escrito con destinatario real.' },
          { icon: '🔬', title: 'Proyecto de Investigación', desc: 'Proceso de búsqueda, análisis y presentación de hallazgos sobre un problema real.' },
          { icon: '🏗️', title: 'Producto Creativo',      desc: 'Maqueta, afiche, video, obra de arte, experimento, aplicación o solución diseñada.' },
          { icon: '🎭', title: 'Desempeño en Situación', desc: 'Resolución de problemas en contexto, simulación de roles, toma de decisiones fundamentada.' },
          { icon: '📂', title: 'Portafolio',              desc: 'Colección seleccionada de trabajos que evidencian progreso y reflexión del estudiante.' },
        ].map(c => (
          <div className="cia-card" key={c.title}>
            <span className="cia-card-icon">{c.icon}</span>
            <p className="cia-card-title">{c.title}</p>
            <p className="cia-card-desc">{c.desc}</p>
          </div>
        ))}
      </div>

      <div className="cia-section-label">Prompts para evaluación auténtica</div>
      {[
        {
          titulo: 'Situación de evaluación contextualizada',
          texto: 'Diseña una situación de evaluación auténtica sobre [TEMA] para [GRADO] de [ÁREA]. La situación debe: presentar un contexto real o verosímil de la vida dominicana, plantear un reto o problema que requiera aplicar los conocimientos trabajados, especificar el producto que el estudiante debe crear, e incluir criterios de evaluación (rúbrica o lista de cotejo).',
        },
        {
          titulo: 'Portafolio de aprendizaje',
          texto: 'Diseña un portafolio de aprendizaje para [GRADO] de [ÁREA] durante [PERÍODO]. Incluye: lista de evidencias a recopilar (al menos 5), criterios para la selección de trabajos, guía de reflexión del estudiante (qué aprendí, cómo lo aprendí, qué mejoraría), y rúbrica para evaluar el portafolio final.',
        },
      ].map((p, i) => (
        <div className="cia-prompt-card" key={i}>
          <p className="cia-prompt-title" style={{ marginBottom: 6 }}>{p.titulo}</p>
          <div className="cia-prompt-body">{p.texto}</div>
          <button className="cia-btn cia-btn-ghost" onClick={() => navigator.clipboard.writeText(p.texto)}>
            📋 Copiar
          </button>
        </div>
      ))}

      <hr className="cia-divider" />
      <Info tipo="green" icon="💡">
        <strong>Consejo del MINERD:</strong> La evaluación auténtica parte de una situación de aprendizaje
        contextualizada. Diseña primero la situación, luego los indicadores y finalmente el instrumento.
        La IA puede ayudarte en cada uno de estos pasos.
      </Info>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 9 · Personalización
// ════════════════════════════════════════════════════════════════════════════
function SecPersonal() {
  return (
    <div className="cia-section">
      <SH
        badge="🎯 PERSONALIZACIÓN"
        title="Personalización e Inclusión"
        desc="Cada estudiante es único. La IA te ayuda a diferenciar la enseñanza y a diseñar adecuaciones para atender la diversidad del aula con equidad y calidad."
      />

      <Info tipo="amber" icon="⚠️">
        <strong>Importante:</strong> La IA genera propuestas generales. Las adecuaciones reales requieren
        tu conocimiento profundo del estudiante, el acompañamiento del psicólogo, orientador y la familia.
        Usa las sugerencias de la IA como punto de partida, no como diagnóstico.
      </Info>

      <div className="cia-section-label" style={{ marginTop: 24 }}>Estrategias de diferenciación</div>
      <div className="cia-grid cia-grid-2" style={{ marginBottom: 24 }}>
        {[
          { icon: '📊', title: 'Diferenciación de contenido', desc: 'Adapta la profundidad y complejidad de los conceptos según el nivel del estudiante, manteniendo el mismo objetivo.' },
          { icon: '🔧', title: 'Diferenciación de proceso', desc: 'Ofrece diferentes rutas para llegar al mismo aprendizaje: visual, auditivo, kinestésico, colaborativo o individual.' },
          { icon: '🎨', title: 'Diferenciación de producto', desc: 'Permite que los estudiantes demuestren su aprendizaje de diferentes formas: oral, escrita, visual, digital o práctica.' },
          { icon: '🌍', title: 'Diferenciación de entorno', desc: 'Adapta el ambiente físico, el nivel de ruido, la organización del espacio y los materiales a las necesidades individuales.' },
        ].map(c => (
          <div className="cia-card" key={c.title}>
            <span className="cia-card-icon">{c.icon}</span>
            <p className="cia-card-title">{c.title}</p>
            <p className="cia-card-desc">{c.desc}</p>
          </div>
        ))}
      </div>

      <div className="cia-section-label">Prompts para personalización</div>
      {[
        {
          titulo: 'Actividades en tres niveles',
          texto: 'Diseña la actividad sobre [TEMA] para [GRADO] de [ÁREA] en tres niveles de complejidad:\n• Nivel de apoyo: más estructura, menos abstracción, acompañamiento paso a paso\n• Nivel esperado: competencia estándar del grado, autonomía moderada\n• Nivel desafiante: mayor profundidad, transferencia y creatividad\nCada versión debe lograr el mismo indicador de logro del MINERD.',
        },
        {
          titulo: 'Adecuaciones curriculares',
          texto: 'Sugiere adecuaciones curriculares para un estudiante con [NECESIDAD ESPECIAL: TDAH / dislexia / discapacidad visual / autismo / etc.] en [GRADO] de [ÁREA]. Incluye adecuaciones de acceso, metodológicas y de evaluación. Basado en el enfoque inclusivo del MINERD y el DUA (Diseño Universal para el Aprendizaje).',
        },
        {
          titulo: 'Estrategias para superdotación',
          texto: 'Diseña 5 estrategias de enriquecimiento curricular para un estudiante superdotado en [GRADO] de [ÁREA]. Las estrategias deben ir más allá del programa regular, promover el pensamiento creativo y crítico, y conectar con proyectos de impacto real en la comunidad.',
        },
      ].map((p, i) => (
        <div className="cia-prompt-card" key={i}>
          <p className="cia-prompt-title" style={{ marginBottom: 6 }}>{p.titulo}</p>
          <div className="cia-prompt-body">{p.texto}</div>
          <button className="cia-btn cia-btn-ghost" onClick={() => navigator.clipboard.writeText(p.texto)}>📋 Copiar</button>
        </div>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 10 · Ética y Responsabilidad
// ════════════════════════════════════════════════════════════════════════════
const PRINCIPIOS = [
  { title: 'Transparencia', desc: 'Informa a tus estudiantes y colegas cuando usas IA para crear materiales. La honestidad pedagógica es fundamental para mantener la confianza.' },
  { title: 'Revisión crítica', desc: 'Nunca compartas con los estudiantes un material generado por IA sin revisarlo primero. Verifica contenido, adecuación al grado y alineación curricular.' },
  { title: 'Privacidad de datos', desc: 'No ingreses nombres completos, números de identidad, datos de salud ni información sensible de tus estudiantes en herramientas de IA externas.' },
  { title: 'Equidad de acceso', desc: 'La IA no debe crear más desigualdad. Diseña con ella experiencias que sean accesibles para todos los estudiantes, incluidos los más vulnerables.' },
  { title: 'Respeto a la autoría', desc: 'Lo que genera la IA es un borrador que tú adaptas y validas. No lo presentes como producción científica o académica sin indicar el uso de IA.' },
  { title: 'Formación del criterio', desc: 'Enseña a tus estudiantes a usar la IA críticamente: a verificar información, identificar sesgos y no depender de ella para pensar.' },
  { title: 'Supervisión docente', desc: 'El docente mantiene siempre la responsabilidad pedagógica. La IA asiste, propone y genera — la decisión final es siempre tuya.' },
]

function SecEtica() {
  return (
    <div className="cia-section">
      <SH
        badge="🛡️ ÉTICA"
        title="Ética y Responsabilidad en el uso de IA"
        desc="Usar la IA con ética no es opcional — es parte del profesionalismo docente. Estos principios te guiarán hacia un uso responsable, transparente y pedagógicamente íntegro."
      />

      <Info tipo="red" icon="⚠️">
        <strong>Riesgo principal:</strong> La IA puede generar información incorrecta con total confianza.
        Siempre verifica con fuentes confiables (MINERD, libros de texto, expertos en el área) antes de
        usar cualquier contenido generado automáticamente con tus estudiantes.
      </Info>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24, marginBottom: 28 }}>
        {PRINCIPIOS.map((p, i) => (
          <div className="cia-principle" key={i}>
            <div className="cia-principle-num">{i + 1}</div>
            <div className="cia-principle-body">
              <p className="cia-principle-title">{p.title}</p>
              <p className="cia-principle-desc">{p.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="cia-section-label">¿Qué enseñarles a los estudiantes?</div>
      <ul className="cia-checklist">
        <li>La IA genera texto probable, no verdadero — siempre verificar con fuentes primarias.</li>
        <li>Presentar trabajo de IA como propio sin declararlo es deshonestidad académica.</li>
        <li>La IA puede tener sesgos culturales, de género o socioeconómicos — hay que analizarla críticamente.</li>
        <li>El pensamiento propio y la creatividad personal tienen un valor que ninguna IA puede reemplazar.</li>
        <li>Usar la IA para aprender más, no para pensar menos.</li>
      </ul>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 11 · Laboratorio IA
// ════════════════════════════════════════════════════════════════════════════
function SecLaboratorio() {
  const [prompt, setPrompt]   = useState('')
  const [output, setOutput]   = useState('')
  const [error,  setError]    = useState('')
  const [gen,    setGen]      = useState(false)
  const outputRef             = useRef('')
  const { contexto }          = useContextoDocente()

  const enviar = async () => {
    if (!prompt.trim() || gen) return
    setOutput('')
    setError('')
    setGen(true)
    outputRef.current = ''

    await llamarIALab(prompt.trim(), {
      onChunk:  (t) => { outputRef.current += t; setOutput(outputRef.current) },
      onFinish: () => setGen(false),
      onError:  (e) => { setError(e); setGen(false) },
    }, contexto)
  }

  const usarSug = (s) => {
    const texto = s.replace(/^[^\s]+ /, '')
    setPrompt(texto)
    setOutput('')
    setError('')
  }

  const limpiar = () => {
    setPrompt('')
    setOutput('')
    setError('')
    setGen(false)
  }

  return (
    <div className="cia-section">
      <SH
        badge="🧪 LABORATORIO"
        title="Laboratorio IA"
        desc="Espacio libre para experimentar con la IA. Escribe cualquier prompt pedagógico y obtén una respuesta generada por DocenteOS AI PRO en tiempo real."
      />

      <div className="cia-lab">
        <div className="cia-lab-top">
          <div className="cia-lab-dot cia-lab-dot-r" />
          <div className="cia-lab-dot cia-lab-dot-y" />
          <div className="cia-lab-dot cia-lab-dot-g" />
          <span className="cia-lab-top-title">DocenteOS AI PRO · Laboratorio</span>
        </div>
        <div className="cia-lab-body">
          <label className="cia-lab-label">Tu prompt pedagógico</label>
          <textarea
            className="cia-lab-textarea"
            placeholder="Escribe aquí tu petición... Por ejemplo: 'Crea 5 actividades para enseñar las fracciones a 4to grado de Primaria'"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviar() }}
          />
          <div className="cia-lab-actions">
            <button className="cia-lab-send" onClick={enviar} disabled={gen || !prompt.trim()}>
              {gen ? '⏳ Generando...' : '✦ Generar'}
            </button>
            <button className="cia-lab-clear" onClick={limpiar}>Limpiar</button>
            <span className="cia-lab-hint">Ctrl+Enter para enviar</span>
          </div>

          {(output || error || gen) && (
            <div className="cia-lab-output">
              <div className="cia-lab-output-label">
                ✦ Respuesta de DocenteOS AI PRO
                {output && !gen && (
                  <button
                    className="cia-btn cia-btn-ghost"
                    style={{ marginLeft: 'auto', fontSize: '0.73rem', padding: '3px 10px' }}
                    onClick={() => navigator.clipboard.writeText(output)}
                  >
                    📋 Copiar
                  </button>
                )}
              </div>
              {error
                ? <div className="cia-lab-error">{error}</div>
                : (
                  <div className="cia-lab-output-text">
                    {output}
                    {gen && <span className="cia-lab-cursor" />}
                    {!gen && !output && <span style={{ color: 'var(--cia-text-3)' }}>Iniciando...</span>}
                  </div>
                )
              }
            </div>
          )}
        </div>
      </div>

      {!output && !error && !gen && (
        <>
          <div className="cia-section-label">Sugerencias para empezar</div>
          <div className="cia-lab-sugerencias">
            {SUGERENCIAS_LAB.map((s, i) => (
              <button key={i} className="cia-lab-sug" onClick={() => usarSug(s)}>
                {s}
              </button>
            ))}
          </div>
        </>
      )}

      <hr className="cia-divider" />
      <Info tipo="amber" icon="💡">
        <strong>Recuerda:</strong> Siempre revisa el resultado antes de usarlo. La IA genera un borrador —
        tú lo ajustas con tu conocimiento del grupo, el currículo y el contexto de tu centro educativo.
      </Info>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 12 · Academia DocenteOS
// ════════════════════════════════════════════════════════════════════════════
function SecAcademia() {
  return (
    <div className="cia-section">
      <SH
        badge="🎓 ACADEMIA"
        title="Academia DocenteOS"
        desc="Cursos cortos para dominar la IA educativa paso a paso. Aprende a tu ritmo, obtén reconocimientos y conviértete en referente de innovación en tu centro educativo."
      />

      <Info tipo="blue" icon="🚀">
        <strong>Próximamente:</strong> La Academia DocenteOS lanzará sus primeros cursos interactivos
        con videolecciones, ejercicios prácticos y certificados digitales verificables.
        Los dos primeros ya están disponibles.
      </Info>

      <div className="cia-academia-grid" style={{ marginTop: 16 }}>
        {CURSOS.map(c => (
          <div className="cia-curso-card" key={c.id}>
            <div className="cia-curso-stripe" style={{ background: c.color }} />
            <div className="cia-curso-body">
              <span className="cia-curso-icon">{c.icon}</span>
              <p className="cia-curso-title">{c.titulo}</p>
              <p className="cia-curso-desc">{c.desc}</p>
              <div className="cia-curso-meta">
                <span className="cia-curso-tag">📚 {c.lecciones} lecciones</span>
                <span className="cia-curso-tag">⏱ {c.duracion}</span>
                <span className="cia-curso-tag" style={{ background: `${c.color}15`, color: c.color }}>{c.nivel}</span>
              </div>
              <div className="cia-curso-progress">
                <div className="cia-progress-bar">
                  <div className="cia-progress-fill" style={{ width: '0%', background: c.color }} />
                </div>
                <span className="cia-progress-label">0 de {c.lecciones} lecciones completadas</span>
              </div>
              <button className={`cia-curso-btn${c.disponible ? '' : ' proxim'}`}>
                {c.disponible ? '▶ Comenzar curso' : '🔒 Próximamente'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <hr className="cia-divider" />
      <div className="cia-section-label">Lo que obtendrás al completar la Academia</div>
      <ul className="cia-checklist">
        <li>Certificado digital de "Docente IA DocenteOS" verificable y descargable.</li>
        <li>Dominio práctico de 6 módulos de IA aplicados al aula dominicana.</li>
        <li>Banco personal de más de 50 prompts probados y refinados.</li>
        <li>Capacidad para replicar lo aprendido con colegas en tu centro educativo.</li>
        <li>Acceso prioritario a nuevos cursos y funciones del Centro IA Docente.</li>
      </ul>
    </div>
  )
}
