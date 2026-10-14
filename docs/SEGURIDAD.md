# Seguridad de acceso — DocenteOS

Resumen de las capas de seguridad del login/registro y **qué debes activar tú en la
consola de Firebase** para que funcionen por completo. El código ya está listo; lo que
sigue es configuración (una sola vez).

Consola: https://console.firebase.google.com → tu proyecto.

---

## Capas ya implementadas en código

| Capa | Qué hace | Estado |
|---|---|---|
| **Dominio institucional** | Solo permite registrar correos `@docente.edu.do` (o la cuenta admin). | ✅ Activa |
| **Contraseña fuerte** | Exige ≥8 caracteres con mayúscula, minúscula y número. | ✅ Activa |
| **Verificación de correo** | Al registrarse se envía un enlace; no se puede iniciar sesión hasta confirmarlo. Botón para reenviar. | ✅ Activa (requiere plantilla de correo, ver abajo) |
| **Verificación en dos pasos (MFA/TOTP)** | Segundo factor opcional con app autenticadora. El docente lo activa en Configuración. | ⚙️ Requiere activar en consola |
| **App Check (anti-bots)** | Protege el backend de abuso automatizado. | ⚙️ Requiere clave reCAPTCHA |
| **Reglas de Firestore** | Cada docente solo accede a sus propios datos (`usuarios/{uid}/…`). | ✅ Activas en `firestore.rules` |

---

## 1. Verificación de correo (ya funciona, revisa la plantilla)

El envío ya está en el código. Para que el correo se vea bien:

1. **Authentication → Templates → Email address verification**.
2. Personaliza remitente, asunto y cuerpo (en español).
3. (Opcional) En **Authentication → Settings → Authorized domains**, confirma que tu
   dominio de producción esté autorizado para que los enlaces funcionen.

> Nota: las cuentas creadas **antes** de esta medida pueden tener el correo sin verificar.
> Si alguna necesita entrar, márcala como verificada desde **Authentication → Users**.

## 2. Verificación en dos pasos (MFA por TOTP) — plan gratuito

1. **Authentication → Sign-in method → Advanced** (o la sección *Multi-factor*).
2. Habilita **Authenticator app (TOTP)**.
3. Listo. El docente la activa desde **Configuración → Verificación en dos pasos**:
   escanea el QR con Google Authenticator / Authy / Microsoft Authenticator y confirma
   con el código de 6 dígitos. En el siguiente login se le pedirá el código.

> El MFA por **SMS** NO se usa aquí (requiere plan Blaze de pago y es menos seguro que TOTP).

## 3. App Check (anti-bots) — recomendado para producción

Protege tu backend de peticiones que no vienen de tu app real.

1. **App Check** (menú lateral) → registra tu app web con **reCAPTCHA v3**.
   - Google te da una **clave de sitio** (site key).
2. Pega la clave en tu entorno (`.env.local` y en Vercel):
   ```
   VITE_RECAPTCHA_SITE_KEY=tu_site_key_de_recaptcha
   ```
3. (Desarrollo local) Para no bloquearte, en App Check genera un **debug token** y ponlo:
   ```
   VITE_APPCHECK_DEBUG_TOKEN=el_token_de_depuracion
   ```
4. Cuando todo funcione, en App Check activa **Enforce** para Firestore/Auth.

> El código ya inicializa App Check **solo si** `VITE_RECAPTCHA_SITE_KEY` existe; sin ella,
> la app funciona igual (sin esta protección). Ver `src/firebase.js`.

## 4. Límite de intentos (ya lo da Firebase)

Firebase bloquea automáticamente tras muchos intentos fallidos
(`auth/too-many-requests`) — el mensaje ya está traducido. No requiere configuración.

---

## Verificación en el navegador (requiere tu login)

Lo siguiente solo se puede probar logueado; el código ya compila y pasa lint/tests:

- [ ] Registrar una cuenta nueva → llega el correo → no deja entrar hasta confirmar.
- [ ] Reenviar verificación desde el login.
- [ ] Activar MFA en Configuración (tras habilitar TOTP en consola) → escanear QR → confirmar.
- [ ] Cerrar sesión, volver a entrar → pide el código de 6 dígitos.
- [ ] (Si configuras App Check) la app sigue funcionando con la clave puesta.
