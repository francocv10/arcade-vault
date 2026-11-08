# SPEC 24 — Nombres de jugador únicos y fijos

> **Status:** Aprobado
> **Depends on:** SPEC 18 (registro con `username`), SPEC 19 (`/acceso/nombre`, `ExigirNombre` y `sinNombre`), SPEC 20 (confirmación por `/auth/callback?origen=correo`), SPEC 22 (`guardarPuntuacion`, `scores.player_name` y SEG-008), SPEC 23 (punto 3 de su revisión)
> **Date:** 2026-11-08
> **Objective:** Que cada nombre de jugador pertenezca a una sola cuenta para siempre, sin distinguir mayúsculas y sin poder cambiarse, para que el ranking no fusione ni deje suplantar a dos cuentas.

---

## Por qué existe este spec

La revisión de seguridad del 2026-11-08 dejó el punto 3 para esta spec: `username` no es único y se puede cambiar por API, lo que permite suplantar a otro jugador en el ranking.

Hoy el nombre vive en `user_metadata.username`. Cualquier sesión puede reescribirlo con `updateUser`, saltándose `/acceso/nombre`. `guardarPuntuacion` lo copia a `scores.player_name`, y la vista `leaderboard` agrupa por `upper(player_name)`. Dos cuentas llamadas `ana` y `ANA` se fusionan en una sola fila, y una cuenta puede renombrarse como el primero del ranking.

### Por qué el ranking no cambia

Si un nombre pertenece a una sola cuenta para siempre, aunque esa cuenta se borre, agrupar por nombre es lo mismo que agrupar por cuenta. Así la vista `leaderboard` no cambia y nadie necesita leer `scores.user_id`, que la SPEC 22 cerró a `anon` y `authenticated` (SEG-008).

Agrupar por `user_id` obligaría a reabrir esa columna o a usar una vista `security definer`, que el asesor de Supabase marca como error.

### Estado actual de los datos

Comprobado el 2026-11-08: 1 cuenta, con `username` válido, sin nombres repetidos, y 6 puntuaciones, todas con `user_id`. La migración solo tiene que dar de alta esa cuenta.

---

## Alcance

**In:**

- Tabla `jugadores` con el nombre único de cada cuenta, sin acceso desde la API.
- El nombre se reserva para siempre: borrar la cuenta no lo libera.
- Unicidad sin distinguir mayúsculas, conservando cómo lo escribió el jugador.
- Nombres reservados: `JUGADOR`, `INVITADO` y `ADMIN`.
- Server Action `nombreDisponible`, que `AuthForm` llama antes de `signUp`.
- Server Action `elegirNombre`, que sustituye a `updateUser` en `ElegirNombreForm`.
- Server Action `asegurarNombre`, que `AuthProvider` llama una vez por cuenta al abrir sesión.
- `/auth/callback` reserva el nombre antes de decidir el destino.
- `user_metadata.username` pasa a ser una copia que escribe el servidor.
- `guardarPuntuacion` toma el nombre de `jugadores`, no de los metadatos.
- Mensaje único `Ese nombre no está disponible. Elige otro.` bajo el campo.
- Migración que da de alta la cuenta existente.
- Regenerar `database.types.ts` y actualizar `CLAUDE.md` y `references/security/security-checklist.md`.

**Out of scope (para futuros specs):**

- Cambiar el nombre, ni desde la app ni con ayuda de un administrador.
- Liberar los nombres de las cuentas borradas.
- Agrupar el ranking por `user_id`.
- Cambiar `obtenerMejorMarca`, que sigue recibiendo el nombre desde el navegador.
- Filtrar nombres ofensivos o una lista de reservados más larga.
- Cambiar la vista `leaderboard`, `queries.ts` o los permisos de `scores`.
- Los 8 juegos de maqueta, cuyo nombre sigue en `localStorage`.

---

## Modelo de datos

### Tabla `jugadores`

```sql
create table public.jugadores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  username text not null
    check (username ~ '^[A-Za-z0-9_]{3,10}$')
    check (lower(username) not in ('jugador', 'invitado', 'admin')),
  creado_en timestamptz not null default now()
);
create unique index jugadores_username_lower_idx
  on public.jugadores (lower(username));
```

- `lower(username)` único impide `ana` y `ANA` en dos cuentas. `username` conserva lo que escribió el jugador.
- `on delete set null` conserva la fila al borrar la cuenta: el nombre queda reservado para siempre.
- `user_id unique` da una sola fila por cuenta. Las filas de cuentas borradas pueden tener `user_id` nulo a la vez.
- Los dos `check` repiten en la base de datos `PATRON_USUARIO` y la lista de reservados, por si alguna escritura se salta el código.
- RLS activa, ninguna política y ningún permiso para `anon` ni `authenticated`. Solo se accede con la clave secreta (`createAdminClient()`), como `partidas`.
- `jugadores_username_lower_idx` cubre las búsquedas por nombre, y la restricción `unique` de `user_id` cubre las búsquedas por cuenta.

La migración se llama `create_jugadores` y da de alta las cuentas con un `username` válido en sus metadatos:

```sql
insert into public.jugadores (user_id, username)
select id, raw_user_meta_data->>'username'
from auth.users
where raw_user_meta_data->>'username' ~ '^[A-Za-z0-9_]{3,10}$'
on conflict do nothing;
```

Hay que regenerar `app/lib/supabase/database.types.ts` con `generate_typescript_types`.

### Fuente de verdad del nombre

| Dato                     | Quién lo escribe                                            | Quién lo lee                                             |
| ------------------------ | ----------------------------------------------------------- | -------------------------------------------------------- |
| `jugadores.username`     | Solo el servidor, con la clave secreta                      | `guardarPuntuacion`, `asegurarNombre` y `/auth/callback` |
| `user_metadata.username` | El servidor, como copia (`admin.auth.admin.updateUserById`) | `AuthProvider` (barra, `sinNombre` y `ExigirNombre`)     |
| `scores.player_name`     | `guardarPuntuacion`, desde `jugadores`                      | La vista `leaderboard` (sin cambios)                     |

Si alguien cambia sus metadatos por API, solo ve otro nombre en su barra hasta la siguiente comprobación de `asegurarNombre`, que los vuelve a escribir. Las puntuaciones y el ranking no cambian.

### Nombres reservados y mensaje

Se añaden a `app/acceso/auth-schema.ts`:

```ts
export const NOMBRES_RESERVADOS = ["JUGADOR", "INVITADO", "ADMIN"] as const;
export const ERROR_NOMBRE_NO_DISPONIBLE =
  "Ese nombre no está disponible. Elige otro.";
// true si el nombre, sin distinguir mayúsculas, está en NOMBRES_RESERVADOS.
export function nombreReservado(username: string): boolean;
```

El mensaje es el mismo para un nombre ocupado y para uno reservado. Va bajo el campo, como `.field-error`, en el registro y en `/acceso/nombre`.

### Módulo de servidor `app/lib/jugadores/`

`servidor.ts` (con `import "server-only"`, usa `createAdminClient()`):

```ts
// Nombre de la cuenta en `jugadores`, o null si no tiene fila.
export async function nombreDeJugador(userId: string): Promise<string | null>;

// Inserta la fila. "ocupado" si el nombre ya existe sin distinguir mayúsculas
// (23505 del índice) o está reservado; "ya-tiene" si la cuenta ya tenía fila.
export async function reservarNombre(
  userId: string,
  username: string,
): Promise<"ok" | "ocupado" | "ya-tiene">;

// Lo que comparten `/auth/callback` y `asegurarNombre`.
export async function sincronizarNombre(usuario: {
  id: string;
  user_metadata: Record<string, unknown>;
}): Promise<{ nombre: string | null; metadatosCambiados: boolean }>;
```

`sincronizarNombre` sigue estos casos:

| Situación                                                   | Qué hace                                             | `nombre`      | `metadatosCambiados` |
| ----------------------------------------------------------- | ---------------------------------------------------- | ------------- | -------------------- |
| Tiene fila y los metadatos coinciden                        | Nada                                                 | el de la fila | `false`              |
| Tiene fila y los metadatos no coinciden                     | Reescribe `user_metadata.username` con el de la fila | el de la fila | `true`               |
| Sin fila, metadatos con nombre válido, libre y no reservado | `reservarNombre`                                     | el reservado  | `false`              |
| Sin fila, metadatos con nombre ocupado o reservado          | Pone `user_metadata.username` a `null`               | `null`        | `true`               |
| Sin fila y sin nombre válido en los metadatos (OAuth nuevo) | Nada                                                 | `null`        | `false`              |

`actions.ts` (`"use server"`):

```ts
// Para el registro: true si el nombre es válido, no reservado y libre.
export async function nombreDisponible(username: string): Promise<boolean>;

// Para /acceso/nombre. Exige sesión con getUser().
export async function elegirNombre(
  username: string,
): Promise<{ ok: true } | { ok: false; error: string }>;

// Para AuthProvider. Exige sesión con getUser(); sin sesión, no hace nada.
export async function asegurarNombre(): Promise<{
  metadatosCambiados: boolean;
}>;
```

`elegirNombre` comprueba en este orden:

| Paso | Comprobación                               | Respuesta si falla                                               |
| ---- | ------------------------------------------ | ---------------------------------------------------------------- |
| 1    | `getUser()` devuelve una cuenta            | `mensajeAuth(undefined)`                                         |
| 2    | `validarUsuario(username)` da `null`       | ese texto                                                        |
| 3    | `nombreReservado(username)` da `false`     | `ERROR_NOMBRE_NO_DISPONIBLE`                                     |
| 4    | `reservarNombre` no da `"ocupado"`         | `ERROR_NOMBRE_NO_DISPONIBLE`                                     |
| 5    | Si da `"ya-tiene"`, no cambia nada         | `{ ok: true }` y copia a los metadatos el nombre de la fila      |
| 6    | Copia el nombre a `user_metadata.username` | Si falla, `{ ok: true }` y `console.error`: el nombre ya es suyo |

Los rechazos por nombre ocupado no van a ningún log: los nombres son públicos y no hay nada que investigar.

### Refresco de la sesión en el navegador

El servidor escribe los metadatos con la clave secreta, y el navegador no se entera solo. Tras `elegirNombre` con `ok`, o `asegurarNombre` con `metadatosCambiados`, el cliente llama a `createClient().auth.refreshSession()`. El nuevo `user` llega por `onAuthStateChange`, como hoy, y `AuthProvider` recalcula `sinNombre`.

### Flujos

- **Registro con correo.** `AuthForm` valida en cliente y llama a `nombreDisponible`. Si da `false`, muestra el mensaje bajo el campo y no llama a `signUp`. Si la llamada falla, muestra el error genérico y tampoco llama a `signUp`. La fila se crea al confirmar el correo, en `/auth/callback`. Si otra cuenta tomó el nombre entre medias, el callback vacía los metadatos y lleva a `/acceso/nombre`.
- **Confirmación y OAuth (`/auth/callback`).** Tras `exchangeCodeForSession`, llama a `sincronizarNombre(data.user)`. Con `nombre`, va a `/home`; sin él, a `/acceso/nombre`. `origen=recuperacion` sigue yendo a `/acceso/nueva-clave` sin sincronizar.
- **Al abrir sesión (`AuthProvider`).** Llama a `asegurarNombre` una vez por `user.id` (con un ref), también cuando la sesión llega sin pasar por el callback, por ejemplo con `signInWithPassword`. Si devuelve `metadatosCambiados`, refresca la sesión.
- **`/acceso/nombre`.** `ElegirNombreForm` llama a `elegirNombre` en lugar de `updateUser` y, con `ok`, refresca la sesión. Su efecto de redirección no cambia.
- **Publicar (`guardarPuntuacion`).** Sustituye la lectura de `user_metadata.username` por `nombreDeJugador(userId)`. Sin fila, responde `ERROR_SIN_NOMBRE`. Escribe `normalizarNombre(nombre)` en `player_name`.

---

## Plan de implementación

Antes de escribir código hay que leer en `node_modules/next/dist/docs/` la guía de Server Actions (`01-app/02-guides/server-actions.md`). No hay interfaz nueva que diseñar: el mensaje reutiliza `.field-error`.

1. **Migración.** Aplicar `create_jugadores` con la tabla, el índice, RLS sin políticas, `revoke all` a `anon` y `authenticated`, y el alta de la cuenta existente. Regenerar `database.types.ts`. Verificación: `jugadores` tiene 1 fila, `get_advisors` de seguridad solo añade `rls_enabled_no_policy` sobre `jugadores`, y un `select` con la clave publishable falla con `42501`.
2. **Reservados.** Añadir `NOMBRES_RESERVADOS`, `ERROR_NOMBRE_NO_DISPONIBLE` y `nombreReservado` a `app/acceso/auth-schema.ts`. Verificación: un script temporal fuera del repositorio comprueba `admin`, `Invitado`, `JUGADOR` (reservados) y `px_kai` (no reservado).
3. **Módulo de servidor.** Crear `app/lib/jugadores/servidor.ts` con `nombreDeJugador`, `reservarNombre` y `sincronizarNombre`. Verificación: `npx tsc --noEmit` sin errores.
4. **Server Actions.** Crear `app/lib/jugadores/actions.ts` con `nombreDisponible`, `elegirNombre` y `asegurarNombre`. Verificación: `npx tsc --noEmit` sin errores.
5. **Callback.** En `app/auth/callback/route.ts`, decidir el destino con `sincronizarNombre` en lugar de `tieneUsuario(user_metadata.username)`. Verificación: con una cuenta de prueba sin fila cuyo nombre está libre, el retorno crea la fila y va a `/home`.
6. **`AuthProvider`.** Llamar a `asegurarNombre` una vez por `user.id` y refrescar la sesión si devuelve `metadatosCambiados`. Verificación: una cuenta de prueba con fila y metadatos cambiados por API ve su nombre real en la barra tras recargar.
7. **`/acceso/nombre`.** En `ElegirNombreForm`, sustituir `updateUser` por `elegirNombre`, mostrar `ERROR_NOMBRE_NO_DISPONIBLE` bajo el campo y refrescar la sesión con `ok`. Verificación: un nombre ocupado muestra el mensaje y uno libre lleva a `/home`.
8. **Registro.** En `AuthForm`, llamar a `nombreDisponible` tras `validarRegistro` y antes de `signUp`. Verificación: un nombre ocupado, escrito con otras mayúsculas, muestra el mensaje bajo el campo y la red no registra la llamada a `/auth/v1/signup`.
9. **Publicar.** En `guardarPuntuacion`, tomar el nombre de `nombreDeJugador`. Verificación: con metadatos cambiados por API a otro nombre válido, la puntuación se guarda con el nombre de la tabla.
10. **Documentación.** Marcar en `references/security/security-checklist.md` la casilla «`username` único y no modificable». Actualizar en `CLAUDE.md` la lista de specs, la sección de Supabase (tabla `jugadores` y nombre), `AuthProvider`, `ElegirNombreForm`, el registro de `AuthForm`, `/auth/callback` y `guardarPuntuacion`.

---

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `jugadores` existe con RLS activa, sin políticas y sin permisos para `anon` ni `authenticated`: leerla con la clave publishable falla con `42501`.
- [ ] Tras la migración, la cuenta existente tiene su fila con el nombre de sus metadatos.
- [ ] Insertar por SQL `ana` cuando existe `ANA` falla por `jugadores_username_lower_idx`.
- [ ] Insertar por SQL `admin`, `Invitado` o `JUGADOR` falla por el `check` de reservados.
- [ ] En `/acceso/nombre`, un nombre ocupado escrito con otras mayúsculas muestra `Ese nombre no está disponible. Elige otro.` bajo el campo y no crea fila.
- [ ] En `/acceso/nombre`, `admin`, `Invitado` y `JUGADOR` muestran el mismo mensaje.
- [ ] En `/acceso/nombre`, un nombre libre crea la fila, copia el nombre a los metadatos y lleva a `/home` con el nombre en la barra.
- [ ] Llamar a `elegirNombre` desde una cuenta que ya tiene fila no cambia su nombre.
- [ ] En el registro, un nombre ocupado o reservado muestra el mensaje bajo el campo y no llama a `signUp`.
- [ ] En el registro, un nombre libre sigue mostrando «REVISA TU CORREO».
- [ ] Con una cuenta sin fila cuyo nombre de los metadatos está libre, `/auth/callback` crea la fila y lleva a `/home`.
- [ ] Con una cuenta sin fila cuyo nombre de los metadatos ya es de otra, `/auth/callback` vacía sus metadatos y lleva a `/acceso/nombre`.
- [ ] Una cuenta sin fila que entra con contraseña, sin pasar por el callback, recibe su fila al cargar la app, o va a `/acceso/nombre` si su nombre está ocupado.
- [ ] Una cuenta con fila cuyo `username` se cambió por API ve de nuevo su nombre real en la barra tras recargar.
- [ ] Con los metadatos cambiados por API, `guardarPuntuacion` guarda la puntuación con el nombre de `jugadores`.
- [ ] Una cuenta sin fila recibe `ERROR_SIN_NOMBRE` al guardar.
- [ ] Borrar una cuenta de prueba deja su fila con `user_id` nulo, y otra cuenta no puede elegir ese nombre.
- [ ] La vista `leaderboard`, `queries.ts` y los permisos de `scores` no cambian.
- [ ] Entrar con Google con una cuenta que ya tiene nombre sigue llevando a `/home` sin pasar por `/acceso/nombre`.
- [ ] Las cuentas de prueba, sus filas de `jugadores` (incluidas las de `user_id` nulo), sus partidas y sus puntuaciones se borran al terminar.
- [ ] Los cinco juegos reales, `/salon` y `/acceso` no muestran errores nuevos en consola.
- [ ] `CLAUDE.md` describe la tabla `jugadores`, las tres Server Actions, los nombres reservados y la copia en los metadatos.

---

## Decisiones

- **Sí:** el nombre es fijo para siempre (decisión del usuario). Es lo que adelantó la SPEC 23, y el texto de `/acceso/nombre` ya avisa de que no se podrá cambiar. **No:** cambiarlo desde la app, que exige decidir qué pasa con las puntuaciones antiguas y una pantalla nueva.
- **Sí:** unicidad sin distinguir mayúsculas (decisión del usuario). El ranking ya muestra los nombres en mayúsculas, así que `Ana` y `ANA` se verían iguales. Se conserva cómo lo escribió el jugador para la barra.
- **Sí:** el nombre de una cuenta borrada queda reservado para siempre (decisión del usuario). Así nombre y cuenta son lo mismo, y el ranking puede seguir agrupando por nombre. **No:** liberarlo, que obligaría a agrupar por `user_id` y a reabrir SEG-008 o a usar una vista `security definer`.
- **Sí:** tabla `jugadores` solo para el servidor (decisión del usuario). Es la única forma de que el nombre no se pueda cambiar por API. **No:** seguir en `user_metadata` con un trigger en `auth.users`, que no impide `updateUser`.
- **Sí:** el registro comprueba el nombre antes de `signUp` y lo reserva al abrir la primera sesión (decisión del usuario). No se reserva un nombre para una cuenta que quizá nunca confirme el correo. **No:** quitar el nombre del registro, que añade una pantalla a todos.
- **Sí:** `user_metadata.username` como copia que escribe el servidor (decisión del usuario). `AuthProvider`, la barra y `ExigirNombre` siguen igual. **No:** que el cliente lea su fila de `jugadores`, que necesitaría una política y cambiaría la detección de `sinNombre`.
- **Sí:** `asegurarNombre` al abrir sesión, una vez por cuenta (decisión del usuario). Cubre la cuenta existente y la que entra con contraseña sin pasar por el callback. Cuesta una petición al cargar la app con sesión. **No:** reservar al guardar, que avisaría tarde. **No:** solo el callback, que deja cuentas sin poder publicar y sin aviso.
- **Sí:** `asegurarNombre` reescribe los metadatos cambiados por API (decisión del usuario). La barra siempre muestra el nombre real.
- **Sí:** reservar `JUGADOR`, `INVITADO` y `ADMIN` (decisión del usuario). `JUGADOR` es lo que se ve sin nombre e `INVITADO` el nombre de las maquetas sin sesión. Se comprueban en el código y en un `check` de la tabla.
- **Sí:** un solo mensaje para nombre ocupado y reservado (decisión del usuario). Quien elige no necesita saber cuál de los dos es.
- **Sí:** `nombreDisponible` revela si un nombre existe. Los nombres ya son públicos en el ranking, así que no filtra nada nuevo.
- **No:** tocar `obtenerMejorMarca` (decisión del usuario). Solo lee datos públicos, y con nombres únicos el nombre ya identifica a una cuenta.
- **No:** cambiar la vista `leaderboard`. Con nombres únicos y reservados para siempre, agrupar por `upper(player_name)` ya agrupa por cuenta.
- **Sí:** refrescar la sesión en el navegador tras escribir los metadatos desde el servidor. Sin eso, `AuthProvider` no vería el cambio hasta el siguiente refresco del token (CLAUDE.md: `updateUser` no renueva el JWT).
- **Sí:** verificar con cuentas de prueba creadas con la clave secreta (decisión del usuario), como en las SPEC 22 y 23. No gasta correos.

---

## Riesgos

| Riesgo                                                                     | Mitigación                                                                                                                                                         |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dos registros eligen el mismo nombre libre a la vez                        | El índice único decide en la base de datos. El que confirma después ve vaciados sus metadatos y elige otro en `/acceso/nombre`.                                    |
| `updateUserById` sustituye todos los metadatos en lugar de fusionarlos     | El paso 6 lo comprueba con una cuenta de prueba creada con otro campo en los metadatos (`full_name`), que debe seguir ahí. Si no se fusionan, se envían completos. |
| `refreshSession()` falla y la barra sigue con el nombre anterior           | Solo afecta a la barra hasta el siguiente refresco del token. Las puntuaciones usan siempre la tabla.                                                              |
| `asegurarNombre` falla por la red al cargar la app                         | La app funciona igual. Se reintenta en la siguiente carga, y `guardarPuntuacion` exige la fila de todos modos.                                                     |
| Un nombre reservado para siempre agota los nombres cortos con el tiempo    | Riesgo aceptado: hay 37 caracteres y de 3 a 10 posiciones.                                                                                                         |
| Una cuenta de Google se vincula a una cuenta de correo pendiente (SPEC 20) | Las cuentas pendientes nunca abren sesión, así que no tienen fila. La cuenta vinculada elige nombre como hoy.                                                      |
| El usuario borra su cuenta por error y quiere recuperar el nombre          | Fuera de alcance. Un administrador puede borrar la fila con la clave secreta.                                                                                      |

---

## Qué **no** está en este spec

- Cambiar el nombre después de elegirlo.
- Liberar los nombres de las cuentas borradas.
- Agrupar el ranking por `user_id` o cambiar la vista `leaderboard`.
- Cambiar `obtenerMejorMarca`.
- Filtro de nombres ofensivos.
- Los juegos de maqueta.

Cada uno de ellos, si se aborda, va en su propio spec.
