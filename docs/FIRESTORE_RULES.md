# Reglas de Firestore y Storage — DocenteOS

> Fase 11 del hilo pedagógico (2026-07-04). Fuente de verdad: `firestore.rules`
> y `storage.rules` en la raíz del repo.
>
> Desplegar: `firebase deploy --only firestore:rules,storage`

## Principios

1. **Dueño único**: todo dato de docente vive bajo su `uid` (subcolecciones de
   `usuarios/{uid}` o documentos con campo `usuario`/prefijo `{uid}_`), y solo
   él (o un admin) puede leerlo/escribirlo.
2. **Validación al crear**: las colecciones del hilo pedagógico exigen sus
   campos de vínculo mínimos en `create` (no en `update`, para no romper
   merges parciales de datos legacy).
3. **Nada público**: no existe ninguna colección con `allow read/write: if true`.

## isAdmin() — endurecido (fix auditoría 2026-07-04)

```
email == admin@docenteos.com            (cuenta principal, acceso completo)
O (email termina en @docenteos.com Y email_verified == true)
O existe admins/{uid}
```

- **admin@docenteos.com** es la única cuenta administradora: tiene acceso
  completo por email exacto, sin exigir verificación (la cuenta ya existe en
  Firebase Auth, nadie más puede registrar ese correo). El mismo criterio
  aplica en `storage.rules` y en `/api/ai/generate` (módulos admin-only).
- **Antes del fix**: bastaba registrarse con CUALQUIER correo
  `x@docenteos.com` sin verificar para obtener admin total (escritura del
  currículo oficial incluida). Ese hueco sigue cerrado: otros correos del
  dominio requieren verificación.
- **Escape hatch**: agregar un UID como documento `admins/{uid}` desde
  Firebase Console — la consola no pasa por estas reglas.

## Colecciones del hilo pedagógico

| Ruta | Lectura/Update/Delete | Create exige |
|---|---|---|
| `usuarios/{uid}/cursos/{cursoId}/registroAspectos/{aspId}` | dueño o admin | `cursoId` (== ruta), `nombre` |
| `usuarios/{uid}/cursos/{cursoId}/registroNotas/{notaId}` | dueño o admin | `cursoId` (== ruta), `estudianteId`, `aspectoId` |
| `usuarios/{uid}/cursos/{cursoId}/estudiantes/{estId}/evidencias/{evId}` | dueño o admin | `estudianteId` (== ruta), `cursoId` (== ruta) |
| `usuarios/{uid}/evidenciasPedagogicas/{evId}` | dueño o admin | `estudianteId`, `cursoId` |
| `usuarios/{uid}/instrumentos/{insId}` | dueño o admin | — (formato legacy variado) |
| `usuarios/{uid}/instrumentoResultados/{resId}` | dueño o admin | `cursoId`, `estudianteId`, `instrumentoId`, `estado` ∈ {evaluado, pendiente, no_entrego} |
| `planificaciones/{id}` (top-level) | dueño por campo `usuario` | `usuario == auth.uid` |
| `registrosCalificaciones/{uid_cursoId}` | dueño por prefijo del ID | — |

Nota de compatibilidad: las comparaciones ruta↔dato usan `string(...)` porque
existen IDs legacy numéricos (`estudianteId: 1` vs segmento de ruta `"1"`) —
sin la conversión, las escrituras de usuarios reales fallarían.

## Currículo y Banco de Conocimiento

| Ruta | Lectura | Escritura |
|---|---|---|
| `diseñoCurricular/{slug}` | autenticado | admin |
| `curricularContent/{id}` | autenticado | admin |
| `knowledgeSources/{id}` | admin | admin |

## Storage (`storage.rules`, nuevo en el repo)

| Ruta | Lectura | Escritura |
|---|---|---|
| `bancoConocimiento/**` | autenticado | admin, `application/pdf`, < 30 MB |
| `planificaciones/{uid}/**` | autenticado | dueño, < 10 MB |
| resto | ❌ | ❌ |

## Test de reglas — por qué no hay emulador todavía

El test automatizado de reglas (`@firebase/rules-unit-testing`) requiere el
**emulador de Firestore**, que a su vez requiere **Java Runtime**, y esta
máquina no lo tiene instalado (`java -version` → "Unable to locate a Java
Runtime"). Instalar Java es una decisión de sistema que queda fuera del repo.

Cuando haya Java disponible:

```bash
npm i -D firebase-tools @firebase/rules-unit-testing
npx firebase emulators:start --only firestore
# y crear scripts/test-firestore-rules.mjs con initializeTestEnvironment()
```

### Guion de prueba manual (mientras tanto)

Con dos cuentas (A = docente normal, B = otro docente) en la app desplegada:

1. **Aislamiento**: con B autenticado, intentar leer
   `usuarios/{uidA}/cursos/.../registroNotas` desde la consola del navegador
   (`getDocs`) → debe fallar con `permission-denied`.
2. **Create inválido**: con A, `setDoc` de una nota SIN `aspectoId` en
   `registroNotas` → `permission-denied`. Con `aspectoId` → éxito.
3. **Resultado inválido**: `setDoc` en `instrumentoResultados` con
   `estado: "otro"` → `permission-denied`; con `estado: "evaluado"` → éxito.
4. **Admin falso**: registrar cuenta `prueba@docenteos.com` SIN verificar el
   correo → intentar leer `knowledgeSources` → `permission-denied` (antes del
   fix esto pasaba). Verificar el correo → debe funcionar.
5. **Storage**: como docente normal, intentar subir un PDF a
   `bancoConocimiento/pdfs/x.pdf` → denegado; como admin verificado → éxito.
