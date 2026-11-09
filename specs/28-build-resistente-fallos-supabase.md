# SPEC 28 — Build resistente a los fallos de Supabase

> **Status:** Aprobado
> **Depends on:** SPEC 07 (`obtenerRanking`, `obtenerActividadReciente` y `obtenerTopDelDia`), SPEC 22 (`createAdminClient` y `SUPABASE_SECRET_KEY`), SPEC 27 (`obtenerPartidasJugadas`, `CeldaPartidas` y `CeldaMejorGlobal`)
> **Date:** 2026-11-09
> **Objective:** Que un fallo de Supabase, o la falta de `SUPABASE_SECRET_KEY`, durante el prerender no tumbe `next build`, y que cada página afectada muestre un estado de «no disponible» que se recupera solo.

---

## Por qué existe este spec

El primer despliegue de la SPEC 27 en Vercel falló porque `SUPABASE_SECRET_KEY` no estaba definida para el build: `Error occurred prerendering page "/juegos/tetris"`. Se reprodujo en local con `SUPABASE_SECRET_KEY= npm run build`.

`CeldaPartidas` sí captura el error y pinta `—`, pero el build se cae igual: `obtenerPartidasJugadas` lanza **dentro** de una función `'use cache'`, y Next 16 da por fallido el prerender aunque quien la llama capture la excepción. En `next dev` no ocurre, por eso el criterio de la SPEC 27 («si `obtenerPartidasJugadas` lanza, la celda muestra `—`») pasó sin cubrir el build.

El problema no es solo de «Partidas». Con `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 npx next build --debug-prerender`, el build falla en 7 rutas: las 5 fichas `/juegos/<id>` (`obtenerPartidasJugadas` y `obtenerRanking`), `/salon` (`obtenerRanking`) y `/home` (`obtenerActividadReciente`). Las cuatro consultas de `app/lib/leaderboard/queries.ts` lanzan dentro de `'use cache'`, así que un fallo puntual de Supabase durante un despliegue lo tumba entero.

Según la documentación de Next 16 (`cacheLife.md`), `cacheLife` se puede llamar en ramas distintas (una por invocación), y una caché de vida corta (`revalidate` 0 o `expire` por debajo de 5 minutos) queda fuera del prerender y se resuelve al pedir la página.

---

## Alcance

**In:**

- Las cuatro consultas de `app/lib/leaderboard/queries.ts` (`obtenerPartidasJugadas`, `obtenerRanking`, `obtenerActividadReciente` y `obtenerTopDelDia`) dejan de lanzar. Todo su cuerpo, incluida la creación del cliente, va en un `try/catch` dentro de la función `'use cache'`.
- En el éxito, cada una conserva su `cacheLife` actual (`"minutes"` o `"seconds"`) y su `cacheTag`. En el fallo, registra el error con `console.error` (nombre de la función y mensaje, sin claves ni datos de cuentas), llama a `cacheLife("seconds")` y devuelve `null`.
- Tipos de retorno: `Promise<number | null>` y `Promise<FilaRanking[] | null>`, `Promise<ActividadReciente[] | null>` y `Promise<TopJugadorHoy[] | null>`. `null` significa «no se pudo leer»; `[]` y `0` siguen significando «no hay datos».
- Componente nuevo `UnavailableBoard` en `app/components/unavailable-board.tsx`, junto a `EmptyBoard`: texto «DATOS NO DISPONIBLES — VUELVE EN UN MOMENTO», `role="status"` y sin botón. Reutiliza los estilos de `.empty-board` con un modificador `.empty-board.unavailable` en `app/globals.css` (sin cursor parpadeante).
- Ficha `/juegos/[id]`: `RankingReal` pinta `UnavailableBoard` si `obtenerRanking` devuelve `null`. `CeldaPartidas` y `CeldaMejorGlobal` pintan `—` con `null` y quitan su `try/catch`, porque las consultas ya no lanzan.
- `/salon`: `SalonConDatos` pasa a `HallOfFame` `PuntuacionRanking[] | null` por juego. `HallOfFame` pinta `UnavailableBoard` en la pestaña cuyo ranking es `null` y conserva el podio y la tabla en las demás.
- `/home`: `UltimasPuntuaciones` y `TopJugadoresHoy` pintan `UnavailableBoard` si su consulta devuelve `null`.
- Documentación: `CLAUDE.md` (contrato de `queries.ts`, `UnavailableBoard` y el aviso de que el build ya no avisa de una `SUPABASE_SECRET_KEY` ausente) y `references/produccion-supabase.md` (`SUPABASE_SECRET_KEY` es obligatoria también en el build, en **Production** y en **Preview**).

**Out of scope (para futuros specs):**

- `obtenerMejorMarca`, `iniciarPartida` y `guardarPuntuacion`: son Server Actions, no se ejecutan en el build y ya devuelven errores al cliente.
- Hacer que el build falle a propósito si falta una variable de entorno (validación de configuración en el build).
- Reintentos automáticos o `cacheLife` personalizado para el caso de error.
- `'use cache: remote'` o cualquier caché compartida entre instancias.
- Un aviso visual en `GamePlayer` cuando falta `SUPABASE_SECRET_KEY` en tiempo de ejecución.
- Monitorización o alertas de los `console.error`.

---

## Modelo de datos

Esta spec no cambia la base de datos ni añade migraciones. Solo cambia el contrato de las consultas:

```ts
// app/lib/leaderboard/queries.ts
export async function obtenerPartidasJugadas(
  game: string,
): Promise<number | null>;
export async function obtenerRanking(
  game: string,
  limit: number,
): Promise<FilaRanking[] | null>;
export async function obtenerActividadReciente(
  limit: number,
): Promise<ActividadReciente[] | null>;
export async function obtenerTopDelDia(
  limit: number,
): Promise<TopJugadorHoy[] | null>;
// null = no se pudo leer (fallo de Supabase o de configuración): se registra,
// se guarda con cacheLife("seconds") y nunca se lanza dentro de 'use cache'.
```

```ts
// app/components/hall-of-fame.tsx
type RankingJuego = PuntuacionRanking[] | null; // props asteroides, tetris, arkanoid, snake y frogger
```

---

## Plan de implementación

1. **Consultas.** En `queries.ts`, envolver el cuerpo de las cuatro funciones en `try/catch` con `cacheLife` en cada rama (el de siempre en el éxito y `"seconds"` en el fallo), `console.error` y `return null`. Ajustar los tipos y el comentario de cabecera. Adaptar en el mismo paso a quienes las llaman para que compilen: `null` se trata como `[]` o `0` de forma provisional. `npm run build` debe pasar.
2. **Estado «no disponible».** Crear `app/components/unavailable-board.tsx` y la regla `.empty-board.unavailable` en `app/globals.css`.
3. **Ficha.** En `app/juegos/[id]/page.tsx`, `RankingReal` pinta `UnavailableBoard` con `null`, y `CeldaPartidas` y `CeldaMejorGlobal` pintan `—` con `null` y quitan su `try/catch`.
4. **Salón.** `app/salon/page.tsx` y `app/components/hall-of-fame.tsx` con `RankingJuego` y `UnavailableBoard` por pestaña.
5. **Home.** `UltimasPuntuaciones` y `TopJugadoresHoy` en `app/home/page.tsx` pintan `UnavailableBoard` con `null`.
6. **Documentación.** Actualizar `CLAUDE.md` y `references/produccion-supabase.md`.

---

## Criterios de aceptación

- [ ] `SUPABASE_SECRET_KEY= npm run build` termina con código 0, y el log del build muestra el `console.error` de `obtenerPartidasJugadas`.
- [ ] `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 npm run build` termina con código 0 y no muestra `Error occurred prerendering page`.
- [ ] Tras el build sin clave, `npm run start` con `.env.local` completo muestra «Partidas» con la cifra real en las 5 fichas al recargar, sin volver a compilar.
- [ ] Con `obtenerRanking` forzado a fallar en `next dev`, la ficha muestra «Mejor global» `—` y `UnavailableBoard` en lugar del ranking, y el resto de la ficha se pinta.
- [ ] Con `obtenerRanking` forzado a fallar para un solo juego, `/salon` muestra `UnavailableBoard` en esa pestaña y el podio normal en las demás.
- [ ] Con `obtenerActividadReciente` y `obtenerTopDelDia` forzadas a fallar, las dos tarjetas de actividad de `/home` muestran `UnavailableBoard` y el resto del Home se pinta.
- [ ] `UnavailableBoard` muestra «DATOS NO DISPONIBLES — VUELVE EN UN MOMENTO», tiene `role="status"` y no tiene botón ni cursor parpadeante.
- [ ] Un juego sin puntuaciones sigue mostrando `EmptyBoard` («SIN PUNTUACIONES — SÉ EL PRIMERO»), no `UnavailableBoard`.
- [ ] Ninguna de las cuatro consultas contiene un `throw`, y cada invocación llama a `cacheLife` una sola vez.
- [ ] Ningún `console.error` de las consultas incluye el valor de una clave ni datos de una cuenta.
- [ ] Con la configuración normal, las 5 fichas, `/salon` y `/home` muestran los mismos datos que antes de esta spec, y `guardarPuntuacion` sigue invalidando el ranking y «Mejor global» al recargar.
- [ ] `npm run lint` y `npm run build` terminan sin errores, y la consola del navegador no muestra errores nuevos en las tres rutas.
- [ ] `CLAUDE.md` describe el contrato `null` de `queries.ts` y `UnavailableBoard`, y `references/produccion-supabase.md` indica que `SUPABASE_SECRET_KEY` hace falta en el build de Production y de Preview.

---

## Decisiones tomadas y descartadas

| Decisión                                                      | Alternativa descartada                                         | Por qué                                                                                                                                            |
| ------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Las cuatro consultas de `queries.ts`                          | Solo `obtenerPartidasJugadas`, o también solo `obtenerRanking` | Lo eligió el usuario: el build falla en 7 rutas con Supabase caído, y arreglar solo una deja el despliegue igual de frágil.                        |
| Devolver `null` dentro de `'use cache'`                       | Lanzar y capturar fuera (SPEC 27)                              | Next 16 da por fallido el prerender si la función cacheada lanza, aunque quien la llama capture el error.                                          |
| `cacheLife("seconds")` en el fallo                            | Misma vida que en el éxito                                     | Lo eligió el usuario: una caché corta queda fuera del prerender, el fallo no se queda en el HTML estático y se reintenta en la siguiente petición. |
| `null` distinto de `[]` y `0`                                 | Devolver `[]` o `0` también en el fallo                        | «No se pudo leer» y «no hay datos» se ven distinto: `EmptyBoard` invita a jugar y `UnavailableBoard` avisa del fallo.                              |
| `UnavailableBoard` propio                                     | Reutilizar `EmptyBoard`                                        | Lo eligió el usuario: «SÉ EL PRIMERO» sería falso cuando sí hay puntuaciones.                                                                      |
| Un solo texto genérico «DATOS NO DISPONIBLES»                 | Un texto por pantalla (ranking, actividad)                     | El mismo componente sirve en la ficha, el salón y el Home.                                                                                         |
| Sin botón en `UnavailableBoard`                               | Botón JUGAR como en `EmptyBoard`                               | El aviso informa de un fallo; la ficha y el Home ya tienen sus botones para jugar.                                                                 |
| Quitar el `try/catch` de `CeldaPartidas` y `CeldaMejorGlobal` | Mantenerlo por si acaso                                        | Las consultas ya no lanzan; dos capas de gestión del mismo fallo confunden.                                                                        |
| Un build sin `SUPABASE_SECRET_KEY` pasa                       | Que el build falle si falta la clave                           | Lo pidió el usuario en la descripción. El fallo queda en el log y la variable se documenta como obligatoria.                                       |
| Verificar con dos builds forzados                             | Solo el build sin clave                                        | Lo eligió el usuario: cubre el caso de Vercel y un Supabase caído.                                                                                 |

---

## Riesgos identificados

| Riesgo                                                                                                                                                    | Mitigación                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Un despliegue sin `SUPABASE_SECRET_KEY` ya no falla: compila, «Partidas» muestra `—` y `guardarPuntuacion` no puede publicar.                             | El build registra el fallo de `obtenerPartidasJugadas`, y `references/produccion-supabase.md` lista la variable como obligatoria en Production y Preview. |
| Mientras Supabase falla, cada visita vuelve a consultarlo (`cacheLife("seconds")`).                                                                       | Se acepta: es la forma de recuperarse sola. La carga extra dura lo que dure el fallo.                                                                     |
| `NEXT_PUBLIC_SUPABASE_URL` se incrusta en el bundle al compilar, así que tras el build con la URL inaccesible `next start` no se recupera sin recompilar. | El criterio de recuperación solo se comprueba tras el build sin clave; el de la URL solo exige que el build termine.                                      |
| Una ruta antes estática puede pasar a parcial si una consulta falla durante el build.                                                                     | Es lo esperado: la parte que falló se resuelve en la petición. Con la configuración normal la salida del build no cambia.                                 |

---

## Lo que **no** entra en esta spec

- `obtenerMejorMarca`, `iniciarPartida` y `guardarPuntuacion`.
- Validar en el build que estén todas las variables de entorno.
- Reintentos, `'use cache: remote'` o perfiles de caché personalizados.
- Avisos en `GamePlayer` por falta de configuración.
- Monitorización de los errores registrados.

Cada una de ellas, si llega, va en su propia spec.
