# SPEC 02 (game-jam boxeo-pixel) — Ranking real de BOXEO PIXEL en Supabase

> **Status:** Borrador
> **Depends on:** SPEC 01 de game-jam boxeo-pixel (motor y reproductor con `status` `playing`, `gameover` y `win`), SPEC 07 (tablas `games` y `scores`, vista `leaderboard` y rankings reales), SPEC 10 (patrón de alta y rankings de un juego nuevo)
> **Date:** 2026-11-03
> **Objective:** Dar de alta `boxeo-pixel` en la tabla `games` y conectar el guardado de puntuaciones y los rankings de `/salon`, `/juegos/boxeo-pixel` y el Home a Supabase, sin exigir autenticación.

---

## Por qué existe este spec

La SPEC 01 deja a BOXEO PIXEL jugable, pero su modal de fin de juego no guarda la puntuación. Como en los demás juegos reales, el ranking se añade en un spec propio que reutiliza la infraestructura de la SPEC 07 (`guardarPuntuacion`, `obtenerRanking`, la vista `leaderboard` y `EmptyBoard`). Este spec **no** cambia el esquema: solo añade una fila a `games` y extiende lo que ya existe.

Particularidades:

- **Categoría VERSUS.** `games.category` es `text` y no tiene `CHECK` propio (el tipo generado es `string`); los valores usados hasta ahora son `SHOOTER`, `PUZZLE` y `ARCADE`. Se comprueba al aplicar la migración que `VERSUS` es admisible.
- **Dos finales con puntuación.** El modal se abre tanto en `gameover` como en `win` (patrón de Arkanoid); en ambos casos se guarda el `score` del snapshot.
- **Puntuación muy por debajo del tope.** La cota teórica es inferior a 25.000, y el `CHECK` de `scores` admite de 0 a 1.000.000: no se toca.
- **Sin cambios en el motor.** Toda la lógica de `app/games/boxeo-pixel/` queda igual.

---

## Alcance

**In:**

- Alta en Supabase: `insert into public.games (id, title, category) values ('boxeo-pixel', 'BOXEO PIXEL', 'VERSUS')`, aplicada con `apply_migration` (nombre `add_boxeo_pixel_game`).
- `"boxeo-pixel"` en `JUEGOS_CON_RANKING` (`app/lib/leaderboard/schema.ts`), con su comentario actualizado, para que `validarEnvio` lo acepte.
- Guardado: en `GamePlayer`, GUARDAR PUNTUACIÓN llama a `guardarPuntuacion({ game: "boxeo-pixel", name, score })` con el aviso `[ERR]` si falla y la misma protección contra doble envío que Snake y Frogger.
- Rankings reales de `boxeo-pixel`:
  - `/salon`: lee `obtenerRanking("boxeo-pixel", 12)` dentro del `<Suspense>` ya existente y lo pasa a `HallOfFame` en una prop nueva `boxeoPixel` (pestaña BOXEO PIXEL y «TU MEJOR MARCA» con `obtenerMejorMarca`).
  - `/juegos/boxeo-pixel`: `app/juegos/[id]/page.tsx` amplía su condición de `RankingReal`.
  - Home: las dos tarjetas de actividad (`obtenerActividadReciente` y `obtenerTopDelDia`) muestran las partidas de `boxeo-pixel` con el título BOXEO PIXEL y el color amarillo; con la tabla vacía siguen mostrando `EmptyBoard` (que invita a `asteroides`).
- Regenerar `app/lib/supabase/database.types.ts` solo si `generate_typescript_types` produce diferencias.
- Documentar en `CLAUDE.md`: la spec en la lista, `boxeo-pixel` en la sección de Supabase (juegos con ranking real; los juegos maqueta pasan de 7 a 6) y en `app/lib/leaderboard/`.

**Out of scope (para futuros specs):**

- Cambios de esquema, tablas, vistas o políticas RLS.
- Puntuaciones por ronda, por rival o por estado (`win` frente a `gameover`), y un ranking separado de campeones.
- Autenticación real (`user_id` queda en `NULL`), anti-trampas, realtime y paginación.
- Tocar el motor, el sonido (SPEC 03) y las maquetas, incluida `duelo-pixel`.
- Tests automatizados.

---

## Modelo de datos

Base de datos (migración que describe la spec y aplicará `/spec-impl` con `apply_migration`; no cambia el esquema, solo añade una fila):

```sql
insert into public.games (id, title, category)
values ('boxeo-pixel', 'BOXEO PIXEL', 'VERSUS');
```

Tipos y funciones existentes que se reutilizan sin cambios de firma:

```ts
// app/lib/leaderboard/schema.ts
export const JUEGOS_CON_RANKING: readonly string[] = [
  "asteroides", "tetris", "arkanoid", "snake", "frogger", "boxeo-pixel",
];

// app/lib/leaderboard/actions.ts
guardarPuntuacion({ game: "boxeo-pixel", name, score })
obtenerMejorMarca("boxeo-pixel", name)

// app/lib/leaderboard/queries.ts (etiqueta de caché: "ranking-boxeo-pixel")
obtenerRanking("boxeo-pixel", 12)
```

`HallOfFame` recibe una prop más:

```ts
// app/components/hall-of-fame.tsx
interface Props {
  asteroides: PuntuacionRanking[];
  tetris: PuntuacionRanking[];
  arkanoid: PuntuacionRanking[];
  snake: PuntuacionRanking[];
  frogger: PuntuacionRanking[];
  boxeoPixel: PuntuacionRanking[]; // nueva
}
```

Convenciones:

- `scores.game_id` es `'boxeo-pixel'` (kebab-case, igual que `games.id` y el id de la ficha). La clave de la pestaña en `HallOfFame` usa el mismo id; solo el nombre de la prop va en camelCase.
- `guardarPuntuacion` ya invalida `ranking-<juego>`, `actividad-reciente` y `top-del-dia` con `updateTag`; no hay que añadir etiquetas.
- El nombre del jugador va en mayúsculas, de 1 a 10 caracteres; la puntuación es un entero de 0 a 1.000.000 (`LIMITES_PUNTUACION`).
- El color de la tarjeta de actividad sale de la ficha del juego (`yellow`); no se añade un mapa nuevo si ya se resuelve por `getGame(id)`.

---

## Plan de implementación

Antes de escribir código de Next.js, leer en `node_modules/next/dist/docs/01-app/` las guías de Cache Components y de Server Actions, según `AGENTS.md`. Cada paso deja el sistema funcional.

1. **Alta en la base de datos.** Aplicar con `apply_migration` el `insert` en `games` y añadir `"boxeo-pixel"` a `JUEGOS_CON_RANKING` (con su comentario). Verificación: `execute_sql` muestra las filas `asteroides`, `tetris`, `arkanoid`, `snake`, `frogger` y `boxeo-pixel` en `games`; si el `insert` falla por una restricción de `category`, se detiene y se documenta; `get_advisors` (security) sin incidencias nuevas; `npx tsc --noEmit` y `npm run lint` sin errores.
2. **Guardado.** En `game-player.tsx`, la rama `boxeo-pixel` usa `guardarPuntuacion` en `guardar` (la misma condición `JUEGOS_CON_RANKING.includes(gameId)` que los demás), con `[ERR]` y sin doble envío. Verificación: GAME OVER → GUARDAR crea una fila en `scores` con `game_id = 'boxeo-pixel'` y `user_id` nulo; con la petición bloqueada aparece `[ERR]` y se conserva el nombre.
3. **Rankings.** `/salon` lee `obtenerRanking("boxeo-pixel", 12)` y lo pasa como `boxeoPixel`; `hall-of-fame.tsx` usa el ranking real y `obtenerMejorMarca` en la pestaña BOXEO PIXEL; `app/juegos/[id]/page.tsx` amplía `RankingReal`. Verificación: con `scores` vacía para `boxeo-pixel` se ve el estado vacío; tras guardar una puntuación aparece en la ficha, en el Salón y en el Home sin reiniciar el servidor.
4. **Documentación.** Actualizar `CLAUDE.md` (ver Alcance). Verificación: `npm run lint` y `npm run build`.

---

## Criterios de aceptación

Verificados con Playwright (Chromium) sobre `npm run dev`, más `npm run lint`, `npx tsc --noEmit`, `npm run build` y consultas SQL con el MCP de Supabase.

**Global**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] No hay errores en la consola del navegador en `/juegos/boxeo-pixel/jugar`, `/juegos/boxeo-pixel`, `/salon` y `/home`.
- [ ] `git diff` no toca `app/games/boxeo-pixel/`, `public/` ni `references/`.

**Base de datos y guardado**

- [ ] `games` contiene la fila `boxeo-pixel` / `BOXEO PIXEL` / `VERSUS` y las cinco filas anteriores siguen intactas.
- [ ] FIN, GAME OVER o ¡CAMPEÓN! → GUARDAR PUNTUACIÓN crea una fila en `scores` con `game_id = 'boxeo-pixel'`, el nombre en mayúsculas, la puntuación del canvas y `user_id` nulo; el modal muestra «PUNTUACIÓN GUARDADA».
- [ ] Con la petición bloqueada o fallando, el modal muestra `[ERR]`, conserva el nombre escrito y no muestra «PUNTUACIÓN GUARDADA»; el botón no permite doble envío.
- [ ] `validarEnvio` rechaza `game: "boxeo-pixel"` con puntuación negativa o superior a 1.000.000 y un nombre vacío o de más de 10 caracteres.
- [ ] En `/juegos/duelo-pixel/jugar` GUARDAR sigue usando `localStorage` y no crea filas en `scores`.

**Rankings**

- [ ] Con `scores` vacía para `boxeo-pixel`, `/salon` (pestaña BOXEO PIXEL) y `/juegos/boxeo-pixel` muestran «SIN PUNTUACIONES — SÉ EL PRIMERO» con enlace a `/juegos/boxeo-pixel/jugar`.
- [ ] Tras guardar, la puntuación aparece en la ficha y en el Salón sin reiniciar el servidor, y en las dos tarjetas de actividad del Home con el título BOXEO PIXEL y el color amarillo.
- [ ] Un mismo nombre con dos puntuaciones de BOXEO PIXEL aparece una sola vez en su ranking, con la mayor, y no se mezcla con los rankings de los otros juegos.
- [ ] «TU MEJOR MARCA» de la pestaña BOXEO PIXEL muestra la mejor marca del nombre en sesión (sin distinguir mayúsculas) y su puesto, y no aparece si no tiene ninguna.
- [ ] Las pestañas de ASTEROIDES, TETRIS, ARKANOID, SNAKE, FROGGER y de las otras 6 maquetas conservan el comportamiento que tenían.
- [ ] `get_advisors` de seguridad no reporta incidencias nuevas.
- [ ] En `.next/static` no aparece la clave `service_role` ni la contraseña de la base de datos.
- [ ] Las filas de prueba creadas en `scores` durante la verificación se borran al terminar.

---

## Decisiones

**Definición rápida sin aclaraciones detalladas.** Decisiones tomadas por defecto por el agente `game-jam`, que no puede preguntar al usuario; se pueden cambiar al revisar el borrador.

- **Sí:** spec propia de ranking, separada del motor, porque la SPEC 01 ya es grande y la infraestructura de la SPEC 07 existe. **No:** mezclar ambos.
- **Sí:** categoría `VERSUS` en `games`, la misma que la ficha. Se comprueba al aplicar la migración. **No:** guardarlo como `ARCADE` para esquivar una restricción; si existe, se corrige en el spec.
- **Sí:** una sola puntuación por partida, sea `gameover` o `win`. **No:** ranking separado de campeones ni por rival.
- **Sí:** `HallOfFame` con una prop más (`boxeoPixel`), en el mismo estilo que las demás. **No:** un registro genérico de rankings.
- **Sí:** el `EmptyBoard` del Home sigue apuntando a `asteroides`.
- **Sí:** sin cambios de esquema ni de `CHECK`: el máximo real (menos de 25.000) cabe en el rango.
- **Sí:** no se toca el motor ni las maquetas. **No:** cambiar `duelo-pixel`.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `games.category` rechaza `VERSUS` por una restricción no visible en los tipos | Se comprueba con `execute_sql` antes del `insert`; si hay `CHECK`, se amplía en la misma migración y se documenta |
| El id con guion (`boxeo-pixel`) se confunde con la prop `boxeoPixel` del `HallOfFame` | La clave de pestaña y los datos usan el id kebab-case; solo la prop va en camelCase; criterio de aceptación de las pestañas |
| La caché sirve rankings viejos tras guardar | `guardarPuntuacion` ya invalida `ranking-boxeo-pixel`, `actividad-reciente` y `top-del-dia`; criterio de actualización sin reiniciar |
| Con `cacheComponents: true`, leer el ranking sin `<Suspense>` rompe el prerrenderizado | Se reutilizan los límites `<Suspense>` de `/salon` y de la ficha |
| La clave `service_role` o la contraseña acaban en el bundle | Sin cambios en las variables de entorno; hay criterio de revisión de `.next/static` |
| Filas de prueba se quedan en producción | Criterio de aceptación de borrado al terminar |

---

## Qué **no** está en este spec

- Cambios de esquema, vistas o políticas RLS.
- Rankings por rival, por ronda o de campeones.
- Autenticación real, anti-trampas, realtime y paginación.
- El motor, el sonido y las skins.
- Tocar las maquetas.
- Tests automatizados.

Cada uno de ellos, si se aborda, va en su propio spec.
