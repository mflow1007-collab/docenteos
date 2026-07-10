import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, doc, getCountFromServer, getDoc, getDocs, limit, query, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../firebase.js'
import { AIService } from '../../services/ai/AIService.js'
import { PROVIDER_META } from '../../services/ai/providers/index.js'
import { attachJsonToSource, validateJsonSobre } from '../../services/bancoConocimientoService.js'

const OPERADORES = [
  { id: 'auto', label: 'Automático', hint: 'DocenteOS decide la ruta por tipo de trabajo.' },
  { id: 'openai', label: 'OpenAI', hint: 'Buen equilibrio para código, JSON, análisis y síntesis.' },
  { id: 'anthropic', label: 'Anthropic', hint: 'Fuerte en auditoría larga, arquitectura y razonamiento pedagógico.' },
  { id: 'gemini', label: 'Gemini', hint: 'Rápido para exploración, reescritura y síntesis extensa.' },
  { id: 'abacus', label: 'Abacus', hint: 'RouteLLM para enrutar automáticamente a modelos disponibles.' },
  { id: 'nvidia', label: 'NVIDIA NIM', hint: 'Modelos abiertos potentes para razonamiento y tareas técnicas.' },
]

const TIPOS_TRABAJO = [
  {
    id: 'arquitectura',
    nombre: 'Arquitectura DocenteOS',
    orden: ['anthropic', 'openai', 'gemini', 'nvidia', 'abacus'],
    descripcion: 'Diagnóstico técnico, refactor, decisiones de sistema y auditorías de flujo.',
  },
  {
    id: 'curriculo',
    nombre: 'Currículo MINERD',
    orden: ['anthropic', 'openai', 'gemini', 'abacus', 'nvidia'],
    descripcion: 'Mallas, banco de conocimiento, validación curricular y estructura pedagógica.',
  },
  {
    id: 'codigo',
    nombre: 'Código y debugging',
    orden: ['openai', 'anthropic', 'nvidia', 'gemini', 'abacus'],
    descripcion: 'Implementación, revisión de errores, organización de archivos y refactor seguro.',
  },
  {
    id: 'json',
    nombre: 'JSON y datos',
    orden: ['openai', 'gemini', 'anthropic', 'abacus', 'nvidia'],
    descripcion: 'Transformación, validación estricta, limpieza y comparación de estructuras.',
  },
  {
    id: 'redaccion',
    nombre: 'Redacción pedagógica',
    orden: ['gemini', 'anthropic', 'openai', 'abacus', 'nvidia'],
    descripcion: 'Mejora de textos, instrucciones, metacognición, recursos y comunicación docente.',
  },
]

const MODOS = [
  { id: 'auto', nombre: 'Ruta inteligente', desc: 'Usa el orden recomendado por el tipo de trabajo.' },
  { id: 'manual', nombre: 'Operador único', desc: 'Fuerza un proveedor específico para esta tarea.' },
  { id: 'mesa', nombre: 'Mesa completa', desc: 'Consulta varios operadores y genera una síntesis final.' },
]

const LIMITES_MESA = 5

const BANCOS_MONITOREO = [
  { id: 'knowledgeSources', nombre: 'Banco de Conocimiento', riesgo: 'Fuente visible de mallas, registros y documentos oficiales.' },
  { id: 'curricularContent', nombre: 'Contenido Curricular Interno', riesgo: 'Debe estar enlazado a fuentes visibles; no puede alimentar planificación si queda huérfano.' },
  { id: 'curriculos', nombre: 'Banco Curricular Legacy', riesgo: 'Banco anterior; conviene evitarlo como fuente principal de planificación.' },
  { id: 'bp_temas', nombre: 'Banco Pedagógico · Temas', riesgo: 'Apoyo pedagógico; no sustituye malla MINERD.' },
  { id: 'bp_actividades', nombre: 'Banco Pedagógico · Actividades', riesgo: 'Base para actividades sugeridas.' },
  { id: 'bp_instrumentos', nombre: 'Banco Pedagógico · Instrumentos', riesgo: 'Instrumentos sugeridos y reutilizables.' },
  { id: 'bp_recursos', nombre: 'Banco Pedagógico · Recursos', riesgo: 'Recursos didácticos.' },
  { id: 'bp_neae', nombre: 'Banco Pedagógico · NEAE', riesgo: 'Adecuaciones y apoyos.' },
  { id: 'bic_planes', nombre: 'BIC · Planes', riesgo: 'Aprendizaje de planes generados o promovidos.' },
  { id: 'bic_actividades', nombre: 'BIC · Actividades', riesgo: 'Actividades indexadas.' },
  { id: 'bic_instrumentos', nombre: 'BIC · Instrumentos', riesgo: 'Instrumentos indexados.' },
  { id: 'ke_agentes', nombre: 'Knowledge Engine · Agentes', riesgo: 'Memoria y comportamiento de agentes IA.' },
  { id: 'ke_topics', nombre: 'Knowledge Engine · Topics', riesgo: 'Temas y taxonomías de aprendizaje.' },
  { id: 'ke_estilos', nombre: 'Knowledge Engine · Estilos', riesgo: 'Estilos docentes aprendidos.' },
  { id: 'aiLogs', nombre: 'Historial IA', riesgo: 'Uso, costos, errores y proveedor utilizado.' },
  { id: 'aiCache', nombre: 'Caché IA', riesgo: 'Puede ahorrar tokens, pero debe invalidarse si cambia el contenido base.' },
  { id: 'planificaciones', nombre: 'Planificaciones Guardadas', riesgo: 'Historial del docente y base del hilo pedagógico.' },
]

const ACCIONES_MANUALES = [
  {
    id: 'auditar-bancos',
    titulo: 'Auditar bancos',
    texto: 'Audita el estado de todos los bancos. Detecta duplicados, huérfanos, datos legacy, riesgos de planificación genérica y acciones seguras.',
  },
  {
    id: 'limpiar-curricular',
    titulo: 'Detectar contenido curricular huérfano',
    texto: 'Analiza si curricularContent puede tener documentos no enlazados a knowledgeSources y propón una limpieza fail-closed sin borrar templates ni datos visibles.',
  },
  {
    id: 'auditar-costos',
    titulo: 'Auditar costos IA',
    texto: 'Revisa el uso de proveedores, cache, errores y oportunidades para bajar tokens sin perder calidad pedagógica.',
  },
  {
    id: 'crear-plan-accion',
    titulo: 'Crear plan de acción',
    texto: 'Convierte el diagnóstico actual en una lista priorizada de acciones: seguro ahora, refactor, migración y validación.',
  },
]

const SECCIONES_CORREGIBLES = [
  { id: 'indicadoresLogro', label: 'Indicadores de logro', espera: 'array' },
  { id: 'competencias', label: 'Competencias', espera: 'array' },
  { id: 'temas', label: 'Temas oficiales', espera: 'array' },
  { id: 'contenidos.conceptuales', label: 'Contenidos · Conceptuales', espera: 'array' },
  { id: 'contenidos.procedimentales', label: 'Contenidos · Procedimentales', espera: 'array' },
  { id: 'contenidos.actitudinales', label: 'Contenidos · Actitudinales', espera: 'array' },
  { id: 'estrategiasSugeridas', label: 'Estrategias sugeridas', espera: 'array' },
  { id: 'actividadesSugeridas', label: 'Actividades sugeridas', espera: 'array' },
  { id: 'evidenciasEsperadas', label: 'Evidencias esperadas', espera: 'array' },
  { id: 'instrumentosSugeridos', label: 'Instrumentos sugeridos', espera: 'array' },
  { id: 'recursos', label: 'Recursos', espera: 'array' },
  { id: 'vocabulario', label: 'Vocabulario', espera: 'array' },
  { id: 'gramatica', label: 'Gramática', espera: 'array' },
  { id: 'funcionesComunicativas', label: 'Funciones comunicativas', espera: 'array' },
]

const sistemaPotenteIA = `Eres Potente IA, el operador senior de DocenteOS.
Trabajas como arquitecto técnico, auditor pedagógico y asistente de implementación.
Reglas:
- No inventes datos curriculares ni suplantes mallas oficiales.
- Distingue diagnóstico, decisión y próximo paso.
- Si falta información, dilo claramente.
- Prioriza seguridad, trazabilidad, compatibilidad con MINERD y no romper templates existentes.
- Responde en español claro, operativo y con acciones concretas.`

const promptOperador = ({ tipo, instruccion, contexto }) => `
TIPO DE TRABAJO: ${tipo.nombre}
DESCRIPCIÓN: ${tipo.descripcion}

CONTEXTO DISPONIBLE:
${contexto || 'Sin contexto adicional.'}

TAREA DEL ADMINISTRADOR:
${instruccion}

ENTREGA:
1. Diagnóstico breve.
2. Decisión recomendada.
3. Pasos concretos.
4. Riesgos o validaciones necesarias.
`

const promptSintesis = ({ tipo, instruccion, contexto, respuestas }) => `
Actúa como director de una mesa de IA de DocenteOS.
Debes leer respuestas de varios operadores, escoger lo mejor y producir una respuesta final única.

TIPO DE TRABAJO: ${tipo.nombre}
CONTEXTO:
${contexto || 'Sin contexto adicional.'}

TAREA ORIGINAL:
${instruccion}

RESPUESTAS DE OPERADORES:
${respuestas.map((r) => `--- ${r.label} ---\n${r.texto}`).join('\n\n')}

ENTREGA FINAL:
- Conclusión clara.
- Qué haría DocenteOS ahora.
- Qué no debe hacerse.
- Próximo paso verificable.
`

const promptCorreccionJson = ({ fuente, seccion, actual, textoOficial }) => `
Actúa como corrector curricular estricto de DocenteOS.

FUENTE:
${fuente}

SECCIÓN A CORREGIR:
${seccion.label} (${seccion.id})

VALOR ACTUAL DE ESA SECCIÓN:
${JSON.stringify(actual ?? null, null, 2)}

TEXTO OFICIAL PEGADO O SUBIDO POR EL ADMIN:
${textoOficial}

REGLAS OBLIGATORIAS:
- Usa literalmente el texto oficial provisto.
- No inventes indicadores, competencias, estrategias, actividades, temas ni contenidos.
- Si hay errores ortográficos en la fuente oficial, consérvalos.
- Devuelve SOLO JSON válido.
- Devuelve únicamente el valor nuevo de la sección "${seccion.id}", no la malla completa.
- El tipo esperado es ${seccion.espera}. Si el texto no contiene información suficiente, devuelve [].
`

function providerLabel(id) {
  if (id === 'auto') return 'Automático'
  return PROVIDER_META[id]?.displayName || id
}

function providerIcon(id) {
  return PROVIDER_META[id]?.icon || '•'
}

function nowLabel() {
  return new Date().toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })
}

async function contarBancos() {
  if (!db) return []
  const resultados = await Promise.all(BANCOS_MONITOREO.map(async (banco) => {
    try {
      const snap = await getCountFromServer(collection(db, banco.id))
      return { ...banco, count: snap.data().count, ok: true }
    } catch (err) {
      return { ...banco, count: null, ok: false, error: err.message }
    }
  }))
  return resultados
}

function resumenBancosTexto(items = []) {
  if (!items.length) return 'Sin monitoreo cargado.'
  return items.map((b) => `- ${b.nombre} (${b.id}): ${b.ok ? `${b.count} documento(s)` : `sin acceso (${b.error || 'error'})`}. Riesgo: ${b.riesgo}`).join('\n')
}

function getByPath(obj, path) {
  return String(path || '').split('.').filter(Boolean).reduce((acc, key) => acc?.[key], obj)
}

function setByPath(obj, path, value) {
  const keys = String(path || '').split('.').filter(Boolean)
  const clone = structuredClone(obj || {})
  let cursor = clone
  keys.slice(0, -1).forEach((key) => {
    if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key])) cursor[key] = {}
    cursor = cursor[key]
  })
  cursor[keys[keys.length - 1]] = value
  return clone
}

function extraerJson(texto = '') {
  const t = String(texto || '').trim()
  if (!t) throw new Error('La IA no devolvió contenido.')
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fenced ? fenced[1].trim() : t
  try { return JSON.parse(raw) } catch {}
  const startObj = raw.indexOf('{')
  const startArr = raw.indexOf('[')
  const start = [startObj, startArr].filter(n => n >= 0).sort((a, b) => a - b)[0]
  const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'))
  if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1))
  throw new Error('La respuesta no contiene JSON válido.')
}

async function cargarGatewayConfig() {
  if (!db) return { models: {}, priority: [] }
  try {
    const snap = await getDoc(doc(db, 'config', 'ia-gateway'))
    return snap.exists() ? snap.data() : { models: {}, priority: [] }
  } catch {
    return { models: {}, priority: [] }
  }
}

function useProviderStatus() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/status')
      setStatus(await res.json())
    } catch {
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])
  return { status, loading, cargar }
}

async function generarConProveedor({ providerId, tipo, instruccion, contexto, models, onChunk }) {
  let salida = ''
  await AIService.generate({
    module: 'admin-potente-ia',
    system: sistemaPotenteIA,
    prompt: promptOperador({ tipo, instruccion, contexto }),
    maxTokens: 5000,
    providerOrder: [providerId],
    preferredProvider: providerId,
    modelOverrides: models,
    strictProvider: true,
    onChunk: (chunk) => {
      salida += chunk
      onChunk?.(chunk)
    },
    onFinish: () => {},
    onError: (msg) => { throw new Error(msg) },
  })
  return salida.trim()
}

export default function AdminPotenteIA() {
  const { status, loading: statusLoading, cargar: recargarStatus } = useProviderStatus()
  const [tipoId, setTipoId] = useState('arquitectura')
  const [modo, setModo] = useState('auto')
  const [operador, setOperador] = useState('auto')
  const [instruccion, setInstruccion] = useState('')
  const [contexto, setContexto] = useState('')
  const [salida, setSalida] = useState('')
  const [resultadosMesa, setResultadosMesa] = useState([])
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')
  const [meta, setMeta] = useState(null)
  const [bancos, setBancos] = useState([])
  const [cargandoBancos, setCargandoBancos] = useState(false)
  const [archivos, setArchivos] = useState([])
  const [fuentes, setFuentes] = useState([])
  const [fuenteId, setFuenteId] = useState('')
  const [jsonActual, setJsonActual] = useState(null)
  const [seccionCorreccion, setSeccionCorreccion] = useState('indicadoresLogro')
  const [textoCorreccion, setTextoCorreccion] = useState('')
  const [jsonCorregido, setJsonCorregido] = useState(null)
  const [valorCorregido, setValorCorregido] = useState(null)
  const [salidaCorreccion, setSalidaCorreccion] = useState('')
  const [corrigiendoJson, setCorrigiendoJson] = useState(false)
  const [aplicandoJson, setAplicandoJson] = useState(false)
  const [mensajeCorreccion, setMensajeCorreccion] = useState('')

  const tipo = useMemo(() => TIPOS_TRABAJO.find((t) => t.id === tipoId) || TIPOS_TRABAJO[0], [tipoId])
  const configured = status?.providers || {}
  const configurados = Object.entries(configured).filter(([, v]) => v?.configured).map(([id]) => id)
  const ordenActivo = tipo.orden.filter((id) => configured[id]?.configured)
  const operadorEfectivo = modo === 'manual' && operador !== 'auto'
    ? operador
    : ordenActivo[0] || status?.primaryProvider || 'openai'

  const puedeEjecutar = instruccion.trim().length >= 8 && !trabajando

  const cargarBancos = async () => {
    setCargandoBancos(true)
    const items = await contarBancos()
    setBancos(items)
    setCargandoBancos(false)
    return items
  }

  useEffect(() => { cargarBancos() }, [])

  // Declarada ANTES de cargarFuentes, que la invoca (evita el acceso a una
  // const antes de su declaración — bug real de lint/runtime)
  const cargarJsonFuente = async (id = fuenteId) => {
    setMensajeCorreccion('')
    setJsonActual(null)
    setJsonCorregido(null)
    setValorCorregido(null)
    if (!db || !id) return null
    const sourceSnap = await getDoc(doc(db, 'knowledgeSources', id))
    if (!sourceSnap.exists()) throw new Error('No se encontró la fuente seleccionada.')
    const source = { id: sourceSnap.id, ...sourceSnap.data() }
    if (source.structuredPayload) {
      setJsonActual(source.structuredPayload)
      return source.structuredPayload
    }
    if (!source.curricularContentId) throw new Error('La fuente no tiene JSON curricular enlazado.')
    const contentSnap = await getDoc(doc(db, 'curricularContent', String(source.curricularContentId)))
    if (!contentSnap.exists()) throw new Error('No se encontró el contenido curricular enlazado.')
    const data = contentSnap.data()
    const payload = data.payload || data
    setJsonActual(payload)
    return payload
  }

  const cargarFuentes = async () => {
    if (!db) return []
    const snap = await getDocs(query(collection(db, 'knowledgeSources'), limit(200)))
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((f) => f.active !== false && (f.curricularContentId || f.structuredPayload || f.contentType))
      .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'es'))
    setFuentes(items)
    let sourceFromSession = ''
    try { sourceFromSession = sessionStorage.getItem('docenteos_potente_ia_source_id') || '' } catch {}
    if (sourceFromSession && items.some((f) => f.id === sourceFromSession)) {
      setFuenteId(sourceFromSession)
      cargarJsonFuente(sourceFromSession).catch(() => {})
      try { sessionStorage.removeItem('docenteos_potente_ia_source_id') } catch {}
    } else if (!fuenteId && items[0]) {
      setFuenteId(items[0].id)
    }
    return items
  }

  useEffect(() => { cargarFuentes() }, [])

  const agregarArchivos = async (event) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    const leidos = []
    for (const file of files) {
      const texto = await file.text().catch(() => '')
      leidos.push({
        nombre: file.name,
        tipo: file.type || 'archivo',
        tamano: file.size,
        texto: texto.slice(0, 12000),
      })
    }
    setArchivos((prev) => [...prev, ...leidos])
    event.target.value = ''
  }

  const agregarArchivoCorreccion = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const texto = await file.text().catch(() => '')
    setTextoCorreccion((prev) => [prev, `--- ${file.name} ---`, texto].filter(Boolean).join('\n\n'))
    event.target.value = ''
  }

  const contextoFinal = () => {
    const partes = []
    if (contexto.trim()) partes.push(`CONTEXTO DEL ADMIN:\n${contexto.trim()}`)
    if (bancos.length) partes.push(`MONITOREO DE BANCOS:\n${resumenBancosTexto(bancos)}`)
    if (archivos.length) {
      partes.push(`ARCHIVOS SUBIDOS:\n${archivos.map((a) => `--- ${a.nombre} (${a.tipo}, ${a.tamano} bytes) ---\n${a.texto}`).join('\n\n')}`)
    }
    return partes.join('\n\n')
  }

  const usarAccionManual = async (accion) => {
    let items = bancos
    if (!items.length) items = await cargarBancos()
    setInstruccion(accion.texto)
    setContexto((prev) => [prev, `Acción manual seleccionada: ${accion.titulo}`, resumenBancosTexto(items)].filter(Boolean).join('\n\n'))
  }

  const guardarSesion = async (payload) => {
    if (!db) return
    try {
      await addDoc(collection(db, 'admin_potente_ia_trabajos'), {
        ...payload,
        creadoPor: auth?.currentUser?.uid || null,
        creadoPorEmail: auth?.currentUser?.email || '',
        createdAt: serverTimestamp(),
      })
    } catch {
      // No bloquea el trabajo si el guardado administrativo falla.
    }
  }

  const ejecutar = async () => {
    if (!puedeEjecutar) return
    setTrabajando(true)
    setError('')
    setSalida('')
    setResultadosMesa([])
    setMeta({ inicio: nowLabel(), operador: modo === 'mesa' ? 'Mesa completa' : providerLabel(operadorEfectivo) })

    try {
      const gw = await cargarGatewayConfig()
      const models = gw.models || {}

      if (modo === 'mesa') {
        const participantes = (ordenActivo.length ? ordenActivo : tipo.orden).slice(0, LIMITES_MESA)
        const parciales = []
        for (const providerId of participantes) {
          const label = providerLabel(providerId)
          setSalida((prev) => `${prev}\n\n[${label}] trabajando...\n`)
          const texto = await generarConProveedor({
            providerId, tipo, instruccion, contexto: contextoFinal(), models,
            onChunk: () => {},
          })
          const item = { providerId, label, texto }
          parciales.push(item)
          setResultadosMesa([...parciales])
          setSalida((prev) => `${prev}\n[${label}] listo.\n`)
        }

        let final = ''
        await AIService.generate({
          module: 'admin-potente-ia',
          system: sistemaPotenteIA,
          prompt: promptSintesis({ tipo, instruccion, contexto: contextoFinal(), respuestas: parciales }),
          maxTokens: 6000,
          providerOrder: [operadorEfectivo],
          preferredProvider: operadorEfectivo,
          modelOverrides: models,
          strictProvider: true,
          onChunk: (chunk) => {
            final += chunk
            setSalida(final)
          },
          onFinish: () => {},
          onError: (msg) => { throw new Error(msg) },
        })
        await guardarSesion({ modo, tipo: tipo.id, operador: operadorEfectivo, instruccion, contexto: contextoFinal(), salida: final, parciales, bancos, archivos: archivos.map(({ nombre, tipo, tamano }) => ({ nombre, tipo, tamano })) })
      } else {
        const providerOrder = modo === 'manual' && operador !== 'auto'
          ? [operador]
          : (ordenActivo.length ? ordenActivo : tipo.orden)
        let textoFinal = ''
        await AIService.generate({
          module: 'admin-potente-ia',
          system: sistemaPotenteIA,
          prompt: promptOperador({ tipo, instruccion, contexto: contextoFinal() }),
          maxTokens: 6000,
          providerOrder,
          preferredProvider: providerOrder[0],
          modelOverrides: models,
          strictProvider: modo === 'manual',
          onChunk: (chunk) => {
            textoFinal += chunk
            setSalida(textoFinal)
          },
          onFinish: () => {},
          onError: (msg) => { throw new Error(msg) },
        })
        await guardarSesion({ modo, tipo: tipo.id, operador: providerOrder[0], providerOrder, instruccion, contexto: contextoFinal(), salida: textoFinal, bancos, archivos: archivos.map(({ nombre, tipo, tamano }) => ({ nombre, tipo, tamano })) })
      }
      setMeta((prev) => ({ ...(prev || {}), fin: nowLabel() }))
    } catch (err) {
      setError(err.message || 'No se pudo completar el trabajo.')
    } finally {
      setTrabajando(false)
    }
  }

  const prepararCorreccionJson = async () => {
    if (!fuenteId || !textoCorreccion.trim()) return
    setCorrigiendoJson(true)
    setMensajeCorreccion('')
    setSalidaCorreccion('')
    setJsonCorregido(null)
    setValorCorregido(null)
    try {
      const base = jsonActual || await cargarJsonFuente(fuenteId)
      const fuente = fuentes.find((f) => f.id === fuenteId)
      const seccion = SECCIONES_CORREGIBLES.find((s) => s.id === seccionCorreccion) || SECCIONES_CORREGIBLES[0]
      const actual = getByPath(base, seccion.id)
      const gw = await cargarGatewayConfig()
      let respuesta = ''
      await AIService.generate({
        module: 'admin-potente-ia',
        system: sistemaPotenteIA,
        prompt: promptCorreccionJson({
          fuente: `${fuente?.title || 'Fuente'} · ${fuente?.level || ''} ${fuente?.grade || ''} · ${fuente?.area || ''} · ${fuente?.subject || ''}`,
          seccion,
          actual,
          textoOficial: textoCorreccion,
        }),
        maxTokens: 5000,
        providerOrder: tipo.orden,
        modelOverrides: gw.models || {},
        onChunk: (chunk) => {
          respuesta += chunk
          setSalidaCorreccion(respuesta)
        },
        onFinish: () => {},
        onError: (msg) => { throw new Error(msg) },
      })
      const nuevoValor = extraerJson(respuesta)
      const nextJson = setByPath(base, seccion.id, nuevoValor)
      const validacion = validateJsonSobre(JSON.stringify(nextJson))
      if (!validacion.parsed) throw new Error(validacion.error || 'No se pudo validar el JSON corregido.')
      setValorCorregido(nuevoValor)
      setJsonCorregido(validacion.parsed)
      setMensajeCorreccion(validacion.ok
        ? 'Corrección lista y validada. Revisa el JSON antes de aplicar.'
        : `Corrección preparada, pero el JSON aún no está listo para generar: ${validacion.error}`)
    } catch (err) {
      setMensajeCorreccion(`No se pudo preparar la corrección: ${err.message || err}`)
    } finally {
      setCorrigiendoJson(false)
    }
  }

  const aplicarCorreccionJson = async () => {
    if (!fuenteId || !jsonCorregido) return
    setAplicandoJson(true)
    setMensajeCorreccion('')
    try {
      await attachJsonToSource(fuenteId, JSON.stringify(jsonCorregido))
      await cargarFuentes()
      await cargarJsonFuente(fuenteId)
      setMensajeCorreccion('Corrección aplicada al Banco de Conocimiento. La fuente ahora apunta al JSON corregido.')
    } catch (err) {
      setMensajeCorreccion(`No se pudo aplicar: ${err.message || err}`)
    } finally {
      setAplicandoJson(false)
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-header-text">
          <h1>Potente IA</h1>
          <p>Estación de trabajo administrativa para orquestar proveedores, auditar decisiones y resolver tareas complejas de DocenteOS.</p>
        </div>
        <button className="admin-btn" onClick={recargarStatus} disabled={statusLoading}>
          Actualizar estado
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 0.85fr) minmax(0, 1.35fr)', gap: 16, alignItems: 'start' }}>
        <section className="admin-info-panel" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>Centro de mando</h2>
              <p style={{ margin: '4px 0 0', color: 'var(--adm-muted)', fontSize: 13 }}>Define el trabajo y quién debe operarlo.</p>
            </div>
            <span style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #bbf7d0', borderRadius: 999, padding: '5px 10px', fontSize: 12, fontWeight: 800 }}>
              {configurados.length} activos
            </span>
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Tipo de trabajo</label>
            <select className="admin-form-select" value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
              {TIPOS_TRABAJO.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
            <span className="admin-form-hint">{tipo.descripcion}</span>
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Modo de operación</label>
            <div style={{ display: 'grid', gap: 8 }}>
              {MODOS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setModo(m.id)}
                  style={{
                    textAlign: 'left',
                    border: `1px solid ${modo === m.id ? '#2563eb' : 'var(--adm-border)'}`,
                    background: modo === m.id ? '#eff6ff' : 'var(--adm-surface)',
                    color: 'var(--adm-text)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    cursor: 'pointer',
                  }}
                >
                  <strong style={{ display: 'block' }}>{m.nombre}</strong>
                  <span style={{ fontSize: 12, color: 'var(--adm-muted)' }}>{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Operador</label>
            <select className="admin-form-select" value={operador} onChange={(e) => setOperador(e.target.value)} disabled={modo === 'auto'}>
              {OPERADORES.map((op) => (
                <option key={op.id} value={op.id}>{op.label}</option>
              ))}
            </select>
            <span className="admin-form-hint">
              Operador efectivo: {providerIcon(operadorEfectivo)} {providerLabel(operadorEfectivo)}
            </span>
          </div>

          <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
            <h3 style={{ margin: 0, fontSize: 14 }}>Ruta recomendada</h3>
            {tipo.orden.map((id, index) => (
              <div key={id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '1px solid var(--adm-border)',
                borderRadius: 8,
                padding: '8px 10px',
                background: configured[id]?.configured ? '#f8fafc' : '#f1f5f9',
                opacity: configured[id]?.configured ? 1 : 0.55,
              }}>
                <span><strong>{index + 1}.</strong> {providerIcon(id)} {providerLabel(id)}</span>
                <small>{configured[id]?.configured ? 'disponible' : 'sin API'}</small>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>Monitor de bancos</h3>
              <button className="admin-btn admin-btn-secondary" onClick={cargarBancos} disabled={cargandoBancos} style={{ padding: '5px 9px', fontSize: 12 }}>
                {cargandoBancos ? 'Leyendo...' : 'Actualizar'}
              </button>
            </div>
            <div style={{ display: 'grid', gap: 7, maxHeight: 260, overflow: 'auto' }}>
              {bancos.map((b) => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: '1px solid var(--adm-border)', borderRadius: 8, padding: '8px 10px', background: 'var(--adm-surface)' }}>
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: 12 }}>{b.nombre}</strong>
                    <small style={{ color: 'var(--adm-muted)' }}>{b.id}</small>
                  </span>
                  <strong style={{ color: b.ok ? '#86efac' : '#fca5a5' }}>{b.ok ? b.count : 'sin acceso'}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="admin-info-panel" style={{ padding: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 14 }}>
            {ACCIONES_MANUALES.map((accion) => (
              <button
                key={accion.id}
                type="button"
                onClick={() => usarAccionManual(accion)}
                style={{
                  border: '1px solid var(--adm-border)',
                  background: 'var(--adm-surface)',
                  color: 'var(--adm-text)',
                  borderRadius: 8,
                  padding: 10,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <strong style={{ display: 'block', fontSize: 12 }}>{accion.titulo}</strong>
                <span style={{ fontSize: 11, color: 'var(--adm-muted)' }}>Preparar tarea</span>
              </button>
            ))}
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Trabajo para Potente IA</label>
            <textarea
              className="admin-form-textarea"
              rows={7}
              value={instruccion}
              onChange={(e) => setInstruccion(e.target.value)}
              placeholder="Ej: Audita por qué al subir una malla de Inglés 1ro aparecen 2do y 3ro, y propón una corrección segura sin tocar el template."
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Contexto opcional</label>
            <textarea
              className="admin-form-textarea"
              rows={4}
              value={contexto}
              onChange={(e) => setContexto(e.target.value)}
              placeholder="Pega errores, rutas de archivos, hallazgos, restricciones o criterios de aceptación."
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Archivos de trabajo</label>
            <input className="admin-form-input" type="file" multiple onChange={agregarArchivos} />
            <span className="admin-form-hint">Se leen como texto y se anexan al contexto de esta tarea. No reemplazan el Banco de Conocimiento.</span>
            {archivos.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {archivos.map((a, idx) => (
                  <span key={`${a.nombre}-${idx}`} style={{ border: '1px solid var(--adm-border)', borderRadius: 999, padding: '5px 9px', fontSize: 12, background: 'var(--adm-surface)' }}>
                    {a.nombre}
                    <button type="button" onClick={() => setArchivos((prev) => prev.filter((_, i) => i !== idx))} style={{ marginLeft: 8, border: 0, background: 'transparent', color: '#fca5a5', cursor: 'pointer' }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="admin-btn admin-btn-primary" onClick={ejecutar} disabled={!puedeEjecutar}>
              {trabajando ? 'Trabajando...' : 'Ejecutar Potente IA'}
            </button>
            <button className="admin-btn admin-btn-secondary" onClick={() => { setInstruccion(''); setContexto(''); setSalida(''); setResultadosMesa([]); setError('') }} disabled={trabajando}>
              Limpiar
            </button>
            {meta && <span style={{ color: 'var(--adm-muted)', fontSize: 12 }}>Inicio: {meta.inicio} · {meta.operador}</span>}
          </div>

          {error && <div className="admin-alert error" style={{ marginTop: 14 }}>{error}</div>}

          <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: resultadosMesa.length ? '0.8fr 1.2fr' : '1fr', gap: 14 }}>
            {resultadosMesa.length > 0 && (
              <div style={{ display: 'grid', gap: 10 }}>
                {resultadosMesa.map((r) => (
                  <article key={r.providerId} style={{ border: '1px solid var(--adm-border)', borderRadius: 8, padding: 12, background: 'var(--adm-surface)' }}>
                    <strong>{providerIcon(r.providerId)} {r.label}</strong>
                    <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--adm-muted)', whiteSpace: 'pre-wrap', maxHeight: 150, overflow: 'auto' }}>
                      {r.texto}
                    </p>
                  </article>
                ))}
              </div>
            )}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Resultado</h3>
                {meta?.fin && <small style={{ color: 'var(--adm-muted)' }}>Finalizado: {meta.fin}</small>}
              </div>
              <div style={{
                minHeight: 280,
                border: '1px solid var(--adm-border)',
                borderRadius: 8,
                background: '#0f172a',
                color: '#e2e8f0',
                padding: 16,
                whiteSpace: 'pre-wrap',
                lineHeight: 1.55,
                fontSize: 14,
                overflow: 'auto',
              }}>
                {salida || 'El resultado aparecerá aquí.'}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="admin-info-panel" style={{ padding: 18, marginTop: 16 }}>
        <div className="admin-page-header" style={{ marginBottom: 14 }}>
          <div className="admin-page-header-text">
            <h2 style={{ margin: 0 }}>Corrección manual de JSON curricular</h2>
            <p>Sube o pega texto oficial para corregir solo una sección de una malla: indicadores, competencias, contenidos, estrategias, actividades y más.</p>
          </div>
          <button className="admin-btn" onClick={cargarFuentes}>Actualizar fuentes</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, .75fr) minmax(0, 1.25fr)', gap: 14 }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="admin-form-group">
              <label className="admin-form-label">Fuente / malla</label>
              <select className="admin-form-select" value={fuenteId} onChange={(e) => { setFuenteId(e.target.value); setJsonActual(null); setJsonCorregido(null); }}>
                <option value="">Seleccionar fuente</option>
                {fuentes.map((f) => (
                  <option key={f.id} value={f.id}>{f.title || f.description || f.id}</option>
                ))}
              </select>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Sección a corregir</label>
              <select className="admin-form-select" value={seccionCorreccion} onChange={(e) => { setSeccionCorreccion(e.target.value); setJsonCorregido(null); }}>
                {SECCIONES_CORREGIBLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>

            <button className="admin-btn admin-btn-secondary" onClick={() => cargarJsonFuente()} disabled={!fuenteId}>
              Cargar JSON actual
            </button>

            {jsonActual && (
              <div style={{ border: '1px solid var(--adm-border)', borderRadius: 8, padding: 10, background: 'var(--adm-surface)' }}>
                <strong style={{ display: 'block', marginBottom: 6 }}>Valor actual</strong>
                <pre style={{ margin: 0, maxHeight: 220, overflow: 'auto', fontSize: 12, color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(getByPath(jsonActual, seccionCorreccion) ?? null, null, 2)}
                </pre>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <div className="admin-form-group">
              <label className="admin-form-label">Texto oficial o corrección textual</label>
              <textarea
                className="admin-form-textarea"
                rows={8}
                value={textoCorreccion}
                onChange={(e) => setTextoCorreccion(e.target.value)}
                placeholder="Pega aquí los indicadores correctos, competencias, actividades, estrategias o el fragmento oficial que debe reemplazar la sección seleccionada."
              />
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input className="admin-form-input" type="file" onChange={agregarArchivoCorreccion} style={{ maxWidth: 320 }} />
              <button className="admin-btn admin-btn-primary" onClick={prepararCorreccionJson} disabled={!fuenteId || !textoCorreccion.trim() || corrigiendoJson}>
                {corrigiendoJson ? 'Preparando...' : 'Preparar corrección JSON'}
              </button>
              <button className="admin-btn admin-btn-secondary" onClick={aplicarCorreccionJson} disabled={!jsonCorregido || aplicandoJson}>
                {aplicandoJson ? 'Aplicando...' : 'Aplicar al Banco'}
              </button>
            </div>

            {mensajeCorreccion && (
              <div className={`admin-alert ${mensajeCorreccion.startsWith('No se pudo') ? 'error' : 'success'}`}>
                {mensajeCorreccion}
              </div>
            )}

            {(valorCorregido || salidaCorreccion) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ border: '1px solid var(--adm-border)', borderRadius: 8, padding: 10, background: 'var(--adm-surface)' }}>
                  <strong style={{ display: 'block', marginBottom: 6 }}>Respuesta IA</strong>
                  <pre style={{ margin: 0, maxHeight: 300, overflow: 'auto', fontSize: 12, color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>
                    {salidaCorreccion}
                  </pre>
                </div>
                <div style={{ border: '1px solid var(--adm-border)', borderRadius: 8, padding: 10, background: '#0f172a' }}>
                  <strong style={{ display: 'block', marginBottom: 6 }}>JSON completo corregido</strong>
                  <pre style={{ margin: 0, maxHeight: 300, overflow: 'auto', fontSize: 12, color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                    {jsonCorregido ? JSON.stringify(jsonCorregido, null, 2) : 'Sin JSON corregido todavía.'}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
