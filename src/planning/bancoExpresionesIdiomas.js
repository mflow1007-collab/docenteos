/**
 * Banco de Expresiones para Inglés y Francés — DocenteOS
 *
 * Clasificado por: momento, habilidad y función comunicativa.
 * La IA selecciona automáticamente usando diaNum para evitar repetición.
 *
 * Uso en las actividades: {expr_saludo}, {expr_despedida}, {expr_comprension},
 * {expr_speaking}, {expr_parejas}, {expr_pronunciacion}, {expr_vocabulario},
 * {expr_gramatica}, {expr_writing}, {expr_retroalimentacion},
 * {expr_listening_nombre}, {expr_listening_tarea}
 *
 * TAXONOMÍA DE LISTENING CON PROPÓSITO:
 * Dos clases consecutivas nunca repiten el mismo tipo de listening.
 * El tipo se selecciona por diaNum % 9.
 */

// ─── INGLÉS ───────────────────────────────────────────────────────────────────

const EN = {
  saludo: [
    "Good morning! How are you today? Are you ready for the class?",
    "Hello, everyone! How are you feeling today? Ready to practice English?",
    "Hi class! Great to see you! Are you all set for today?",
    "Good afternoon! How's everyone doing? Let's have an amazing class!",
    "Welcome back! How was your day? Ready to learn English?",
    "Hey there! Are you ready for an exciting English lesson today?",
    "Good morning! I hope you're all energized and ready to learn!",
  ],

  despedida: [
    "Goodbye! See you next class! Keep practicing your English!",
    "Great job today! You're getting better every day! See you next time!",
    "That's all for today! Don't forget to practice at home! Keep it up!",
    "Excellent work! English takes practice — keep going! See you soon!",
    "Amazing class today! You should be proud of your progress! Goodbye!",
    "Thank you for your effort today! The more you practice, the better you get! Goodbye!",
    "Wonderful session! Keep using English outside the classroom! See you next class!",
  ],

  instruccion_clase: [
    "Listen carefully and focus on the key words!",
    "Work with your partner! Take turns asking and answering.",
    "Read the text silently first, then we'll discuss together.",
    "Write your answers in complete sentences in your notebook.",
    "Repeat after me! First slowly, then at normal speed.",
    "Use the model on the board to help you create your own example.",
    "Let's do this step by step — follow along carefully!",
    "Take turns — one person talks, the other listens actively.",
    "Check your work and correct any mistakes before sharing.",
    "Use the vocabulary cards and your notes to support your answer.",
  ],

  comprension_listening: [
    "What did you hear? What is the topic? Which words do you recognize?",
    "Listen again. This time, focus only on the main idea. What is being talked about?",
    "What details did you catch? Think: Who? Where? What happened? When?",
    "Is there any word or expression you didn't understand? Let's guess from context!",
    "What is the mood or feeling in the audio? Happy? Worried? Surprised? How do you know?",
    "What's the purpose of this audio? To inform? To convince? To entertain?",
    "How did the speaker use their voice? What did the tone tell you?",
  ],

  comprension_reading: [
    "What is the main idea of the text? Find the key sentence that says it all.",
    "Read carefully. What facts or details support the main idea? Underline them.",
    "Is there a word you don't know? Use context clues to figure out the meaning.",
    "What can you infer from the text? What is the author's message between the lines?",
    "Compare what the text says with your own experience. Can you relate to this topic?",
    "What is the author's purpose — to inform, persuade, or entertain? How can you tell?",
    "Which part of the text surprised you most? Why?",
  ],

  speaking: [
    "What do you think about this topic? Give at least one reason for your answer.",
    "Do you agree or disagree with this idea? Explain your thinking clearly.",
    "Describe it to your partner using at least three specific details.",
    "Tell your classmate about a personal experience related to this topic.",
    "What would you do if you were in this situation? Explain your decision.",
    "Compare and contrast. Which option do you prefer and why?",
    "Give your opinion using: 'I think...', 'In my opinion...', 'I believe...'",
    "Ask your partner a follow-up question after their answer.",
  ],

  parejas: [
    "Turn to your partner and discuss! You have 2 minutes. Ready? Go!",
    "Ask and answer with your classmate! Take turns — one asks, one answers.",
    "Compare your answers with a partner. Do you agree? Where do you differ?",
    "Practice the dialogue with your partner. Then switch roles and try again!",
    "Work together on this challenge! Share your ideas and reach an agreement.",
    "Person A starts the conversation. Person B responds and continues. Switch after 1 minute.",
    "Give your partner two compliments and one suggestion to improve their answer.",
  ],

  pronunciacion: [
    "Listen to the difference: ... vs ... Can you hear the contrast? Repeat after me!",
    "Repeat after me slowly: ... Great! Now at normal speed!",
    "The stress is on the first/second syllable. Clap when you hear the stressed part!",
    "Try this minimal pair: ... / ... Which sound is different? Practice it!",
    "Say it with confidence! Open your mouth wide and project your voice.",
    "Exaggerate the sounds at first — that's how we train our mouth to form new sounds!",
  ],

  vocabulario: [
    "What does this word mean in context? Can you use it in your own sentence?",
    "Find a synonym or antonym for this word. Which fits better in this sentence?",
    "Add this word to your vocabulary notebook with: definition + example sentence + drawing.",
    "Look at the context surrounding this word. What do you think it means?",
    "Can you think of three real-life situations where you would use this word?",
    "Create a word web: write the word in the center and connect related words around it.",
    "Make a sentence with this word that describes something from your own life.",
  ],

  gramatica: [
    "Look at this sentence. What grammar rule is being used? How do we form this structure?",
    "Compare these two sentences. What's the difference? When do we use each one?",
    "Fill in the blank using the correct form. Think about the rule before you answer!",
    "Write your own sentence using this structure. Make it about your life — be creative!",
    "When do we use this grammar form? Think of at least three situations where it applies.",
    "Find the grammar mistake in this sentence and correct it. What rule did you apply?",
    "Transform this statement into a question and then into a negative form.",
  ],

  writing: [
    "Write 3-5 sentences about this topic using the vocabulary from today's class.",
    "Describe the topic using vivid details and specific adjectives. Make it come alive!",
    "Write a short paragraph: start with a topic sentence, add 2-3 details, close with a conclusion.",
    "Create a dialogue between two people discussing this topic. Use the structures we practiced.",
    "Write a short story with a beginning, a conflict, and a resolution. Use the target grammar.",
    "Write an email or message related to this topic using formal or informal register appropriately.",
    "Express your opinion in writing: state your position, give two reasons, and conclude.",
  ],

  retroalimentacion: [
    "Great effort! Let's look at it together and see how we can make it even stronger.",
    "You're on the right track! Just pay attention to the structure — let's fix it together.",
    "Excellent! That's a perfect example. Can you give us one more?",
    "Good attempt! Now think about the word order. What rule applies here?",
    "I love your creativity! The idea is great — let's just refine the grammar.",
    "You're improving every class! Notice how we use... in this type of sentence.",
    "That's correct! Now challenge yourself — can you make it more complex?",
  ],

  exit_ticket: [
    "What is the most important thing you learned today? Write one complete sentence.",
    "Complete this: 'Today I learned that... and I can use it when...'",
    "Write one thing you understood well and one question you still have.",
    "Explain today's main topic in 2 sentences, as if teaching a classmate who was absent.",
    "Which language structure from today would you use again? Write your own example.",
    "List three words you learned today and write a sentence using at least two of them.",
    "Write one thing that was easy today and one thing you want to practice more.",
  ],
};

// ─── FRANCÉS ──────────────────────────────────────────────────────────────────

const FR = {
  saludo: [
    "Bonjour ! Comment allez-vous aujourd'hui ? Êtes-vous prêts pour le cours ?",
    "Bonjour à tous ! Comment vous sentez-vous aujourd'hui ? Prêts à apprendre le français ?",
    "Bonjour ! Quelle belle journée pour apprendre ! Êtes-vous tous prêts ?",
    "Bon après-midi ! Comment ça va ? Commençons notre cours ensemble !",
    "Bienvenue ! Êtes-vous tous prêts pour l'aventure du français aujourd'hui ?",
    "Bonjour ! J'espère que vous êtes tous en forme et prêts à pratiquer !",
    "Salut tout le monde ! Comment s'est passée votre journée ? On commence !",
  ],

  despedida: [
    "Au revoir ! À la prochaine ! Continuez à pratiquer le français !",
    "Excellent travail aujourd'hui ! Vous progressez vraiment ! À bientôt !",
    "C'est tout pour aujourd'hui ! N'oubliez pas de pratiquer à la maison ! Au revoir !",
    "Très bien ! Continuez comme ça ! Le français, c'est magnifique ! À la prochaine !",
    "Bravo pour vos efforts ! Chaque classe vous rapproche de la maîtrise ! Bonne journée !",
    "Merci pour votre participation ! Plus vous pratiquez, mieux vous parlez ! À bientôt !",
    "Fantastique ! Je suis fier/fière de vos progrès ! À la prochaine classe !",
  ],

  instruccion_clase: [
    "Écoutez attentivement et concentrez-vous sur les mots clés !",
    "Travaillez avec votre partenaire ! Prenez chacun votre tour.",
    "Lisez le texte en silence d'abord, puis nous allons discuter ensemble.",
    "Écrivez vos réponses en phrases complètes dans votre cahier.",
    "Répétez après moi ! D'abord lentement, puis à vitesse normale.",
    "Utilisez le modèle au tableau pour créer votre propre exemple.",
    "Faisons cela étape par étape — suivez bien !",
    "À tour de rôle — une personne parle, l'autre écoute activement.",
    "Vérifiez votre travail et corrigez les erreurs avant de partager.",
    "Utilisez vos notes et le vocabulaire du tableau pour vous aider.",
  ],

  comprension_listening: [
    "Qu'est-ce que vous avez entendu ? Quel est le sujet ? Quels mots reconnaissez-vous ?",
    "Écoutez encore. Cette fois, concentrez-vous sur l'idée principale. De quoi parle-t-on ?",
    "Quels détails avez-vous compris ? Pensez à : Qui ? Où ? Que s'est-il passé ? Quand ?",
    "Y a-t-il un mot ou une expression que vous n'avez pas compris ? Devinons ensemble !",
    "Quelle est l'ambiance dans l'audio ? Joyeux ? Inquiet ? Surpris ? Comment le savez-vous ?",
    "Quel est le but de cet audio ? Informer ? Convaincre ? Divertir ?",
  ],

  comprension_reading: [
    "Quelle est l'idée principale du texte ? Trouvez la phrase clé qui résume tout.",
    "Lisez attentivement. Quels faits ou détails soutiennent l'idée principale ? Soulignez-les.",
    "Y a-t-il un mot inconnu ? Utilisez le contexte pour deviner le sens.",
    "Que pouvez-vous déduire du texte ? Quel est le message de l'auteur entre les lignes ?",
    "Quel est le but de l'auteur — informer, persuader ou divertir ? Comment le savez-vous ?",
    "Quelle partie du texte vous a le plus surpris(e) ? Pourquoi ?",
  ],

  speaking: [
    "Que pensez-vous de ce sujet ? Donnez au moins une raison pour votre réponse.",
    "Êtes-vous d'accord ou pas d'accord avec cette idée ? Expliquez votre raisonnement.",
    "Décrivez-le à votre camarade en utilisant au moins trois détails spécifiques.",
    "Racontez à votre camarade une expérience personnelle liée à ce sujet.",
    "Que feriez-vous si vous étiez dans cette situation ? Expliquez votre décision.",
    "Comparez et contrastez. Quelle option préférez-vous et pourquoi ?",
    "Donnez votre opinion en utilisant : 'Je pense que...', 'À mon avis...', 'Je crois que...'",
  ],

  parejas: [
    "Tournez-vous vers votre camarade et discutez ! Vous avez 2 minutes. Allez !",
    "Posez des questions à votre camarade ! À tour de rôle — l'un pose, l'autre répond.",
    "Comparez vos réponses avec un camarade. Êtes-vous d'accord ? Où diffèrez-vous ?",
    "Pratiquez le dialogue avec votre partenaire. Puis changez les rôles et recommencez !",
    "Travaillez ensemble sur ce défi ! Partagez vos idées et trouvez un accord.",
    "La personne A commence la conversation. La personne B répond et continue. Changez après 1 minute.",
  ],

  pronunciacion: [
    "Écoutez la différence : ... vs ... Vous entendez le contraste ? Répétez après moi !",
    "Répétez après moi lentement : ... Très bien ! Maintenant à vitesse normale !",
    "L'accent est sur la première/deuxième syllabe. Frappez dans vos mains sur la syllabe accentuée !",
    "Dites-le avec confiance ! Ouvrez bien la bouche et projetez votre voix.",
    "Exagérez les sons au début — c'est ainsi qu'on entraîne notre bouche à de nouveaux sons !",
  ],

  vocabulario: [
    "Que signifie ce mot en contexte ? Pouvez-vous l'utiliser dans votre propre phrase ?",
    "Trouvez un synonyme ou un antonyme pour ce mot. Lequel convient mieux dans cette phrase ?",
    "Ajoutez ce mot à votre cahier de vocabulaire : définition + phrase d'exemple + dessin.",
    "Regardez le contexte autour de ce mot. Que pensez-vous qu'il signifie ?",
    "Pouvez-vous penser à trois situations de la vie réelle où vous utiliseriez ce mot ?",
    "Créez une carte mentale : écrivez le mot au centre et connectez les mots associés.",
  ],

  gramatica: [
    "Regardez cette phrase. Quelle règle grammaticale est utilisée ? Comment forme-t-on cette structure ?",
    "Comparez ces deux phrases. Quelle est la différence ? Quand utilise-t-on chacune ?",
    "Remplissez le blanc en utilisant la bonne forme. Pensez à la règle avant de répondre !",
    "Écrivez votre propre phrase avec cette structure. Parlez de votre vie — soyez créatif(ve) !",
    "Quand utilise-t-on cette forme grammaticale ? Pensez à au moins trois situations.",
    "Trouvez la faute de grammaire dans cette phrase et corrigez-la. Quelle règle avez-vous appliquée ?",
  ],

  writing: [
    "Écrivez 3-5 phrases sur ce sujet en utilisant le vocabulaire étudié aujourd'hui.",
    "Décrivez le sujet avec des détails précis et des adjectifs spécifiques. Faites-le vivre !",
    "Écrivez un court paragraphe : commencez par une phrase sujet, ajoutez 2-3 détails, concluez.",
    "Créez un dialogue entre deux personnes qui discutent de ce sujet. Utilisez les structures pratiquées.",
    "Écrivez une courte histoire avec un début, un conflit et une résolution.",
    "Exprimez votre opinion par écrit : présentez votre position, donnez deux raisons, concluez.",
  ],

  retroalimentacion: [
    "Excellent effort ! Regardons cela ensemble pour voir comment l'améliorer encore plus.",
    "Vous êtes sur la bonne voie ! Faites juste attention à la structure — corrigeons-la ensemble.",
    "Excellent ! C'est un exemple parfait. Pouvez-vous nous en donner un autre ?",
    "Bonne tentative ! Maintenant, pensez à l'ordre des mots. Quelle règle s'applique ici ?",
    "J'aime votre créativité ! L'idée est géniale — peaufinons juste la grammaire.",
    "Vous progressez à chaque cours ! Remarquez comment on utilise... dans ce type de phrase.",
    "C'est correct ! Maintenant, défiez-vous — pouvez-vous rendre la phrase plus complexe ?",
  ],

  exit_ticket: [
    "Qu'est-ce que la chose la plus importante que vous avez apprise aujourd'hui ? Écrivez une phrase complète.",
    "Complétez : 'Aujourd'hui j'ai appris que... et je peux l'utiliser quand...'",
    "Écrivez une chose que vous avez bien comprise et une question que vous avez encore.",
    "Expliquez le sujet principal d'aujourd'hui en 2 phrases, comme si vous l'enseigniez à un camarade absent.",
    "Quelle structure de langue d'aujourd'hui réutiliseriez-vous ? Écrivez votre propre exemple.",
    "Listez trois mots appris aujourd'hui et écrivez une phrase en utilisant au moins deux d'entre eux.",
    "Écrivez une chose facile aujourd'hui et une chose que vous voulez pratiquer davantage.",
  ],
};

// ─── TAXONOMÍA DE LISTENING CON PROPÓSITO ────────────────────────────────────
// diaNum % 9 selecciona el tipo. Nunca se repite en clases consecutivas.

const LISTENING_EN = [
  { nombre: "Listen and Act",      tarea: "As you listen, respond physically: point to the image, mime the action, or raise your hand when you hear the key word." },
  { nombre: "Listen and Decide",   tarea: "Listen carefully. Write T (True) or F (False) for each statement. Be ready to justify your answer." },
  { nombre: "Listen and Compare",  tarea: "Listen and find similarities and differences with your own experience. Use a T-chart: 'Same / Different'." },
  { nombre: "Listen and Solve",    tarea: "Listen for the clues you need to solve the problem. Write down the key information as you hear it." },
  { nombre: "Listen and Complete", tarea: "Listen and fill in the gaps in the text. Write exactly what you hear in each blank." },
  { nombre: "Listen and Evaluate", tarea: "Listen and use the mini-rubric to evaluate what you hear. Check: content, structure, and clarity." },
  { nombre: "Listen and Create",   tarea: "After listening, use the ideas and language you heard to create your own version. Be inspired, not a copy!" },
  { nombre: "Listen and Organize", tarea: "Listen and put the events, steps, or ideas in the correct order. Number them as you go." },
  { nombre: "Listen and Choose",   tarea: "Listen and circle or underline the correct option from the choices given. Only one is correct!" },
];

const LISTENING_FR = [
  { nombre: "Écoutez et Agissez",  tarea: "En écoutant, répondez physiquement : montrez l'image, mimez l'action, ou levez la main quand vous entendez le mot clé." },
  { nombre: "Écoutez et Décidez",  tarea: "Écoutez attentivement. Écrivez V (Vrai) ou F (Faux) pour chaque affirmation. Soyez prêts à justifier." },
  { nombre: "Écoutez et Comparez", tarea: "Écoutez et trouvez les ressemblances et différences avec votre expérience. Utilisez un T-chart : 'Pareil / Différent'." },
  { nombre: "Écoutez et Résolvez", tarea: "Écoutez pour trouver les indices nécessaires pour résoudre le problème. Notez les informations clés." },
  { nombre: "Écoutez et Complétez",tarea: "Écoutez et remplissez les blancs dans le texte. Écrivez exactement ce que vous entendez." },
  { nombre: "Écoutez et Évaluez", tarea: "Écoutez et utilisez la mini-grille pour évaluer ce que vous entendez. Vérifiez : contenu, structure et clarté." },
  { nombre: "Écoutez et Créez",   tarea: "Après avoir écouté, utilisez les idées et la langue entendues pour créer votre propre version." },
  { nombre: "Écoutez et Organisez",tarea: "Écoutez et mettez les événements, étapes ou idées dans le bon ordre. Numérotez-les au fur et à mesure." },
  { nombre: "Écoutez et Choisissez",tarea: "Écoutez et entourez la bonne option parmi les choix donnés. Une seule est correcte !" },
];

// ─── Selector con variación por diaNum ────────────────────────────────────────

const BANCOS = { en: EN, fr: FR };
const LISTENING = { en: LISTENING_EN, fr: LISTENING_FR };

const expr = (lang, categoria, diaNum = 0) => {
  const banco = BANCOS[lang];
  if (!banco) return "";
  const lista = banco[categoria];
  if (!lista || lista.length === 0) return "";
  return lista[diaNum % lista.length];
};

// Marcadores usados en las actividades: {expr_XXX}
// Listening: {expr_listening_nombre} → "Listen and Decide"
//            {expr_listening_tarea}  → instrucción cognitiva completa
// Exit ticket: {expr_exit_ticket}   → pregunta metacognitiva específica

export const inyectarExpresiones = (actividades, diaNum = 0, lang = "en") => {
  const lstBanco = LISTENING[lang] || LISTENING.en;
  const lstAct = lstBanco[diaNum % lstBanco.length];

  return actividades.map((act) =>
    act
      .replace(/\{expr_saludo\}/g,                  expr(lang, "saludo",                  diaNum))
      .replace(/\{expr_despedida\}/g,               expr(lang, "despedida",               diaNum))
      .replace(/\{expr_instruccion\}/g,             expr(lang, "instruccion_clase",        diaNum))
      .replace(/\{expr_comprension_listening\}/g,   expr(lang, "comprension_listening",    diaNum))
      .replace(/\{expr_comprension_reading\}/g,     expr(lang, "comprension_reading",      diaNum))
      .replace(/\{expr_speaking\}/g,                expr(lang, "speaking",                 diaNum))
      .replace(/\{expr_parejas\}/g,                 expr(lang, "parejas",                  diaNum))
      .replace(/\{expr_pronunciacion\}/g,           expr(lang, "pronunciacion",             diaNum))
      .replace(/\{expr_vocabulario\}/g,             expr(lang, "vocabulario",              diaNum))
      .replace(/\{expr_gramatica\}/g,               expr(lang, "gramatica",                diaNum))
      .replace(/\{expr_writing\}/g,                 expr(lang, "writing",                  diaNum))
      .replace(/\{expr_retroalimentacion\}/g,       expr(lang, "retroalimentacion",        diaNum))
      .replace(/\{expr_listening_nombre\}/g,        lstAct.nombre)
      .replace(/\{expr_listening_tarea\}/g,         lstAct.tarea)
      .replace(/\{expr_exit_ticket\}/g,             expr(lang, "exit_ticket",              diaNum))
  );
};
