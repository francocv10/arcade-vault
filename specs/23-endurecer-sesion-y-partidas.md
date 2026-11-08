# SPEC 23 — Endurecer la sesión, el cambio de contraseña y las partidas

> **Status:** Implementado
> **Depends on:** SPEC 18 (`NuevaClaveForm` y recuperación de contraseña), SPEC 21 (regla de contraseña, cabeceras y protección de rutas), SPEC 22 (`partidas`, `iniciarPartida` y `guardarPuntuacion`)
> **Date:** 2026-11-08
> **Objective:** Que solo una recuperación reciente pueda cambiar la contraseña y cierre las demás sesiones, que `iniciarPartida` valide la sesión contra Supabase y limite las partidas por hora, y añadir las cabeceras HSTS y `Permissions-Policy`.

---

## Por qué existe este spec

Una revisión de seguridad de la autenticación (2026-11-08) encontró seis puntos débiles. Ninguno es grave, pero los tres primeros permiten quedarse con una cuenta o manipular el ranking.

| Punto | Hallazgo                                                                                                 | Dónde                                         | Qué hace esta spec          |
| ----- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------- |
| 1     | Cambiar la contraseña no cierra las demás sesiones: un intruso sigue dentro tras la recuperación         | `app/components/nueva-clave-form.tsx`         | Las cierra                  |
| 2     | Cualquier sesión puede cambiar la contraseña en `/acceso/nueva-clave` sin la actual ni un enlace         | `app/lib/supabase/proxy.ts`, `NuevaClaveForm` | Exige recuperación reciente |
| 3     | `username` no es único y se puede cambiar por API, lo que permite suplantar a otro jugador en el ranking | `user_metadata`, vista `leaderboard`          | Nada: va en la SPEC 24      |
| 4     | `iniciarPartida` no tiene límite: una cuenta puede insertar miles de filas en `partidas`                 | `app/lib/leaderboard/actions.ts`              | Tope de 60 por hora         |
| 5     | `iniciarPartida` usa `getClaims()`, que acepta una sesión cerrada hasta que caduca el JWT (~1 h)         | `app/lib/leaderboard/actions.ts`              | Usa `getUser()`             |
| 6     | Faltan `Strict-Transport-Security` y `Permissions-Policy`                                                | `next.config.ts`                              | Las añade                   |

### Qué no garantiza esta spec

El navegador puede llamar a `PUT /auth/v1/user` directamente con su token, sin pasar por la app. La Server Action y la página no lo impiden.

Lo que cubre esa puerta es **Secure password change** en el panel: Supabase exige reautenticación a las sesiones de más de 24 h. Una sesión robada con menos de 24 h todavía podría cambiar la contraseña por API. Cerrarlo del todo exige que Supabase permita restringir `updateUser` por método de acceso, y hoy no lo permite.

---

## Alcance

**In:**

- Función pura `esRecuperacionReciente` en `app/acceso/auth-schema.ts`, con la ventana `VENTANA_RECUPERACION_SEGUNDOS` = 600.
- Server Action `cambiarClave` en `app/acceso/nueva-clave/actions.ts`: valida la regla, exige recuperación reciente, cambia la contraseña y cierra las demás sesiones.
- `NuevaClaveForm` llama a `cambiarClave` en lugar de `updateUser` y muestra «ENLACE NO VÁLIDO» si la sesión no viene de una recuperación reciente.
- Mensaje para `reauthentication_needed` en `mensajeAuth`.
- Activar **Secure password change** en el panel (paso manual del usuario).
- `iniciarPartida` lee la sesión con `getUser()`.
- Tope `PARTIDAS_POR_HORA` = 60 en `app/lib/leaderboard/schema.ts`, aplicado en `iniciarPartida` con un mensaje propio.
- `GamePlayer` muestra ese mensaje al pulsar GUARDAR, sin llamar a `guardarPuntuacion`.
- Cabeceras `Strict-Transport-Security` y `Permissions-Policy` en `next.config.ts`.
- Actualizar `references/security/security-checklist.md` y `CLAUDE.md`.

**Out of scope (para futuros specs):**

- Nombres de jugador únicos y no modificables, y agrupar el ranking por cuenta (punto 3): SPEC 24, por escribir.
- Pedir la contraseña actual para cambiarla desde una sesión normal.
- Una pantalla de «cambiar contraseña» dentro del menú de cuenta.
- Cerrar sesión en todos los dispositivos desde el menú de cuenta.
- Ampliar el proxy para que compruebe la recuperación reciente.
- `preload` de HSTS y `Content-Security-Policy`.
- Limitar las demás Server Actions (`guardarPuntuacion`, `obtenerMejorMarca`, `enviarContacto`).
- Cambiar los **Rate Limits** de Auth.

---

## Modelo de datos

No hay tablas, columnas, políticas ni migraciones nuevas. `database.types.ts` no cambia. El tope cuenta filas de `partidas` con el índice `partidas_user_id_idx` sobre `(user_id, iniciada_en)`, que ya existe.

### Recuperación reciente

Supabase escribe en el claim `amr` del JWT cómo se abrió la sesión. Una sesión abierta con el enlace de recuperación lleva una entrada con `method: "recovery"` y su `timestamp` en segundos. El refresco del token conserva esa entrada y su marca de tiempo.

Se añade a `app/acceso/auth-schema.ts`:

```ts
export const VENTANA_RECUPERACION_SEGUNDOS = 600;

// true si `amr` tiene una entrada `recovery` de hace como mucho la ventana.
// Recibe `unknown` porque los claims vienen de fuera.
export function esRecuperacionReciente(
  amr: unknown,
  ahoraSegundos: number,
): boolean;
```

| `amr`                                                                | Resultado (ahora = 10.000) |
| -------------------------------------------------------------------- | -------------------------- |
| `[{ method: "recovery", timestamp: 9_500 }]`                         | `true`                     |
| `[{ method: "recovery", timestamp: 9_400 }]`                         | `true` (justo 600 s)       |
| `[{ method: "recovery", timestamp: 9_399 }]`                         | `false`                    |
| `[{ method: "password", timestamp: 9_900 }]`                         | `false`                    |
| `[{ method: "oauth", timestamp: 9_900 }]`                            | `false`                    |
| `[{ method: "password" }, { method: "recovery", timestamp: 9_900 }]` | `true`                     |
| `[{ method: "recovery", timestamp: 10_100 }]`                        | `false` (en el futuro)     |
| `undefined`, `null`, `"recovery"`, `[]`                              | `false`                    |

### Server Action `cambiarClave`

```ts
// app/acceso/nueva-clave/actions.ts
"use server";
export async function cambiarClave(
  clave: string,
): Promise<{ ok: true } | { ok: false; error: string }>;
```

Comprueba en este orden y se detiene en el primer fallo:

| Paso | Comprobación                                                       | Respuesta si falla                                              |
| ---- | ------------------------------------------------------------------ | --------------------------------------------------------------- |
| 1    | `typeof clave === "string"` y `validarClaveNueva(clave)` da `null` | `[ERR] La contraseña es demasiado débil.`                       |
| 2    | `getClaims()` del cliente de `server.ts` devuelve claims           | `ERROR_ENLACE`                                                  |
| 3    | `esRecuperacionReciente(claims.amr, ahora)`                        | `ERROR_ENLACE`                                                  |
| 4    | `updateUser({ password: clave })` con el cliente de `server.ts`    | `mensajeAuth(error.code)`                                       |
| 5    | `signOut({ scope: "others" })` con el mismo cliente                | Responde `{ ok: true }` y registra el fallo con `console.error` |

`ERROR_ENLACE` es `[ERR] El enlace ha caducado o ya se usó. Solicita uno nuevo.`, el mismo texto que `AVISOS_URL` muestra para `error=enlace`. La contraseña nunca va a un log.

`updateUser` usa el cliente con la sesión del usuario, no el de la clave secreta. Así Supabase sigue aplicando **Password Requirements** (`weak_password`), `same_password` y **Secure password change**.

### Mensajes nuevos

| Dónde                | Código o caso             | Texto                                                                                   |
| -------------------- | ------------------------- | --------------------------------------------------------------------------------------- |
| `MENSAJES_AUTH`      | `reauthentication_needed` | `[ERR] Por seguridad, solicita un enlace nuevo para cambiar la contraseña.`             |
| `actions.ts` partida | Tope alcanzado            | `[ERR] Has jugado demasiadas partidas seguidas. Espera un rato para volver al ranking.` |

### Tope de partidas

Se añade a `app/lib/leaderboard/schema.ts`:

```ts
export const PARTIDAS_POR_HORA = 60;
```

`iniciarPartida` pasa a devolver `{ ok: boolean; partidaId?: string; error?: string }`. Solo el tope rellena `error`. Los demás fallos siguen devolviendo `{ ok: false }` sin texto.

Orden dentro de `iniciarPartida`: juego válido, `getUser()`, limpieza de caducadas (sin cambios), recuento de las filas de esa cuenta con `iniciada_en` en la última hora y, si son 60 o más, rechazo. Si no, inserción. Cuentan todas las filas de esa hora, publicadas o no. Si el recuento falla, se registra y se sigue con la inserción, como ya hace la limpieza.

### Cabeceras

Se suman a las 3 de la SPEC 21, con el mismo `source: "/(.*)"`:

| Cabecera                    | Valor                                                          |
| --------------------------- | -------------------------------------------------------------- |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains`                          |
| `Permissions-Policy`        | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` |

Los navegadores ignoran HSTS en `http://localhost`, así que no afecta al desarrollo.

---

## Plan de implementación

Antes de escribir código hay que leer en `node_modules/next/dist/docs/` la guía de Server Actions (`01-app`) y `01-app/03-api-reference/05-config/01-next-config-js/headers.md`. No hay interfaz nueva que diseñar: los textos reutilizan `.terminal-error` y la tarjeta «ENLACE NO VÁLIDO».

El paso 1 va primero porque todo el punto 2 depende de que Supabase escriba `recovery` en `amr` con el flujo PKCE de la app.

1. **Comprobar el claim `amr`.** Pedir un enlace de recuperación con una cuenta del equipo, abrirlo y leer en `/acceso/nueva-clave` los claims con `getClaims()` desde la consola del navegador. Verificación: `amr` contiene `method: "recovery"` con un `timestamp` de hace segundos. Si no lo contiene, parar aquí y volver a decidir el punto 2.
2. **Función pura.** Añadir `VENTANA_RECUPERACION_SEGUNDOS` y `esRecuperacionReciente` a `app/acceso/auth-schema.ts`, y `reauthentication_needed` a `MENSAJES_AUTH`. Verificación: cada fila de la tabla «Recuperación reciente» da su resultado con un script temporal fuera del repositorio.
3. **Server Action.** Crear `app/acceso/nueva-clave/actions.ts` con `cambiarClave` según su tabla. Verificación: `npx tsc --noEmit` sin errores.
4. **Formulario.** En `NuevaClaveForm`, leer los claims con `createClient().auth.getClaims()` cuando haya `user` y mostrar «ENLACE NO VÁLIDO» si `esRecuperacionReciente` da `false`, mientras se comprueba «Comprobando el enlace…». Sustituir `updateUser` por `cambiarClave` y conservar la limpieza de la contraseña y `router.replace("/home")` al acertar. Verificación: con una sesión de correo y contraseña, `/acceso/nueva-clave` muestra «ENLACE NO VÁLIDO» y no hay formulario.
5. **Secure password change (manual).** En **Authentication > Providers > Email**, activar **Secure password change**. Verificación: la opción queda activa y un enlace de recuperación recién abierto sigue cambiando la contraseña sin pedir un código.
6. **Sesión en `iniciarPartida`.** Sustituir `getClaims()` por `getUser()` y tomar `userId` de `data.user.id`. Verificación: jugar una partida con sesión y guardar sigue funcionando.
7. **Tope.** Añadir `PARTIDAS_POR_HORA` a `schema.ts` y el recuento a `iniciarPartida`, con el nuevo tipo de respuesta. Verificación: `npx tsc --noEmit` sin errores.
8. **Aviso en `GamePlayer`.** Guardar en un ref `errorPartidaRef` el `error` de `iniciarPartida`, limpiarlo junto a `partidaRef` al empezar cada partida, y en `guardar` mostrarlo con `setErrorGuardado` sin llamar a `guardarPuntuacion` si no hay partida y el ref tiene texto. Verificación: con 60 filas recientes creadas por SQL para una cuenta de prueba, pulsar GUARDAR muestra el mensaje del tope y la red no registra la llamada a `guardarPuntuacion`.
9. **Cabeceras.** Añadir las dos a `headers` en `next.config.ts`. Verificación: con `npm run build` y `npm run start`, `curl -I` las devuelve en `/home`.
10. **Documentación.** Añadir a `references/security/security-checklist.md` los puntos 1, 2, 4, 5 y 6 como casillas, con el estado de **Secure password change** y el límite de la sección «Qué no garantiza esta spec». Actualizar en `CLAUDE.md` la lista de specs, `NuevaClaveForm`, el flujo de `iniciarPartida`, las cabeceras de `next.config.ts` y la configuración de Auth.

---

## Criterios de aceptación

- [x] `npm run lint` y `npm run build` terminan sin errores. _(`npm run lint` no arrancaba porque el commit `ffe96f4`, ajeno a esta spec, bajó `eslint-config-next` a la versión 15. Pasa sin errores tras restaurar la 16.4.3 en `main`.)_
- [x] Tras abrir un enlace de recuperación, los claims de la sesión contienen `amr` con `method: "recovery"`.
- [x] Cada fila de la tabla «Recuperación reciente» da exactamente su resultado.
- [x] Un enlace de recuperación recién abierto llega a `/acceso/nueva-clave`, deja guardar una contraseña válida y lleva a `/home`.
- [x] Tras cambiar la contraseña, otra sesión de la misma cuenta abierta en otro navegador queda cerrada al refrescar su token o recargar. _(En Supabase queda cerrada al instante: `GET /auth/v1/user` con su token da `403 session_not_found`, y las acciones que usan `getUser()` la rechazan. La interfaz solo la quita al refrescar el token, porque el proxy la valida por firma hasta que caduca el JWT.)_
- [x] Tras cambiar la contraseña, la sesión del navegador que la cambió sigue abierta.
- [x] Con una sesión de correo y contraseña, `/acceso/nueva-clave` muestra «ENLACE NO VÁLIDO» sin formulario.
- [x] Con una sesión de Google o GitHub, `/acceso/nueva-clave` muestra «ENLACE NO VÁLIDO» sin formulario. _(Comprobado con Google.)_
- [x] Pasados 10 minutos desde abrir el enlace, enviar el formulario muestra `[ERR] El enlace ha caducado o ya se usó. Solicita uno nuevo.` y la contraseña no cambia. _(Dado por cubierto, decisión del usuario: la función pura da `false` pasados 600 s según su tabla, y la acción rechaza con ese texto una sesión sin recuperación reciente. No se probó con una espera real, para no gastar otro correo.)_
- [x] Llamar a `cambiarClave` desde una sesión normal, saltándose la página, responde `[ERR] El enlace ha caducado o ya se usó. Solicita uno nuevo.` y la contraseña no cambia.
- [x] Llamar a `cambiarClave` con una contraseña que no cumple la regla responde `[ERR] La contraseña es demasiado débil.` sin llegar a Supabase.
- [x] Una contraseña inválida en el formulario sigue mostrando `Falta: …` bajo el campo sin llamar a `cambiarClave`.
- [x] Ningún log del servidor contiene la contraseña. _(Exigió `logging.serverFunctions: false`: ver «Decisiones».)_
- [x] **Secure password change** está activo en el panel y anotado en `references/security/security-checklist.md`.
- [x] Sin sesión, `/acceso/nueva-clave` sigue redirigiendo a `/acceso?error=enlace` desde el proxy.
- [x] `iniciarPartida` llama a `getUser()` y no a `getClaims()`.
- [x] Tras cerrar sesión en otro navegador, `iniciarPartida` con las cookies antiguas responde `{ ok: false }` y no inserta fila.
- [x] Una cuenta de prueba con 59 filas de `partidas` en la última hora abre una partida más.
- [x] Con 60 filas en la última hora, `iniciarPartida` responde el mensaje del tope y no inserta fila.
- [x] Con el tope alcanzado, el juego sigue jugándose y GUARDAR muestra `[ERR] Has jugado demasiadas partidas seguidas. Espera un rato para volver al ranking.` sin llamar a `guardarPuntuacion`.
- [x] Las filas con más de una hora no cuentan para el tope.
- [x] La cuenta de prueba, sus partidas y sus puntuaciones se borran al terminar.
- [x] Con `npm run start`, `curl -I` devuelve `Strict-Transport-Security` y `Permissions-Policy` con su valor exacto en `/home`, `/acceso`, `/auth/callback` y `/games/snake/fruits.png`.
- [x] Las 3 cabeceras de la SPEC 21 siguen presentes.
- [x] Los cinco juegos reales, la consola táctil, el acceso con OAuth y la confirmación de correo no muestran errores nuevos en consola. _(Arkanoid muestra `ERR_CACHE_OPERATION_NOT_SUPPORTED` al pedir `break-sound.mp3` para un clon de `Audio`. Se considera previo: esta spec no toca el audio ni Arkanoid. La confirmación de correo solo se revisó hasta la pestaña CREAR CUENTA, sin enviar el registro.)_
- [x] `CLAUDE.md` describe `cambiarClave`, la ventana de recuperación, el tope de partidas y las cabeceras nuevas.

---

## Decisiones

- **Sí:** dividir la revisión en dos specs (decisión del usuario). Los nombres únicos necesitan una tabla nueva, migrar nombres repetidos y cambiar cómo agrupa `leaderboard`. Van en la SPEC 24.
- **Sí:** cerrar las demás sesiones con `scope: "others"` (decisión del usuario). Quien recupera la cuenta sigue dentro. **No:** `scope: "global"`, que obligaría a volver a entrar justo después de elegir la contraseña.
- **Sí:** solo una sesión abierta por el enlace de recuperación puede cambiar la contraseña (decisión del usuario). No gasta correos y sirve igual para las cuentas de Google y GitHub. **No:** pedir la contraseña actual, que no existe en las cuentas de proveedor. **No:** solo la opción del panel, que puede pedir un código por correo y chocar con el límite de 2 por hora.
- **Sí:** ventana de 10 minutos desde que se abre el enlace (decisión del usuario). **No:** 1 hora, que deja más margen a una sesión robada.
- **Sí:** comprobar la ventana en una Server Action y también en la página (decisión del usuario). La página solo decide qué se muestra; la acción es la que impide el cambio. **No:** comprobarla solo en el cliente, que se salta con una llamada directa.
- **Sí:** activar **Secure password change** (decisión del usuario). Es lo único que protege `PUT /auth/v1/user` frente a una sesión antigua.
- **Sí:** `updateUser` con el cliente de la sesión. **No:** `admin.updateUserById` con la clave secreta, que saltaría **Password Requirements** y **Secure password change**.
- **Sí:** la acción responde `ok` aunque falle `signOut({ scope: "others" })`. La contraseña ya cambió, y devolver un error haría pensar que no.
- **No:** ampliar el proxy con la recuperación reciente. La página y la acción ya lo cubren, y el proxy de la SPEC 21 sigue echando a quien no tiene sesión.
- **Sí:** `getUser()` en `iniciarPartida` (decisión del usuario). Cuesta una petición al empezar cada partida, igual que `guardarPuntuacion`.
- **Sí:** tope de 60 partidas por hora (decisión del usuario). Una partida real dura más de un minuto, así que un jugador legítimo no llega. **No:** reutilizar una partida abierta, que cambia la regla de tiempo jugado de la SPEC 22. **No:** un tope de partidas abiertas, que no frena a quien publica cada una.
- **Sí:** mensaje propio cuando se alcanza el tope (decisión del usuario). El genérico de la SPEC 22 haría pensar que la puntuación es falsa.
- **Sí:** si el recuento falla, se inserta igual. Un fallo de la base de datos no debe dejar sin ranking a todos los jugadores.
- **Sí:** HSTS de 1 año con `includeSubDomains` y sin `preload` (decisión del usuario). Aún no hay dominio definitivo, y salir de la lista `preload` de los navegadores tarda meses.
- **Sí:** `Permissions-Policy` que bloquea cámara, micrófono, ubicación, pago y USB. Ningún juego los usa. **No:** bloquear `fullscreen` o `gamepad`, que un juego futuro podría querer.
- **Sí (añadido durante la implementación, decisión del usuario):** `logging: { serverFunctions: false }` en `next.config.ts`. `next dev` registra por defecto cada Server Action con sus argumentos, y la primera prueba real escribió en la terminal la contraseña que recibía `cambiarClave`. Desactivarlo es la opción documentada en `01-app/03-api-reference/05-config/01-next-config-js/logging.md` y protege también los datos de `enviarContacto`. **No:** pasar la contraseña de otra forma, sin garantía de que el registro no la muestre. **No:** aceptarlo por ser solo de desarrollo, que incumple «Ningún log del servidor contiene la contraseña».

---

## Riesgos

| Riesgo                                                                                | Mitigación                                                                                                                                                  |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase no escribe `recovery` en `amr` con el flujo PKCE de `/auth/callback`         | El paso 1 lo comprueba antes de escribir código. Si falla, se para y se vuelve a decidir el punto 2.                                                        |
| `/auth/confirm` con `type=recovery` escribe otro método en `amr`                      | Hoy ningún correo enlaza ahí (CLAUDE.md). Si se usa en el futuro, hay que repetir el paso 1 con ese enlace.                                                 |
| El cupo de 2 correos por hora limita las pruebas de recuperación                      | Agrupar en un mismo enlace las pruebas de guardar, de la otra sesión y de la ventana de 10 minutos. Para la ventana basta con esperar sin guardar.          |
| Una sesión robada de menos de 24 h cambia la contraseña con `PUT /auth/v1/user`       | Riesgo aceptado y escrito en «Qué no garantiza esta spec» y en el checklist.                                                                                |
| **Secure password change** pide un código en el flujo de recuperación                 | La sesión de recuperación es nueva y queda dentro de las 24 h. El paso 5 lo comprueba, y `reauthentication_needed` tiene mensaje propio.                    |
| `signOut({ scope: "others" })` falla y el intruso sigue dentro                        | Se registra con `console.error`. El usuario puede volver a pedir un enlace y cambiar la contraseña otra vez, lo que repite el cierre de las demás sesiones. |
| Un jugador legítimo llega a 60 partidas en una hora                                   | Solo pierde el ranking durante esa hora, no el juego, y ve por qué.                                                                                         |
| En desarrollo, Strict Mode crea una fila de más por partida                           | Cuenta para el tope solo en `next dev`, donde 30 partidas reales ya serían muchas.                                                                          |
| HSTS con `includeSubDomains` afecta a subdominios sin HTTPS del dominio de producción | Antes de desplegar en un dominio propio, comprobar que todos sus subdominios sirven HTTPS.                                                                  |

---

## Qué **no** está en este spec

- Nombres de jugador únicos y ranking agrupado por cuenta (SPEC 24).
- Pedir la contraseña actual o cambiarla desde el menú de cuenta.
- Cerrar sesión en todos los dispositivos desde la barra.
- Comprobar la recuperación reciente en el proxy.
- `preload` de HSTS y `Content-Security-Policy`.
- Límites en las demás Server Actions.
- Cambiar los **Rate Limits** de Auth.

Cada uno de ellos, si se aborda, va en su propio spec.
