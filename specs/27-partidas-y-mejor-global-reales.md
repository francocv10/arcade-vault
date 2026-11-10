# SPEC 27 — «Partidas» y «Mejor global» reales en la ficha

> **Status:** Implementado
> **Depends on:** SPEC 07 (vista `leaderboard` y `obtenerRanking`), SPEC 22 (tabla `partidas` e `iniciarPartida`), SPEC 23 (tope de partidas por hora), SPEC 26 (quitó `best` y `plays`)
> **Date:** 2026-11-09
> **Objective:** Que la ficha `/juegos/[id]` vuelva a mostrar «Partidas» y «Mejor global» como en `references/templates/detalle.jsx`, con el total de partidas iniciadas y la mejor puntuación reales de Supabase.

---

## Por qué existe este spec

La SPEC 26 quitó las celdas «Partidas» y «Mejor global» del `stat-strip` de la ficha porque salían de `plays` y `best`, que eran cifras inventadas (o `"0"` y `0` en los juegos reales). Su tabla de decisiones dejó para otra spec rellenarlas con datos reales. Sin ellas, la ficha solo muestra «Dificultad» y se aleja de la plantilla.

«Partidas» cuenta las filas de `partidas`, una por cada partida que `iniciarPartida` abre a una cuenta con sesión. Hoy esa cifra no sirve como total: `iniciarPartida` borra las partidas de la cuenta con más de `PARTIDA_MAX_SEGUNDOS` (6 h), y `partidas.user_id` tiene `ON DELETE CASCADE`, así que borrar una cuenta borra sus partidas. Para que el contador solo crezca, las partidas pasan a acumularse.

El borrado de caducadas es solo limpieza: `guardarPuntuacion` ya rechaza una partida de más de 6 h con `puntuacionPosible`, y el tope de `PARTIDAS_POR_HORA` solo cuenta la última hora. Quitarlo no abre ningún hueco de validación.

---

## Alcance

**In:**

- Celdas «Partidas» y «Mejor global» en el `stat-strip` de `/juegos/[id]`, antes de «Dificultad», en el orden y con los estilos de `detalle.jsx` (Mejor global en `var(--magenta)` con su `textShadow`).
- «Partidas» = número total de filas de `partidas` con ese `game_id`, con `toLocaleString("es-ES")` (p. ej. `12.345`; `es-ES` no agrupa las cifras de 4 dígitos, así que `1980` sale sin punto). Sin partidas: `0`.
- «Mejor global» = la puntuación del puesto 1 de `obtenerRanking(gameId, 10)`, la misma llamada que ya pinta el ranking de la ficha, con `toLocaleString("es-ES")`. Sin puntuaciones: `—`.
- Función nueva `obtenerPartidasJugadas(game)` en `app/lib/leaderboard/queries.ts`: `'use cache'`, `cacheLife("minutes")`, recuento con `createAdminClient()` (la tabla no tiene permisos para `anon` ni `authenticated`) y `{ count: "exact", head: true }`, sin devolver filas.
- Degradado: si la consulta de una celda falla, esa celda muestra `—` y el fallo se registra en el servidor con `console.error`; el resto de la ficha se pinta normal.
- Las partidas se acumulan: quitar el `delete` de caducadas de `iniciarPartida`.
- Migración `partidas_acumuladas`: `partidas.user_id` admite nulos y su clave foránea pasa a `ON DELETE SET NULL`; índice `partidas_game_id_idx` sobre `partidas (game_id)`.
- Copia de la migración en `supabase/produccion/03-partidas_acumuladas.sql`, `02-verificacion-esperado.tsv` actualizado, `get_advisors` y `app/lib/supabase/database.types.ts` regenerado.
- Documentación: `CLAUDE.md` (lista de specs, `iniciarPartida` sin limpieza, `partidas.user_id` con `ON DELETE SET NULL`, índice nuevo y aviso `unindexed_foreign_keys` resuelto) y `references/produccion-supabase.md` si enumera migraciones.

**Out of scope (para futuros specs):**

- El badge de mejor puntuación en `GameCard` (`/biblioteca` y `/home`).
- Contar las partidas de los invitados: no crean filas en `partidas`, y abrirles `iniciarPartida` cambia la SPEC 22.
- Un contador acumulado aparte (columna o tabla de totales) o una función SQL de agregado.
- Invalidar la caché de «Partidas» con `updateTag` en cada `iniciarPartida`.
- Formato compacto (`12,4 mil`).
- Rellenar con datos reales «Dificultad» o las etiquetas de `detail-tags`.
- Recuperar las partidas ya borradas por la limpieza anterior.

---

## Modelo de datos

Base de datos (migración `partidas_acumuladas`, sin datos):

```sql
alter table public.partidas alter column user_id drop not null;
alter table public.partidas drop constraint partidas_user_id_fkey;
alter table public.partidas
  add constraint partidas_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete set null;
create index if not exists partidas_game_id_idx on public.partidas (game_id);
```

RLS, políticas y permisos de `partidas` no cambian: RLS activa, ninguna política y ningún permiso para `anon` ni `authenticated`.

Tipos (`database.types.ts` regenerado): `partidas.Row.user_id` pasa de `string` a `string | null`. `iniciarPartida` y `guardarPuntuacion` siguen filtrando con `.eq("user_id", userId)`, así que una fila con `user_id` nulo nunca se puede publicar ni cuenta para el tope por hora de nadie.

Consulta nueva:

```ts
// app/lib/leaderboard/queries.ts
export async function obtenerPartidasJugadas(game: string): Promise<number>;
// 'use cache' + cacheLife("minutes"); lanza si Supabase devuelve error,
// para que un fallo no quede en caché (quien la llama lo captura).
```

---

## Plan de implementación

1. **Migración.** Aplicar `partidas_acumuladas` en dev con `apply_migration` (SQL del modelo de datos). Guardar el SQL idéntico en `supabase/produccion/03-partidas_acumuladas.sql`. Ejecutar `02-verificacion.sql` en dev y actualizar `02-verificacion-esperado.tsv`. Lanzar `get_advisors` (seguridad y rendimiento) y regenerar `app/lib/supabase/database.types.ts`. `npm run build` debe pasar.
2. **Acumular partidas.** En `iniciarPartida` (`app/lib/leaderboard/actions.ts`), quitar el bloque `caducidad`/`delete` y su `console.warn`, y actualizar el comentario. Si `PARTIDA_MAX_SEGUNDOS` deja de importarse ahí, quitar el import (sigue en `schema.ts` para `puntuacionPosible`).
3. **Consulta.** Añadir `obtenerPartidasJugadas(game)` a `queries.ts` con `createAdminClient()`, `'use cache'` y `cacheLife("minutes")`; actualizar el comentario de cabecera del archivo, que hoy dice que todas usan el cliente público.
4. **Celdas.** En `app/juegos/[id]/page.tsx`, añadir antes de «Dificultad» dos celdas, cada una con su `<Suspense>` (fallback `…` dentro de `.v`): `CeldaPartidas` (llama a `obtenerPartidasJugadas`) y `CeldaMejorGlobal` (llama a `obtenerRanking(gameId, 10)` y toma `scores[0]?.score`). Cada una captura su error, lo registra y pinta `—`.
5. **Comprobación.** `npm run lint` y `npm run build`. Con el MCP de Playwright: ficha de un juego con puntuaciones y de uno sin ellas, cifra de «Partidas» comparada con `select count(*) from partidas where game_id = ...` en dev, y una partida nueva con sesión que suba la cifra tras caducar la caché.
6. **Documentación.** Actualizar `CLAUDE.md` y, si procede, `references/produccion-supabase.md`.

---

## Criterios de aceptación

- [x] El `stat-strip` de `/juegos/<id>` muestra, en este orden, «Partidas», «Mejor global» y «Dificultad» para los 5 juegos reales.
- [x] «Partidas» coincide con `select count(*) from public.partidas where game_id = '<id>'` en dev (con la caché vacía) y usa el formato `es-ES` (separador de miles desde 5 dígitos).
- [x] Un juego sin filas en `partidas` muestra «Partidas» `0`.
- [x] «Mejor global» coincide con la puntuación del puesto #01 del ranking de la misma ficha, en magenta con brillo.
- [x] Un juego sin puntuaciones muestra «Mejor global» `—` y el ranking muestra `EmptyBoard`.
- [x] Tras guardar una puntuación que supera la mejor, «Mejor global» muestra la nueva cifra al recargar la ficha.
- [x] Si `obtenerPartidasJugadas` lanza (probado forzando el error), la celda muestra `—`, el servidor registra el fallo y el resto de la ficha se pinta.
- [x] `iniciarPartida` no contiene ningún `.delete()` sobre `partidas`.
- [x] `partidas.user_id` admite nulos y `partidas_user_id_fkey` tiene `ON DELETE SET NULL` en dev.
- [x] Existe `partidas_game_id_idx` en dev y `get_advisors` ya no da `unindexed_foreign_keys` sobre `partidas.game_id`; no aparece ningún aviso nuevo de seguridad.
- [x] `anon` y `authenticated` siguen sin poder leer `partidas`: una petición REST con la clave publishable da `42501`. (Comprobado por permisos: ni `anon` ni `authenticated` tienen `SELECT` de tabla ni de columna sobre `partidas`, y la tabla no tiene políticas; la petición REST no se lanzó.)
- [x] El tope de 60 partidas por hora y los rechazos de `guardarPuntuacion` funcionan como antes (una partida de otra cuenta y una puntuación imposible siguen dando `[ERR] No se pudo validar esta puntuación.`).
- [x] `supabase/produccion/03-partidas_acumuladas.sql` contiene el mismo SQL aplicado en dev, y `02-verificacion-esperado.tsv` coincide con la salida de `02-verificacion.sql` en dev.
- [x] `database.types.ts` está regenerado y `partidas.Row.user_id` es `string | null`.
- [x] Ningún archivo del bundle de cliente (`.next/static`) contiene el valor de `SUPABASE_SECRET_KEY`.
- [x] `npm run lint` y `npm run build` terminan sin errores, y la consola del navegador no muestra errores nuevos en la ficha.
- [x] `CLAUDE.md` incluye esta spec en la lista y describe `iniciarPartida` sin limpieza y `partidas.user_id` con `ON DELETE SET NULL`.

---

## Decisiones tomadas y descartadas

| Decisión                                                     | Alternativa descartada                                      | Por qué                                                                                                         |
| ------------------------------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| «Partidas» = partidas iniciadas (`partidas`)                 | Puntuaciones publicadas (`scores`)                          | Lo eligió el usuario: es la cifra más fiel de cuánto se juega, incluidas las partidas que no se guardan.        |
| Acumular partidas (sin limpieza de caducadas)                | Mantener el borrado de las de más de 6 h                    | Con el borrado el contador bajaría solo; la validez ya la garantiza `puntuacionPosible`.                        |
| `ON DELETE SET NULL` en `partidas.user_id`                   | Mantener `ON DELETE CASCADE`                                | Borrar una cuenta no debe restar partidas al total; sigue el patrón de `scores.user_id` y `jugadores.user_id`.  |
| Recuento con `count: "exact", head: true` y la clave secreta | Función SQL `SECURITY DEFINER` o abrir `SELECT` a `anon`    | No expone filas ni cambia permisos; la clave secreta ya se usa solo en el servidor desde la SPEC 22.            |
| Índice `partidas_game_id_idx`                                | Escaneo completo                                            | La tabla ahora solo crece; además cierra el aviso `unindexed_foreign_keys` aceptado en la SPEC 22.              |
| `cacheLife("minutes")` sin `updateTag`                       | `updateTag` en cada `iniciarPartida` o `cacheLife("hours")` | Invalidar a cada partida vaciaría la caché sin parar; unos minutos de retraso no importan en un contador.       |
| «Mejor global» del ranking ya cargado                        | Consulta propia de `max(score)`                             | Ninguna consulta nueva, y la etiqueta `ranking-<juego>` ya la invalida `guardarPuntuacion`.                     |
| Número completo con `es-ES`                                  | Formato compacto (`12,4 mil`)                               | Exacto y coherente con las puntuaciones de la ficha.                                                            |
| `0` sin partidas, `—` sin puntuaciones o con fallo           | Lanzar a `app/error.tsx`                                    | Una cifra decorativa no debe tumbar la ficha; `0` partidas es un dato real y `—` indica que no hay marca.       |
| Solo la ficha                                                | También el badge de `GameCard`                              | Es lo que pide la plantilla `detalle.jsx`; la tarjeta multiplicaría las consultas por página y va en otra spec. |

---

## Riesgos identificados

| Riesgo                                                                                                                   | Mitigación                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| En desarrollo, Strict Mode abre una partida de más por montaje y ahora ya no caduca: el contador de dev queda inflado.   | Se acepta: solo afecta a dev. En producción no hay doble montaje.                                                                                       |
| Las partidas borradas antes por la limpieza no vuelven: el contador arranca por debajo del total histórico.              | Se acepta y se anota en `CLAUDE.md`; el total cuenta desde esta spec en adelante.                                                                       |
| Usar la clave secreta dentro de una función `'use cache'`.                                                               | La función solo devuelve un número; `admin.ts` lleva `import "server-only"` y el criterio de `.next/static` comprueba que la clave no llega al cliente. |
| Producción sin la migración: `iniciarPartida` deja de borrar, pero las cuentas borradas siguen arrastrando sus partidas. | `03-partidas_acumuladas.sql` y `02-verificacion-esperado.tsv` quedan listos para que el usuario los aplique a mano en el SQL Editor.                    |
| Un fallo de `obtenerRanking` sigue llevando el ranking a `app/error.tsx`, aunque la celda «Mejor global» lo capture.     | Fuera de alcance: el comportamiento del ranking no cambia en esta spec.                                                                                 |

---

## Lo que **no** entra en esta spec

- El badge de mejor puntuación en las tarjetas de `/biblioteca` y `/home`.
- Partidas de invitados.
- Contadores acumulados aparte, funciones SQL de agregado o invalidación por partida.
- Formato compacto de cifras.
- Datos reales para «Dificultad» o las etiquetas de la ficha.
- Recuperar las partidas borradas antes de esta spec.

Cada una de ellas, si llega, va en su propia spec.
