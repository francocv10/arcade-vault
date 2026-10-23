# SPEC 08 — Juego TETRIS jugable en la plataforma con ranking real

> **Status:** Implementado
> **Depends on:** SPEC 06 (patrón de motor de canvas y reproductor), SPEC 07 (tablas `games` y `scores`, vista `leaderboard` y rankings reales)
> **Date:** 2026-10-23
> **Objective:** Portar Tetris de `references/started-games/03-tetris/` a un motor de canvas en TypeScript, publicarlo como el juego `tetris` (1 vida y tema claro/oscuro solo dentro del canvas), conectarlo al reproductor y guardar y mostrar sus puntuaciones en Supabase.

---

## Por qué existe este spec

Hoy solo `asteroides` es un juego real. La carpeta `references/started-games/03-tetris/` trae un Tetris completo en JavaScript vanilla (`index.html`, `style.css`, `game.js`): tablero de 10×20, 7 piezas (las estándar; el código original trae además una «N», una tuerca hueca de 3×3 en gris, que se descarta por decisión del usuario), pieza fantasma, vista previa de la siguiente pieza, puntuación clásica, niveles cada 10 líneas y un botón de tema claro/oscuro. Este spec lo lleva a la plataforma siguiendo el patrón de SPEC 06 y SPEC 07: un motor de canvas en TypeScript que avisa a React por callback y un ranking real en Supabase.

Tiene tres particularidades frente a Asteroides:

- **Forma del lienzo.** El original es un tablero vertical de 300×600 con un panel lateral en el DOM (marcadores, vista previa y controles). El CRT es 4:3, así que el lienzo lógico pasa a 800×600 y el panel se dibuja dentro del canvas.
- **Una sola vida.** Tetris no tiene vidas: la partida termina cuando una pieza nueva no cabe. Por decisión del usuario, el snapshot envía `lives: 1` durante la partida y `lives: 0` al terminar, de modo que la barra del reproductor muestra `♥` y luego `—`. Los demás juegos conservan sus 3 vidas.
- **Tema claro/oscuro.** El original lo alterna con un botón. Se conserva, pero solo cambia la paleta del juego dentro del canvas; el marco CRT y el resto de la plataforma siguen oscuros. El botón aparece únicamente en este juego.

El catálogo ya tiene `caida` («CAÍDA», PUZZLE), una maqueta ficticia con portada `.cover-tetro`. Es una ficha distinta y no se toca: `tetris` es una entrada nueva.

---

## Alcance

**In:**

- Entrada nueva `tetris` **al final** de `GAMES` en `app/data/games.ts` (así `GAMES.slice(0, 6)` del Home no cambia) y portada CSS nueva `.cover-tetris` en `app/globals.css`, diseñada con `/frontend-design` y distinta de `.cover-tetro`.
- Motor del juego en `app/games/tetris/`, portado de `game.js` sin cambiar la jugabilidad: tablero 10×20, 7 piezas, rotación horaria con _wall kicks_, caída por gravedad, _soft drop_, _hard drop_, pieza fantasma, vista previa de la siguiente pieza, puntuación por líneas, niveles y fin de partida cuando una pieza nueva colisiona al aparecer.
- Aspecto idéntico al original: paleta de 8 colores, bloques con brillo superior, rejilla tenue y colores de los temas oscuro y claro de `style.css`, todo dibujado en el canvas.
- Lienzo lógico de 800×600: tablero de 300×600 y, a su derecha, el panel dibujado en canvas con SCORE, LINES, LEVEL, NEXT (caja de 120×120) y la lista de controles. Sin el título «TETRIS» (la plataforma ya lo muestra) y sin la línea «P pausa».
- Pantalla de GAME OVER dibujada en el canvas («GAME OVER» y «Puntuación: N»), sin botón de reinicio propio: el modal de React se abre solo y ofrece JUGAR DE NUEVO.
- Tema claro/oscuro: el motor expone `setTheme("dark" | "light")` y cambia solo la paleta del canvas. Un botón TEMA en la barra de acciones del reproductor, visible únicamente cuando `gameId === "tetris"`, alterna el tema. El tema elegido se guarda en `localStorage` con la clave `av-tetris-theme` y por defecto es oscuro.
- Componente cliente `app/components/tetris-canvas.tsx`, calcado de `asteroids-canvas.tsx`: monta el canvas de 800×600, crea el motor en `useEffect`, lo destruye al desmontar (seguro con Strict Mode) y lo controla por `paused`, `restartKey` y `theme`.
- Rama `gameId === "tetris"` en `GamePlayer`: canvas en lugar de la arena de CSS, sin el `setInterval` de puntos falsos, barra `player-hud` con valores reales (VIDAS `♥`/`—`), PAUSA/REANUDAR, FIN, modal automático al llegar a `gameover`, JUGAR DE NUEVO, SALIR y el botón TEMA.
- CSS para que el canvas llene `.crt-screen` bajo las capas de líneas de escaneo y viñeta (clase `.tetris-canvas`).
- Alta en Supabase: `insert into public.games` con el MCP y el `id` `tetris` en `JUEGOS_CON_RANKING` (`app/lib/leaderboard/schema.ts`).
- Guardado: GUARDAR PUNTUACIÓN llama a `guardarPuntuacion({ game: "tetris", name, score })` con aviso `[ERR]` si falla.
- Rankings reales de `tetris` en `/salon` (pestaña TETRIS y «TU MEJOR MARCA»), `/juegos/tetris` y las tarjetas de actividad del Home, con estado vacío `EmptyBoard`.
- Sin assets: el original no usa imágenes ni sonido, y no se crea `public/`.
- Documentar la spec y los archivos nuevos en `CLAUDE.md`.

**Out of scope (para futuros specs):**

- Generalizar `GamePlayer` hacia un registro de juegos (cada juego añade su rama, como Asteroides).
- Tecla `P` de pausa y su overlay propio: la pausa es solo el botón PAUSA de React.
- Controles táctiles.
- Sonido y música (el original no tiene).
- Mejoras de jugabilidad respecto a `game.js`: pieza de reserva (_hold_), bolsa de 7 piezas, rotación SRS, retardo de bloqueo (_lock delay_), niveles distintos o modos de juego.
- Cambios de aspecto más allá de los dos temas del original (colores neón, fuente pixel).
- Tema claro/oscuro para otros juegos o para la plataforma.
- Autenticación real (`user_id` queda en `NULL`), anti-trampas, realtime y paginación.
- Portar otros juegos o tocar las maquetas, `caida` y el ranking falso del resto.
- Tests automatizados.

---

## Modelo de datos

Ficha del catálogo (mismo tipo `Juego` de SPEC 01):

```ts
{
  id: "tetris",
  title: "TETRIS",
  short: "Encaja siete piezas sin tocar el techo.",
  long: "Siete piezas caen sobre un tablero de 10×20. Muévelas, rótalas y déjalas caer para completar líneas; cada 10 líneas sube el nivel y la caída se acelera. Solo tienes una vida: si una pieza nueva no cabe al aparecer, la partida termina.",
  cat: "PUZZLE",
  cover: "cover-tetris",
  color: "magenta",
  best: 0,
  plays: "0",
}
```

Contrato entre el motor y React (`app/games/tetris/types.ts`), el mismo patrón que Asteroides más `setTheme`:

```ts
export type EstadoTetris = "playing" | "gameover";
export type TemaTetris = "dark" | "light";

export interface SnapshotTetris {
  score: number; // entero 0..1_000_000
  lives: number; // 1 mientras se juega, 0 en gameover
  level: number; // floor(lines / 10) + 1
  status: EstadoTetris;
}

export interface JuegoTetris {
  pause(): void;
  resume(): void;
  restart(): void;
  setTheme(tema: TemaTetris): void;
  destroy(): void;
}

export function createTetrisGame(
  canvas: HTMLCanvasElement,
  onChange: (snapshot: SnapshotTetris) => void,
): JuegoTetris;
```

Estado interno del motor (no se expone; mismos nombres que `game.js`):

```ts
// board: ROWS × COLS, 0 = vacía, 1..7 = índice de color de la pieza
// current / next: { type: number; shape: number[][]; x: number; y: number }
// score, lines, level, dropInterval (ms), dropAccum (ms), paused, gameOver
```

Base de datos (migración que describe la spec y aplicará `/spec-impl` con `apply_migration`; no cambia el esquema, solo añade una fila):

```sql
insert into public.games (id, title, category)
values ('tetris', 'TETRIS', 'PUZZLE');
```

Convenciones:

- `onChange` se llama al arrancar y solo cuando cambia algún valor del snapshot, nunca por fotograma. Las pulsaciones que suman puntos (`↓`, `Espacio`) y los bloqueos de pieza sí lo disparan, porque cambian `score`, `level` o `status`.
- Constantes del original sin modificar: `COLS = 10`, `ROWS = 20`, `BLOCK = 30`, `LINE_SCORES = [0, 100, 300, 500, 800]`, `dropInterval` inicial de 1000 ms, wall kicks `[0, -1, 1, -2, 2]`, pieza fantasma con `globalAlpha = 0.2`, brillo del bloque `rgba(255,255,255,0.12)` en sus 4 px superiores.
- Colores de piezas por índice: `1` I `#4dd0e1`, `2` O `#ffd54f`, `3` T `#ba68c8`, `4` S `#81c784`, `5` Z `#e57373`, `6` J `#90caf9`, `7` L `#ffb74d`. La pieza nueva se elige con la misma probabilidad entre los 7 tipos y aparece en `y = 0`, con `x = floor(COLS / 2) - floor(ancho / 2)` (I en 3, el resto en 4).
- Reglas de puntuación: _soft drop_ +1 por fila; _hard drop_ +2 por fila recorrida; al limpiar `n` líneas, `score += LINE_SCORES[n] × level` con el nivel anterior a la subida; después `level = floor(lines / 10) + 1` y `dropInterval = max(100, 1000 − (level − 1) × 90)`.
- Una pieza apoyada se fija al instante, tanto por gravedad como con `↓` (el original no tiene retardo de bloqueo).
- Paletas por tema (variables de `style.css` convertidas a constantes del motor): oscuro con fondo `#0f0f17`, tablero `#1a1a25`, borde `#2a2a3a`, etiquetas `#555570`, rejilla `#22222e`, valores `#7aa2f7`; claro con fondo `#f0f0f8`, tablero `#e4e4f0`, borde `#b0b0c8`, etiquetas `#6060a0`, rejilla `#c8c8dc`, textos de controles `#404060`. Las piezas conservan sus colores en ambos temas.
- Controles: `←` `→` mueven, `↑` y `X` rotan, `↓` baja una fila, `Espacio` hace _hard drop_. Se leen con `event.code` y la autorrepetición del sistema se conserva como en el original. Las teclas se escuchan en `window`; se ignoran los eventos de `input`, `textarea` y `select`, y mientras el juego está en pausa o terminado. `preventDefault` de estas teclas solo mientras se juega.
- La puntuación es un entero de 0 a 1.000.000 (`CHECK` de `scores`): el motor envía en el snapshot `Math.min(score, 1_000_000)`.
- El panel del canvas formatea los números con `toLocaleString("es-ES")`, como el resto de la plataforma.
- Los textos nuevos de la interfaz de React están en español; el canvas conserva los del original (`SCORE`, `LINES`, `LEVEL`, `NEXT`, `CONTROLS`, `GAME OVER`).

Composición del lienzo de 800×600 (valores fijos para el motor):

- Tablero de 300×600 en `x = 150`. A su derecha, el panel desde `x = 480`, con SCORE, LINES, LEVEL, NEXT (caja de 120×120 con bloques de 30 px, pieza centrada en una cuadrícula de 4×4) y CONTROLS, en ese orden.
- Todo el lienzo se rellena con el color de fondo del tema; el tablero y la caja NEXT usan el color de tablero y su borde.

---

## Plan de implementación

Antes de escribir código de Next.js, leer en `node_modules/next/dist/docs/01-app/` la guía de Client Components (`"use client"`) y, para los rankings, las de Cache Components y Server Actions, según `AGENTS.md`. Para la portada y el botón TEMA se usa `/frontend-design`, respetando la estética arcade/neón de la plataforma; el contenido del canvas no se rediseña. Cada paso deja el sistema funcional. El alta en la base de datos va antes de la integración en el reproductor para que el guardado funcione en cuanto el juego sea jugable.

1. **Ficha del juego.** Entrada `tetris` al final de `GAMES` y portada `.cover-tetris` (fondo oscuro con una pila de piezas y una T cayendo, en el estilo de `.cover-asteroides`). Verificación: `/biblioteca`, `/salon`, `/juegos/tetris` y `/juegos/tetris/jugar` cargan sin errores (el reproductor sigue siendo la maqueta); `/home` no cambia; `caida` sigue con su ficha y portada.
2. **Alta en la base de datos.** Aplicar con `apply_migration` el `insert` en `games` y añadir `"tetris"` a `JUEGOS_CON_RANKING` en `app/lib/leaderboard/schema.ts` (incluido su comentario). Verificación: `execute_sql` muestra las filas `asteroides` y `tetris` en `games`; `get_advisors` (security) sin incidencias nuevas; `npx tsc --noEmit` y `npm run lint` sin errores.
3. **Piezas y tablero.** Módulos de `app/games/tetris/` con la lógica pura, sin acceder a `document` ni a `window` (nombres propuestos): `pieces.ts` (matrices de las 7 piezas, colores, `rotateCW`) y `board.ts` (crear tablero, `collide`, fijar pieza, limpiar líneas, posición de la pieza fantasma). Reciben el tablero por parámetro en lugar de usar globales. Verificación: `npx tsc --noEmit` y `npm run lint`.
4. **Motor y dibujo.** `app/games/tetris/types.ts`, `app/games/tetris/draw.ts` (paletas de los dos temas, tablero, rejilla, fantasma, panel, NEXT y GAME OVER) y `app/games/tetris/game.ts` con `createTetrisGame`: entrada de teclado, bucle `requestAnimationFrame`, gravedad, puntuación, niveles, fin de partida, `pause`/`resume`/`restart`/`setTheme`/`destroy` y `onChange`. Verificación: `npx tsc --noEmit` y `npm run lint`.
5. **Componente de canvas.** `app/components/tetris-canvas.tsx` con `<canvas width={800} height={600}>`, clase `.tetris-canvas`, `role="img"` y `aria-label`, y las props `onChange`, `paused`, `restartKey` y `theme`. Verificación: montado en una ruta de prueba temporal, el juego se ve y se juega; la ruta se elimina antes del paso siguiente.
6. **Integración en el reproductor.** En `app/components/game-player.tsx`, cuando `gameId === "tetris"`: renderizar `TetrisCanvas`, no arrancar el `setInterval` de puntos falsos, alimentar JUGADOR/PUNTUACIÓN/VIDAS/NIVEL con el snapshot (VIDAS inicial 1), abrir el modal al llegar a `gameover`, usar `guardarPuntuacion` en `guardar` con la misma protección contra doble envío, y añadir el botón TEMA a `hud-actions` con el tema leído de `av-tetris-theme` tras hidratar. El tipo del snapshot pasa a ser la unión de los dos snapshots. En `app/globals.css`: `.tetris-canvas` llena el `.crt-screen` (posición absoluta, `inset: 0`, 100 % de ancho y alto) y los pseudo-elementos de líneas de escaneo y viñeta quedan por encima (`z-index: 1`), igual que con `.asteroids-canvas`. Verificación: partida completa en `/juegos/tetris/jugar` hasta GAME OVER y guardado; Asteroides y los otros 7 juegos se comportan igual que antes.
7. **Rankings.** `/salon` lee `obtenerRanking("tetris", 12)` y se lo pasa a `HallOfFame` (prop nueva junto a la de Asteroides); `hall-of-fame.tsx` usa el ranking real y `obtenerMejorMarca` también en la pestaña TETRIS; `app/juegos/[id]/page.tsx` amplía su condición de `RankingReal` a `tetris`. El `EmptyBoard` del Home sigue invitando a `asteroides`. Las demás pestañas y fichas no cambian. Verificación: con `scores` vacía para `tetris` se ve el estado vacío; tras guardar una puntuación aparece en ficha, Salón y Home sin reiniciar el servidor.
8. **Documentación.** En `CLAUDE.md`: añadir SPEC 08 a la lista de specs, `app/games/tetris/` y `tetris-canvas.tsx` a la estructura de `app/`, y `tetris` a la sección de Supabase (juegos con ranking real). Verificación: `npm run lint` y `npm run build`.

---

## Criterios de aceptación

Verificados con Playwright (Chromium) sobre `npm run dev`, más `npm run lint`, `npx tsc --noEmit`, `npm run build` y consultas SQL con el MCP de Supabase.

**Global**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] No hay errores en la consola del navegador en `/juegos/tetris/jugar` durante una partida completa ni en `/home`, `/biblioteca`, `/salon`, `/acceso`, `/about` y `/juegos/tetris`.
- [ ] La carpeta `references/started-games/03-tetris/` no se modifica (`git status`).

**Ficha y catálogo**

- [ ] `/biblioteca` lista TETRIS con categoría PUZZLE, portada `.cover-tetris` propia y botón magenta, y `caida` sigue existiendo con su texto y portada actuales.
- [ ] `/juegos/tetris` muestra la ficha y su botón JUGAR lleva a `/juegos/tetris/jugar`.
- [ ] `/home` muestra las mismas 6 tarjetas de juegos que antes.
- [ ] Las pestañas de `/salon` incluyen TETRIS y no rompen las demás.

**Jugabilidad**

- [ ] Al cargar `/juegos/tetris/jugar` aparece el canvas (resolución lógica 800×600) llenando todo el recuadro del CRT, sin franjas ni recortes a 1440, 1024 y 390 px de ancho, con el tablero de 10×20 vacío y con rejilla, una pieza en la fila 0, y el panel con `SCORE 0`, `LINES 0`, `LEVEL 1`, la pieza de NEXT y la lista de controles sin la línea de pausa.
- [ ] En nivel 1 la pieza actual baja una fila cada 1000 ms.
- [ ] `←` y `→` mueven la pieza una columna por pulsación y no la sacan del tablero ni la meten en bloques fijados.
- [ ] `↑` y `X` giran la pieza en sentido horario; si no cabe, prueban los desplazamientos 0, −1, +1, −2 y +2 en ese orden y, si ninguno cabe, no giran.
- [ ] `↓` baja la pieza una fila y suma 1 punto; con la pieza apoyada la fija al instante sin sumar.
- [ ] `Espacio` deja caer la pieza hasta la posición de la pieza fantasma, suma 2 puntos por fila recorrida y fija la pieza al instante.
- [ ] La pieza fantasma se dibuja en la posición de aterrizaje con opacidad 0,2.
- [ ] Aparecen los 7 tipos de pieza (I, O, T, S, Z, J y L) y la pieza que aparece es la que mostraba NEXT.
- [ ] Limpiar 1, 2, 3 y 4 líneas a la vez suma 100, 300, 500 y 800 puntos multiplicados por el nivel vigente antes de subir de nivel.
- [ ] El nivel es `floor(LINES / 10) + 1`: sube a 2 al llegar a 10 líneas y el intervalo de caída pasa a 910 ms; desde el nivel 11 es de 100 ms.
- [ ] Cuando una pieza nueva colisiona al aparecer, el canvas deja de avanzar y dibuja «GAME OVER» y «Puntuación: N» con la puntuación final.
- [ ] La tecla `P` no hace nada.
- [ ] Las flechas y `Espacio` no desplazan la página mientras se juega.

**Tema claro/oscuro**

- [ ] La barra del reproductor muestra un botón TEMA solo en `/juegos/tetris/jugar`; no aparece en `/juegos/asteroides/jugar` ni en `/juegos/caida/jugar`.
- [ ] Al pulsar TEMA, el fondo, el tablero, la rejilla y los textos del canvas pasan a la paleta clara (fondo `#f0f0f8`) y, al pulsar de nuevo, vuelven a la oscura (fondo `#0f0f17`); los colores de las piezas no cambian.
- [ ] Al cambiar de tema no se alteran el marco CRT (bisel, líneas de escaneo, viñeta y barra inferior), la barra del reproductor ni ninguna otra parte de la plataforma.
- [ ] Cambiar de tema con el juego en pausa redibuja el canvas de inmediato.
- [ ] Tras elegir el tema claro y recargar la página, el juego arranca en claro; `localStorage["av-tetris-theme"]` vale `"light"`.
- [ ] Con `localStorage` bloqueado o con un valor distinto de `"light"` y `"dark"`, el juego arranca en oscuro y no hay errores en consola.

**Integración con React**

- [ ] La barra del reproductor muestra PUNTUACIÓN y NIVEL iguales a los del panel del canvas en todo momento, y VIDAS muestra `♥` mientras se juega y `—` en cuanto la partida termina.
- [ ] PAUSA congela la caída y las teclas, muestra «EN PAUSA» y cambia el botón a REANUDAR; REANUDAR continúa sin que la pieza salte de posición.
- [ ] Con el foco en el botón PAUSA o en TEMA, pulsar `Espacio` hace _hard drop_ y no activa el botón.
- [ ] Al llegar a GAME OVER el modal «FIN DEL JUEGO» se abre solo con la puntuación real; FIN también lo abre pausando el juego.
- [ ] Con el modal abierto, escribir espacios y flechas en el campo de iniciales no mueve ni deja caer la pieza.
- [ ] JUGAR DE NUEVO cierra el modal y reinicia con 0 puntos, 0 líneas, nivel 1 y VIDAS `♥`, conservando el tema elegido.
- [ ] SALIR y VOLVER AL VAULT detienen el bucle: tras navegar no quedan escuchas de teclado ni `requestAnimationFrame` activos (las flechas vuelven a desplazar la página).
- [ ] A 390 px de ancho el canvas se ve completo y escalado dentro del CRT, mantiene la proporción 4:3 y la página no genera desborde horizontal.
- [ ] `/juegos/asteroides/jugar` conserva su jugabilidad y sus 3 vidas, y `/juegos/bloque-buster/jugar` (y los otros juegos) conservan la maqueta con la puntuación al azar y sus 3 vidas.

**Base de datos y ranking**

- [ ] `games` contiene la fila `tetris` / `TETRIS` / `PUZZLE` y la fila `asteroides` sigue intacta.
- [ ] FIN o GAME OVER → GUARDAR PUNTUACIÓN crea una fila en `scores` con `game_id = 'tetris'`, el nombre en mayúsculas, la puntuación del canvas y `user_id` nulo; el modal muestra «PUNTUACIÓN GUARDADA».
- [ ] Con la petición bloqueada o fallando, el modal muestra `[ERR]`, conserva el nombre escrito y no muestra «PUNTUACIÓN GUARDADA»; el botón no permite doble envío.
- [ ] En `/juegos/bloque-buster/jugar` GUARDAR sigue usando `localStorage` y no crea filas en `scores`.
- [ ] Con `scores` vacía para `tetris`, `/salon` (pestaña TETRIS) y `/juegos/tetris` muestran el estado vacío «SIN PUNTUACIONES — SÉ EL PRIMERO» con enlace a `/juegos/tetris/jugar`.
- [ ] Tras guardar, la puntuación aparece en la ficha y en el Salón sin reiniciar el servidor, y en las dos tarjetas de actividad del Home con el título TETRIS y el color magenta.
- [ ] Un mismo nombre con dos puntuaciones de Tetris aparece una sola vez en su ranking, con la mayor, y no se mezcla con el ranking de Asteroides.
- [ ] «TU MEJOR MARCA» de la pestaña TETRIS muestra la mejor marca del nombre en sesión (sin distinguir mayúsculas) y su puesto, y no aparece si no tiene ninguna.
- [ ] Las pestañas de ASTEROIDES y de los otros 7 juegos conservan el comportamiento que tenían.
- [ ] `get_advisors` de seguridad no reporta incidencias nuevas.
- [ ] En `.next/static` no aparece la clave `service_role` ni la contraseña de la base de datos.
- [ ] Las filas de prueba creadas en `scores` durante la verificación se borran al terminar.

---

## Decisiones

- **Sí:** una spec única para motor + reproductor + base de datos + rankings, porque la infraestructura de SPEC 07 ya existe. **No:** dividir en dos specs.
- **Sí:** entrada nueva `tetris` y dejar `caida` intacta. Decisión del usuario: `caida` es una maqueta ficticia distinta, como `rocas` frente a `asteroides`. Color magenta, el mismo de `caida`.
- **Sí:** rama `gameId === "tetris"` en `GamePlayer` junto a la de Asteroides. **No:** refactorizar hacia un registro de juegos; decisión cerrada, se hará en otro spec cuando pese.
- **Sí:** entrada al final de `GAMES` para no cambiar las 6 tarjetas del Home ni la pestaña inicial del Salón.
- **Sí:** `best: 0` y `plays: "0"`. **No:** inventar cifras.
- **Sí:** motor TypeScript en `app/games/tetris/` con callback a React. **No:** `<iframe>` ni `<script>` del original.
- **Sí:** `onChange` solo cuando cambian los valores. **No:** estado de React por fotograma.
- **Sí:** aspecto idéntico al original, con sus dos temas. Decisión del usuario. Los efectos del marco CRT no cuentan como cambio del juego.
- **Sí:** lienzo lógico de 800×600 con el panel (marcadores, NEXT y controles) dibujado en el canvas. Decisión del usuario. Mantiene un único canvas, llena el CRT sin franjas y evita añadir un panel de DOM al reproductor. **No:** letterbox del tablero 300×600 (franjas laterales) ni lienzo con solo tablero y NEXT (perdía LINES).
- **Sí:** 1 vida: `lives: 1` en juego y `lives: 0` en `gameover`, de modo que la barra muestra `♥` y luego `—` con el código actual de `GamePlayer` (`"♥ ".repeat(lives).trim() || "—"`). Decisión del usuario. **No:** mostrar LÍNEAS en lugar de VIDAS ni cambiar etiquetas del HUD según el juego.
- **Sí:** el modal de fin de juego se abre solo al llegar a `gameover`, como en Asteroides. El GAME OVER del canvas no ofrece reinicio propio porque el modal siempre aparece.
- **Sí:** quitar la tecla `P`; la pausa es solo el botón PAUSA de React. Decisión del usuario. Una sola fuente de verdad y sin estado `paused` en el contrato. **No:** overlay de pausa propio en el canvas.
- **Sí:** 7 piezas estándar. **No:** la tuerca «N» que trae el `game.js` original (el `README.md` ya decía 7). Decisión del usuario, tomada al verificar los criterios; sustituye a la decisión inicial de portar las 8.
- **Sí:** botón de tema claro/oscuro en la barra del reproductor, solo en `tetris`, que llama a `setTheme` del motor. Decisión del usuario. El tema solo cambia la paleta del canvas; el marco CRT y la plataforma siguen oscuros. Es un botón de React y no uno dibujado en el canvas para que sea accesible con teclado y consistente con PAUSA y FIN. **No:** tema claro para la plataforma ni para otros juegos.
- **Sí:** tema persistido en `localStorage` con la clave `av-tetris-theme` (el original usaba `tetris-theme`; se añade el prefijo de la plataforma), leído tras hidratar y con `try/catch`. Decisión del usuario.
- **Sí:** sin sonido ni assets: el original no los tiene, no se crea `public/`.
- **Sí:** comportamiento de teclado idéntico al original, incluida la autorrepetición del sistema en todas las teclas (mantener `Espacio` encadena _hard drops_). **No:** ignorar `event.repeat`; sería un cambio de jugabilidad que no se ha pedido.
- **Sí:** sin tope de `dt`: el original acumula `dropAccum` y lo reinicia a 0 tras cada caída, así que un salto de tiempo provoca como mucho una caída. Al reanudar tras una pausa se reinicia `lastTime`.
- **Sí:** `Math.min(score, 1_000_000)` en el snapshot para respetar el `CHECK` de `scores`. Alcanzar ese valor exigiría miles de líneas; no se justifica una migración. **No:** subir el límite de la base de datos.
- **Sí:** el `EmptyBoard` del Home sigue apuntando a `asteroides`; el Home no depende de qué juego tenga filas.
- **Sí:** `HallOfFame` recibe una prop más para `tetris`, en el mismo estilo que la de Asteroides. **No:** un registro genérico de rankings.

---

## Riesgos

| Riesgo                                                                                                      | Mitigación                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strict Mode monta dos veces el efecto y quedaría un segundo bucle o escuchas duplicadas                     | `destroy()` cancela `requestAnimationFrame` y elimina los `keydown` de `window`; criterio de aceptación de limpieza al salir                                                |
| Tras pulsar PAUSA o TEMA el botón conserva el foco y `Espacio` lo activaría en lugar de dejar caer la pieza | `preventDefault` en `keydown` de `Espacio` y flechas cuando el origen no es un campo editable; hay criterio de aceptación para ambos botones                                |
| El tablero vertical 300×600 en un lienzo 4:3 deja poco aire o un panel apretado                             | Composición fija en el spec (tablero en `x = 150`, panel desde `x = 480`); verificación visual a 1440, 1024 y 390 px, ajustando dentro del lienzo sin cambiar su resolución |
| El tema claro llena todo el `.crt-screen` de blanco y desentona con el marco oscuro                         | Es lo pedido (tema solo dentro del canvas); las capas de líneas de escaneo y viñeta quedan por encima y el criterio de aceptación comprueba que el marco no cambia          |
| Parpadeo del tema: el juego arranca oscuro y pasa a claro tras leer `localStorage`                          | Lectura en un efecto tras hidratar, antes de la primera partida; se acepta un cambio de paleta inmediato al montar. Estado por defecto seguro: oscuro                       |
| `localStorage` bloqueado lanza una excepción                                                                | Lectura y escritura dentro de `try/catch`; el juego funciona en oscuro sin persistir                                                                                        |
| `GamePlayer` ya asume un único snapshot (`SnapshotAsteroides`)                                              | El tipo pasa a la unión de los dos snapshots, que tienen los mismos campos; cambio mínimo sin registro genérico                                                             |
| `Espacio` mantenido encadena _hard drops_ y termina la partida rápido                                       | Es el comportamiento del original y queda registrado en Decisiones; se puede cambiar en un spec posterior                                                                   |
| Con `cacheComponents: true`, leer el ranking de `tetris` sin `<Suspense>` rompe el prerrenderizado          | Se reutiliza el `<Suspense>` de `/salon` y de la ficha; `obtenerRanking` ya es una función `'use cache'` con etiqueta `ranking-tetris`                                      |
| La caché sirve rankings viejos tras guardar                                                                 | `guardarPuntuacion` ya invalida `ranking-<id>`, `actividad-reciente` y `top-del-dia`; criterio de aceptación de actualización sin reiniciar                                 |
| El motor usa `document`/`window` y rompe el prerrenderizado                                                 | Todo el acceso al DOM ocurre dentro de `useEffect`; el componente es `"use client"`                                                                                         |

---

## Qué **no** está en este spec

- Generalizar `GamePlayer` hacia un registro de juegos.
- Tecla `P` de pausa, controles táctiles y sonido.
- Mejoras de jugabilidad (_hold_, bolsa de 7 piezas, SRS, retardo de bloqueo, otros modos) y cambios de aspecto más allá de los dos temas del original.
- Tema claro/oscuro para otros juegos o para la plataforma.
- Autenticación real, anti-trampas, realtime y paginación del ranking.
- Portar otros juegos del catálogo o cambiar `caida` y las demás maquetas.
- Tests automatizados.

Cada uno de ellos, si se aborda, va en su propio spec.
