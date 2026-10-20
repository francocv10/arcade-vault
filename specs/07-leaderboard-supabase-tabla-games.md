# SPEC 07 — Leaderboard real en Supabase y tabla `games`

> **Status:** Aprobado
> **Depends on:** SPEC 05 (clientes de Supabase), SPEC 06 (juego `asteroides` y su modal de fin de juego)
> **Date:** 2026-10-19
> **Objective:** Crear en Supabase las tablas `games` (solo con `asteroides`) y `scores` (con `user_id` opcional) y conectar a ellas el guardado de puntuaciones de Asteroides y los rankings de `/salon`, `/juegos/asteroides` y `/home`, sin exigir autenticación al jugador.

---

## Por qué existe este spec

Hoy el ranking es falso: `seededScores` (`app/data/scores.ts`) genera filas con un generador pseudoaleatorio, el Home muestra `RECENT_ACTIVITY` y `TOP_TODAY` estáticos, y `saveScore` (`AuthProvider`) guarda en `localStorage` puntuaciones que ninguna pantalla lee. SPEC 05 dejó Supabase conectado pero sin tablas, y SPEC 06 entregó el primer juego real (`asteroides`), que ya envía su puntuación al modal de fin de juego. Este spec cierra ese circuito para ese juego: la puntuación se guarda en la base de datos y se lee de ella en todas las pantallas de ranking.

La autenticación real sigue fuera: el jugador firma con el nombre del modal (como hoy). La columna `user_id` se crea ya, opcional, para que el spec de auth no tenga que migrar la tabla.

---

## Alcance

**In:**

- Migración de Supabase (aplicada con el MCP) que crea:
  - Tabla `public.games` con una única fila: `asteroides`.
  - Tabla `public.scores` con `user_id` nullable.
  - Vista `public.leaderboard` (mejor puntuación por jugador y juego).
  - Índices, restricciones `CHECK` y políticas RLS (ver Modelo de datos).
- Tipos TypeScript generados (`generate_typescript_types`) en `app/lib/supabase/database.types.ts`, usados como genérico en los dos `createClient` de SPEC 05.
- Capa de acceso a datos en `app/lib/leaderboard/`: validación del envío, consultas y Server Actions.
- Guardado: cuando `gameId === "asteroides"`, GUARDAR PUNTUACIÓN del modal llama a la Server Action en lugar de `saveScore`. Si falla (red, validación, 500) muestra un aviso `[ERR]` y conserva el modal y el nombre escrito (igual que `ContactForm` en SPEC 03/04).
- Lectura real para `asteroides` en:
  - `/salon`: podio y tabla de la pestaña ASTEROIDES.
  - `/juegos/asteroides`: top 10 de la ficha.
  - `/home`: tarjetas «ÚLTIMAS PUNTUACIONES» y «TOP JUGADORES · HOY».
- «TU MEJOR MARCA» del Salón: para ASTEROIDES, la mejor puntuación guardada con el nombre del usuario en sesión local (comparación sin distinguir mayúsculas); si no tiene ninguna, el bloque no se muestra.
- Estado vacío explícito en podio, tabla y Home cuando no hay puntuaciones reales.
- Los datos mostrados se actualizan tras guardar una puntuación (invalidación de caché).
- Documentar el spec, las tablas y los archivos nuevos en `CLAUDE.md`.

**Out of scope (para futuros specs):**

- Autenticación real con Supabase Auth: `user_id` queda siempre en `NULL`. `/acceso`, `AuthForm` y `AuthProvider` no cambian.
- Anti-trampas (firmas, sesiones de partida verificadas en servidor). Solo hay validación básica.
- Insertar en `games` los otros 7 juegos del catálogo: se añaden uno a uno cuando se porten. Las maquetas siguen con `seededScores` y `saveScore` a `localStorage`.
- Migrar `app/data/games.ts` a la base de datos: el catálogo (biblioteca, home, ficha) sigue siendo estático; `games.id = "asteroides"` coincide con `GAMES`.
- Migrar o importar las puntuaciones de `av_scores` en `localStorage`: se ignoran.
- `HOME_STATS` y el campo `best`/`plays` de la ficha (siguen estáticos).
- Realtime, paginación del ranking, borrado o moderación de puntuaciones, perfiles y avatares.
- Tests automatizados.

---

## Modelo de datos

```sql
create table public.games (
  id         text primary key,
  title      text not null,
  category   text not null,
  created_at timestamptz not null default now()
);

insert into public.games (id, title, category)
values ('asteroides', 'ASTEROIDES', 'SHOOTER');

create table public.scores (
  id          uuid primary key default gen_random_uuid(),
  game_id     text not null references public.games (id),
  player_name text not null check (char_length(player_name) between 1 and 10),
  score       integer not null check (score between 0 and 1000000),
  user_id     uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc);
create index scores_created_at_idx on public.scores (created_at desc);

-- Mejor puntuación por jugador y juego (un nombre aparece una sola vez).
create view public.leaderboard with (security_invoker = true) as
select distinct on (game_id, upper(player_name))
  game_id, upper(player_name) as player_name, score, created_at
from public.scores
order by game_id, upper(player_name), score desc, created_at asc;
```

RLS (activada en ambas tablas):

| Tabla    | Política                                                                                                                                             |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `games`  | `SELECT` para `anon` y `authenticated`. Sin `INSERT`/`UPDATE`/`DELETE` desde la API (la fila se crea con la migración).                              |
| `scores` | `SELECT` para `anon` y `authenticated`. `INSERT` para `anon` y `authenticated` con `user_id is null or user_id = auth.uid()`. Sin `UPDATE`/`DELETE`. |

Contratos TypeScript (en `app/lib/leaderboard/`, nombres propuestos):

```ts
// schema.ts — validación del envío (mismo estilo que contact-schema.ts)
export interface EnvioPuntuacion {
  game: string; // debe existir en `games`; hoy solo "asteroides"
  name: string; // 1..10 caracteres tras trim, en mayúsculas
  score: number; // entero 0..1_000_000
}

// queries.ts — solo servidor
export interface FilaRanking {
  rank: number;
  name: string;
  score: number;
  date: string; // dd/mm/aaaa, el mismo formato que PuntuacionRanking
}
export function obtenerRanking(
  game: string,
  limit: number,
): Promise<FilaRanking[]>;
export function obtenerActividadReciente(
  limit: number,
): Promise<ActividadReciente[]>; // forma de app/data/home.ts
export function obtenerTopDelDia(limit: number): Promise<TopJugadorHoy[]>; // forma de app/data/home.ts

// actions.ts — "use server"
export function guardarPuntuacion(
  envio: EnvioPuntuacion,
): Promise<{ ok: boolean; error?: string }>;
export function obtenerMejorMarca(
  game: string,
  name: string,
): Promise<{ rank: number; score: number; date: string } | null>;
```

Convenciones:

- `user_id` es siempre `NULL` en este spec; la política de `INSERT` ya admite `auth.uid()` para cuando exista auth.
- El nombre se normaliza a mayúsculas (como el campo del modal, que ya lo hace y limita a 10 caracteres). El ranking muestra una fila por nombre (su mejor marca) gracias a la vista `leaderboard`.
- «Hoy» en el Home son las últimas 24 horas; la tarjeta de actividad reciente usa «hace N min/h» calculado en servidor y el color del juego tomado de `GAMES` (`color`).
- Las claves no cambian: solo se usa la clave publishable de SPEC 05. `service_role` no se usa.

---

## Plan de implementación

Antes de escribir código de Next.js hay que leer en `node_modules/next/dist/docs/01-app/` las guías de Cache Components (`'use cache'`, `cacheTag`, `updateTag`/`revalidateTag`, `<Suspense>`) y de Server Actions, según `AGENTS.md` (con `cacheComponents: true`, leer `cookies()` o consultar datos en una página exige un límite `<Suspense>`). Para las políticas RLS y el uso de vistas se consulta la documentación vigente con `search_docs`. Los cambios visuales (estados vacíos, aviso de error) se diseñan con `/frontend-design`, respetando la estética arcade/neón.

1. **Migración.** Aplicar con `apply_migration` las tablas, la vista, los índices y las políticas RLS de arriba. Verificación: `list_tables` muestra `games` y `scores` con RLS activa; `get_advisors` (security) no reporta tablas sin RLS ni vistas sin `security_invoker`; `games` tiene exactamente una fila (`asteroides`) y `scores` está vacía.
2. **Tipos.** Generar los tipos con `generate_typescript_types`, guardarlos en `app/lib/supabase/database.types.ts` y tipar con `Database` los dos `createClient`. Verificación: `npx tsc --noEmit` y `npm run lint` sin errores.
3. **Capa de datos.** Crear `app/lib/leaderboard/schema.ts`, `queries.ts` y `actions.ts` con las firmas anteriores: validación con los mismos límites que la base de datos, consultas sobre `leaderboard` y `scores`, y la acción que inserta con el cliente de servidor e invalida la caché de los rankings. Verificación: `npx tsc --noEmit` y `npm run lint` sin errores; una inserción de prueba mediante la acción (puntuación negativa o nombre vacío) es rechazada y una válida se guarda (se borra la fila de prueba con `execute_sql` al terminar).
4. **Guardado desde el modal.** En `app/components/game-player.tsx`, para `gameId === "asteroides"`, GUARDAR PUNTUACIÓN llama a `guardarPuntuacion` dentro de un `try/catch`, deshabilita el botón mientras envía y solo muestra «PUNTUACIÓN GUARDADA» si `ok`; si no, aviso `[ERR]` y se conserva el nombre. Los otros 7 juegos siguen llamando a `saveScore`. Verificación: una partida real de Asteroides guarda una fila en `scores` (comprobada con `execute_sql`); un fallo simulado (red caída) no tumba la página.
5. **Ficha y Salón.** `/juegos/[id]`: top 10 real para `asteroides`, `seededScores` para el resto. `/salon`: la pestaña ASTEROIDES usa `obtenerRanking` (podio con 1.º, 2.º y 3.º y tabla de 12 filas) y «TU MEJOR MARCA» usa `obtenerMejorMarca`; las demás pestañas no cambian. Ambos con estado vacío cuando no hay filas (podio y tabla sustituidos por un mensaje `SIN PUNTUACIONES — SÉ EL PRIMERO` y enlace a JUGAR). Verificación: con `scores` vacía se ve el estado vacío; tras guardar una puntuación aparece en ficha y Salón sin reiniciar el servidor.
6. **Home.** Las dos tarjetas de «ACTIVIDAD EN VIVO» leen de la base de datos dentro de un `<Suspense>` propio, de modo que el resto del Home no depende de la consulta; estado vacío con el mismo mensaje. `RECENT_ACTIVITY` y `TOP_TODAY` dejan de usarse en el Home (se borran de `app/data/home.ts` si ningún otro archivo los importa). Verificación: `/home` carga con y sin filas; las secciones `.reveal` y el resto del Home no cambian.
7. **Documentación.** En `CLAUDE.md`: añadir SPEC 07 a la lista de specs, `app/lib/leaderboard/` a la estructura de `app/`, y actualizar la sección de Supabase (tablas `games` y `scores`, vista `leaderboard`, RLS, `user_id` aún sin uso). Verificación: `npm run lint` y `npm run build` sin errores.

---

## Criterios de aceptación

Verificados con Playwright (Chromium) sobre `npm run dev`, más `npm run lint`, `npx tsc --noEmit`, `npm run build` y consultas SQL con el MCP de Supabase.

**Base de datos**

- [ ] `games` existe con exactamente una fila: `asteroides` / `ASTEROIDES` / `SHOOTER`.
- [ ] `scores` existe con `user_id uuid null` referenciando `auth.users`, y RLS activa en `games` y `scores`.
- [ ] Con la clave publishable (rol `anon`) se puede leer `games`, `scores` y `leaderboard`, insertar en `scores` con `user_id` nulo, y no se puede hacer `UPDATE` ni `DELETE` en ninguna tabla ni `INSERT` en `games`.
- [ ] Una inserción con `score = -1`, `score = 1000001`, `player_name` vacío o de 11 caracteres, o `game_id` inexistente es rechazada por la base de datos.
- [ ] Una inserción con `user_id` de otro usuario es rechazada por RLS.
- [ ] `get_advisors` de seguridad no reporta incidencias nuevas sobre estas tablas y la vista.
- [ ] `leaderboard` devuelve una sola fila por jugador y juego (la de mayor puntuación, sin distinguir mayúsculas).

**Guardado**

- [ ] En `/juegos/asteroides/jugar`, FIN → GUARDAR PUNTUACIÓN crea una fila en `scores` con `game_id = 'asteroides'`, el nombre en mayúsculas, la puntuación del canvas y `user_id` nulo; el modal muestra «PUNTUACIÓN GUARDADA».
- [ ] Guardar sin haber iniciado sesión (modo invitado, nombre `INVITADO`) funciona igual.
- [ ] Con la petición bloqueada o fallando, el modal muestra `[ERR]`, conserva el nombre escrito y no muestra «PUNTUACIÓN GUARDADA»; la página no se rompe.
- [ ] El botón no permite doble envío mientras la petición está en curso.
- [ ] En `/juegos/bloque-buster/jugar` (y los otros 6) GUARDAR sigue usando `localStorage` y no crea filas en `scores`.

**Lectura**

- [ ] Con `scores` vacía, `/salon` (pestaña ASTEROIDES), `/juegos/asteroides` y las dos tarjetas del Home muestran el estado vacío, sin datos inventados.
- [ ] Tras guardar una puntuación, aparece en la ficha, el Salón (como 1.º con 1 sola fila) y las dos tarjetas del Home, sin reiniciar el servidor.
- [ ] El podio del Salón, con 3 o más jugadores, muestra a los tres mejores en orden; con menos de 3, muestra los puestos disponibles y deja los demás vacíos sin errores.
- [ ] Un mismo nombre con dos puntuaciones aparece una sola vez en el ranking, con la mayor.
- [ ] «TOP JUGADORES · HOY» solo cuenta puntuaciones de las últimas 24 horas; «ÚLTIMAS PUNTUACIONES» muestra las más recientes con «hace N min/h».
- [ ] «TU MEJOR MARCA» para ASTEROIDES muestra la mejor marca del nombre del usuario en sesión (sin distinguir mayúsculas) y su puesto, y no aparece si no tiene ninguna.
- [ ] Las pestañas de los otros 7 juegos y sus fichas conservan el ranking falso de siempre.

**Global**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] No hay errores nuevos en la consola del navegador en `/home`, `/biblioteca`, `/salon`, `/acceso`, `/about`, `/juegos/asteroides` y `/juegos/asteroides/jugar`.
- [ ] En `.next/static` no aparece la clave `service_role` ni la contraseña de la base de datos.
- [ ] `/acceso`, `AuthForm`, `AuthProvider` y el catálogo `app/data/games.ts` no cambian (`git diff`).
- [ ] El Home carga el resto de secciones sin esperar a la consulta de actividad.

---

## Decisiones

- **Sí:** sin autenticación obligatoria. El jugador firma con el nombre del modal. Decisión del usuario.
- **Sí:** `user_id` nullable creado ya, siempre `NULL` por ahora. Decisión del usuario: el jugador no debe autenticarse para jugar, pero la columna evita una migración cuando llegue el spec de auth. **No:** exigir sesión ni crear cuentas en este spec.
- **Sí:** `games` solo con `asteroides`. Decisión del usuario. Es la clave foránea de `scores` y las maquetas se añaden al portarse. **No:** sembrar los 8 juegos del catálogo, que permitiría guardar puntuaciones de juegos falsos.
- **Sí:** el catálogo estático (`app/data/games.ts`) sigue siendo la fuente de la UI; la tabla `games` solo respalda la integridad de `scores`. Consecuencia aceptada: hay dos fuentes mientras solo exista un juego real, con el `id` como vínculo.
- **Sí:** datos reales en `/salon`, ficha, `/home` y modal de fin de juego, para ASTEROIDES. Decisión del usuario. Los demás juegos siguen como hoy.
- **Sí:** estado vacío explícito, no datos de ejemplo. Evita mostrar jugadores que no existen. **No:** sembrar filas ficticias ni mezclar con `seededScores`.
- **Sí:** validación básica sin anti-trampas (recomendada): `CHECK` en la base de datos, validación en la Server Action y RLS sin `UPDATE`/`DELETE`. **No:** firmas o sesiones de partida; es otro spec.
- **Sí:** la inserción pasa por una Server Action con el cliente de servidor, por lo que la clave publishable y RLS bastan. **No:** usar `service_role`.
- **Sí:** una fila por jugador (mejor puntuación) en el ranking mediante la vista `leaderboard`, para que un mismo nombre no ocupe todo el podio. Las puntuaciones individuales se conservan en `scores`.
- **Sí:** puntuación máxima de 1.000.000 y nombre de 1 a 10 caracteres (el mismo límite del campo de iniciales del modal). Ajustable si algún juego futuro lo exige.
- **Sí:** «hoy» = últimas 24 horas, para no depender de la zona horaria.
- **Sí:** ignorar `av_scores` de `localStorage`, sin importarlas. Evita duplicados y puntuaciones de fuentes no fiables.
- **Sí:** «TU MEJOR MARCA» por nombre de la sesión local. Es provisional hasta que exista `user_id` real.
- **Sí:** los tipos generados se integran en los clientes de SPEC 05 (SPEC 05 los difirió por no haber tablas).
- **Sí:** migración aplicada con el MCP de Supabase. **No:** crear una carpeta `supabase/` con la CLI en este spec.

---

## Riesgos

| Riesgo                                                                                                                 | Mitigación                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cualquiera con la clave publishable puede insertar directamente en `scores` saltándose la Server Action                | Los `CHECK` y RLS aplican igual; un tramposo sigue pudiendo enviar una puntuación válida pero falsa (límite aceptado de «sin anti-trampas»); el máximo de 1.000.000 acota el daño |
| Spam o relleno de la tabla con muchas filas                                                                            | Fuera de alcance; se puede añadir limitación de tasa o Edge Function en otro spec. Los rankings leen con `LIMIT`                                                                  |
| Con `cacheComponents: true`, consultar datos en `/home`, `/salon` o la ficha sin `<Suspense>` rompe el prerrenderizado | Leer la guía de Cache Components; cada consulta va dentro de un límite `<Suspense>` o de una función `'use cache'` con etiqueta                                                   |
| La caché sirve rankings viejos tras guardar                                                                            | La Server Action invalida las etiquetas del ranking, actividad y top del día; criterio de aceptación de actualización sin reiniciar                                               |
| Un nombre se hace pasar por otro (no hay identidad)                                                                    | Aceptado hasta el spec de auth; `user_id` queda preparado para vincular                                                                                                           |
| Contenido ofensivo en el nombre                                                                                        | Aceptado: solo iniciales de 10 caracteres; la moderación queda fuera                                                                                                              |
| `/salon` es un Client Component (`HallOfFame`) y no puede consultar la base directamente                               | Los datos del ranking se pasan desde un Server Component padre dentro de `<Suspense>`; «TU MEJOR MARCA» usa la Server Action `obtenerMejorMarca`                                  |
| La vista `leaderboard` expone datos con permisos del creador                                                           | Se define con `security_invoker = true` y se comprueba con `get_advisors`                                                                                                         |
| Quitar `RECENT_ACTIVITY`/`TOP_TODAY` rompe otra pantalla que los importe                                               | Buscar importaciones antes de borrarlos; si hay alguna, se conservan                                                                                                              |

---

## Qué **no** está en este spec

- Autenticación real, OAuth y `proxy.ts`; `user_id` queda sin uso.
- Anti-trampas, limitación de tasa y moderación.
- Insertar en `games` los otros 7 juegos o mover el catálogo a la base de datos.
- Importar las puntuaciones de `localStorage`.
- Realtime, paginación, perfiles y avatares.
- Estadísticas del Home (`HOME_STATS`) y los campos `best`/`plays` de la ficha.
- Tests automatizados.

Cada uno de ellos, si se aborda, va en su propio spec.
