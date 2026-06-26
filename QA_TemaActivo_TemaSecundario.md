# QA Manual - Tema Activo / Tema Secundario (DocenteOS)

## 1) Precondiciones

- Usuario docente normal autenticado.
- Usuario admin: admin@docenteos.com autenticado.
- Firestore accesible y sincronizando en tiempo real.
- No borrar datos previos de prueba.

## 2) Casos de prueba principales

### Caso A: Primer tema crea Tema Activo

1. Entrar a Planificacion.
2. Escribir tema: `Parts of the House`.
3. Generar y guardar.

**Esperado**
- Se crea/actualiza `temaActivo` en `usuarios/{uid}`.
- `temaSecundario` permanece vacio o sin definir.
- Se crea registro en `usuarios/{uid}/historialTemas/{temaNormalizado}`.
- No hay bloqueo.

---

### Caso B: Segundo tema crea Tema Secundario

1. Con el mismo usuario, crear tema nuevo: `Healthy Food`.
2. Generar y guardar.

**Esperado**
- `temaActivo` permanece en primer tema.
- `temaSecundario` se crea con segundo tema.
- Historial contiene ambos temas.
- Sin limite para editar cualquiera de los dos.

---

### Caso C: Comparacion de tema normalizada

Probar generar/guardar con estas variantes del tema activo:
- `parts of the house`
- `PARTS OF THE HOUSE`
- `parts   of   the house`
- Variante con acentos equivalentes

**Esperado**
- El sistema reconoce coincidencia con tema activo/secundario.
- No consume credito.
- No muestra bloqueo.

---

### Caso D: Tercer tema sin credito

1. Tener ya `temaActivo` y `temaSecundario` distintos.
2. Intentar nuevo tema: `Daily Routines`.
3. Usuario sin creditos y sin suscripcion habilitada.

**Esperado**
- Aparece mensaje de bloqueo con los 2 temas activos listados.
- Botones visibles: Seguir editando, Cancelar, Usar nuevo credito.
- No se genera tercera linea de tema.
- No se rompe flujo existente.

---

### Caso E: Tercer tema con credito

1. Mismo escenario del Caso D, pero usuario con credito disponible.
2. Elegir `Usar nuevo credito`.

**Esperado**
- Nuevo tema pasa a `temaActivo`.
- Tema activo anterior pasa a `temaSecundario`.
- Tema secundario anterior se mueve a historial (inactivo/historial).
- Se descuenta credito segun campo disponible del usuario.
- Se genera planificacion correctamente.

---

### Caso F: Admin sin restricciones

1. Entrar con `admin@docenteos.com`.
2. Con dos temas ya activos, crear un tercero diferente.

**Esperado**
- No bloqueo por creditos.
- Flujo continua y permite nuevo tema.

---

### Caso G: Edicion ilimitada de temas activos

Con dos temas activos ya definidos, probar repetidamente:
- editar planificacion
- regenerar IA
- cambiar competencias/indicadores/estrategias/recursos/evaluacion
- exportar PDF varias veces
- guardar varias versiones

**Esperado**
- Nunca bloquear por limite mensual.
- Actualiza `ultimaEdicion` y metrica de historial.
- PDF incrementa `cantidadPDF` del tema.

---

### Caso H: Sincronizacion en tiempo real

1. Abrir dos pestañas con el mismo usuario.
2. En pestaña 1 cambiar de tema y guardar.
3. Observar pestaña 2.

**Esperado**
- Estado de tema activo/secundario se refresca automaticamente.
- Sin necesidad de recargar manualmente.

## 3) Verificaciones en Firestore

### Documento usuario

`usuarios/{uid}` debe reflejar:
- `temaActivo` con `titulo`, `tituloNormalizado`, `creado`, `ultimaEdicion`, `estado`.
- `temaSecundario` con misma estructura cuando aplique.
- `actualizadoEn`.

### Historial

`usuarios/{uid}/historialTemas/{temaNormalizado}`:
- `titulo`
- `fechaInicio`
- `fechaUltimaEdicion`
- `cantidadEdiciones`
- `cantidadPDF`
- `cantidadInstrumentos`
- `estado`
- `activo`

### Auditoria

Coleccion `auditoria` debe registrar evento de uso de tema.

## 4) Resultado de build tecnico

- `npm run build`: OK (sin errores de compilacion).
- Advertencia conocida: tamano de chunk alto (no bloqueante para release).

## 5) Criterio de aprobacion

Aprobar release si:
- No existe bloqueo al trabajar en tema activo/secundario.
- Solo se bloquea tercer tema sin credito.
- Admin opera sin restriccion.
- Firestore refleja cambios y metricas en tiempo real.
- No se pierde informacion historica existente.
