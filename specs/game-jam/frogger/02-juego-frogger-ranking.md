# GJ FROGGER 02 — Ranking real de FROGGER en Supabase

> **Status:** Borrador
> **Depends on:** SPEC 06, SPEC 07 (tablas `games` y `scores`, vista `leaderboard` y rankings reales), SPEC 08, SPEC 09, SPEC 10, GJ FROGGER 01 (motor y reproductor de `frogger`)
> **Date:** 2026-10-28
> **Objective:** Dar de alta `frogger` en la tabla `games`, guardar sus puntuaciones en Supabase y mostrar su ranking en `/salon`, `/juegos/frogger` y las tarjetas de actividad del Home.

---

## Por qué existe este spec

GJ FROGGER 01 deja el juego jugable, pero su GUARDAR PUNTUACIÓN sigue escribiendo en `localStorage` como las maquetas. La infraestructura de ranking ya existe desde SPEC 07 (`games`, `scores`, vista `leaderboard`, `guardarPuntuacion`, `obtenerRanking` y `obtenerMejorMarca`) y es genérica por `game_id`, así que este spec se limita a dar de alta el juego y a ampliar a `frogger` las condiciones que hoy cubren `asteroides`, `tetris`, `arkanoid` y `snake`. No introduce un registro genérico de juegos ni de rankings (decisión cerrada).

Frogger es el quinto juego con ranking real. Su puntuación no tiene máximo natural (los niveles no terminan), pero el motor la limita a `1_000_000` en el snapshot, igual que Tetris, así que siempre cumple el `CHECK` de `scores`.

---

## Alcance

**In:**

- Alta de `frogger` en `public.games` con el MCP de Supabase (`apply_migration`).
- `"frogger"` en `JUEGOS_CON_RANKING` en `app/lib/leaderboard/schema.ts`.
- Guardado real en `GamePlayer`: con `gameId === "frogger"`, GUARDAR PUNTUACIÓN llama a `guardarPuntuacion({ game: "frogger", name, score })`, con `try/catch`, aviso `[ERR]`, protección contra doble envío y «PUNTUACIÓN GUARDADA» solo si `ok`.
- Ranking real de `frogger` en `/salon` (pestaña FROGGER y «TU MEJOR MARCA»), en `/juegos/frogger` (`RankingReal`, top 10) y en las dos tarjetas de actividad del Home, con `EmptyBoard` cuando no hay filas.
- Regenerar `app/lib/supabase/database.types.ts` solo si cambió el esquema (aquí no cambia).
- Documentar los dos specs y los archivos nuevos en `CLAUDE.md`.

**Out of scope (para futuros specs):**

- Sonido y música (se añadirán más adelante en un spec propio).
- Cambios en el motor, las reglas, la ficha o la portada (GJ FROGGER 01).
- Generalizar `GamePlayer`, `HallOfFame` o la página de ficha hacia un registro de juegos.
- Autenticación real (`user_id` queda `NULL`), anti-trampas, realtime y paginación.
- Ranking por nivel o por tiempo, o cualquier otra métrica distinta de la puntuación.
- Cambiar `ranaria` ni las demás maquetas (siguen con `localStorage` y `app/data/`).
- Tests automatizados.

---

## Modelo de datos

Este spec no cambia el esquema ni introduce estructuras nuevas de TypeScript. Reutiliza `scores`, la vista `leaderboard`, `PuntuacionRanking` y las Server Actions de SPEC 07.

Migración (la aplicará `/spec-impl` con `apply_migration`; solo añade una fila):

```sql
insert into public.games (id, title, category)
values ('frogger', 'FROGGER', 'ARCADE');
```

Constantes y convenciones:

- `game_id` de `scores` y `id` de la ficha en `GAMES` son el mismo texto: `frogger`. La actividad reciente usa el `title` y el `color` de `GAMES` (FROGGER, verde).
- Límites existentes de `scores` (sin cambios): `player_name` de 1 a 10 caracteres, `score` entero de 0 a 1.000.000, `user_id` siempre `NULL`.
- Etiquetas de caché que invalida `guardarPuntuacion`: `ranking-frogger`, `actividad-reciente` y `top-del-dia`.
- Lecturas: `obtenerRanking("frogger", 12)` en `/salon` y el top 10 en `/juegos/frogger`.
- Prop nueva de `HallOfFame`: `frogger: PuntuacionRanking[]`, en el mismo estilo que `asteroides`, `tetris`, `arkanoid` y `snake`.

---

## Plan de implementación

Antes de escribir código, leer en `node_modules/next/dist/docs/01-app/` las guías de Cache Components y de Server Actions, según `AGENTS.md`. Verificar con Grep (`"snake"`, `JUEGOS_CON_RANKING`, `esSnake`) los puntos exactos que hoy cubren al último juego real, y copiar su patrón: si el código difiere de este plan, manda el código. Cada paso deja el sistema funcional.

1. **Alta en la base de datos.** Aplicar con `apply_migration` el `insert` en `games` y añadir `"frogger"` a `JUEGOS_CON_RANKING` en `app/lib/leaderboard/schema.ts` (incluido su comentario). Verificación: `execute_sql` muestra las filas `asteroides`, `tetris`, `arkanoid`, `snake` y `frogger` en `games`; `get_advisors` (security) sin incidencias nuevas; `npx tsc --noEmit` y `npm run lint` sin errores.
2. **Guardado real.** En `app/components/game-player.tsx`, la condición que usa `guardarPuntuacion` incluye `frogger` (por ejemplo `esFrogger`), con la protección contra doble envío y el aviso `[ERR]` de los otros juegos reales. Verificación: tras una partida en `/juegos/frogger/jugar`, FIN → GUARDAR PUNTUACIÓN crea una fila en `scores` con `game_id = 'frogger'`; con la petición bloqueada aparece `[ERR]`.
3. **Rankings.** `/salon` (`app/salon/page.tsx`) añade `obtenerRanking("frogger", 12)` al `Promise.all` y se lo pasa a `HallOfFame` como `frogger`; `app/components/hall-of-fame.tsx` usa el ranking real y `obtenerMejorMarca` también en la pestaña FROGGER; `app/juegos/[id]/page.tsx` amplía su condición de `RankingReal` a `frogger`. El `EmptyBoard` del Home sigue invitando a `asteroides`. Verificación: con `scores` vacía para `frogger` se ve el estado vacío en Salón y ficha; tras guardar, la puntuación aparece en ambos y en el Home sin reiniciar el servidor.
4. **Documentación.** En `CLAUDE.md`: añadir ambos specs a la lista, `app/games/frogger/`, `frogger-canvas.tsx` y el juego en la sección de Supabase (juegos con ranking real; las maquetas pasan de 7 a 6). Verificación: `npm run lint` y `npm run build`.

---

## Criterios de aceptación

Verificados con Playwright (Chromium) sobre `npm run dev`, más `npm run lint`, `npx tsc --noEmit`, `npm run build` y consultas SQL con el MCP de Supabase.

**Global**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] No hay errores en la consola en `/juegos/frogger/jugar`, `/juegos/frogger`, `/salon` y `/home`.
- [ ] El motor de `app/games/frogger/` no cambia respecto a GJ FROGGER 01.

**Base de datos y ranking**

- [ ] `games` contiene la fila `frogger` / `FROGGER` / `ARCADE` y las filas `asteroides`, `tetris`, `arkanoid` y `snake` siguen intactas.
- [ ] FIN o GAME OVER → GUARDAR PUNTUACIÓN crea una fila en `scores` con `game_id = 'frogger'`, el nombre en mayúsculas, la puntuación del canvas y `user_id` nulo; el modal muestra «PUNTUACIÓN GUARDADA».
- [ ] Con la petición bloqueada o fallando, el modal muestra `[ERR]`, conserva el nombre escrito y no muestra «PUNTUACIÓN GUARDADA»; el botón no permite doble envío.
- [ ] En `/juegos/ranaria/jugar` GUARDAR sigue usando `localStorage` y no crea filas en `scores`.
- [ ] Con `scores` vacía para `frogger`, `/salon` (pestaña FROGGER) y `/juegos/frogger` muestran el estado vacío «SIN PUNTUACIONES — SÉ EL PRIMERO» con enlace a `/juegos/frogger/jugar`.
- [ ] Tras guardar, la puntuación aparece en la ficha y en el Salón sin reiniciar el servidor, y en las dos tarjetas de actividad del Home con el título FROGGER y el color verde.
- [ ] Un mismo nombre con dos puntuaciones de Frogger aparece una sola vez en su ranking, con la mayor, y no se mezcla con los rankings de los otros juegos.
- [ ] «TU MEJOR MARCA» de la pestaña FROGGER muestra la mejor marca del nombre en sesión (sin distinguir mayúsculas) y su puesto, y no aparece si no tiene ninguna.
- [ ] Las pestañas de ASTEROIDES, TETRIS, ARKANOID, SNAKE y de las demás maquetas (incluida RANARIA) conservan el comportamiento que tenían.
- [ ] `/home` conserva las mismas 6 tarjetas de juegos y su `EmptyBoard` sigue invitando a `asteroides` cuando no hay filas.
- [ ] `get_advisors` de seguridad no reporta incidencias nuevas.
- [ ] En `.next/static` no aparece la clave `service_role` ni la contraseña de la base de datos.
- [ ] Las filas de prueba creadas en `scores` durante la verificación se borran al terminar.

---

## Decisiones

- **Sí:** spec propia para el ranking, separada del motor. Decisión del usuario (dos specs, sin spec de extras ni de sonido). **No:** mezclar motor y base de datos.
- **Sí:** reutilizar las Server Actions, las consultas y la vista de SPEC 07 sin cambios. **No:** tocar `queries.ts` ni `actions.ts`.
- **Sí:** `HallOfFame` recibe una prop más para `frogger`, en el mismo estilo que las otras. **No:** un registro genérico de rankings.
- **Sí:** el `id` es `frogger` en la ficha y en `games`, para que la actividad use su título y color. **No:** reutilizar `ranaria`.
- **Sí:** `title` `FROGGER` y `category` `ARCADE` en `games`, igual que la ficha. Decisión del usuario sobre el nombre.
- **Sí:** sin tope adicional de puntuación en la base: el motor limita el snapshot a 1.000.000 y el `CHECK` ya lo admite.
- **Sí:** el `EmptyBoard` del Home sigue apuntando a `asteroides`. Recomendación aceptada.
- **Sí:** `best: 0` y `plays: "0"` en la ficha, sin sembrar puntuaciones. **No:** inventar cifras.
- **Sí:** sin sonido en este spec. Decisión del usuario.

---

## Riesgos

| Riesgo                                                                                           | Mitigación                                                                                                                    |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Insertar la fila en `games` después de activar el guardado produce errores de clave foránea      | El paso 1 (alta y `JUEGOS_CON_RANKING`) va antes del paso 2 (guardado)                                                        |
| La caché sirve rankings viejos tras guardar                                                      | `guardarPuntuacion` ya invalida `ranking-<id>`, `actividad-reciente` y `top-del-dia`; criterio de actualización sin reiniciar |
| Con `cacheComponents: true`, leer el ranking sin `<Suspense>` rompe el prerrenderizado           | Se reutilizan los `<Suspense>` de `/salon` y de la ficha; `obtenerRanking` ya es `'use cache'`                                |
| La condición `snake` se copia a medias y alguna pestaña de `HallOfFame` muestra datos de maqueta | Criterios de aceptación por pestaña y comprobación de que `RANARIA` no cambia                                                 |
| La clave `service_role` o la contraseña de la base de datos llegan al cliente                    | Solo clave publishable; comprobación en `.next/static`                                                                        |
| Los datos de prueba quedan en `scores`                                                           | Se borran al terminar la verificación                                                                                         |

---

## Qué **no** está en este spec

- Sonido y música.
- Cambios en el motor, las reglas o la ficha del juego.
- Generalizar `GamePlayer`, `HallOfFame` o `/juegos/[id]` hacia un registro de juegos.
- Autenticación real, anti-trampas, realtime y paginación del ranking.
- Ranking por nivel, por tiempo o con otra métrica.
- Cambiar `ranaria` y las demás maquetas.
- Tests automatizados.

Cada uno de ellos, si se aborda, va en su propio spec.
