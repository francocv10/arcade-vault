# SPEC 18 — Registro, inicio de sesión y autenticación con correo (Supabase Auth)

> **Status:** Implementado
> **Depends on:** SPEC 05 (clientes de Supabase), SPEC 07 (tabla `scores` y `guardarPuntuacion`), SPEC 04 (`useDialog` y accesibilidad del menú móvil)
> **Date:** 2026-11-03
> **Objective:** Sustituir la sesión simulada de `localStorage` por Supabase Auth con registro sin confirmación de correo, inicio de sesión, recuperación de contraseña y cierre de sesión en `/acceso`, y asociar a la cuenta las puntuaciones que guarde cada jugador con sesión.

---

## Por qué existe este spec

`/acceso` es una maqueta: `AuthForm` acepta cualquier usuario, ignora la contraseña y guarda `{ name }` en `localStorage` (`av_user`). La base ya está preparada: `scores.user_id` existe, y las políticas RLS y los permisos cubren `anon` y `authenticated`, con `INSERT` limitado a `user_id` nulo o igual a `auth.uid()`. **No hace falta ninguna migración.**

La autenticación completa se reparte en dos specs por tamaño. Esta cubre la sesión y el acceso con correo y contraseña. `specs/19-oauth-google-github.md` añade Google, GitHub y la pantalla «Elige tu nombre».

**No hay confirmación de correo (decisión del usuario):** con **Confirm email** desactivado, `signUp` abre la sesión al momento y cualquier jugador puede registrarse sin recibir ningún correo. Supabase marca esa dirección como confirmada aunque no sea de quien la escribió.

Limitación conocida: la recuperación de contraseña es el único flujo que envía correo. `CONTACT_FROM_EMAIL` es `onboarding@resend.dev` y el proyecto no tiene dominio propio. Resend solo permite enviar desde ese remitente a la cuenta propietaria, así que no se puede conectar como SMTP de Supabase. El correo integrado de Supabase solo entrega a miembros del equipo del proyecto y tiene un límite bajo por hora. A cualquier otra dirección le responde `email_address_not_authorized`. Por tanto, **hasta conectar un dominio, solo los correos del equipo pueden recuperar la contraseña**. La UI lo explica sin romperse, y conectar Resend después es solo configuración.

---

## Alcance

**In:**

- `proxy.ts` en la raíz, que refresca la sesión de Supabase en cada petición de página.
- Route Handler `GET /auth/confirm` para los enlaces de recuperación de contraseña.
- `/acceso` con sus dos pestañas actuales conectadas a Supabase Auth:
  - **INICIAR SESIÓN:** correo y contraseña.
  - **CREAR CUENTA:** usuario, correo y contraseña; al enviar, abre la sesión y entra en `/home`.
- Enlace «¿Olvidaste tu contraseña?» en `/acceso` y pantalla nueva `/acceso/nueva-clave`.
- Reescritura de `AuthProvider` sobre la sesión de Supabase, sin la clave `av_user`.
- Menú de cuenta en la barra (nombre, correo y CERRAR SESIÓN). En el menú móvil, nombre y CERRAR SESIÓN en lugar del enlace «Cuenta».
- Puntuaciones con sesión: `guardarPuntuacion` toma el nombre y el `user_id` de la sesión en el servidor, y el modal de fin de juego muestra el nombre sin permitir editarlo.
- Configuración del proyecto de Supabase (pasos manuales en el panel): **Confirm email** desactivado, Site URL, URLs de redirección, plantilla de recuperación en español y contraseña mínima.
- Actualizar `CLAUDE.md`, `.claude/skills/new-game/puntos-de-integracion.md` si cambia algún punto de integración y `.env.example` si hiciera falta.

**Out of scope (para futuros specs):**

- Google, GitHub, la ruta de callback de OAuth y «Elige tu nombre»: SPEC 19. Mientras tanto, los botones GOOGLE y GITHUB quedan `disabled`.
- Confirmación de correo: pantalla «REVISA TU CORREO», plantilla «Confirm signup» y reenvío.
- Conectar Resend como SMTP de Supabase: requiere un dominio verificado. Es configuración, sin código.
- Tabla `profiles`, usuarios únicos y reserva de nombres frente a invitados.
- Vincular a una cuenta las puntuaciones antiguas con `user_id` nulo.
- Cambiar nombre, correo o contraseña desde un perfil, eliminar la cuenta y pantalla de perfil.
- Rutas protegidas: invitados y usuarios ven las mismas páginas.
- Mover a Supabase `av_scores` (las maquetas), las skins y el tema.
- CAPTCHA y autenticación en dos pasos.
- Desplegar: Site URL de producción y sus redirecciones se añaden al desplegar.

---

## Modelo de datos

No hay tablas, columnas ni políticas nuevas. No se regeneran `database.types.ts`.

### Metadatos de la cuenta

```ts
// auth.users.raw_user_meta_data
{
  username: "Px_Kai";
} // 3..10 caracteres; /^[A-Za-z0-9_]{3,10}$/
```

Convenciones:

- `username` conserva mayúsculas y minúsculas tal como se escribió, y así se muestra en la barra y en el HUD.
- `scores.player_name` sigue en mayúsculas: `normalizarNombre` no cambia, así que `Px_Kai` aparece como `PX_KAI` en el ranking.
- `username` no es único: dos cuentas pueden compartirlo y la vista `leaderboard` las fusiona.
- Los invitados conservan su nombre libre de 1 a 10 caracteres.

### `Usuario` en `app/data/scores.ts`

```ts
export interface Usuario {
  id: string; // auth.users.id
  name: string; // user_metadata.username
  email: string;
}
```

### Contexto de `AuthProvider`

```ts
interface AuthContextValue {
  user: Usuario | null;
  cargando: boolean; // true hasta recibir la primera sesión
  logout: () => Promise<void>;
  saveScore: (entry: Omit<PuntuacionGuardada, "at">) => void; // sin cambios
}
```

`login` desaparece: `onAuthStateChange` es la única fuente de la sesión.

### Validación: `app/acceso/auth-schema.ts` (nuevo)

```ts
export const LIMITES_AUTH = {
  usuarioMin: 3,
  usuarioMax: 10,
  claveMin: 8,
} as const;
export const PATRON_USUARIO = /^[A-Za-z0-9_]{3,10}$/;
export function validarRegistro(datos: {
  username: string;
  email: string;
  password: string;
}): Record<string, string>; // errores por campo; vacío si es válido
export function validarAcceso(datos: {
  email: string;
  password: string;
}): Record<string, string>;
export function mensajeAuth(codigo: string | undefined): string; // código de Supabase → texto en español
```

### Mensajes de `mensajeAuth`

| Código de Supabase                    | Mensaje                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------- |
| `invalid_credentials`                 | `[ERR] Correo o contraseña incorrectos.`                                   |
| `user_already_exists`, `email_exists` | `[ERR] Ya existe una cuenta con ese correo. Inicia sesión.`                |
| `email_address_not_authorized`        | `[ERR] Aún no podemos enviar correos a esta dirección.`                    |
| `email_address_invalid`               | `[ERR] No podemos enviar correos a esta dirección.`                        |
| `over_email_send_rate_limit`          | `[ERR] Se ha alcanzado el límite de correos. Inténtalo dentro de un rato.` |
| `over_request_rate_limit`             | `[ERR] Demasiados intentos. Espera un momento.`                            |
| `weak_password`                       | `[ERR] La contraseña es demasiado débil.`                                  |
| `same_password`                       | `[ERR] La contraseña nueva debe ser distinta de la anterior.`              |
| cualquier otro / fallo de red         | `[ERR] No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.`      |

### Rutas nuevas

| Ruta                  | Tipo          | Función                                                                   |
| --------------------- | ------------- | ------------------------------------------------------------------------- |
| `/auth/confirm`       | Route Handler | `verifyOtp` con `token_hash` y `type=recovery`; crea la sesión y redirige |
| `/acceso/nueva-clave` | Página        | Fija una contraseña nueva con la sesión abierta por el enlace de correo   |

Redirecciones de `/auth/confirm`:

- `type=recovery` válido → `/acceso/nueva-clave`.
- Enlace caducado, usado o incompleto, o cualquier otro `type` → `/acceso?error=enlace`.
- El destino sale de esta tabla interna, nunca de un parámetro de la URL.

---

## Plan de implementación

Antes de escribir código hay que leer en `node_modules/next/dist/docs/` la guía de `proxy.ts` (`01-app/03-api-reference/03-file-conventions/proxy.md`), `route.ts` y Cache Components, y la guía vigente de `@supabase/ssr` para Next.js (`search_docs`). Las pantallas se diseñan con `/frontend-design`, partiendo de los estilos `.auth-card`, `.auth-tabs` y `.field`.

1. **Configuración de Supabase (manual, en el panel).** Site URL `http://localhost:3000`; URL de redirección `http://localhost:3000/**`; **Confirm email** desactivado; contraseña mínima de 8 caracteres. Plantilla «Reset password» en español con el enlace `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`. Verificación: una solicitud de recuperación con un correo del equipo entrega el correo en español con ese enlace.
2. **Refresco de sesión.** Crear `app/lib/supabase/proxy.ts` (`actualizarSesion(request)`, con `createServerClient` y `getClaims()` sin código entre ambos) y `proxy.ts` en la raíz con `export function proxy` y un `matcher` que excluya `_next/static`, `_next/image`, `favicon.ico`, `games/` y los archivos con extensión. Las respuestas devuelven las cookies que fije Supabase. Verificación: `npm run build` y las rutas actuales responden igual.
3. **Enlace de recuperación.** Crear `app/auth/confirm/route.ts` con `verifyOtp` y las redirecciones de la tabla. Verificación: `/auth/confirm` sin parámetros redirige a `/acceso?error=enlace`.
4. **Validación.** Crear `app/acceso/auth-schema.ts`. Verificación: `npx tsc --noEmit` sin errores.
5. **`AuthProvider`.** Reescribirlo con el cliente de navegador. Suscribir `onAuthStateChange`, incluido `INITIAL_SESSION`, sin llamar a Supabase dentro del callback. Traducir la sesión a `Usuario` (`username` ausente → `JUGADOR`). Borrar `av_user` al montar, dentro de `try/catch`. Ampliar `Usuario` y sustituir `login` por el nuevo contrato; en este paso `AuthForm` deja de llamar a `login` y queda el formulario sin enviar. Verificación: la app compila y un `av_user` antiguo desaparece y no abre sesión.
6. **Inicio de sesión.** En `AuthForm`, la pestaña INICIAR SESIÓN pide correo y contraseña y llama a `signInWithPassword` desde el cliente de navegador. Al entrar redirige a `/home`. Añadir `<label htmlFor>`, `name`, `autoComplete`, estado de envío, bloque de error con `role="alert"` que conserva lo escrito, `type="button"` en las pestañas y `disabled` en GOOGLE y GITHUB con `title="Próximamente"`. Mostrar el aviso de `?error=enlace`. Con sesión abierta y `cargando` en falso, `/acceso` hace `router.replace("/home")`. Verificación: entrar con una cuenta de prueba.
7. **Registro.** La pestaña CREAR CUENTA pide usuario, correo y contraseña, valida con `validarRegistro` y llama a `signUp` con `options.data.username`. El botón conserva «CREAR Y JUGAR». Al recibir la sesión, redirige a `/home`. Un correo ya registrado muestra el mensaje de `user_already_exists` y conserva lo escrito; comprobar con la cuenta de prueba el código exacto que devuelve Supabase. Si `signUp` responde sin sesión, **Confirm email** sigue activo: se trata como error general y se revisa el paso 1. Verificación: registrar un correo que no sea del equipo y comprobar que entra en `/home` con sesión, sin recibir ningún correo.
8. **Recuperar contraseña.** Añadir el modo «¿Olvidaste tu contraseña?» dentro de `AuthForm`, con `resetPasswordForEmail`. Muestra siempre el mismo mensaje de envío para cualquier correo que exista o no, salvo los errores de límite y `email_address_not_authorized`. Crear `app/acceso/nueva-clave/page.tsx` y `app/components/nueva-clave-form.tsx` con `updateUser({ password })`. Sin sesión, muestra «ENLACE NO VÁLIDO» y un enlace a `/acceso`. Al guardar, redirige a `/home`. Verificación: recorrer el flujo con un correo del equipo.
9. **Menú de cuenta.** En `app/components/nav.tsx`, sustituir el botón que cierra sesión al pulsarlo por `app/components/account-menu.tsx`: botón `NOMBRE ▾` con `aria-haspopup="menu"` y `aria-expanded`, y panel con el correo y CERRAR SESIÓN. Se cierra con Escape, con clic fuera y al elegir una opción, y devuelve el foco al botón. Cerrar sesión deja al jugador en la misma ruta. En el panel móvil, con sesión, mostrar nombre y CERRAR SESIÓN en lugar de «Cuenta». Mientras `cargando`, no mostrar «Iniciar Sesión» para evitar el parpadeo. Añadir `.account-menu` a `app/globals.css`. Verificación: abrir, cerrar y salir con teclado.
10. **Puntuaciones.** En `app/lib/leaderboard/actions.ts`, `guardarPuntuacion` lee `getClaims()` con el cliente de servidor. Con sesión, sustituye `name` por `user_metadata.username`, lo pasa por `validarEnvio` e inserta `user_id = claims.sub`. Sin sesión, inserta como hoy. En `app/components/game-player.tsx`, `name` pasa a ser `user?.name ?? editedName ?? "INVITADO"`, y con sesión el campo del modal es `readOnly`. La rama de maquetas y `saveScore` no cambian. Verificación: guardar en Asteroides con sesión y como invitado, y consultar `scores`.
11. **Documentación.** Actualizar `CLAUDE.md`: lista de specs, `proxy.ts`, `/auth/confirm`, `/acceso/nueva-clave`, `AuthProvider`, la sección Supabase (ya hay auth real y `user_id` se rellena con sesión) y la limitación del correo sin dominio.

---

## Criterios de aceptación

- [x] `npm run lint` y `npm run build` terminan sin errores.
- [x] Existe `proxy.ts` en la raíz y no se ejecuta sobre `_next/static`, `_next/image` ni `/games/*`.
- [x] No queda ninguna lectura ni escritura de `av_user` en `app/`, y un `av_user` previo se borra al cargar sin abrir sesión.
- [x] Registrarse con cualquier correo, también ajeno al equipo, abre la sesión al momento, lleva a `/home` y muestra `NOMBRE ▾` en la barra, con el nombre en sus mayúsculas y minúsculas originales.
- [x] Registrarse no envía ningún correo y no aparece ninguna pantalla «REVISA TU CORREO».
- [x] Registrarse con un correo ya registrado muestra `[ERR] Ya existe una cuenta con ese correo. Inicia sesión.` y no abre sesión.
- [x] Reutilizar o manipular el enlace de recuperación lleva a `/acceso?error=enlace` y muestra un aviso.
- [ ] Solicitar la recuperación con un correo ajeno al equipo muestra el mensaje de `email_address_not_authorized` sin errores en consola ni pantalla rota. _Sin probar en pantalla: necesita un correo real ajeno al equipo. La SPEC 19 cambia el texto del mensaje._
- [x] `ab`, `abcdefghijk`, `con espacio` y `ñandú` son rechazados como usuario en el navegador; `Px_Kai` se acepta.
- [x] Una contraseña de 7 caracteres se rechaza y una de 8 se acepta.
- [x] Con credenciales erróneas se ve `[ERR] Correo o contraseña incorrectos.` y el correo escrito se conserva; el mensaje es el mismo si el correo no existe.
- [x] Recargar la página y abrir otra pestaña conservan la sesión, y cerrar la sesión en una pestaña la cierra en la otra.
- [x] Con la sesión abierta, entrar en `/acceso` redirige a `/home`.
- [x] Solicitar la recuperación con correos del equipo muestra el mismo mensaje tanto si tienen cuenta como si no.
- [x] El enlace de recuperación lleva a `/acceso/nueva-clave`; tras guardar, la contraseña anterior ya no sirve y la nueva sí.
- [x] `/acceso/nueva-clave` sin sesión muestra «ENLACE NO VÁLIDO».
- [x] CERRAR SESIÓN, en escritorio y en móvil, elimina la sesión, deja al jugador en la misma ruta y vuelve a mostrar «Iniciar Sesión».
- [x] El menú de cuenta funciona solo con teclado y devuelve el foco al botón al cerrarse.
- [x] Con sesión, guardar una puntuación real crea en `scores` una fila con `user_id` igual a la cuenta y `player_name` igual al `username` en mayúsculas, aunque la petición envíe otro `name`.
- [x] Con sesión, el campo del modal es de solo lectura.
- [x] Sin sesión, «JUGAR COMO INVITADO» lleva a `/home` y guardar crea una fila con `user_id` nulo y el nombre escrito.
- [x] Las maquetas siguen guardando en `av_scores` y `TU MEJOR MARCA` sigue funcionando con la cuenta.
- [x] GOOGLE y GITHUB aparecen deshabilitados. _Cierto al cerrar esta spec; la SPEC 19 los activa._
- [x] `/acceso`, `/acceso/nueva-clave` y el menú de cuenta se usan sin scroll horizontal a 320 px de ancho.
- [x] No hay errores nuevos en consola en `/home`, `/biblioteca`, `/salon`, `/acceso`, `/about` ni en `/juegos/asteroides/jugar`.
- [x] `CLAUDE.md` describe la autenticación real y la limitación del correo sin dominio.

---

## Decisiones

- **Sí:** Supabase Auth con correo y contraseña, más Google y GitHub en la SPEC 19. La división es decisión del usuario, para entregar y probar por separado.
- **Sí:** `username` en `user_metadata`, sin tabla nueva por el momento (decisión del usuario).
- **Sí:** registro con usuario, correo y contraseña; inicio de sesión solo con correo y contraseña. Supabase autentica por correo y resolver usuario → correo no es posible sin tabla.
- **Sí:** usuario de 3 a 10 caracteres con letras mayúsculas y minúsculas, números y `_` (decisión del usuario). Se conserva el caso en la cuenta; el ranking sigue en mayúsculas para no alterar `normalizarNombre` ni los datos existentes.
- **No:** confirmación de correo (decisión del usuario, que sustituye a la primera versión de esta spec). El registro funciona para cualquier jugador sin dominio ni SMTP, a cambio de aceptar direcciones ajenas marcadas como confirmadas.
- **Sí:** mantener la recuperación de contraseña. El usuario solo descartó la confirmación. Sin dominio funciona únicamente para el equipo; la UI avisa y Resend se conecta después como configuración.
- **Sí:** invitados sin cambios y nombre fijo con sesión (decisión del usuario).
- **No:** reservar nombres frente a invitados por ahora (decisión del usuario). Sin tabla no hay lista consultable, y recorrer `auth.users` exigiría `service_role`. Queda como riesgo aceptado.
- **Sí:** con sesión, el servidor decide `player_name` y `user_id`. El nombre enviado por el cliente se ignora.
- **Sí:** formularios con el cliente de navegador, no Server Actions. `onAuthStateChange` solo se dispara si la operación ocurre en ese cliente; con una Server Action la barra no se enteraría hasta recargar.
- **Sí:** `getClaims()` en servidor. La documentación vigente lo recomienda frente a `getSession()`, cuyos datos de cookies no son de fiar.
- **Sí:** enlaces con `token_hash` y `/auth/confirm`, el patrón SSR de Supabase. Funcionan aunque el correo se abra en otro dispositivo.
- **Sí:** destino de redirección interno. **No:** parámetro `next` en esta spec, para no abrir una redirección arbitraria.
- **Sí:** mantener `/acceso` con pestañas, como la plantilla (decisión del usuario). **No:** rutas `/login` y `/registro`.
- **Sí:** recuperar contraseña y menú de cuenta dentro del alcance (decisión del usuario).
- **Sí:** contraseña mínima de 8 caracteres, validada en cliente y en Supabase.
- **Sí:** mensajes iguales para correos existentes e inexistentes en acceso y recuperación. **No** es posible en el registro: sin confirmación, quien se registra entra al momento, así que un correo repetido tiene que dar error. Se acepta que el registro revele si un correo ya tiene cuenta.
- **No:** migraciones. Comprobado en la base: RLS y permisos ya cubren `authenticated`.

---

## Riesgos

| Riesgo                                                                                                                                     | Mitigación                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sin confirmación, alguien puede registrarse con un correo ajeno, que queda marcado como confirmado y deja a su dueño sin poder registrarse | Consecuencia de quitar la confirmación; el impacto es bajo porque la cuenta solo guarda puntuaciones. Activar **Confirm email** y conectar Resend antes de un lanzamiento público. |
| Sin confirmación desaparece el límite por hora de los registros, y aumentan los bots y las cuentas falsas                                  | Límites de Supabase por IP y RLS sin cambios. CAPTCHA queda para otra spec si hiciera falta.                                                                                       |
| Sin dominio, los jugadores ajenos al equipo no pueden recuperar su contraseña                                                              | Mensaje claro. Con la SPEC 19 pueden entrar con Google o GitHub si el correo coincide. Conectar Resend en cuanto haya dominio.                                                     |
| El límite por hora del correo integrado bloquea las pruebas de recuperación                                                                | Agrupar las comprobaciones. `over_email_send_rate_limit` tiene mensaje propio.                                                                                                     |
| `user_metadata` lo puede cambiar el propio usuario con `updateUser`                                                                        | Se acepta porque no hay nombres reservados. El servidor revalida con `validarEnvio` y RLS no lo consulta. Una tabla `profiles` lo resolverá.                                       |
| Dos jugadores con el mismo nombre se fusionan en `leaderboard`, incluido un invitado                                                       | Riesgo aceptado por el usuario hasta que exista `profiles`.                                                                                                                        |
| Un usuario con sesión podría insertar directamente con `user_id` nulo y cualquier nombre                                                   | La política `INSERT` lo permite porque también sirve a invitados. No empeora la situación actual.                                                                                  |
| Código entre `createServerClient` y `getClaims()` provoca cierres de sesión aleatorios                                                     | Seguir la guía oficial al pie de la letra en `app/lib/supabase/proxy.ts`.                                                                                                          |
| `proxy.ts` añade latencia a cada página                                                                                                    | `matcher` limitado y `getClaims()`, que valida localmente si el proyecto usa claves asimétricas. Comprobar que `/juegos/[id]/jugar` no se degrada.                                 |
| Llamar a Supabase dentro de `onAuthStateChange` bloquea el cliente                                                                         | El callback solo actualiza estado.                                                                                                                                                 |
| Con `cacheComponents`, leer la sesión rompe el prerrenderizado                                                                             | Las páginas no leen `cookies()`: la sesión se resuelve en cliente, en el proxy, en el Route Handler y en la Server Action.                                                         |
| El enlace del correo apunta a `localhost`, así que no abre en el móvil                                                                     | Probar en el mismo equipo. La Site URL cambia al desplegar.                                                                                                                        |

---

## Qué **no** está en este spec

- Google, GitHub y «Elige tu nombre» (SPEC 19).
- Confirmación de correo.
- Conectar Resend como SMTP de Supabase.
- Tabla `profiles`, usuarios únicos y reserva de nombres.
- Vincular puntuaciones antiguas a una cuenta.
- Pantalla de perfil, cambio de nombre o correo, y eliminación de la cuenta.
- Rutas protegidas.
- Mover a Supabase `av_scores`, skins o temas.
- CAPTCHA y autenticación en dos pasos.
- Configuración de producción.

Cada uno de ellos, si se aborda, va en su propio spec.
