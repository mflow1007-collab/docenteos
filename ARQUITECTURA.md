# 📚 DOCUMENTACIÓN ARQUITECTURA DocenteOS

## 🏗️ Estructura del Proyecto

```
src/
├── App.jsx                          # Componente principal (sin cambios visuales)
├── App.css                          # Estilos globales (mejorados)
├── firebase.js                      # Configuración Firebase
├── main.jsx                         # Entrada de la app
├── index.css                        # Reset de estilos
│
├── components/                      # ✨ NUEVOS: Componentes reutilizables
│   ├── FormularioPlanificacion.jsx   # Formulario de entrada
│   └── ResultadoPlanificacion.jsx    # Visualización de resultados
│
├── pages/                           # ✨ NUEVOS: Páginas/vistas
│   └── PlanificacionPage.jsx        # Página completa de planificación
│
├── services/                        # ✨ NUEVOS: Lógica de negocio
│   └── planificacionService.js      # Validaciones y generación
│
└── data/                            # ✨ NUEVOS: Datos simulados
    └── mockPlanificaciones.js       # Datos de prueba por materia
```

---

## 📋 EXPLICACIÓN DE CADA ARCHIVO

### **1. `src/data/mockPlanificaciones.js`**

**Propósito:** Almacenar datos simulados de planificaciones para diferentes cursos/materias.

**Contiene:**
- Objeto `mockPlanificaciones` con combinaciones de:
  - `2do Secundaria-Inglés-Daily Routines`
  - `2do Secundaria-Francés-Viajes y Turismo`
  - `6to Primaria-Inglés-Family Members`
  - `6to Primaria-Relaciones Humanas-Emociones`

- Función `obtenerMockPlanificacion(curso, materia, tema)`
  - Retorna datos específicos si existen
  - Genera planificación genérica como fallback

**Estructura de datos:**
```javascript
{
  competencia: string,
  indicadores: string[],
  contenidos: {
    conceptuales: string[],
    procedimentales: string[],
    actitudinales: string[]
  },
  estrategias: string[],
  actividades: string[],
  evidencias: string[],
  evaluacion: string
}
```

**Uso actual:** Mock data
**Uso futuro:** Reemplazar con llamadas a OpenAI API

---

### **2. `src/services/planificacionService.js`**

**Propósito:** Centralizar toda la lógica de generación y validación.

**Funciones principales:**

#### `validarDatosPlanificacion(datos)`
- Valida que `curso`, `periodo`, `tema`, `competencia` estén completos
- Retorna `{ válido: boolean, error: string }`
- Usado en `PlanificacionPage.jsx` antes de generar

#### `extraerMateria(curso)`
- Ej: `"2do Secundaria - Inglés"` → `"Inglés"`

#### `extraerGrado(curso)`
- Ej: `"2do Secundaria - Inglés"` → `"2do Secundaria"`

#### `generarPlanificacion(datos)` ⭐
- Valida datos
- Simula delay de 1.5s (como si fuera API)
- Obtiene mock data
- Agrega metadatos (fecha, versión, etc.)
- **Retorna:** Planificación completa

#### `prepararParaGuardar(planificacion, usuario)`
- Formatea datos para Firebase
- Agrega `usuarioId`, `usuarioEmail`, `estado`

#### `formatearParaPDF(planificacion)`
- Convierte planificación a texto formateado
- Listo para descarga o PDF

**Ventaja:** Cuando conectemos OpenAI, SOLO modificamos esta función:
```javascript
// Antes (mock data)
const planificacion = obtenerMockPlanificacion(...);

// Después (OpenAI)
const planificacion = await openai.createCompletion({
  modelo: "gpt-4",
  prompt: generarPrompt(datos)
});
```

---

### **3. `src/components/FormularioPlanificacion.jsx`**

**Propósito:** Renderizar formulario de entrada (Presentational Component).

**Props recibidas:**
```javascript
{
  curso, setCurso,
  periodo, setPeriodo,
  tema, setTema,
  competencia, setCompetencia,
  onGenerar,              // función callback
  cargando,               // boolean para deshabilitar inputs
  cursos,                 // array de opciones
  periodos,               // array de opciones
  competencias            // array de opciones
}
```

**Responsabilidades:**
- Renderizar 4 inputs de formulario
- Validar que todos estén completos antes de habilitar botón
- Deshabilitar inputs cuando `cargando === true`
- Mostrar spinner en el botón

**No contiene:**
- Lógica de validación (está en service)
- Manejo de estado (está en Page)
- Llamadas a APIs

---

### **4. `src/components/ResultadoPlanificacion.jsx`**

**Propósito:** Mostrar la planificación generada (Presentational Component).

**Props recibidas:**
```javascript
{
  planificacion,          // objeto completo de planificación
  onGuardar,              // función callback
  onDescargar,            // función callback
  onNueva,                // función callback
  guardando,              // boolean
  mensaje                 // { tipo, texto }
}
```

**Estructura visual:**
```
┌─ Encabezado (metadatos)
├─ Mensaje de estado (si existe)
├─ 🎯 Competencia
├─ 📊 Indicadores
├─ 📚 Contenidos (3 columnas)
├─ 💡 Estrategias
├─ 🎨 Actividades
├─ ✅ Evidencias
├─ 📋 Evaluación
└─ Botones: Guardar | Descargar | Nueva
```

**Características:**
- Render condicional: `if (!planificacion) return null`
- Mapeo de arrays con keys
- Secciones anidadas
- Botones funcionales con callbacks

---

### **5. `src/pages/PlanificacionPage.jsx`**

**Propósito:** Orquestar toda la lógica de la página (Smart Component).

**Estado (useState):**
```javascript
// Formulario
const [curso, periodo, tema, competencia]

// Generación
const [cargando, setCargando]
const [planificacion, setPlanificacion]
const [mensaje, setMensaje]

// Guardado
const [guardando, setGuardando]
```

**Funciones:**

#### `manejarGenerar()`
1. Valida datos
2. Llama a `generarPlanificacion(datos)` del service
3. Espera respuesta (1.5s mock)
4. Guarda en state
5. Scroll automático al resultado
6. Maneja errores

#### `manejarGuardar()`
1. Llama a `guardarPlanificacion()` de Firebase
2. Muestra mensaje de éxito
3. Auto-desaparece en 3s

#### `manejarDescargar()`
1. Formatea con `formatearParaPDF()`
2. Crea Blob
3. Descarga como archivo .txt
4. (Próximo paso: convertir a PDF real)

#### `manejarNueva()`
1. Limpia todos los states
2. Scroll al formulario

**Composición:**
```javascript
<>
  <Titulo />
  <Descripción />
  <FormularioPlanificacion {...props} />
  <ResultadoPlanificacion {...props} />
</>
```

---

### **6. `src/App.jsx` (Cambios)**

**Antes:**
```javascript
{pagina === "planificacion" && <Planificacion />}
```

**Después:**
```javascript
import PlanificacionPage from "./pages/PlanificacionPage";
...
{pagina === "planificacion" && <PlanificacionPage />}
```

**Cambios:**
- ✅ Sigue importando `guardarPlanificacion` de Firebase
- ✅ Sidebar sigue igual
- ✅ Navegación sigue igual
- ✅ Diseño visual NO cambia
- ✅ IAPro sigue disponible
- ✨ Planificación es más modular y escalable

---

### **7. `src/App.css` (Nuevos estilos)**

Se agregaron estilos para:
- `.seccion-resultado` - Tarjetas individuales
- `.contenidos-desglose` - Grid de 3 columnas
- `.contenido-grupo` - Cada tipo de contenido
- Responsive en móvil

**Importante:** Se conservan TODOS los estilos anteriores.

---

## 🔄 FLUJO DE DATOS

```
Usuario (Interface)
       ↓
FormularioPlanificacion (Input)
       ↓
PlanificacionPage (maneja estado)
       ↓
generarPlanificacion() → validarDatosPlanificacion()
       ↓
obtenerMockPlanificacion() [Mock data actual]
       ↓
ResultadoPlanificacion (mostrar)
       ↓
Botones: Guardar → Firebase | Descargar → Archivo
```

---

## 🚀 PRÓXIMOS PASOS (Roadmap)

### **Fase 2: Integración OpenAI** ✅ Lista de tareas)
1. Crear `.env` con `VITE_OPENAI_API_KEY`
2. Instalar `openai` package
3. Crear `src/services/openaiService.js`
4. Reemplazar mock en `generarPlanificacion()`:
   ```javascript
   // En lugar de obtenerMockPlanificacion():
   const respuesta = await openai.createChatCompletion({
     messages: [{role: "system", content: prompt}]
   });
   ```

### **Fase 3: Componentes de Biblioteca**
1. Crear `BibliotecaPlanificacionesPage.jsx`
2. Listar planificaciones del usuario desde Firebase
3. Buscar, filtrar, eliminar, editar
4. Ver historial de cambios

### **Fase 4: Exportación PDF**
1. Instalar `jspdf` + `html2pdf`
2. Crear `src/services/pdfService.js`
3. Exportar con formato profesional

### **Fase 5: Otros Generadores**
1. Secuencias didácticas
2. Planes diarios
3. Instrumentos de evaluación
4. Reportes pedagógicos
5. Seguimiento estudiantil

**Cada uno usará la MISMA arquitectura:**
- `data/mock[Módulo]s.js`
- `services/[módulo]Service.js`
- `components/Formulario[Módulo].jsx`
- `components/Resultado[Módulo].jsx`
- `pages/[Módulo]Page.jsx`

---

## ✨ VENTAJAS DE ESTA ARQUITECTURA

✅ **Separación de concerns** - Cada archivo tiene UNA responsabilidad
✅ **Reutilizable** - Componentes usables en otros módulos
✅ **Testeable** - Funciones puras en services
✅ **Escalable** - Fácil agregar nuevos módulos
✅ **Mantenible** - Cambios centralizados
✅ **Preparada para producción** - Estructura profesional

---

## 🧪 CÓMO PROBAR

1. **Guardar** todos los archivos
2. **Navegar a** "📅 Planificación"
3. **Completar** formulario:
   - Curso: "2do Secundaria - Inglés"
   - Período: "Trimestre I"
   - Tema: "Daily Routines"
   - Competencia: "Comunicación oral"
4. **Click** "✨ Generar planificación"
5. **Ver** resultado en 1.5s
6. **Guardar** (requiere login Firebase)
7. **Descargar** como archivo

---

## 📞 SOPORTE

Para preguntas o mejoras:
- Revisar estructura en `src/services/planificacionService.js`
- Mock data en `src/data/mockPlanificaciones.js`
- Componentes en `src/components/`
- Página en `src/pages/`
