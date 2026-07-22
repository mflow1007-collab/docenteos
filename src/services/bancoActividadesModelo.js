/**
 * bancoActividadesModelo.js — Semilla del Banco Pedagógico
 *
 * QUÉ ES: catálogo de actividades con MECÁNICA REAL extraídas VERBATIM de los
 * documentos modelo del dueño (unidades "My Life and Daily Routines" y
 * "People Around Me"). Son las actividades con nombre y procedimiento propio
 * —Frequency Walk, Interview Stations, My Daily Vlog, Gallery Walk Passport…—
 * que distinguen una planificación rica de una plantilla genérica.
 *
 * PARA QUÉ: sembrar `bp_actividades` una vez, marcadas `official`, para que el
 * generador (unidadAprendizajeService → elegirActividadBanco) las sirva sin
 * gastar créditos de IA. El dueño valida el resultado contra su modelo.
 *
 * NO inventa: cada actividad es copia fiel de la mecánica del documento del
 * dueño. Al ampliar el catálogo, agregar SOLO actividades ya vistas en un
 * documento validado, nunca variaciones inventadas.
 *
 * USO (una sola vez, desde consola de admin o script):
 *   import { sembrarActividadesModelo } from './bancoActividadesModelo.js';
 *   await sembrarActividadesModelo(userId);
 */

import { getActividades, createActividad } from './bancoPedagogicoService.js';

// Cada actividad: instrucciones VERBATIM del documento modelo. `temas` y
// `habilidades` son las SEÑALES que el matcher usa para emparejar con el día
// (deben reflejar la estructura/tema que trabaja la actividad).
export const ACTIVIDADES_MODELO = [
  // ── Adverbios de frecuencia · hábitos saludables ──────────────────────────
  {
    titulo: 'Frequency Walk',
    tipo: 'Speaking',
    momento: 'Desarrollo',
    area: 'Lenguas Extranjeras',
    grados: ['2do Secundaria'],
    temas: ['hábitos saludables', 'frecuencia', 'rutinas', 'adverbios de frecuencia'],
    habilidades: ['frecuencia', 'always', 'usually', 'sometimes', 'never', 'presente simple'],
    estrategia: 'Aprendizaje kinestésico · indagación dialógica',
    competencia: 'Comunicativa',
    instrucciones: [
      'Descubren el uso de los adverbios de frecuencia mediante ejemplos contextualizados sobre hábitos saludables, relacionando always, usually, sometimes, rarely y never con prácticas reales de cuidado personal (I always wash my hands. I usually eat fruit. I sometimes go to bed late.).',
      'Participan en la actividad Frequency Walk desplazándose por diferentes zonas del aula según la frecuencia con la que realizan determinadas acciones.',
      'Comparan respuestas y comentan semejanzas y diferencias entre sus rutinas.',
    ],
    duracion: 30,
  },
  // ── WH-questions · tercera persona · rutinas escolares/familiares ─────────
  {
    titulo: 'Interview Stations (Family & Routines)',
    tipo: 'Speaking',
    momento: 'Desarrollo',
    area: 'Lenguas Extranjeras',
    grados: ['2do Secundaria'],
    temas: ['rutinas familiares', 'rutinas escolares', 'entrevista', 'WH-questions'],
    habilidades: ['WH-questions', 'tercera persona', 'he', 'she', 'presente simple', 'preguntar'],
    estrategia: 'Interview Stations · indagación dialógica',
    competencia: 'Comunicativa',
    instrucciones: [
      'Descubren las WH-questions en tercera persona a partir de ejemplos (What does your sister do after school? When does your grandmother get up?).',
      'Se organizan estaciones de entrevista; los estudiantes rotan, entrevistan a un compañero (What does your mother do? How often do you help at home?) y anotan la respuesta en cada estación.',
      'Con la información de las estaciones, redactan oraciones descriptivas usando la tercera persona del singular para presentar a su compañero y su familia.',
    ],
    duracion: 30,
  },
  // ── Conectores de secuencia · narrar la rutina ────────────────────────────
  {
    titulo: 'My Daily Vlog',
    tipo: 'Speaking',
    momento: 'Desarrollo',
    area: 'Lenguas Extranjeras',
    grados: ['2do Secundaria'],
    temas: ['rutina diaria', 'secuencia', 'conectores', 'narración'],
    habilidades: ['conectores', 'first', 'then', 'after that', 'finally', 'secuencia', 'presente simple'],
    estrategia: 'Juego de roles · producción oral',
    competencia: 'Comunicativa',
    instrucciones: [
      'Escuchan a un estudiante narrar su día y completan los conectores y verbos que faltan en un texto-hueco (Listen and Complete).',
      'Role Play "My Daily Vlog": en parejas, uno narra su rutina como vlogger usando conectores (first, then, after that, finally) y el otro, como público, hace una pregunta al final.',
      'Redactan el primer borrador de su párrafo de rutina, lo intercambian con un compañero y lo mejoran con la sugerencia recibida ("una estrella y un deseo").',
    ],
    duracion: 30,
  },
  // ── Should/shouldn't · consejos de hábitos saludables ─────────────────────
  {
    titulo: 'Healthy Habits Interview Stations',
    tipo: 'Speaking',
    momento: 'Desarrollo',
    area: 'Lenguas Extranjeras',
    grados: ['2do Secundaria'],
    temas: ['hábitos saludables', 'consejos', 'salud', 'recomendaciones'],
    habilidades: ['should', 'shouldn\'t', 'consejos', 'aconsejar', 'recomendar'],
    estrategia: 'Interview Stations · indagación dialógica',
    competencia: 'Resolución de Problemas',
    instrucciones: [
      'Participan en Listen and Solve: escuchan el caso de un estudiante con una rutina poco saludable y, en grupos, proponen tres consejos con should/shouldn\'t para resolver su problema.',
      'Interview Stations: se organizan tres estaciones (Sleep, Food, Exercise). Los estudiantes rotan, entrevistan a un compañero (How many hours do you sleep? What do you eat for breakfast?) y anotan un consejo en cada estación.',
      'Con la información de las estaciones, redactan una Healthy Habits List con cuatro consejos y eligen el mejor consejo de cada compañero.',
    ],
    duracion: 30,
  },
  // ── Posesivo 's · pronombres · descripción de posesiones ──────────────────
  {
    titulo: "Who Owns This? (Mystery Box)",
    tipo: 'Speaking',
    momento: 'Desarrollo',
    area: 'Lenguas Extranjeras',
    grados: ['2do Secundaria'],
    temas: ['posesivos', 'pronombres posesivos', 'posesiones', 'relaciones humanas'],
    habilidades: ['posesivo', 'mine', 'yours', 'his', 'hers', 'pronombres posesivos'],
    estrategia: 'Exploración guiada · aprendizaje colaborativo',
    competencia: 'Comunicativa',
    instrucciones: [
      'Escuchan una conversación breve y enumeran los objetos mencionados, identificando a quién pertenecen usando mine, yours, his, hers (Listen and Identify).',
      'Descubren el uso de los pronombres posesivos analizando ejemplos sencillos (Is this pen yours? No, it\'s his.), conectándolos con situaciones cotidianas.',
      'Realizan la actividad "Who owns this?" en parejas: describen objetos encontrados en una caja misteriosa usando pronombres posesivos y justifican su elección.',
    ],
    duracion: 30,
  },
  // ── Pronombres objeto · dramatización ─────────────────────────────────────
  {
    titulo: 'Mini Drama (Object Pronouns)',
    tipo: 'Role Play',
    momento: 'Desarrollo',
    area: 'Lenguas Extranjeras',
    grados: ['2do Secundaria'],
    temas: ['pronombres objeto', 'relaciones cotidianas', 'interacción'],
    habilidades: ['pronombres objeto', 'me', 'her', 'them', 'dramatización'],
    estrategia: 'Aprendizaje colaborativo · dramatización',
    competencia: 'Comunicativa',
    instrucciones: [
      'Escuchan instrucciones con pronombres objeto y responden con mímica para mostrar comprensión (Listen and Act).',
      'Descubren ejemplos de uso de pronombres objeto en oraciones cotidianas (She gave it to me.).',
      'Realizan un "Mini Drama": en parejas, crean un breve drama cotidiano usando pronombres objeto y lo socializan en un Speaking Circle, revisando el uso correcto antes de guardarlo.',
    ],
    duracion: 30,
  },
  // ── Question tags · confirmar en conversación ─────────────────────────────
  {
    titulo: 'Daily Chat (Question Tags)',
    tipo: 'Speaking',
    momento: 'Desarrollo',
    area: 'Lenguas Extranjeras',
    grados: ['2do Secundaria'],
    temas: ['question tags', 'rutinas diarias', 'entrevista', 'conversación'],
    habilidades: ['question tags', 'confirmar', 'entrevista'],
    estrategia: 'Recuperación de experiencias previas · socialización',
    competencia: 'Comunicativa',
    instrucciones: [
      'Escuchan diálogos donde se usan question tags para confirmar afirmaciones y discuten sus usos (Listen and Validate).',
      'Examinan ejemplos de question tags contextualizados (You speak English, don\'t you? / She isn\'t coming today, is she?) y discuten cómo se forman.',
      'Realizan entrevistas en parejas ("Daily Chat") sobre sus rutinas diarias, incorporando question tags para confirmar comprensión y empatía.',
    ],
    duracion: 30,
  },
  // ── Comparar rutinas · and/but + should ───────────────────────────────────
  {
    titulo: 'Healthy Family (Compare & Advise)',
    tipo: 'Speaking',
    momento: 'Desarrollo',
    area: 'Lenguas Extranjeras',
    grados: ['2do Secundaria'],
    temas: ['comparar rutinas', 'hábitos saludables', 'familia', 'salud'],
    habilidades: ['and', 'but', 'comparar', 'should', 'recomendar'],
    estrategia: 'Juego de roles · indagación dialógica',
    competencia: 'Pensamiento Lógico, Creativo y Crítico',
    instrucciones: [
      'Escuchan a jóvenes describir sus rutinas familiares y completan un cuadro de semejanzas y diferencias; descubren cómo comparar con and/but (I have breakfast at 6:00, but my sister has breakfast at 7:00.) (Listen and Compare).',
      'Misión en parejas (juego de roles "Healthy Family"): comparan sus hábitos y se dan recomendaciones con should (You should sleep more. Your family should eat more fruits.).',
      'Redactan un párrafo comparando su rutina con la de un familiar e incluyen una recomendación saludable, y lo comparten ante el grupo.',
    ],
    duracion: 30,
  },
  // ── Presentación personal · verb to be (apropiación / Fase 1) ──────────────
  {
    titulo: 'Two Truths and a Lie',
    tipo: 'Speaking',
    momento: 'Desarrollo',
    area: 'Lenguas Extranjeras',
    grados: ['2do Secundaria'],
    temas: ['presentación personal', 'rutinas', 'identificación personal'],
    habilidades: ['verb to be', 'presente simple', 'presentarse', 'preguntar'],
    estrategia: 'Aprendizaje colaborativo · indagación dialógica',
    competencia: 'Comunicativa',
    instrucciones: [
      'Preparan tres oraciones sobre sí mismos: dos verdaderas y una falsa (I wake up at 6 a.m. / I have a dog / I never eat breakfast).',
      'Juegan "Two Truths and a Lie" en parejas o grupos: leen sus oraciones en voz alta y los demás deciden cuál es la mentira.',
      'Justifican su elección haciendo preguntas de seguimiento (Do you really wake up at 6?) antes de intercambiar los roles.',
    ],
    duracion: 30,
  },
  // ── Verbos de acción · presente simple (mímica) ───────────────────────────
  {
    titulo: 'Charades of Routines',
    tipo: 'Speaking',
    momento: 'Desarrollo',
    area: 'Lenguas Extranjeras',
    grados: ['2do Secundaria'],
    temas: ['rutinas diarias', 'verbos de acción', 'actividades cotidianas'],
    habilidades: ['presente simple', 'verbos de acción', 'tercera persona'],
    estrategia: 'Aprendizaje kinestésico · descubrimiento e indagación',
    competencia: 'Comunicativa',
    instrucciones: [
      'Representan con mímica una acción de su rutina diaria (brush teeth, take a shower, do homework) sin hablar, mientras los demás observan (Charades).',
      'Adivinan la acción en inglés y construyen la oración completa en tercera persona (He brushes his teeth.).',
      'Rotan los turnos para que todos representen y adivinen, ampliando el banco de verbos de la rutina.',
    ],
    duracion: 30,
  },
  // ── Adverbios de frecuencia · preguntar (mingle) ──────────────────────────
  {
    titulo: 'Find Someone Who',
    tipo: 'Speaking',
    momento: 'Desarrollo',
    area: 'Lenguas Extranjeras',
    grados: ['2do Secundaria'],
    temas: ['rutinas diarias', 'frecuencia', 'hábitos', 'adverbios de frecuencia'],
    habilidades: ['frecuencia', 'preguntar', 'Do you', 'presente simple', 'always', 'usually', 'never'],
    estrategia: 'Aprendizaje cooperativo · indagación dialógica',
    competencia: 'Comunicativa',
    instrucciones: [
      'Reciben una hoja con acciones de la rutina (gets up early, eats breakfast, exercises on weekends) y una consigna de búsqueda.',
      'Circulan por el aula preguntando "Do you wake up before 6 a.m.?" y anotan el nombre del primer compañero que responde "Yes, I do" (Find Someone Who…).',
      'Comparten en grupos qué actividades resultaron más comunes y cuáles menos frecuentes entre sus compañeros.',
    ],
    duracion: 30,
  },
  // ── Presente simple · WH-questions (Information Gap) ───────────────────────
  {
    titulo: 'Information Gap: Morning Routine',
    tipo: 'Speaking',
    momento: 'Desarrollo',
    area: 'Lenguas Extranjeras',
    grados: ['2do Secundaria'],
    temas: ['rutina matutina', 'rutinas diarias', 'información incompleta'],
    habilidades: ['presente simple', 'WH-questions', 'What time', 'preguntar', 'tercera persona'],
    estrategia: 'Aprendizaje cooperativo · práctica guiada',
    competencia: 'Comunicativa',
    instrucciones: [
      'Reciben una tarjeta con la rutina matutina incompleta de un personaje (Anna, Mark) sin mostrarla al compañero (Information Gap).',
      'Preguntan al compañero para completar la información que les falta (What time does Anna wake up? What does Mark do after breakfast?).',
      'Verifican juntos que ambas rutinas quedaron completas y correctas antes de socializar sus resultados.',
    ],
    duracion: 30,
  },
  // ── Comparación cultural · conectores de contraste (Jigsaw) ────────────────
  {
    titulo: 'Jigsaw Reading: Routines in Other Countries',
    tipo: 'Reading',
    momento: 'Desarrollo',
    area: 'Lenguas Extranjeras',
    grados: ['2do Secundaria'],
    temas: ['comparación cultural', 'rutinas de otros países', 'rutinas diarias'],
    habilidades: ['comparar', 'but', 'however', 'while', 'conectores de contraste', 'presente simple'],
    estrategia: 'Aprendizaje cooperativo (Jigsaw) · comparación cultural',
    competencia: 'Ética y Ciudadana',
    instrucciones: [
      'Se dividen en grupos y cada grupo lee un texto corto sobre la rutina de un adolescente de un país anglófono (Sam — USA, Lily — UK, Jack — Australia), identificando 5 datos clave (Jigsaw Reading).',
      'Se reorganizan en grupos mixtos con un "experto" de cada país que comparte lo que aprendió de su texto.',
      'Completan una tabla comparativa (Mi rutina / USA / UK / Australia) y comentan la diferencia más sorprendente usando conectores de contraste (but, however, while).',
    ],
    duracion: 30,
  },
  // ── Conectores de secuencia · narrar el día (Vlog Script) ──────────────────
  {
    titulo: 'A Day in My Life (Vlog Script)',
    tipo: 'Writing',
    momento: 'Desarrollo',
    area: 'Lenguas Extranjeras',
    grados: ['2do Secundaria'],
    temas: ['rutina diaria', 'narración del día', 'secuencia'],
    habilidades: ['conectores', 'first', 'then', 'after that', 'finally', 'secuencia', 'presente simple'],
    estrategia: 'Aprendizaje basado en tareas · producción escrita',
    competencia: 'Pensamiento Lógico, Creativo y Crítico',
    instrucciones: [
      'Analizan la estructura de un vlog modelo: apertura (Hi guys! Welcome to my channel), secciones por momentos del día y cierre.',
      'Completan una plantilla de cinco secciones (Intro, Morning, School, Afternoon, Evening) con dos oraciones cada una, usando conectores de secuencia (first, then, after that, finally).',
      'Ensayan el guion en parejas dándose retroalimentación sobre pronunciación y uso de conectores antes de leerlo al grupo.',
    ],
    duracion: 30,
  },
  // ── Repaso de vocabulario de rutinas (cierre / integración) ────────────────
  {
    titulo: 'Routine Bingo',
    tipo: 'Vocabulary',
    momento: 'Desarrollo',
    area: 'Lenguas Extranjeras',
    grados: ['2do Secundaria'],
    temas: ['rutinas diarias', 'repaso de vocabulario', 'cierre de unidad'],
    habilidades: ['vocabulario de rutinas', 'presente simple', 'escucha con propósito'],
    estrategia: 'Aprendizaje lúdico · integración',
    competencia: 'Comunicativa',
    instrucciones: [
      'Reciben un cartón de bingo con acciones de la rutina diaria distribuidas en la cuadrícula (Routine Bingo).',
      'Escuchan al docente leer oraciones (She goes to bed at 10 p.m.) y marcan la acción correspondiente en su cartón.',
      'El primero en completar una línea comparte sus acciones en voz alta usando oraciones completas.',
    ],
    duracion: 30,
  },
];

/**
 * Siembra las actividades del modelo en bp_actividades, marcadas `official`.
 * Idempotente: no duplica una actividad cuyo título ya exista en el banco.
 * Devuelve { creadas, omitidas }.
 */
export const sembrarActividadesModelo = async (userId) => {
  const existentes = await getActividades({ area: 'Lenguas Extranjeras' });
  const titulosExistentes = new Set(
    existentes.map((a) => String(a.titulo || '').trim().toLowerCase())
  );
  let creadas = 0;
  let omitidas = 0;
  for (const act of ACTIVIDADES_MODELO) {
    const clave = act.titulo.trim().toLowerCase();
    if (titulosExistentes.has(clave)) { omitidas += 1; continue; }
    await createActividad({ ...act, estado: 'official' }, userId);
    creadas += 1;
  }
  return { creadas, omitidas, total: ACTIVIDADES_MODELO.length };
};
