# SPEC 26 — Eliminar los juegos de maqueta

> **Status:** Aprobado
> **Depends on:** SPEC 01 (catálogo y maquetas), SPEC 07 (ranking real y `JUEGOS_CON_RANKING`), SPEC 22 (modal de fin de juego y `.ranking-lock`), SPEC 24 (`NOMBRES_RESERVADOS`)
> **Date:** 2026-11-09
> **Objective:** Que Arcade Vault solo muestre y sirva los 5 juegos reales (Asteroides, Tetris, Arkanoid, Snake y Frogger), eliminando las 8 maquetas y todo el código y los datos falsos que solo existían para ellas.

---

## Por qué existe este spec

`app/data/games.ts` tiene 13 juegos: 5 reales, con motor de canvas y ranking en Supabase, y 8 maquetas de la SPEC 01 (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria` y `duelo-pixel`), que solo simulan una partida con un `setInterval` y guardan en `localStorage`.

Las maquetas siguen en primera línea:

- `/home` muestra `GAMES.slice(0, 6)`: los 6 primeros son maquetas, así que el carril «JUEGOS DISPONIBLES AHORA» no enseña ningún juego real.
- `/salon` abre en la pestaña `bloque-buster`, con un ranking inventado por `seededScores`.
- `/juegos/[id]` enseña para las maquetas un ranking inventado y para todos un «Partidas» y un «Mejor global» falsos (`plays` y `best`); en los reales valen `"0"` y `0`.
- `/home` anuncia «12+ JUEGOS».

Desde la SPEC 22 solo publican las cuentas en juegos reales, y las maquetas son la única razón de que sigan vivos `saveScore`, la clave `av_scores`, el campo editable de iniciales del modal y la rama de simulación de `GamePlayer`.

---

## Alcance

**In:**

- Quitar las 8 maquetas de `GAMES`, que queda con los 5 reales en orden de porte: `asteroides`, `tetris`, `arkanoid`, `snake`, `frogger`.
- Quitar `VERSUS` del tipo `Categoria` y de `CATS`, que queda `TODOS`, `ARCADE`, `PUZZLE` y `SHOOTER`.
- Quitar los campos `best` y `plays` de `Juego` y los huecos que los pintan: el `score-badge` de `GameCard` y las celdas «Partidas» y «Mejor global» de la ficha `/juegos/[id]`.
- `HOME_STATS`: «12+ JUEGOS» pasa a «5 JUEGOS».
- URLs de maquetas (`/juegos/<maqueta>` y `/juegos/<maqueta>/jugar`): 404 con `notFound()`. `generateStaticParams` solo genera los 5 reales.
- `/juegos/[id]`: siempre `RankingReal`, sin rama `seededScores`.
- `/salon` (`HallOfFame`): sin `seededScores`, sin el rango y la puntuación inventados de «TU MEJOR MARCA» (`youRank`, `youScore`, fecha fija `11/05/2026`); la caja solo aparece si `obtenerMejorMarca` devuelve una marca. La pestaña por defecto es `GAMES[0]` (Asteroides).
- `GamePlayer`: eliminar la rama de maqueta (`fakeScore`, el `setInterval`, `over`/`setOver` y el botón que la terminaba, `editedName`/`setEditedName` y la llamada a `saveScore`). Todo juego que llega a `GamePlayer` es real.
- Modal de fin de juego: invitado ve `.ranking-lock` (como hoy en juegos reales); con sesión, el nombre se muestra en el campo de solo lectura y GUARDAR llama a `guardarPuntuacion`, como hoy.
- `AuthProvider`: eliminar `saveScore` del contexto y borrar `av_scores` de `localStorage` al montar, igual que `av_user` (con `try/catch`).
- `app/data/scores.ts`: eliminar `seededScores`, `PLAYERS` y `PuntuacionGuardada`; conservar `PuntuacionRanking` y `Usuario`.
- `app/data/home.ts`: el comentario de ejemplo `"Caída"` pasa a un juego real.
- `app/globals.css`: eliminar las portadas de maqueta `.cover-bricks`, `.cover-tetro`, `.cover-snake`, `.cover-glot`, `.cover-invaders`, `.cover-rocas`, `.cover-rana` y `.cover-duelo` (con sus `::before`/`::after`) y los comentarios que las citan como contraste («Distinta de .cover-bricks», etc.).
- `app/acceso/auth-schema.ts`: actualizar el comentario de `NOMBRES_RESERVADOS` (INVITADO ya no lo usa ninguna maqueta), sin cambiar la lista.
- Documentación: `CLAUDE.md`, `references/game-suggestions-todo.md` y `references/mobile-review.md` en lo que traten las maquetas como existentes.

**Out of scope (para futuros specs):**

- Cambios en Supabase: ninguna migración. `games` ya tiene solo los 5 reales, e `INVITADO` sigue reservado en `NOMBRES_RESERVADOS` y en el check de `jugadores`.
- Mostrar cifras reales de partidas o de mejor puntuación global en tarjetas y ficha.
- Redirecciones de las URLs antiguas a `/biblioteca` o a un juego real equivalente.
- Rediseñar `/biblioteca`, `/home` o `/salon` más allá de quitar lo falso (p. ej. que el carril de 6 huecos quede con 5).
- Unificar las comprobaciones `gameId === "..."` repetidas de `GamePlayer` y de `/juegos/[id]` con `JUEGOS_CON_RANKING`, salvo donde desaparece la rama de maqueta.
- Tocar las specs 01–25 ni `specs/game-jam/`, que quedan como histórico.
- `demos/Demos.tsx`, `/contador` y `HomeSilhouettes`.

---

## Modelo de datos

No hay datos nuevos. Cambian tipos existentes:

```ts
// app/data/games.ts
export type Categoria = "ARCADE" | "PUZZLE" | "SHOOTER"; // sin "VERSUS"

export interface Juego {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: Categoria;
  cover: string;
  color: ColorBoton;
  // sin best ni plays
}

export const CATS: ["TODOS", ...Categoria[]] = [
  "TODOS",
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
];
```

```ts
// app/components/auth-provider.tsx: el contexto pierde saveScore
interface AuthContexto {
  user: Usuario | null;
  cargando: boolean;
  logout: () => Promise<void>;
}
```

`localStorage`: la clave `av_scores` deja de leerse y escribirse; se borra al montar `AuthProvider`. Las claves de tema y skins (`av-tetris-theme`, `av-*-skin`) no cambian.

---

## Plan de implementación

1. **Catálogo.** En `app/data/games.ts`, dejar los 5 reales en orden `asteroides`, `tetris`, `arkanoid`, `snake`, `frogger`, quitar `VERSUS` de `Categoria` y `CATS`, y quitar `best` y `plays` de `Juego` y de las 5 entradas. Ajustar `GameCard` (sin `score-badge`; el botón JUGAR se queda) y la ficha `/juegos/[id]` (sin «Partidas» ni «Mejor global»; «Dificultad» se queda). `npm run build` debe pasar: las rutas de maquetas ya no se generan.
2. **404 en URLs antiguas.** Comprobar que `/juegos/[id]/page.tsx` y `/juegos/[id]/jugar/page.tsx` llaman a `notFound()` cuando `getGame(id)` es `undefined` (y, si no, añadirlo).
3. **Ficha y Salón sin datos falsos.** En `/juegos/[id]`, renderizar siempre `RankingReal` y quitar `FilasRanking` con `seededScores` si deja de usarse. En `HallOfFame`, `rows = reales[tab]`, quitar `seededScores`, `youRank`, `youScore` y la fecha fija, y mostrar «TU MEJOR MARCA» solo con sesión y `mejorMarca`.
4. **`GamePlayer` sin rama de maqueta.** Quitar `fakeScore`, el `setInterval`, `over`/`setOver` y su botón, `editedName`, el campo editable de iniciales y la rama que llama a `saveScore`. `score`, `lives` y `level` salen solo del snapshot. Si `esReal` queda siempre verdadero, simplificar las condiciones que lo usan.
5. **`AuthProvider` y datos.** Quitar `saveScore` y `SCORES_KEY` del provider; al montar, `localStorage.removeItem("av_scores")` en el mismo bloque que borra `av_user`. Quitar `seededScores`, `PLAYERS` y `PuntuacionGuardada` de `app/data/scores.ts`. Cambiar `HOME_STATS` a `{ n: "5", u: "JUEGOS", ... }` y el comentario `"Caída"` de `home.ts`.
6. **CSS.** Borrar de `app/globals.css` las 8 portadas de maqueta y los comentarios que las nombran. Buscar después que ninguna clase borrada siga referenciada en `app/`.
7. **Comentarios.** Actualizar el comentario de `NOMBRES_RESERVADOS` y los comentarios de `GamePlayer`, `HallOfFame`, `/juegos/[id]` y `games.ts` que hablen de maquetas o datos ficticios.
8. **Comprobación.** `npm run lint` y `npm run build` sin errores. Revisar con el MCP de Playwright `/home`, `/biblioteca` (cada filtro), `/salon` (cada pestaña, con y sin sesión), `/juegos/asteroides`, `/juegos/frogger/jugar` (fin de partida como invitado y con sesión) y `/juegos/bloque-buster` y `/juegos/caida/jugar` (404).
9. **Documentación.** Actualizar `CLAUDE.md` (sin maquetas, «otros 8 juegos», `saveScore`, `av_scores`, `seededScores`, `best`/`plays`, `VERSUS` ni las menciones a `caida`, `bloque-buster`, `serpentina` y `ranaria` como «otra maqueta distinta»; añadir esta spec a la lista), `references/game-suggestions-todo.md` y `references/mobile-review.md`.

---

## Criterios de aceptación

- [ ] `GAMES` tiene exactamente 5 entradas, en el orden `asteroides`, `tetris`, `arkanoid`, `snake`, `frogger`.
- [ ] `Juego` no tiene `best` ni `plays`, y ninguna parte de `app/` los lee.
- [ ] `Categoria` y `CATS` no contienen `VERSUS`; `/biblioteca` muestra los filtros TODOS, ARCADE, PUZZLE y SHOOTER, y cada uno lista al menos un juego.
- [ ] `/biblioteca` con TODOS muestra 5 tarjetas, sin «MEJOR PUNTUACIÓN».
- [ ] El carril «JUEGOS DISPONIBLES AHORA» de `/home` muestra los 5 juegos reales y ninguna maqueta.
- [ ] `/home` muestra «5 JUEGOS» en lugar de «12+».
- [ ] `/juegos/<id>` y `/juegos/<id>/jugar` responden 404 para los 8 ids de maqueta.
- [ ] La ficha `/juegos/<id>` de los 5 reales muestra el ranking de Supabase (o `EmptyBoard`) y no muestra «Partidas» ni «Mejor global».
- [ ] `/salon` abre en Asteroides y tiene exactamente 5 pestañas.
- [ ] En `/salon`, «TU MEJOR MARCA» no aparece sin sesión ni con una sesión sin marca en ese juego, y con marca muestra el rango, la puntuación y la fecha que devuelve `obtenerMejorMarca`.
- [ ] `GamePlayer` no contiene `setInterval`, `fakeScore`, `editedName` ni `saveScore`.
- [ ] Al terminar una partida como invitado, el modal muestra `.ranking-lock`; con sesión, muestra el nombre en solo lectura y GUARDAR publica en Supabase como antes.
- [ ] `useAuth()` no expone `saveScore`, y tras cargar cualquier página `localStorage.getItem("av_scores")` es `null`.
- [ ] `app/data/scores.ts` no exporta `seededScores`, `PLAYERS` ni `PuntuacionGuardada`.
- [ ] `app/globals.css` no contiene `.cover-bricks`, `.cover-tetro`, `.cover-snake` (sin sufijo), `.cover-glot`, `.cover-invaders`, `.cover-rocas`, `.cover-rana` ni `.cover-duelo`, y las portadas de los 5 reales se ven igual que antes.
- [ ] Ningún archivo de `app/` contiene los ids `bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria` ni `duelo-pixel`.
- [ ] `NOMBRES_RESERVADOS` sigue siendo `JUGADOR`, `INVITADO` y `ADMIN`, y no hay migraciones nuevas en Supabase.
- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] La consola del navegador no muestra errores nuevos en las rutas revisadas.
- [ ] `CLAUDE.md` no describe maquetas como existentes e incluye esta spec en la lista; `references/game-suggestions-todo.md` y `references/mobile-review.md` están actualizados.

---

## Decisiones tomadas y descartadas

| Decisión                                             | Alternativa descartada                                | Por qué                                                                                                                               |
| ---------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Eliminar todo el código que solo usaban las maquetas | Quitar solo las entradas del catálogo                 | El código sin uso (simulación, `saveScore`, `seededScores`) confunde y obliga a mantener ramas `esReal` que ya no tienen otra salida. |
| 404 en las URLs antiguas                             | Redirigir a `/biblioteca` o al juego real equivalente | Las maquetas nunca tuvieron tráfico real que conservar, y `notFound()` no deja redirecciones que mantener.                            |
| Quitar `best` y `plays`                              | Rellenarlos con datos reales de Supabase              | Hoy son cifras falsas o ceros; mostrar datos reales necesita consultas cacheadas nuevas y merece su propia spec.                      |
| «5 JUEGOS» en `HOME_STATS`                           | Mantener «12+»                                        | El sitio no debe anunciar juegos que no tiene.                                                                                        |
| Quitar `VERSUS`                                      | Quitar el filtro entero o dejar `VERSUS` vacío        | Un filtro que siempre da una lista vacía es un callejón sin salida; los otros tres sí tienen juegos.                                  |
| Orden de porte (`asteroides` primero)                | Alfabético o más nuevo primero                        | Es el orden actual entre los reales y deja Asteroides como pestaña por defecto de `/salon`.                                           |
| Borrar `av_scores` al montar                         | Dejar la clave huérfana                               | Sigue el patrón de `av_user` y no deja datos que nadie lee en el navegador.                                                           |
| `INVITADO` sigue reservado                           | Liberarlo con una migración                           | No compensa tocar la base de datos; reservado no estorba y evita confusión con el texto de invitado.                                  |
| No tocar las specs 01–25                             | Anotarlas                                             | Son histórico: describen lo que se hizo entonces.                                                                                     |

---

## Riesgos identificados

- **Clase compartida borrada por error.** `.cover-snake` (maqueta) y `.cover-snake-real` (Snake) comparten prefijo, igual que `.cover-tetro` y `.cover-tetris`. Hay que borrar por selector exacto y comprobar visualmente las 5 portadas reales.
- **Carril de `/home` con un hueco.** El carril se diseñó para 6 tarjetas y ahora tiene 5; si queda descompensado en algún ancho, se anota para otra spec en vez de rediseñarlo aquí.
- **`/salon` sin sesión.** Al quitar el rango inventado, un usuario sin marca deja de ver la caja; hay que comprobar que la cabecera de `/salon` no queda descolocada.
- **Prefetch o enlaces guardados.** Algún enlace externo o marcador a una maqueta dará 404; se acepta.
