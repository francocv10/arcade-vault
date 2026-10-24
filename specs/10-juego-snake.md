# SPEC 10 — Juego SNAKE jugable en la plataforma con ranking real

> **Status:** Implementado
> **Depends on:** SPEC 06 (patrón de motor de canvas y reproductor), SPEC 07 (tablas `games` y `scores`, vista `leaderboard` y rankings reales), SPEC 08 (snapshot y canvas por `gameId`, prop por juego en `HallOfFame`, `lives: 1 → 0`), SPEC 09 (tercer juego real y primeros assets en `public/`)
> **Date:** 2026-10-23
> **Objective:** Diseñar un Snake clásico en un motor de canvas en TypeScript con las frutas de `references/source-assets/snake-assets/`, publicarlo como el juego `snake`, conectarlo al reproductor y guardar y mostrar sus puntuaciones en Supabase.

---

## Por qué existe este spec

Hoy `asteroides`, `tetris` y `arkanoid` son juegos reales. Para Snake no hay un juego de partida en `references/started-games/`: solo existe `references/source-assets/snake-assets/`, con `fruits.png` (una hoja de 3790×442 px con tres filas de frutas, fondo transparente, obtenida de Spriters Resource) y `sprites.js` (un atlas `window.SPRITE_ATLAS` con las coordenadas `{ x, y, w, h }` de las 22 frutas de la fila mediana, `y = 136` y `h = 160`). Por eso el juego se diseña desde cero: mecánicas, puntos, niveles y aspecto salen de las decisiones de la fase de preguntas, y los assets solo aportan la comida.

Sigue el patrón de SPEC 06 a 09: un motor de canvas en TypeScript que avisa a React por callback y un ranking real en Supabase.

Particularidades frente a los juegos anteriores:

- **Sin juego de referencia.** Las reglas, las constantes y el aspecto se fijan en este spec. Se inspiran en el Snake de Google (tablero de casillas alternas verde claro y oscuro, serpiente azul con ojos, fruta sobre una casilla), pero la serpiente y el tablero se dibujan con formas en canvas porque no hay sprites de ellos.
- **Lienzo ya 4:3.** El tablero es una cuadrícula de 20×15 casillas de 40 px, es decir 800×600, así que llena el CRT sin recomponer nada y sin panel lateral. La puntuación y el nivel viven en la barra de React; el canvas no dibuja HUD.
- **Una sola vida.** Como en Tetris: `lives: 1` durante la partida y `lives: 0` al terminar. La barra muestra `♥` y luego `—`.
- **Las frutas de la hoja son pixel-art.** La fila mediana de `fruits.png` (la que recoge el atlas) es la versión pixelada de las frutas; las otras dos filas (planas y realistas) quedan sin usar. Las imágenes se escalan con `imageSmoothingEnabled = false` para conservar los píxeles.
- **Segundo juego con assets.** `public/games/snake/` se crea junto a `public/games/arkanoid/`.

El catálogo ya tiene `serpentina` («SERPENTINA», ARCADE, portada `.cover-snake`), una maqueta ficticia con el mismo concepto. Es una ficha distinta y no se toca: `snake` es una entrada nueva con su propia portada `.cover-snake-real`.

---

## Alcance

**In:**

- Entrada nueva `snake` **al final** de `GAMES` en `app/data/games.ts` (así `GAMES.slice(0, 6)` del Home no cambia) y portada CSS nueva `.cover-snake-real` en `app/globals.css`, diseñada con `/frontend-design`, en estética arcade/neón y distinta de `.cover-snake`.
- Assets en `public/games/snake/`: `fruits.png`, copiado sin modificar desde `references/source-assets/snake-assets/`.
- Motor del juego en `app/games/snake/`: tablero de 20×15 casillas de 40 px, serpiente de 3 segmentos que avanza por casillas, una fruta aleatoria a la vez de las 22 del atlas, crecimiento de un segmento por fruta, 10 puntos por fruta, niveles por frutas comidas, velocidad creciente con tope y fin de partida al chocar con una pared o con el propio cuerpo.
- Aspecto estilo Google Snake dibujado en canvas: casillas alternas verde claro y oscuro, serpiente azul con cabeza redondeada y ojos, frutas del spritesheet.
- Pantalla de GAME OVER dibujada en el canvas («GAME OVER» y «Puntuación: N») sobre un velo semitransparente, sin botón propio: el modal de React se abre solo y ofrece JUGAR DE NUEVO. Sin HUD de puntos en el canvas.
- Control con `←` `↑` `→` `↓` y con `W` `A` `S` `D`.
- Lienzo lógico de 800×600, escalado con CSS para llenar `.crt-screen`.
- Componente cliente `app/components/snake-canvas.tsx`, calcado de `arkanoid-canvas.tsx`: monta el canvas de 800×600, crea el motor en `useEffect`, lo destruye al desmontar (seguro con Strict Mode) y lo controla por `paused` y `restartKey`.
- Rama `gameId === "snake"` en `GamePlayer`: canvas en lugar de la arena de CSS, sin el `setInterval` de puntos falsos, barra `player-hud` con valores reales (VIDAS `♥`/`—`), PAUSA/REANUDAR, FIN, modal automático al llegar a `gameover`, JUGAR DE NUEVO y SALIR.
- CSS para que el canvas llene `.crt-screen` bajo las capas de líneas de escaneo y viñeta (clase `.snake-canvas`).
- Alta en Supabase: `insert into public.games` con el MCP y el `id` `snake` en `JUEGOS_CON_RANKING` (`app/lib/leaderboard/schema.ts`).
- Guardado: GUARDAR PUNTUACIÓN llama a `guardarPuntuacion({ game: "snake", name, score })` con aviso `[ERR]` si falla.
- Rankings reales de `snake` en `/salon` (pestaña SNAKE y «TU MEJOR MARCA»), `/juegos/snake` y las tarjetas de actividad del Home, con estado vacío `EmptyBoard`.
- Documentar la spec y los archivos nuevos en `CLAUDE.md`.

**Out of scope (para futuros specs):**

- Generalizar `GamePlayer` hacia un registro de juegos (cada juego añade su rama, como los anteriores).
- Sonido y música (los assets no traen audio).
- Controles táctiles y gestos de deslizamiento.
- Frutas con valores distintos, power-ups, obstáculos, paredes que atraviesan (_wrap_), varias vidas, modo de dos jugadores, selector de dificultad o de tamaño de tablero.
- Pausa con teclado (`P`, `Escape`, `Espacio`): la pausa es solo el botón PAUSA de React.
- Las otras dos filas de `fruits.png` y cualquier sprite de serpiente.
- Autenticación real (`user_id` queda en `NULL`), anti-trampas, realtime y paginación.
- Portar otros juegos o tocar las maquetas, `serpentina` y el ranking falso del resto.
- Tests automatizados.

---

## Modelo de datos

Ficha del catálogo (mismo tipo `Juego` de SPEC 01):

```ts
{
  id: "snake",
  title: "SNAKE",
  short: "Come frutas, crece y no te muerdas la cola.",
  long: "Guía a la serpiente por el tablero con las flechas o WASD y come las frutas que aparecen. Cada fruta suma 10 puntos y alarga a la serpiente; cada 5 frutas subes de nivel y ella se acelera. Un choque con la pared o con tu propio cuerpo termina la partida.",
  cat: "ARCADE",
  cover: "cover-snake-real",
  color: "cyan",
  best: 0,
  plays: "0",
}
```

Contrato entre el motor y React (`app/games/snake/types.ts`), el mismo patrón que Tetris con dos estados:

```ts
export type EstadoSnake = "playing" | "gameover";

export interface SnapshotSnake {
  score: number; // entero 0..2970
  lives: number; // 1 jugando, 0 en gameover
  level: number; // 1..60
  status: EstadoSnake;
}

export interface JuegoSnake {
  pause(): void;
  resume(): void;
  restart(): void;
  destroy(): void;
}

export function createSnakeGame(
  canvas: HTMLCanvasElement,
  onChange: (snapshot: SnapshotSnake) => void,
): JuegoSnake;
```

Módulos de `app/games/snake/` (nombres propuestos, con lógica pura y sin acceder a `document` ni a `window` al importarse):

- `sprites.ts`: `FRUITS`, el atlas de `sprites.js` convertido a un módulo tipado (`Record<string, { x: number; y: number; w: number; h: number }>` con las 22 frutas y sus coordenadas exactas), y `drawFruit`, que recibe la imagen por parámetro. La carga de la imagen (`new Image()`) ocurre dentro de `createSnakeGame`.
- `board.ts`: lógica pura que recibe el estado por parámetro: `COLS`, `ROWS`, `CELL`, `nextHead`, `chocaConPared`, `chocaConCuerpo`, `celdaLibre` (elige una casilla no ocupada por la serpiente) y `nivelPorFrutas`.
- `game.ts`: `createSnakeGame`.

Estado interno del motor (no se expone):

```ts
// snake: { x, y }[]  (índice 0 = cabeza; coordenadas de casilla, origen arriba a la izquierda)
// dir: { x, y }; dirQueue: { x, y }[] (máx. 2 giros pendientes)
// fruit: { x, y, kind: keyof typeof FRUITS }
// eaten (frutas comidas), score, level, status: 'playing' | 'gameover', started, paused
```

Base de datos (migración que describe la spec y aplicará `/spec-impl` con `apply_migration`; no cambia el esquema, solo añade una fila):

```sql
insert into public.games (id, title, category)
values ('snake', 'SNAKE', 'ARCADE');
```

Convenciones:

- `onChange` se llama al arrancar (cuando `fruits.png` ya está cargado) y solo cuando cambia algún valor del snapshot, nunca por fotograma. Comer una fruta, subir de nivel y morir sí lo disparan.
- Tablero: `COLS = 20`, `ROWS = 15`, `CELL = 40`; 300 casillas. Lienzo lógico de 800×600 sin márgenes.
- Estado inicial: serpiente de 3 segmentos horizontal, cabeza en la casilla `(6, 7)` y cola en `(4, 7)`, dirección derecha. La serpiente **no se mueve** hasta que el jugador pulsa una tecla de dirección válida (derecha, arriba o abajo; izquierda se ignora porque es la reversa). Mientras espera, el canvas dibuja la leyenda «PULSA UNA FLECHA PARA EMPEZAR» sobre el tablero. El estado sigue siendo `playing`.
- Fruta inicial: una casilla libre al azar, con una fruta al azar de las 22 del atlas. Al comerla se coloca otra en una casilla libre al azar (no ocupada por la serpiente) con otra fruta al azar (puede repetirse).
- Movimiento: paso discreto por casillas con acumulador de tiempo. Velocidad inicial de 8 pasos por segundo; sube 0,5 pasos por segundo por nivel y tiene tope de 16 pasos por segundo (se alcanza en el nivel 17). `dt` tiene tope de 50 ms y se reinicia `lastTime` al reanudar.
- Niveles: `level = 1 + floor(frutas comidas / 5)`, de 1 a 60.
- Puntuación: 10 puntos por fruta, sin bonificaciones. El máximo es 297 frutas (300 casillas menos las 3 iniciales), es decir 2.970 puntos, dentro del `CHECK` de `scores` (0 a 1.000.000); no hace falta ningún tope.
- Crecimiento: al comer, la serpiente conserva la cola ese paso y crece un segmento.
- Fin de partida: al entrar la cabeza en una casilla fuera del tablero o en una casilla del cuerpo, el estado pasa a `gameover` (`lives: 0`). La cola que se desplaza en ese mismo paso **no** cuenta como choque (la cabeza puede entrar en la casilla que la cola libera). Si tras comer no queda ninguna casilla libre (tablero lleno), el estado pasa también a `gameover`.
- Controles: `←` `↑` `→` `↓` y `A` `W` `D` `S` (mayúsculas y minúsculas). Los giros se encolan (máximo 2 pendientes) y cada paso consume uno; se ignoran un giro igual a la dirección actual o inverso a ella, calculados contra el último giro encolado. Las teclas se escuchan en `window`; se ignoran los eventos de `input`, `textarea` y `select` y mientras el juego está en pausa o terminado. `preventDefault` de las flechas solo mientras se juega; el motor cancela también el `keyup` de las teclas que consumió para que no activen el botón enfocado.
- Dibujo: casillas alternas `#aad751` y `#a2d149` (patrón de tablero de ajedrez); cuerpo de la serpiente en `#4e7cf6` con segmentos redondeados y unidos; cabeza con dos ojos blancos con pupila negra orientados según la dirección. La fruta se dibuja centrada en su casilla, escalada para caber en 36×36 px conservando la proporción del recorte, con `imageSmoothingEnabled = false`. No hay borde propio del canvas.
- Los textos nuevos de la interfaz de React están en español; el canvas usa los de esta spec («PULSA UNA FLECHA PARA EMPEZAR», «GAME OVER», «Puntuación: N»).
- Los assets se sirven desde `/games/snake/…`.

---

## Plan de implementación

Antes de escribir código de Next.js, leer en `node_modules/next/dist/docs/01-app/` la guía de Client Components (`"use client"`) y, para los rankings, las de Cache Components y Server Actions, según `AGENTS.md`. Para la portada se usa `/frontend-design`, respetando la estética arcade/neón de la plataforma; el contenido del canvas no se rediseña. Cada paso deja el sistema funcional. El alta en la base de datos va antes de la integración en el reproductor para que el guardado funcione en cuanto el juego sea jugable.

1. **Ficha del juego.** Entrada `snake` al final de `GAMES` y portada `.cover-snake-real` (fondo oscuro, serpiente azul y una fruta, en el estilo de `.cover-asteroides`). Verificación: `/biblioteca`, `/salon`, `/juegos/snake` y `/juegos/snake/jugar` cargan sin errores (el reproductor sigue siendo la maqueta); `/home` no cambia; `serpentina` sigue con su ficha y su portada `.cover-snake`.
2. **Alta en la base de datos.** Aplicar con `apply_migration` el `insert` en `games` y añadir `"snake"` a `JUEGOS_CON_RANKING` en `app/lib/leaderboard/schema.ts` (incluido su comentario). Verificación: `execute_sql` muestra las filas `asteroides`, `tetris`, `arkanoid` y `snake` en `games`; `get_advisors` (security) sin incidencias nuevas; `npx tsc --noEmit` y `npm run lint` sin errores.
3. **Assets y datos puros.** Copiar `fruits.png` a `public/games/snake/` y crear `app/games/snake/sprites.ts` (atlas tipado de las 22 frutas) y `board.ts`. Verificación: `/games/snake/fruits.png` responde 200 en `npm run dev`; `npx tsc --noEmit` y `npm run lint`; el atlas tiene 22 entradas y cada recorte cae dentro de 3790×442.
4. **Motor.** `app/games/snake/types.ts` y `game.ts` con `createSnakeGame`: carga de `fruits.png`, entrada de teclado, bucle `requestAnimationFrame` con acumulador de pasos, cola de giros, crecimiento, niveles, colisiones, dibujo del tablero, la serpiente y las frutas, leyenda de inicio y GAME OVER en canvas, `pause`/`resume`/`restart`/`destroy` y `onChange`. Si `destroy()` llega antes de que termine la carga de la imagen, el bucle no arranca. Verificación: `npx tsc --noEmit` y `npm run lint`.
5. **Componente de canvas.** `app/components/snake-canvas.tsx` con `<canvas width={800} height={600}>`, clase `.snake-canvas`, `role="img"` y `aria-label`, y las props `onChange`, `paused` y `restartKey`. Verificación: montado en una ruta de prueba temporal, el juego se ve y se juega; la ruta se elimina antes del paso siguiente.
6. **Integración en el reproductor.** En `app/components/game-player.tsx`, cuando `gameId === "snake"`: renderizar `SnakeCanvas`, no arrancar el `setInterval` de puntos falsos, alimentar JUGADOR/PUNTUACIÓN/VIDAS/NIVEL con el snapshot (VIDAS inicial 1), abrir el modal al llegar a `gameover` y usar `guardarPuntuacion` en `guardar` con la misma protección contra doble envío. El tipo del snapshot pasa a ser la unión de los cuatro snapshots. En `app/globals.css`: `.snake-canvas` llena el `.crt-screen` (posición absoluta, `inset: 0`, 100 % de ancho y alto) y los pseudo-elementos de líneas de escaneo y viñeta quedan por encima (`z-index: 1`), igual que con `.arkanoid-canvas`. Verificación: partida completa en `/juegos/snake/jugar` hasta GAME OVER y guardado; Asteroides, Tetris, Arkanoid y los otros 7 juegos se comportan igual que antes.
7. **Rankings.** `/salon` lee `obtenerRanking("snake", 12)` y se lo pasa a `HallOfFame` (prop nueva junto a las de Asteroides, Tetris y Arkanoid); `hall-of-fame.tsx` usa el ranking real y `obtenerMejorMarca` también en la pestaña SNAKE; `app/juegos/[id]/page.tsx` amplía su condición de `RankingReal` a `snake`. El `EmptyBoard` del Home sigue invitando a `asteroides`. Las demás pestañas y fichas no cambian. Verificación: con `scores` vacía para `snake` se ve el estado vacío; tras guardar una puntuación aparece en ficha, Salón y Home sin reiniciar el servidor.
8. **Documentación.** En `CLAUDE.md`: añadir SPEC 10 a la lista de specs, `app/games/snake/`, `snake-canvas.tsx` y `public/games/snake/` a la estructura, y `snake` a la sección de Supabase (juegos con ranking real; los juegos maqueta pasan de 8 a 7). Verificación: `npm run lint` y `npm run build`.

---

## Criterios de aceptación

Verificados con Playwright (Chromium) sobre `npm run dev`, más `npm run lint`, `npx tsc --noEmit`, `npm run build` y consultas SQL con el MCP de Supabase.

**Global**

- [x] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [x] No hay errores en la consola del navegador en `/juegos/snake/jugar` durante una partida completa ni en `/home`, `/biblioteca`, `/salon`, `/acceso`, `/about` y `/juegos/snake`.
- [x] La carpeta `references/source-assets/snake-assets/` no se modifica (`git diff` sin cambios en ella).

**Ficha y catálogo**

- [x] `/biblioteca` lista SNAKE con categoría ARCADE, portada `.cover-snake-real` propia y botón cian, y `serpentina` sigue existiendo con su texto y portada actuales.
- [x] `/juegos/snake` muestra la ficha y su botón JUGAR lleva a `/juegos/snake/jugar`.
- [x] `/home` muestra las mismas 6 tarjetas de juegos que antes.
- [x] Las pestañas de `/salon` incluyen SNAKE y no rompen las demás.

**Jugabilidad**

- [x] Al cargar `/juegos/snake/jugar` aparece el canvas (resolución lógica 800×600) llenando todo el recuadro del CRT, sin franjas ni recortes a 1440, 1024 y 390 px de ancho, con el tablero de 20×15 casillas de 40 px alternando `#aad751` y `#a2d149`, la serpiente azul de 3 segmentos con la cabeza en `(6, 7)`, una fruta en una casilla libre y la leyenda «PULSA UNA FLECHA PARA EMPEZAR».
- [x] Las frutas se ven con su sprite pixel-art del atlas, sin imagen rota, recortes cortados ni suavizado borroso, y cada una cabe en su casilla.
- [x] La serpiente no se mueve hasta pulsar `→`, `↑`, `↓`, `D`, `W` o `S`; pulsar `←` o `A` antes de empezar no hace nada.
- [x] Con la serpiente en marcha, un giro de 180° (p. ej. `←` yendo a la derecha) se ignora y pulsar la misma dirección no cambia nada.
- [x] Pulsar dos giros dentro de un mismo paso (p. ej. `↑` y `←`) los aplica en pasos consecutivos y no mata a la serpiente por una reversa instantánea.
- [x] Al nivel 1 la serpiente avanza 8 casillas por segundo (125 ms por paso, ±1 fotograma); al nivel 2, 8,5; y la velocidad no pasa de 16 casillas por segundo.
- [x] Comer una fruta suma exactamente 10 puntos, alarga la serpiente un segmento y coloca otra fruta en una casilla libre (nunca sobre la serpiente).
- [x] Al comer la quinta fruta el nivel pasa de 1 a 2 y la barra muestra `NIVEL 2`; a las 10 frutas, nivel 3.
- [x] Salirse por cualquiera de los cuatro bordes termina la partida: el canvas deja de avanzar y dibuja «GAME OVER» y «Puntuación: N» sobre un velo semitransparente, con la puntuación final conservada.
- [x] Chocar con el propio cuerpo termina la partida; entrar en la casilla que la cola acaba de liberar en ese mismo paso no la termina.
- [x] Las flechas y `Espacio` no desplazan la página mientras se juega.

**Integración con React**

- [x] La barra del reproductor muestra PUNTUACIÓN y NIVEL iguales a los de la partida en todo momento; VIDAS muestra `♥` mientras se juega y `—` al terminar.
- [x] PAUSA congela la serpiente, muestra «EN PAUSA» y cambia el botón a REANUDAR; REANUDAR continúa sin que la serpiente salte de casilla. El canvas no dibuja overlay de pausa.
- [x] Con el foco en el botón PAUSA, las flechas y `WASD` actúan sobre el juego y no activan ningún botón.
- [x] Al llegar a GAME OVER el modal «FIN DEL JUEGO» se abre solo con la puntuación real; FIN también lo abre pausando el juego.
- [x] Con el modal abierto, escribir en el campo de iniciales (incluidas las flechas y las letras `W`, `A`, `S` y `D`) no mueve la serpiente.
- [x] JUGAR DE NUEVO cierra el modal y reinicia con 0 puntos, nivel 1, 1 vida, serpiente de 3 segmentos en `(6, 7)` y la leyenda de inicio.
- [x] SALIR y VOLVER AL VAULT detienen el bucle: tras navegar no quedan escuchas de teclado ni `requestAnimationFrame` activos (las flechas vuelven a desplazar la página).
- [x] A 390 px de ancho el canvas se ve completo y escalado dentro del CRT, mantiene la proporción 4:3 y la página no genera desborde horizontal.
- [x] `/juegos/asteroides/jugar`, `/juegos/tetris/jugar` y `/juegos/arkanoid/jugar` conservan su jugabilidad, y `/juegos/serpentina/jugar` (y los otros juegos) conservan la maqueta con la puntuación al azar y sus 3 vidas.

**Base de datos y ranking**

- [x] `games` contiene la fila `snake` / `SNAKE` / `ARCADE` y las filas `asteroides`, `tetris` y `arkanoid` siguen intactas.
- [x] FIN o GAME OVER → GUARDAR PUNTUACIÓN crea una fila en `scores` con `game_id = 'snake'`, el nombre en mayúsculas, la puntuación del canvas y `user_id` nulo; el modal muestra «PUNTUACIÓN GUARDADA».
- [x] Con la petición bloqueada o fallando, el modal muestra `[ERR]`, conserva el nombre escrito y no muestra «PUNTUACIÓN GUARDADA»; el botón no permite doble envío.
- [x] En `/juegos/serpentina/jugar` GUARDAR sigue usando `localStorage` y no crea filas en `scores`.
- [x] Con `scores` vacía para `snake`, `/salon` (pestaña SNAKE) y `/juegos/snake` muestran el estado vacío «SIN PUNTUACIONES — SÉ EL PRIMERO» con enlace a `/juegos/snake/jugar`.
- [x] Tras guardar, la puntuación aparece en la ficha y en el Salón sin reiniciar el servidor, y en las dos tarjetas de actividad del Home con el título SNAKE y el color cian.
- [x] Un mismo nombre con dos puntuaciones de Snake aparece una sola vez en su ranking, con la mayor, y no se mezcla con los rankings de los otros juegos.
- [x] «TU MEJOR MARCA» de la pestaña SNAKE muestra la mejor marca del nombre en sesión (sin distinguir mayúsculas) y su puesto, y no aparece si no tiene ninguna.
- [x] Las pestañas de ASTEROIDES, TETRIS, ARKANOID y de los otros 7 juegos conservan el comportamiento que tenían.
- [x] `get_advisors` de seguridad no reporta incidencias nuevas.
- [x] En `.next/static` no aparece la clave `service_role` ni la contraseña de la base de datos.
- [x] Las filas de prueba creadas en `scores` durante la verificación se borran al terminar.

---

## Decisiones

- **Sí:** una spec única para motor + reproductor + base de datos + rankings, porque la infraestructura de SPEC 07 ya existe. **No:** dividir en dos specs.
- **Sí:** diseñar el juego desde cero a partir de los assets, porque no hay juego de referencia. **No:** inventar un original: se toma como modelo el Snake de Google, que es de lo que provienen los sprites.
- **Sí:** entrada nueva `snake` y dejar `serpentina` intacta. Es una maqueta ficticia distinta, como `rocas` frente a `asteroides`, `caida` frente a `tetris` y `bloque-buster` frente a `arkanoid`. Portada propia `.cover-snake-real`, porque `.cover-snake` ya existe.
- **Sí:** color cian para la ficha: `serpentina` ya usa el verde y la serpiente del juego es azul. Elegido por defecto; no se discutió en la fase de preguntas.
- **Sí:** rama `gameId === "snake"` en `GamePlayer` junto a las de los otros tres. **No:** refactorizar hacia un registro de juegos; decisión cerrada, se hará en otro spec cuando pese.
- **Sí:** entrada al final de `GAMES` para no cambiar las 6 tarjetas del Home ni la pestaña inicial del Salón.
- **Sí:** `best: 0` y `plays: "0"`. **No:** inventar cifras.
- **Sí:** motor TypeScript en `app/games/snake/` con callback a React. **No:** `<iframe>` ni `<script>`; `sprites.js` no se copia, su atlas se convierte en `sprites.ts` tipado porque depende de `window.SPRITE_ATLAS`.
- **Sí:** `onChange` solo cuando cambian los valores. **No:** estado de React por fotograma.
- **Sí:** aspecto estilo Google Snake (tablero verde de dos tonos, serpiente azul dibujada en canvas). Decisión del usuario. **No:** neón arcade dentro del canvas; los efectos del marco CRT no cuentan como cambio del juego.
- **Sí:** una fruta aleatoria a la vez entre las 22 del atlas, todas con el mismo valor. Decisión del usuario. **No:** una fruta fija ni frutas con distinto valor (añade reglas nuevas).
- **Sí:** tablero de 20×15 casillas de 40 px, lo que da 800×600 exacto y llena el CRT sin franjas ni letterbox. Decisión del usuario. **No:** 32×24 de 25 px.
- **Sí:** velocidad inicial de 8 pasos por segundo, +0,5 por nivel y tope de 16. Valores propuestos por el spec y aceptados con la opción recomendada. **No:** velocidad fija, que quita progresión.
- **Sí:** 1 vida, con `lives: 1 → 0` en el snapshot, igual que Tetris. Decisión del usuario. **No:** 3 vidas ni paredes que atraviesan.
- **Sí:** 10 puntos por fruta y nivel = 1 + frutas / 5, sin victoria. Decisión del usuario. El tablero lleno se trata como `gameover` porque el contrato no tiene `win`; llegar ahí exige 297 frutas y no se espera en la práctica.
- **Sí:** la serpiente espera la primera tecla antes de moverse y muestra una leyenda en el canvas. Decisión del spec, como en el Snake de Google; evita morir antes de reaccionar al pulsar JUGAR. **No:** arrancar sola.
- **Sí:** cola de hasta 2 giros y sin reversas. Evita que dos pulsaciones rápidas dentro de un mismo paso provoquen una muerte injusta, que es el defecto típico de un Snake sin cola.
- **Sí:** flechas y `WASD` como controles; la pausa es solo el botón PAUSA de React, sin `P`, `Escape` ni `Espacio`. Una sola fuente de verdad, como en Tetris y Arkanoid. **No:** controles táctiles.
- **Sí:** sin sonido. Los assets no traen audio. **No:** generar bips con WebAudio (amplía el alcance).
- **Sí:** tope de `dt` de 50 ms y reinicio de `lastTime` al reanudar, como pide el patrón de SPEC 06; con el acumulador, un salto de tiempo no hace avanzar varios pasos de golpe.
- **Sí:** sin HUD dibujado en el canvas: PUNTUACIÓN y NIVEL ya están en la barra de React y el tablero llena los 800×600. **No:** panel lateral dibujado, que obligaría a recortar el tablero.
- **Sí:** sin tope de puntuación en el snapshot: el máximo es 2.970 y el `CHECK` admite hasta 1.000.000.
- **Sí:** el `EmptyBoard` del Home sigue apuntando a `asteroides`; el Home no depende de qué juego tenga filas.
- **Sí:** `HallOfFame` recibe una prop más para `snake`, en el mismo estilo que las de los otros tres. **No:** un registro genérico de rankings.

---

## Riesgos

| Riesgo                                                                                                    | Mitigación                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Strict Mode monta dos veces el efecto y quedaría un segundo bucle o escuchas duplicadas                   | `destroy()` cancela `requestAnimationFrame` y elimina los `keydown`/`keyup` de `window`; criterio de aceptación de limpieza al salir                                     |
| `destroy()` llega antes de que `fruits.png` termine de cargar y el callback arranca un bucle huérfano     | El callback de carga comprueba un indicador `destroyed` antes de iniciar el bucle; el motor no llama a `onChange` tras `destroy()`                                       |
| `fruits.png` no carga (ruta incorrecta, `public/` sin desplegar)                                          | Verificación de la URL `/games/snake/fruits.png` en el paso 3; si falla, el motor registra un único `console.error` y no arranca el bucle                                |
| Las coordenadas del atlas recortan mal alguna fruta (se cortan bordes o se cuela otra fruta)              | Verificación visual de las 22 frutas en el paso 3 y 4 y criterio de aceptación de recortes; si alguna falla, se corrige su entrada en `sprites.ts` y se anota en la spec |
| Frutas de anchos distintos (110 a 170 px) se deforman al meterlas en una casilla de 40 px                 | Escalado proporcional para caber en 36×36 px, sin estirar; criterio de aceptación de que cada fruta cabe en su casilla                                                   |
| Dos giros muy rápidos dentro de un paso producen una reversa instantánea y una muerte injusta             | Cola de giros de máximo 2 y comparación contra el último giro encolado                                                                                                   |
| Tras pulsar PAUSA el botón conserva el foco y las flechas o `Espacio` podrían activarlo                   | `preventDefault` en `keydown` y `keyup` de las teclas de juego cuando el origen no es un campo editable; hay criterio de aceptación                                      |
| Las letras `W`, `A`, `S` y `D` mueven la serpiente mientras se escribe en el campo de iniciales del modal | El motor ignora eventos de `input`, `textarea` y `select`; el modal pausa el motor; hay criterio de aceptación                                                           |
| El `dt` salta al reanudar tras una pausa o al volver a la pestaña                                         | Reiniciar `lastTime` al reanudar y limitar `dt` a 50 ms                                                                                                                  |
| `GamePlayer` ya usa la unión de tres snapshots y el tipo crece                                            | El tipo pasa a la unión de los cuatro; los campos comunes son los mismos                                                                                                 |
| Con `cacheComponents: true`, leer el ranking de `snake` sin `<Suspense>` rompe el prerrenderizado         | Se reutiliza el `<Suspense>` de `/salon` y de la ficha; `obtenerRanking` ya es una función `'use cache'` con etiqueta `ranking-snake`                                    |
| La caché sirve rankings viejos tras guardar                                                               | `guardarPuntuacion` ya invalida `ranking-<id>`, `actividad-reciente` y `top-del-dia`; criterio de aceptación de actualización sin reiniciar                              |
| El motor usa `document`/`window`/`Image` y rompe el prerrenderizado                                       | Todo el acceso al DOM ocurre dentro de `createSnakeGame`, llamado desde `useEffect`; el componente es `"use client"`                                                     |

---

## Qué **no** está en este spec

- Generalizar `GamePlayer` hacia un registro de juegos.
- Sonido, música, controles táctiles y pausa con teclado.
- Frutas con valores distintos, power-ups, obstáculos, paredes que atraviesan, varias vidas, dos jugadores o dificultades.
- Las otras filas de `fruits.png` y cualquier otro estilo visual del tablero.
- Autenticación real, anti-trampas, realtime y paginación del ranking.
- Portar otros juegos del catálogo o cambiar `serpentina` y las demás maquetas.
- Tests automatizados.

Cada uno de ellos, si se aborda, va en su propio spec.
