# SPEC 22 — Puntuaciones validadas en servidor

> **Status:** Aprobado
> **Depends on:** SPEC 07 (`scores`, `leaderboard` y `guardarPuntuacion`), SPEC 18 (sesión y `user_metadata.username`), SPEC 19 (cuentas sin nombre)
> **Date:** 2026-11-06
> **Objective:** Impedir que una llamada directa a la API publique una puntuación: solo el servidor escribe en `scores`, solo para cuentas y solo con una partida iniciada cuyos puntos sean posibles para el tiempo jugado.

---

## Por qué existe este spec

La SPEC 21 cierra el checklist básico y deja fuera las puntuaciones falsas. El usuario exige que no se puedan publicar puntuaciones arbitrarias con una llamada directa a la API.

Hoy hay dos puertas abiertas:

1. **PostgREST.** La política `scores_insert_public` deja insertar con la clave publishable, que es pública.
2. **La Server Action `guardarPuntuacion`.** Es un endpoint público que se fía del `score` que envía el navegador.

Cerrar solo la primera no sirve: `guardarPuntuacion` aceptaría igualmente cualquier cifra.

### Qué no garantiza esta spec

El juego corre en el navegador, así que el servidor nunca ve la partida, solo un número. Esta spec bloquea las llamadas sin partida, las de otra cuenta, las repetidas y las cifras imposibles para el tiempo jugado.

No bloquea a quien abra una partida real, espere y envíe una cifra creíble. Cerrar ese caso exige que el servidor reproduzca cada partida, y el usuario lo descartó (ver «Decisiones»).

---

## Alcance

**In:**

- Tabla `partidas`, sin acceso desde la API, con una fila por partida iniciada.
- Columna `scores.partida_id`, única, para que cada partida publique una sola vez.
- Cliente de servidor con clave secreta, en `app/lib/supabase/admin.ts`.
- Server Action `iniciarPartida` y nueva firma de `guardarPuntuacion`.
- Límites por juego: tope absoluto y puntos por segundo.
- Solo las cuentas publican en el ranking, en los 5 juegos reales.
- Modal de fin de juego para invitados con aviso y enlace a `/acceso`.
- Borrar las 2 puntuaciones de invitado que hay en `scores`.
- Quitar `scores_insert_public` y los permisos de escritura de `anon` y `authenticated` en `scores`.
- Lectura pública de `scores` sin `user_id` ni `partida_id` (SEG-008 de `references/security/security-review.md`).
- `tieneUsuario` exige `PATRON_USUARIO`, para que el servidor rechace un `username` escrito por API (SEG-002).
- Actualizar `.env.example`, `CLAUDE.md` y `.claude/skills/new-game/puntos-de-integracion.md`.

**Out of scope (para futuros specs):**

- Reproducir la partida en el servidor.
- Enviar un registro de la partida o de las entradas del jugador.
- Descontar las pausas del tiempo jugado.
- Limitar cuántas partidas abre una cuenta.
- Panel de moderación o borrado de puntuaciones sospechosas.
- Los 8 juegos de maqueta, que siguen en `localStorage`.
- Ofuscar el código de los motores.

---

## Modelo de datos

### Tabla `partidas`

```sql
create table public.partidas (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games (id),
  user_id uuid not null references auth.users (id) on delete cascade,
  iniciada_en timestamptz not null default now()
);
```

Tiene RLS activa y ninguna política. Se revocan todos los permisos a `anon` y `authenticated`, así que solo se accede con la clave secreta.

### Cambios en `scores`

```sql
alter table public.scores
  add column partida_id uuid unique references public.partidas (id) on delete set null;
```

- `UNIQUE` hace que publicar dos veces la misma partida falle en la base de datos.
- Se borran las filas con `user_id` nulo: hoy son 2, de Snake y Tetris.
- `user_id` sigue admitiendo nulos, porque `ON DELETE SET NULL` conserva la puntuación al borrar una cuenta.
- Se elimina `scores_insert_public`.
- Se revoca `INSERT`, `UPDATE`, `DELETE` y `TRUNCATE` a `anon` y `authenticated`.
- `SELECT` pasa a ser por columnas, sin `id`, `user_id` ni `partida_id`:

```sql
revoke select on public.scores from anon, authenticated;
grant select (game_id, player_name, score, created_at)
  on public.scores to anon, authenticated;
```

- La política de `SELECT` no cambia. La vista `leaderboard` tampoco: con `security_invoker` solo necesita esas cuatro columnas.
- `queries.ts` y `obtenerMejorMarca` no cambian, porque solo leen esas columnas. La clave secreta no se ve afectada.
- `select=*` sobre `scores` pasa a fallar con la clave publishable, y la vista `leaderboard` lo sigue admitiendo.

Hay que regenerar `app/lib/supabase/database.types.ts`.

### Límites por juego

Se añaden a `app/lib/leaderboard/schema.ts`:

```ts
export const LIMITES_POR_JUEGO: Record<
  string,
  { puntosMax: number; puntosPorSegundo: number }
> = {
  asteroides: { puntosMax: 1_000_000, puntosPorSegundo: 500 },
  tetris: { puntosMax: 1_000_000, puntosPorSegundo: 2_000 },
  arkanoid: { puntosMax: 2_080, puntosPorSegundo: 200 },
  snake: { puntosMax: 1_000_000, puntosPorSegundo: 160 },
  frogger: { puntosMax: 1_000_000, puntosPorSegundo: 300 },
};
export const GRACIA_SEGUNDOS = 5;
export const PARTIDA_MAX_SEGUNDOS = 6 * 60 * 60;

export function puntuacionPosible(
  game: string,
  score: number,
  segundos: number,
): boolean;
```

Una puntuación es posible si cumple tres condiciones:

- `score <= puntosMax`.
- `segundos <= PARTIDA_MAX_SEGUNDOS`.
- `score <= (segundos + GRACIA_SEGUNDOS) * puntosPorSegundo`.

Los valores son techos, no estimaciones, porque un límite ajustado rechazaría a jugadores reales:

| Juego        | Base del límite                                                                          |
| ------------ | ---------------------------------------------------------------------------------------- |
| `asteroides` | 5 asteroides pequeños por segundo, a 100 puntos cada uno                                 |
| `tetris`     | Crece con el nivel: 800 × nivel por cuatro líneas. Cubre un ritmo experto hasta nivel 15 |
| `arkanoid`   | 20 bloques por segundo, a 10 puntos. El tope es la suma exacta de los 208 bloques        |
| `snake`      | 16 pasos por segundo, a 10 puntos por fruta: no se puede superar                         |
| `frogger`    | Unos 380 puntos por cruce, que dura 1,6 s como mínimo, más las bocas                     |

### Firma de las acciones

```ts
export async function iniciarPartida(
  game: string,
): Promise<{ ok: boolean; partidaId?: string }>;

export async function guardarPuntuacion(envio: {
  partidaId: string;
  score: number;
}): Promise<{ ok: boolean; error?: string }>;
```

`guardarPuntuacion` ya no recibe `game` ni `name`: el juego sale de la partida y el nombre de la cuenta.

### Comprobaciones de `guardarPuntuacion`

Se aplican en este orden, antes de insertar:

| Comprobación                                    | Si falla                                                 |
| ----------------------------------------------- | -------------------------------------------------------- |
| Hay sesión                                      | `[ERR] Inicia sesión para entrar en el ranking.`         |
| La cuenta tiene un `username` válido            | `ERROR_SIN_NOMBRE`, el mensaje actual                    |
| `partidaId` es un UUID y `score` un entero >= 0 | `[ERR] No se pudo validar esta puntuación.`              |
| La partida existe y es de esta cuenta           | `[ERR] No se pudo validar esta puntuación.`              |
| `puntuacionPosible` devuelve `true`             | `[ERR] No se pudo validar esta puntuación.`              |
| El `insert` no viola `UNIQUE` (`23505`)         | `[ERR] No se pudo validar esta puntuación.`              |
| El `insert` no da otro error                    | `ERROR_GUARDADO`, el mensaje actual: se puede reintentar |

Cada rechazo por validación se registra con `console.warn` en el servidor, con el motivo y sin datos de la cuenta. El mensaje del cliente nunca explica el motivo.

### Nombre válido

Cada cuenta puede cambiar `user_metadata.username` con una llamada directa a `updateUser`, sin pasar por `validarUsuario`. Por eso `tieneUsuario`, en `app/acceso/auth-schema.ts`, pasa a comprobar también `PATRON_USUARIO`:

```ts
export function tieneUsuario(username: unknown): boolean {
  return typeof username === "string" && PATRON_USUARIO.test(username);
}
```

El cambio llega a sus tres usos sin tocarlos. `guardarPuntuacion` devuelve `ERROR_SIN_NOMBRE`, y tanto `AuthProvider` (`sinNombre`) como `/auth/callback` llevan esa cuenta a `/acceso/nombre`, donde elige un nombre válido.

### Variable de entorno

| Variable              | Valor                                           |
| --------------------- | ----------------------------------------------- |
| `SUPABASE_SECRET_KEY` | Clave `sb_secret_...`, nunca con `NEXT_PUBLIC_` |

`app/lib/supabase/env.ts` la valida solo en servidor y `app/lib/supabase/admin.ts` lleva `import "server-only"`.

---

## Plan de implementación

Antes de escribir código hay que leer la guía de Server Actions en `node_modules/next/dist/docs/`. El modal del invitado se diseña con `/frontend-design`, reutilizando `.modal` y `.btn`.

El orden importa: la escritura directa se cierra al final. Si se cerrara antes, `guardarPuntuacion` dejaría de funcionar mientras sigue usando el cliente de la sesión.

1. **Clave secreta (manual, en el panel).** En **Project Settings > API Keys**, crear una clave `sb_secret_...`. Añadirla a `.env.local` como `SUPABASE_SECRET_KEY`. Verificación: la variable existe en `.env.local` y su valor empieza por `sb_secret_`, sin mostrarlo.
2. **Cliente de servidor.** Añadir la variable a `.env.example` y a `env.ts`. Crear `app/lib/supabase/admin.ts` con `createClient` de `@supabase/supabase-js`, sin cookies y sin persistir la sesión. Verificación: `npm run build` sin errores y `sb_secret` no aparece en `.next/static`.
3. **Migración `add_partidas`.** Crear `partidas` y `scores.partida_id`, y regenerar los tipos. Es un cambio aditivo: el guardado actual sigue funcionando. Verificación: un `GET` a `/rest/v1/partidas` con la clave publishable no devuelve datos.
4. **Límites.** Añadir `LIMITES_POR_JUEGO`, `GRACIA_SEGUNDOS`, `PARTIDA_MAX_SEGUNDOS` y `puntuacionPosible` a `schema.ts`. Verificación: con un script temporal fuera del repositorio, `puntuacionPosible("snake", 801, 0)` da `false` y `puntuacionPosible("snake", 800, 0)` da `true`, porque la gracia permite 5 × 160 puntos.
5. **`iniciarPartida`.** Añadirla a `app/lib/leaderboard/actions.ts`. Exige sesión y un juego de `JUEGOS_CON_RANKING`, borra las partidas de esa cuenta más antiguas que `PARTIDA_MAX_SEGUNDOS` e inserta la nueva con el cliente secreto. Verificación: `npx tsc --noEmit` sin errores.
6. **`GamePlayer`.** Guardar el id en `partidaRef`, un `useRef` porque no se pinta. Pedirlo en un efecto que depende de `esReal`, `user?.id` y `restartKey`, ignorando la respuesta si el efecto ya se limpió. Si falla, la partida se juega igual y al guardar sale el error. Verificación: cada reinicio crea una fila en `partidas`.
7. **`guardarPuntuacion`.** Cambiar `tieneUsuario` como indica «Nombre válido». Cambiar la firma, aplicar la tabla de «Comprobaciones» e insertar con el cliente secreto, incluyendo `partida_id`. Actualizar la llamada de `guardar` en `GamePlayer`. Verificación: una partida real con sesión aparece en `/salon`.
8. **Modal del invitado.** En `game-player.tsx`, con `esReal && !user`, sustituir el campo de nombre y GUARDAR por «INICIA SESIÓN PARA ENTRAR EN EL RANKING» y un enlace a `/acceso`, conservando JUGAR DE NUEVO. Sin `input`, `use-dialog.ts` enfoca el primer elemento enfocable, así que el enlace debe ir antes que JUGAR DE NUEVO. Las maquetas no cambian. Verificación: sin sesión, el modal se usa con teclado a 320 px.
9. **Migración `close_scores_writes`.** Borrar las filas con `user_id` nulo, eliminar `scores_insert_public`, revocar los permisos de escritura y dejar `SELECT` por columnas. Verificación: un `POST` a `/rest/v1/scores` con la clave publishable falla, un `GET` con `select=user_id` falla, `/salon` y `/home` siguen mostrando datos, y `get_advisors` no da avisos nuevos de seguridad sobre `scores` ni `partidas`.
10. **Documentación.** Actualizar en `CLAUDE.md` la lista de specs, `app/lib/leaderboard/`, la RLS (incluido el `SELECT` por columnas de `scores`), la regla de `tieneUsuario` y las variables de entorno, indicando lo que esta spec no garantiza. Añadir en `.claude/skills/new-game/puntos-de-integracion.md` que un juego nuevo necesita su entrada en `LIMITES_POR_JUEGO`.

---

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `sb_secret` no aparece en `.next/static` ni en la respuesta de ninguna página.
- [ ] Un `POST` a `/rest/v1/scores` con la clave publishable, sin sesión, falla y no crea ninguna fila.
- [ ] Un `POST` a `/rest/v1/scores` con el token de una cuenta real falla y no crea ninguna fila.
- [ ] Un `PATCH` o un `DELETE` a `/rest/v1/scores` con la clave publishable no cambia ninguna fila.
- [ ] `GET`, `POST` y `DELETE` a `/rest/v1/partidas` no devuelven ni cambian ninguna fila, con o sin token de cuenta.
- [ ] Un `GET` a `/rest/v1/scores` con `select=user_id`, `select=partida_id` o `select=*` falla, con la clave publishable y con el token de una cuenta real.
- [ ] Un `GET` a `/rest/v1/scores` con `select=game_id,player_name,score,created_at` devuelve filas.
- [ ] `/salon`, `/juegos/asteroides` y `/home` siguen mostrando los rankings.
- [ ] `scores` no tiene filas con `user_id` nulo tras la migración.
- [ ] Con sesión, terminar una partida y guardar funciona en los 5 juegos, y la puntuación aparece en `/salon`.
- [ ] Reenviar la petición de `guardarPuntuacion` de esa partida responde `[ERR] No se pudo validar esta puntuación.` y no crea otra fila.
- [ ] Llamar a `guardarPuntuacion` con un `partidaId` inventado responde con ese mismo mensaje.
- [ ] Llamar a `guardarPuntuacion` con la partida de otra cuenta responde con ese mismo mensaje.
- [ ] Llamar a `guardarPuntuacion` sin sesión responde `[ERR] Inicia sesión para entrar en el ranking.` y no crea ninguna fila.
- [ ] Modificar el `score` de una petición real a 999.999 en una partida de pocos segundos responde `[ERR] No se pudo validar esta puntuación.`
- [ ] Una puntuación de Arkanoid superior a 2.080 se rechaza aunque haya pasado mucho tiempo.
- [ ] El nombre publicado es siempre el `username` de la cuenta.
- [ ] `puntuacionPosible` da `false` con una partida de más de 6 horas.
- [ ] Una cuenta sin `username` recibe `ERROR_SIN_NOMBRE` y no publica.
- [ ] Una cuenta con un `username` fuera de `PATRON_USUARIO`, fijado con una llamada directa a `updateUser`, recibe `ERROR_SIN_NOMBRE`, no publica y la app la lleva a `/acceso/nombre`.
- [ ] Una cuenta con un nombre válido no ve `/acceso/nombre` al entrar por correo, Google o GitHub.
- [ ] Un fallo de red al guardar conserva el modal, y pulsar de nuevo el botón de guardar publica la puntuación con la misma partida.
- [ ] Sin sesión, los 5 juegos se pueden jugar y el modal muestra la puntuación, «INICIA SESIÓN PARA ENTRAR EN EL RANKING», el enlace a `/acceso` y JUGAR DE NUEVO.
- [ ] Sin sesión, terminar una partida no llama a `guardarPuntuacion` ni a `iniciarPartida`.
- [ ] El modal del invitado se usa solo con teclado y sin scroll horizontal a 320 px.
- [ ] Las 8 maquetas siguen guardando en `localStorage` con su campo de nombre.
- [ ] Una partida normal de cada juego real no se rechaza, incluida una con pausas.
- [ ] No hay errores nuevos en consola en `/juegos/[id]/jugar`, `/salon` ni `/home`.
- [ ] `CLAUDE.md` describe el flujo, la variable `SUPABASE_SECRET_KEY` y lo que esta spec no garantiza.

---

## Decisiones

- **Sí:** cerrar la escritura directa y validar cada partida (decisión del usuario). **No:** cerrar solo PostgREST, porque `guardarPuntuacion` seguiría aceptando cualquier cifra.
- **No:** reproducir la partida en el servidor (decisión del usuario). Es lo único cercano a una garantía real, pero exige rehacer los 5 motores para que sean deterministas.
- **Sí:** spec propia, separada de la 21 (decisión del usuario).
- **Sí:** solo las cuentas publican (decisión del usuario). Sustituye a la decisión de la SPEC 18 de mantener invitados en el ranking.
- **Sí:** borrar las 2 puntuaciones de invitado (decisión del usuario). Así, todo lo que aparece en el ranking ha pasado por la validación.
- **Sí:** aviso y enlace a `/acceso` en el modal del invitado (decisión del usuario). Esa partida no se guarda ni se recupera tras iniciar sesión, porque no tendría una partida validada.
- **Sí:** mensaje genérico al rechazar (decisión del usuario). Explicar el motivo ayudaría a afinar una cifra creíble.
- **Sí:** clave secreta en el servidor. **No:** función `SECURITY DEFINER` expuesta por RPC, que sería otra puerta pública y volvería a abrir el aviso que corrige la SPEC 21.
- **Sí:** tabla `partidas`. **No:** token firmado sin estado, que no impediría reutilizarlo sin guardar además qué tokens se gastaron.
- **Sí:** `UNIQUE` en `scores.partida_id`. La base de datos resuelve la doble publicación de forma atómica, y un fallo de red no gasta la partida.
- **Sí:** el id de partida en `useRef`, porque no se pinta.
- **Sí:** contar el tiempo total, con las pausas incluidas. Medirlas requeriría fiarse del navegador, y así el límite solo se vuelve más permisivo.
- **Sí:** `GRACIA_SEGUNDOS`, porque el motor arranca antes de que llegue la respuesta de `iniciarPartida`.
- **No:** limitar cuántas partidas abre una cuenta. `leaderboard` solo muestra la mejor de cada jugador, así que publicar muchas no da ventaja.
- **No:** invalidar la partida anterior al abrir otra, que fallaría con dos pestañas abiertas.
- **No:** quitar `user_id` nulo de `scores`, porque borrar una cuenta lo pone a `NULL`.
- **Sí:** `SELECT` por columnas en `scores` (SEG-008). **No:** una vista pública nueva, que obligaría a cambiar `queries.ts` y no cerraría la lectura directa de la tabla. Sin este cambio, al publicar solo las cuentas cada fila expondría su `user_id`.
- **Sí:** comprobar `PATRON_USUARIO` dentro de `tieneUsuario` (SEG-002). **No:** comprobarlo solo en `guardarPuntuacion`, porque la app trataría ese nombre como válido y la cuenta no podría corregirlo: `ExigirNombre` no la llevaría a `/acceso/nombre`.

---

## Riesgos

| Riesgo                                                                                       | Mitigación                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alguien inicia una partida real, espera y envía una cifra creíble                            | Riesgo aceptado por el usuario. Queda escrito en `CLAUDE.md` para no darlo por resuelto.                                                                                      |
| Un límite rechaza a un jugador real                                                          | Los límites son techos sobre las constantes de cada motor. Un criterio prueba una partida normal por juego. Los rechazos quedan en el log del servidor para poder ajustarlos. |
| Se filtra `SUPABASE_SECRET_KEY`, que salta la RLS                                            | Sin prefijo `NEXT_PUBLIC_`, con `import "server-only"` y un criterio que la busca en `.next/static`. Si se filtra, se revoca en el panel y se crea otra.                      |
| La clave secreta se combina con las cookies y la sesión del usuario sustituye sus permisos   | `admin.ts` no lee cookies ni persiste sesión. La lectura de la sesión sigue en el cliente de `server.ts`.                                                                     |
| Cerrar la escritura rompe el guardado                                                        | El paso 9 va después de que todo escriba con la clave secreta. La migración se puede revertir volviendo a crear la política.                                                  |
| Una cuenta nueva por partida esquiva cualquier límite por cuenta                             | No hay límite por cuenta que esquivar, y cada partida sigue sujeta al límite de tiempo.                                                                                       |
| Un invitado que inicia sesión al terminar pierde esa partida                                 | Riesgo aceptado: es el coste de exigir una partida validada. El aviso del modal aparece antes de salir de la pantalla.                                                        |
| Quien inicia sesión a media partida la abre con el reloj en ese momento                      | El efecto crea una partida nueva al cambiar `user?.id`. El límite resulta más estricto, y esa ruta exige salir del juego, así que solo pasaría con otra pestaña.              |
| `partidas` acumula filas                                                                     | `iniciarPartida` borra las caducadas de esa cuenta. Quedan las de cuentas que no vuelven, un volumen despreciable.                                                            |
| Un juego nuevo no tiene entrada en `LIMITES_POR_JUEGO`                                       | `puntuacionPosible` devuelve `false` si falta. `puntos-de-integracion.md` lo indica.                                                                                          |
| En desarrollo, Strict Mode pide dos partidas al montar                                       | El efecto ignora la respuesta limpiada y la fila sobrante caduca sola.                                                                                                        |
| Al desplegar falta la variable                                                               | `env.ts` lanza un error que la nombra. La configuración de producción está fuera de esta spec.                                                                                |
| Un `GRANT SELECT` futuro sobre toda la tabla reabre `user_id`                                | Un permiso de tabla anula los de columna. `CLAUDE.md` lo indica y un criterio comprueba el `GET` con `select=user_id`.                                                        |
| El `SELECT` por columnas rompe una lectura de `scores`                                       | `queries.ts` y `leaderboard` solo usan las cuatro columnas concedidas, comprobado en el código y en la definición de la vista. El paso 9 revisa `/salon` y `/home`.           |
| `tieneUsuario` es más estricto y manda a `/acceso/nombre` a una cuenta con un nombre antiguo | `validarUsuario` aplica el mismo patrón desde la SPEC 18. Si alguna cuenta no lo cumple, elige un nombre válido y conserva sus puntuaciones.                                  |

---

## Qué **no** está en este spec

- Reproducir la partida en el servidor.
- Registro de la partida o de las entradas del jugador.
- Descontar las pausas del tiempo jugado.
- Límite de partidas por cuenta.
- Panel de moderación.
- Los 8 juegos de maqueta.
- Ofuscar el código de los motores.

Cada uno de ellos, si se aborda, va en su propio spec.
