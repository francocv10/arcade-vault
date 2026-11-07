# SPEC 21 — Medidas de seguridad básicas

> **Status:** Aprobado
> **Depends on:** SPEC 07 (tablas `games` y `scores`), SPEC 18 (`AuthForm`, `NuevaClaveForm` y `mensajeAuth`), SPEC 20 (registro con confirmación de correo)
> **Date:** 2026-11-06
> **Objective:** Cerrar el checklist de seguridad básico con contraseñas robustas en cliente y en Supabase, cabeceras de seguridad en Next.js y la corrección de los avisos del panel de Supabase.

---

## Por qué existe este spec

`references/security/security-checklist.md` lista las medidas mínimas antes de abrir la app. Parte de ese checklist ya está cubierta, así que esta spec se limita a lo que falta.

Estado consultado el 2026-11-06:

| Punto del checklist       | Estado                                                                                                                            | Qué hace esta spec                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| RLS en `games` y `scores` | Activa en las dos, con políticas `SELECT` públicas e `INSERT` limitado en `scores`. La vista `leaderboard` usa `security_invoker` | Solo la comprueba                                                |
| Longitud mínima de 8      | Exigida en cliente (`LIMITES_AUTH.claveMin`). El valor del panel no se puede consultar desde el MCP                               | Fija 8 en el panel                                               |
| Contraseñas filtradas     | Supabase la reserva al plan Pro, y el asesor de seguridad no la lista hoy                                                         | No la activa: exige composición de contraseña (ver «Decisiones») |
| Límite de registros       | Con el correo integrado hay un tope de 2 correos por hora para todo el proyecto                                                   | Revisa **Authentication > Rate Limits** y deja constancia        |
| Cabeceras en Next.js      | `next.config.ts` no define ninguna                                                                                                | Añade las 3 del checklist                                        |
| Avisos del panel          | 2 WARN de seguridad por `public.rls_auto_enable()` y 1 INFO de rendimiento por `scores_user_id_fkey`                              | Corrige los tres con migraciones                                 |

`auth.users` tiene 0 filas (consultado el 2026-11-06), así que endurecer la contraseña no afecta a ninguna cuenta existente.

---

## Alcance

**In:**

- Regla de contraseña nueva en cliente: mínimo 8 caracteres con minúscula, mayúscula, dígito y símbolo.
- Aplicar la regla al registro (`AuthForm`) y a la nueva contraseña (`NuevaClaveForm`), sin llamar a Supabase si no se cumple.
- Mensaje de error bajo el campo que indica lo que falta.
- Configuración del panel (paso manual del usuario): longitud mínima 8 y **Password Requirements** con los cuatro tipos de carácter.
- Cabeceras `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy` en todas las rutas.
- Migración que revoca `EXECUTE` de `public.rls_auto_enable()` a `public`, `anon` y `authenticated`.
- Migración que crea un índice sobre `scores.user_id`.
- Revisión de **Authentication > Rate Limits** (paso manual del usuario).
- Actualizar `references/security/security-checklist.md` y `CLAUDE.md`.
- Protección de rutas con Proxy Next.js. Información aquí:
https://nextjs.org/docs/app/getting-started/proxy

Ejemplo: proxy.ts
```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This function can be marked `async` if using `await` inside
export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL('/home', request.url))
}

// Alternatively, you can use a default export:
// export default function proxy(request: NextRequest) { ... }

export const config = {
  matcher: '/about/:path*',
}
```


**Out of scope (para futuros specs):**

- Protección de contraseñas filtradas, que requiere el plan Pro.
- CAPTCHA en registro, acceso o recuperación.
- `Content-Security-Policy`, `Permissions-Policy` y `Strict-Transport-Security`.
- Lista viva de requisitos mientras se escribe la contraseña.
- Validar la contraseña al iniciar sesión.
- Validar puntuaciones en servidor y cerrar el `INSERT` directo en `scores`: lo hace la SPEC 22.
- Cambiar el correo integrado por Resend, y la configuración de producción.

---

## Modelo de datos

No hay tablas, columnas ni políticas nuevas. No se regeneran `database.types.ts`: los índices no aparecen ahí y `rls_auto_enable` tampoco.

### Regla de contraseña

Se añade a `app/acceso/auth-schema.ts`:

```ts
const REQUISITOS_CLAVE = [
  { patron: /[a-z]/, falta: "una minúscula" },
  { patron: /[A-Z]/, falta: "una mayúscula" },
  { patron: /[0-9]/, falta: "un dígito" },
  { patron: /[!@#$%^&*()_+\-=[\]{};'\\:"|<>?,./`~]/, falta: "un símbolo" },
] as const;

// null si la contraseña es válida; si no, el texto de .field-error.
export function validarClaveNueva(password: string): string | null;
```

Los símbolos son los que admite Supabase en **Password Requirements**, y las letras solo cuentan si son ASCII. Así cliente y servidor aplican la misma regla.

### Mensajes de `validarClaveNueva`

La longitud se comprueba junto a los requisitos y va primero en la lista.

| Contraseña  | Mensaje                                                                |
| ----------- | ---------------------------------------------------------------------- |
| vacía       | `La contraseña es obligatoria.`                                        |
| `Abcdef1!`  | Ninguno: es válida                                                     |
| `Abcde1!`   | `Falta: al menos 8 caracteres.`                                        |
| `Abcdefg1`  | `Falta: un símbolo.`                                                   |
| `Abcdefg 1` | `Falta: un símbolo.` El espacio no cuenta como símbolo                 |
| `abcdefgh`  | `Falta: una mayúscula, un dígito y un símbolo.`                        |
| `abc`       | `Falta: al menos 8 caracteres, una mayúscula, un dígito y un símbolo.` |
| `ñññ1!abc`  | `Falta: una mayúscula.`                                                |
| `ÑÑÑ1!abc`  | `Falta: una mayúscula.` La `Ñ` no cuenta como mayúscula ASCII          |

### Cabeceras

| Cabecera                 | Valor                             |
| ------------------------ | --------------------------------- |
| `X-Content-Type-Options` | `nosniff`                         |
| `X-Frame-Options`        | `DENY`                            |
| `Referrer-Policy`        | `strict-origin-when-cross-origin` |

Se aplican con `source: "/(.*)"` en la función `headers` de `next.config.ts`.

### Migraciones

| Nombre                           | Cambio                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| `revoke_rls_auto_enable_execute` | `revoke execute on function public.rls_auto_enable() from public, anon, authenticated;` |
| `add_scores_user_id_index`       | `create index scores_user_id_idx on public.scores (user_id);`                           |

`rls_auto_enable` es la función del event trigger `ensure_rls`, que activa RLS en cada tabla nueva de `public`. `postgres` y `service_role` conservan `EXECUTE`.

---

## Plan de implementación

Antes de escribir código hay que leer `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md`. No hay interfaz nueva que diseñar: el mensaje reutiliza `.field-error`.

El orden importa: la regla del cliente va antes que la del panel, para que nadie reciba el `weak_password` genérico por una contraseña que el formulario podía explicar.

1. **Regla de contraseña.** Añadir `REQUISITOS_CLAVE` y `validarClaveNueva` a `app/acceso/auth-schema.ts`. Verificación: ejecutar cada fila de «Mensajes de `validarClaveNueva`» con un script temporal fuera del repositorio y obtener el texto exacto.
2. **Registro.** En `validarRegistro`, sustituir las comprobaciones de `password` por `validarClaveNueva`. `validarAcceso` no cambia. Verificación: en `/acceso`, una contraseña inválida muestra su mensaje y la pestaña de red no registra ninguna petición a `/auth/v1/signup`.
3. **Nueva contraseña.** En `app/components/nueva-clave-form.tsx`, sustituir la comprobación de longitud por `validarClaveNueva` y quitar el import de `LIMITES_AUTH`. Verificación: `npx tsc --noEmit` sin errores, y una contraseña inválida no llama a `updateUser`.
4. **Cabeceras.** Añadir `headers` a `next.config.ts` con la tabla de «Cabeceras». Verificación: con `npm run build` y `npm run start`, `curl -I` devuelve las 3 cabeceras en `/home`.
5. **Permisos de `rls_auto_enable`.** Aplicar `revoke_rls_auto_enable_execute` con `apply_migration`. Verificación: `has_function_privilege` da `false` para `anon` y `authenticated`. Después, crear una tabla de prueba en `public`, comprobar que `relrowsecurity` es `true` y borrarla.
6. **Índice.** Aplicar `add_scores_user_id_index` con `apply_migration`. Verificación: guardar una puntuación sigue funcionando y `get_advisors` de rendimiento ya no lista `scores_user_id_fkey`.
7. **Contraseña en el panel (manual).** En **Authentication > Providers > Email**, fijar **Minimum password length** en 8 y **Password Requirements** en minúsculas, mayúsculas, dígitos y símbolos. Verificación: un `POST` directo a `/auth/v1/signup` con la clave publishable y la contraseña `abcdefgh` responde `weak_password`, no crea la cuenta ni gasta un correo.
8. **Límites (manual).** Revisar **Authentication > Rate Limits** sin cambiar nada y pasar los valores que muestra. Si existe un límite por IP para registros, comprobar que está activo.
9. **Proteccion de rutas con Proxy Next.js**
10. **Documentación.** Marcar `references/security/security-checklist.md`, dejando sin marcar la protección de contraseñas filtradas con su motivo, y anotar los valores del paso 8. Actualizar en `CLAUDE.md` la lista de specs, la regla de contraseña, las cabeceras y la configuración de Auth.

---

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] Cada fila de «Mensajes de `validarClaveNueva`» produce exactamente el texto indicado.
- [ ] Registrarse con una contraseña inválida muestra el mensaje bajo el campo, conserva lo escrito y no llama a `/auth/v1/signup`.
- [ ] Guardar una contraseña inválida en `/acceso/nueva-clave` muestra el mensaje bajo el campo y no llama a `/auth/v1/user`.
- [ ] Registrarse con una contraseña válida llega a «REVISA TU CORREO».
- [ ] Guardar una contraseña válida en `/acceso/nueva-clave` lleva a `/home`.
- [ ] Iniciar sesión con una contraseña que no cumple la regla no muestra `Falta:`, llega a Supabase y responde `[ERR] Correo o contraseña incorrectos.`
- [ ] Un `POST` directo a `/auth/v1/signup` con `abcdefgh` responde `weak_password` y no crea la cuenta.
- [ ] Un `POST` directo a `/auth/v1/signup` con `Abc1!` responde `weak_password` y no crea la cuenta.
- [ ] Una respuesta `weak_password` del servidor se muestra en el formulario como `[ERR] La contraseña es demasiado débil.`
- [ ] Con `npm run start`, `curl -I` devuelve las 3 cabeceras con su valor exacto en `/home`, `/acceso`, `/auth/callback` y `/games/snake/fruits.png`.
- [ ] La app funciona con las cabeceras: los juegos, el acceso con OAuth y la confirmación de correo no muestran errores nuevos en consola.
- [ ] `has_function_privilege` da `false` para `anon` y `authenticated` sobre `public.rls_auto_enable()`.
- [ ] Una tabla nueva en `public` sigue recibiendo RLS de `ensure_rls`.
- [ ] `get_advisors` de seguridad no lista `rls_auto_enable`.
- [ ] `get_advisors` de rendimiento no lista `scores_user_id_fkey`.
- [ ] `games` y `scores` tienen `relrowsecurity = true`.
- [ ] Los valores de **Authentication > Rate Limits** están anotados en `references/security/security-checklist.md`.
- [ ] `references/security/security-checklist.md` tiene todos sus puntos marcados, salvo la protección de contraseñas filtradas, que indica su motivo.
- [ ] `CLAUDE.md` describe la regla de contraseña, las cabeceras y la configuración del panel.

---

## Decisiones

- **Sí:** exigir minúscula, mayúscula, dígito, símbolo y 8 caracteres con expresiones regulares (decisión del usuario). Sustituye en esta spec a la protección de contraseñas filtradas.
- **No:** activar la protección de contraseñas filtradas, que Supabase reserva al plan Pro. Una regla de composición no la equivale: `Password1!` la cumple y está en cualquier lista de filtradas.
- **Sí:** aplicar la regla en registro y nueva contraseña (decisión del usuario). **No:** aplicarla al iniciar sesión. Ahí solo Supabase decide, y un error del formulario no debe decir nada sobre la cuenta.
- **Sí:** un mensaje al enviar con lo que falta (decisión del usuario). Sigue el patrón de los demás campos y no necesita CSS. **No:** lista viva de requisitos, que pide un componente nuevo.
- **Sí:** exigir también la regla en el panel (decisión del usuario). La validación del navegador se puede saltar con una llamada directa a la API.
- **Sí:** un regex por requisito. Un único patrón diría que la contraseña es inválida, pero no qué falta.
- **Sí:** usar los símbolos de Supabase y letras ASCII. Con otra lista, el cliente aceptaría contraseñas que el servidor rechaza.
- **Sí:** conservar el texto de `weak_password` en `mensajeAuth`. Ya cubre el caso de quien llegue al servidor sin pasar por la regla.
- **Sí:** las 3 cabeceras del checklist (decisión del usuario). La app no usa `iframe`, así que `DENY` no rompe nada. **No:** `Content-Security-Policy`, porque los nonces de Next exigen render dinámico y chocan con `cacheComponents` y `partialPrefetching`. **No:** `Permissions-Policy`, que va más allá del checklist.
- **Sí:** `headers` en `next.config.ts`, como indica el checklist. **No:** fijarlas en `proxy.ts`, cuyo `matcher` excluye los assets.
- **Sí:** revocar `EXECUTE` de `rls_auto_enable` (decisión del usuario). **No:** borrar la función, porque `ensure_rls` depende de ella. **No:** pasarla a `SECURITY INVOKER`, porque necesita privilegios para activar RLS.
- **Sí:** índice en `scores.user_id` (decisión del usuario), aunque el aviso sea INFO y la tabla sea pequeña.
- **Sí:** solo los límites del panel contra bots (decisión del usuario). **No:** CAPTCHA, que necesita una cuenta externa y cambios en `AuthForm`.
- **Sí:** el paso de límites no cambia ningún valor. Bajarlos sin datos de uso podría bloquear a jugadores legítimos.
- **No:** añadir una pista fija con los requisitos bajo el campo. El mensaje al enviar ya los indica.

---

## Riesgos

| Riesgo                                                                              | Mitigación                                                                                                                                                                 |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Una contraseña que cumple la regla puede estar filtrada                             | Riesgo aceptado por el usuario. El punto queda sin marcar en el checklist con su motivo.                                                                                   |
| La regla del cliente y la del panel se desalinean                                   | Los pasos 2 y 7 prueban ambas. Si el servidor rechaza algo que el cliente aceptó, se ve `[ERR] La contraseña es demasiado débil.`                                          |
| El panel no ofrece la opción que espera el paso 7 o el plan la limita               | La opción está documentada en Supabase sin restricción de plan. Si no aparece, parar en ese paso: la regla queda solo en cliente y el criterio correspondiente sin marcar. |
| El `POST` de prueba crea una cuenta si el panel no está bien configurado            | Revisar `auth.users` tras la prueba y borrar la cuenta si existe. Puede enviar un correo y gastar el cupo de 2 por hora.                                                   |
| Revocar `EXECUTE` impide que `ensure_rls` active RLS en tablas nuevas               | El paso 5 lo comprueba con una tabla de prueba. Si falla, se vuelve a conceder el permiso y se decide de nuevo.                                                            |
| El asesor de rendimiento marca el índice nuevo como no usado                        | Se acepta: ninguna consulta filtra hoy por `user_id`. El índice sirve para la clave foránea y un aviso INFO no lo invalida.                                                |
| `X-Frame-Options` o `Referrer-Policy` afectan a OAuth o a la confirmación de correo | Los flujos usan redirecciones de nivel superior, no marcos. Un criterio los comprueba.                                                                                     |
| El cupo de 2 correos por hora limita la prueba del registro válido                  | Agrupar esa prueba y hacerla una sola vez. `over_email_send_rate_limit` ya tiene mensaje propio.                                                                           |
| La política `INSERT` de `scores` permite publicar puntuaciones falsas contra la API | Lo resuelve la SPEC 22. Hasta entonces, RLS impide suplantar un `user_id`, pero no valida el valor de `score`.                                                             |

---

## Qué **no** está en este spec

- Protección de contraseñas filtradas.
- CAPTCHA.
- `Content-Security-Policy`, `Permissions-Policy` y `Strict-Transport-Security`.
- Lista viva de requisitos o pista fija bajo el campo.
- Validar la contraseña al iniciar sesión.
- Validar puntuaciones en servidor (SPEC 22).
- Conectar Resend y la configuración de producción.
- Cambiar los valores de **Rate Limits**.

Cada uno de ellos, si se aborda, va en su propio spec.
