# SPEC 09 — Juego ARKANOID jugable en la plataforma con ranking real

> **Status:** Implementado
> **Depends on:** SPEC 06 (patrón de motor de canvas y reproductor), SPEC 07 (tablas `games` y `scores`, vista `leaderboard` y rankings reales), SPEC 08 (segundo juego real: snapshot y canvas por `gameId`, prop por juego en `HallOfFame`)
> **Date:** 2026-10-23
> **Objective:** Portar Arkanoid de `references/started-games/04-arkanoid/` a un motor de canvas en TypeScript con sus sprites y sonidos, publicarlo como el juego `arkanoid`, conectarlo al reproductor y guardar y mostrar sus puntuaciones en Supabase.

---

## Por qué existe este spec

Hoy `asteroides` y `tetris` son juegos reales. La carpeta `references/started-games/04-arkanoid/` trae un Arkanoid completo en JavaScript vanilla (`index.html`, `game.js`, `levels.js`, `assets/`): paleta, pelota, 5 niveles de bloques con velocidad creciente, 3 vidas, explosión animada al romper un bloque, efectos de sonido y pantallas de GAME OVER y de victoria. Este spec lo lleva a la plataforma siguiendo el patrón de SPEC 06, 07 y 08: un motor de canvas en TypeScript que avisa a React por callback y un ranking real en Supabase.

Tiene cuatro particularidades frente a Asteroides y Tetris:

- **Lienzo ya 4:3.** El original es un canvas de 800×600, la misma proporción del CRT, así que se porta sin recomponer nada: el HUD ya está dibujado en el canvas y no hay panel en el DOM.
- **Victoria.** El original termina también ganando (limpiar el nivel 5). El snapshot gana un estado `win`, y el modal de fin de juego se abre tanto en `gameover` como en `win`.
- **Primeros assets de la plataforma.** El original usa un spritesheet PNG y dos MP3. Hoy no existe `public/`; este spec lo crea con `public/games/arkanoid/`.
- **Pausa sin atajos del original.** El original pausa con `P` o `Escape` y muestra un selector para saltar de nivel. Aquí la pausa es solo el botón PAUSA de React y el selector se elimina: permitiría puntuar saltando niveles y falsearía el ranking.

El catálogo ya tiene `bloque-buster` («BLOQUE BUSTER», ARCADE, portada `.cover-bricks`), una maqueta ficticia con un concepto parecido. Es una ficha distinta y no se toca: `arkanoid` es una entrada nueva.

---

## Alcance

**In:**

- Entrada nueva `arkanoid` **al final** de `GAMES` en `app/data/games.ts` (así `GAMES.slice(0, 6)` del Home no cambia) y portada CSS nueva `.cover-arkanoid` en `app/globals.css`, diseñada con `/frontend-design`, en estética arcade/neón y distinta de `.cover-bricks`.
- Assets en `public/games/arkanoid/`, copiados sin modificar desde la referencia: `spritesheet-breakout.png`, `ball-bounce.mp3` y `break-sound.mp3`.
- Motor del juego en `app/games/arkanoid/`, portado de `game.js` y `levels.js` sin cambiar la jugabilidad: paleta de 81×14, pelota de 16×16, 5 niveles con sus patrones y multiplicadores de velocidad, 3 vidas, 10 puntos por bloque, explosión de 4 fotogramas, sonidos de rebote y de rotura, GAME OVER y victoria.
- Aspecto idéntico al original: sprites del spritesheet, fondo negro, HUD (`Score`, `Nivel` y bolas de vidas) y overlays de GAME OVER y victoria dibujados en el canvas.
- Control con `←` `→` y con el ratón (movimiento del puntero sobre el canvas, escalado a las coordenadas lógicas).
- Lienzo lógico de 800×600, escalado con CSS para llenar `.crt-screen`.
- Componente cliente `app/components/arkanoid-canvas.tsx`, calcado de `asteroids-canvas.tsx`: monta el canvas de 800×600, crea el motor en `useEffect`, lo destruye al desmontar (seguro con Strict Mode) y lo controla por `paused` y `restartKey`.
- Rama `gameId === "arkanoid"` en `GamePlayer`: canvas en lugar de la arena de CSS, sin el `setInterval` de puntos falsos, barra `player-hud` con valores reales, PAUSA/REANUDAR, FIN, modal automático al llegar a `gameover` o `win`, JUEGO DE NUEVO y SALIR.
- CSS para que el canvas llene `.crt-screen` bajo las capas de líneas de escaneo y viñeta (clase `.arkanoid-canvas`).
- Alta en Supabase: `insert into public.games` con el MCP y el `id` `arkanoid` en `JUEGOS_CON_RANKING` (`app/lib/leaderboard/schema.ts`).
- Guardado: GUARDAR PUNTUACIÓN llama a `guardarPuntuacion({ game: "arkanoid", name, score })` con aviso `[ERR]` si falla.
- Rankings reales de `arkanoid` en `/salon` (pestaña ARKANOID y «TU MEJOR MARCA»), `/juegos/arkanoid` y las tarjetas de actividad del Home, con estado vacío `EmptyBoard`.
- Documentar la spec y los archivos nuevos en `CLAUDE.md`.

**Out of scope (para futuros specs):**

- Generalizar `GamePlayer` hacia un registro de juegos (cada juego añade su rama, como Asteroides y Tetris).
- Teclas `P` y `Escape` de pausa y el selector de nivel del overlay de pausa: la pausa es solo el botón PAUSA de React.
- Controles táctiles.
- Silenciar o regular el volumen de los sonidos.
- Mejoras de jugabilidad respecto a `game.js`: ángulo de rebote según el punto de la paleta, bloques de varios golpes, power-ups, saque manual de la pelota, más niveles o modos.
- Cambios de aspecto (colores neón, fuente pixel dentro del canvas).
- Autenticación real (`user_id` queda en `NULL`), anti-trampas, realtime y paginación.
- Portar otros juegos o tocar las maquetas, `bloque-buster` y el ranking falso del resto.
- Tests automatizados.

---

## Modelo de datos

Ficha del catálogo (mismo tipo `Juego` de SPEC 01):

```ts
{
  id: "arkanoid",
  title: "ARKANOID",
  short: "Rompe los 5 muros sin que caiga la pelota.",
  long: "Mueve la paleta con el ratón o las flechas y rebota la pelota para destruir muros de bloques de colores. Cada nivel cambia el patrón y acelera la pelota. Tienes 3 vidas: si la pelota cae por debajo de la paleta, pierdes una. Limpia los 5 niveles para ganar.",
  cat: "ARCADE",
  cover: "cover-arkanoid",
  color: "yellow",
  best: 0,
  plays: "0",
}
```

Contrato entre el motor y React (`app/games/arkanoid/types.ts`), el mismo patrón que Asteroides y Tetris con un estado más:

```ts
export type EstadoArkanoid = "playing" | "gameover" | "win";

export interface SnapshotArkanoid {
  score: number; // entero 0..2080
  lives: number; // 3, 2, 1; 0 en gameover; se conservan al ganar
  level: number; // 1..5
  status: EstadoArkanoid;
}

export interface JuegoArkanoid {
  pause(): void;
  resume(): void;
  restart(): void;
  destroy(): void;
}

export function createArkanoidGame(
  canvas: HTMLCanvasElement,
  onChange: (snapshot: SnapshotArkanoid) => void,
): JuegoArkanoid;
```

Módulos de `app/games/arkanoid/` (nombres propuestos, con lógica pura y sin acceder a `document` ni a `window` al importarse):

- `levels.ts`: `LEVELS`, array de 5 niveles `{ speed: number; blocks: { col; row; color }[] }` generado con las mismas reglas que `levels.js`.
- `sprites.ts`: `SPRITES`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION` y las funciones de dibujo `drawSprite` y `drawFrame`, que reciben la imagen por parámetro. La carga de la imagen (`new Image()`) ocurre dentro de `createArkanoidGame`.
- `game.ts`: `createArkanoidGame`.

Estado interno del motor (no se expone; mismos nombres que `game.js`):

```ts
// paddle: { x, y: 560, w: 81, h: 14 }; ball: { x, y, w: 16, h: 16, vx, vy }
// blocks: { x, y, w: 64, h: 24, color, alive }[]; explosions: { x, y, w, h, color, elapsed }[]
// lives, score, currentLevel (1..5), gameState: 'playing' | 'gameover' | 'win', paused
```

Base de datos (migración que describe la spec y aplicará `/spec-impl` con `apply_migration`; no cambia el esquema, solo añade una fila):

```sql
insert into public.games (id, title, category)
values ('arkanoid', 'ARKANOID', 'ARCADE');
```

Convenciones:

- `onChange` se llama al arrancar (cuando el spritesheet ya está cargado) y solo cuando cambia algún valor del snapshot, nunca por fotograma. Romper un bloque, perder una vida, subir de nivel, ganar y perder la última vida sí lo disparan.
- Constantes del original sin modificar: `PADDLE_SPEED = 400` px/s; bloques de 64×24 en cuadrícula de 10 columnas con origen `(80, 80)`; `BASE_BALL_VX = 200` y `BASE_BALL_VY = -300`, multiplicados por la `speed` del nivel; paleta en `y = 560` y centrada al empezar (`x = 359,5`); `EXPLOSION_DURATION = 150` ms con 4 fotogramas; 3 vidas; 10 puntos por bloque.
- Niveles (`speed`; bloques): 1 (×1,00; parrilla 10×6, 60), 2 (×1,10; pirámide, 40), 3 (×1,21; tablero de ajedrez, 30), 4 (×1,33; filas con huecos, 39), 5 (×1,46; marco con cruz central, 39). El total es de 208 bloques, es decir, 2.080 puntos como máximo.
- Reglas de movimiento: la pelota rebota en las paredes izquierda, derecha y superior; rebota en la paleta solo si baja (`vy > 0`) y su base está entre `paddle.y` y `paddle.y + paddle.h + 8`, siempre hacia arriba y sin cambiar el ángulo; al chocar con un bloque (AABB) lo destruye, invierte `vy`, suma 10 y solo se procesa un bloque por fotograma.
- Al limpiar un nivel se carga el siguiente (la paleta conserva su posición; la pelota se coloca sobre ella y sale al instante, sin saque manual); al limpiar el 5 el estado pasa a `win`. Al caer la pelota por debajo de `y = 600` se pierde una vida y la pelota vuelve a la paleta con la velocidad del nivel actual; con 0 vidas el estado pasa a `gameover`.
- Sonidos: `ball-bounce.mp3` al rebotar en pared o paleta y `break-sound.mp3` al romper un bloque, reproducidos con un clon del elemento para permitir solapes. Nada suena en pausa, `gameover` ni `win`. Si el navegador rechaza la reproducción, el error se ignora.
- Controles: `←` `→` mueven la paleta; el movimiento del ratón sobre el canvas centra la paleta bajo el puntero, limitada a los bordes. Las teclas se escuchan en `window`; se ignoran los eventos de `input`, `textarea` y `select`, y mientras el juego está en pausa o terminado. `preventDefault` de las flechas solo mientras se juega. `P`, `Escape` y los clics sobre el canvas no hacen nada.
- Pausa: al reanudar se reinicia `lastTime`; `dt` tiene tope de 50 ms (el original no lo tiene) para que un salto de tiempo no atraviese bloques ni la paleta.
- La puntuación es un entero de 0 a 2.080, dentro del `CHECK` de `scores` (0 a 1.000.000); no hace falta ningún tope.
- Textos del canvas (`Score: N`, `Nivel: N`, `GAME OVER`, `¡Completaste el juego!`) sin cambios. El texto de victoria se dibuja con `maxWidth` de 760 px porque en monospace negrita de 64 px (22 caracteres) mide unos 845 px y el original lo recorta; es el único retoque visual.
- Los textos nuevos de la interfaz de React están en español.
- Los assets se sirven desde `/games/arkanoid/…` y las imágenes se dibujan directamente desde un `HTMLImageElement`, sin la copia a un canvas auxiliar del original; el resultado en pantalla es el mismo.

---

## Plan de implementación

Antes de escribir código de Next.js, leer en `node_modules/next/dist/docs/01-app/` la guía de Client Components (`"use client"`) y, para los rankings, las de Cache Components y Server Actions, según `AGENTS.md`. Para la portada se usa `/frontend-design`, respetando la estética arcade/neón de la plataforma; el contenido del canvas no se rediseña. Cada paso deja el sistema funcional. El alta en la base de datos va antes de la integración en el reproductor para que el guardado funcione en cuanto el juego sea jugable.

1. **Ficha del juego.** Entrada `arkanoid` al final de `GAMES` y portada `.cover-arkanoid` (fondo oscuro con filas de bloques de colores, una paleta y una pelota, en el estilo de `.cover-asteroides`). Verificación: `/biblioteca`, `/salon`, `/juegos/arkanoid` y `/juegos/arkanoid/jugar` cargan sin errores (el reproductor sigue siendo la maqueta); `/home` no cambia; `bloque-buster` sigue con su ficha y su portada `.cover-bricks`.
2. **Alta en la base de datos.** Aplicar con `apply_migration` el `insert` en `games` y añadir `"arkanoid"` a `JUEGOS_CON_RANKING` en `app/lib/leaderboard/schema.ts` (incluido su comentario). Verificación: `execute_sql` muestra las filas `asteroides`, `tetris` y `arkanoid` en `games`; `get_advisors` (security) sin incidencias nuevas; `npx tsc --noEmit` y `npm run lint` sin errores.
3. **Assets y datos puros.** Copiar los tres archivos a `public/games/arkanoid/` y crear `app/games/arkanoid/levels.ts` y `sprites.ts`. Verificación: `/games/arkanoid/spritesheet-breakout.png`, `ball-bounce.mp3` y `break-sound.mp3` responden 200 en `npm run dev`; `npx tsc --noEmit` y `npm run lint`; los 5 niveles suman 60, 40, 30, 39 y 39 bloques.
4. **Motor.** `app/games/arkanoid/types.ts` y `game.ts` con `createArkanoidGame`: carga del spritesheet y de los sonidos, entrada de teclado y ratón, bucle `requestAnimationFrame`, colisiones, niveles, vidas, explosiones, HUD, overlays de GAME OVER y victoria en canvas, `pause`/`resume`/`restart`/`destroy` y `onChange`. Si `destroy()` llega antes de que termine la carga del spritesheet, el bucle no arranca. Verificación: `npx tsc --noEmit` y `npm run lint`.
5. **Componente de canvas.** `app/components/arkanoid-canvas.tsx` con `<canvas width={800} height={600}>`, clase `.arkanoid-canvas`, `role="img"` y `aria-label`, y las props `onChange`, `paused` y `restartKey`. Verificación: montado en una ruta de prueba temporal, el juego se ve y se juega; la ruta se elimina antes del paso siguiente.
6. **Integración en el reproductor.** En `app/components/game-player.tsx`, cuando `gameId === "arkanoid"`: renderizar `ArkanoidCanvas`, no arrancar el `setInterval` de puntos falsos, alimentar JUGADOR/PUNTUACIÓN/VIDAS/NIVEL con el snapshot (VIDAS inicial 3), abrir el modal al llegar a `gameover` o `win`, y usar `guardarPuntuacion` en `guardar` con la misma protección contra doble envío. El tipo del snapshot pasa a ser la unión de los tres snapshots. En `app/globals.css`: `.arkanoid-canvas` llena el `.crt-screen` (posición absoluta, `inset: 0`, 100 % de ancho y alto) y los pseudo-elementos de líneas de escaneo y viñeta quedan por encima (`z-index: 1`), igual que con `.asteroids-canvas`. Verificación: partida completa en `/juegos/arkanoid/jugar` hasta GAME OVER y hasta victoria, y guardado; Asteroides, Tetris y los otros 7 juegos se comportan igual que antes.
7. **Rankings.** `/salon` lee `obtenerRanking("arkanoid", 12)` y se lo pasa a `HallOfFame` (prop nueva junto a las de Asteroides y Tetris); `hall-of-fame.tsx` usa el ranking real y `obtenerMejorMarca` también en la pestaña ARKANOID; `app/juegos/[id]/page.tsx` amplía su condición de `RankingReal` a `arkanoid`. El `EmptyBoard` del Home sigue invitando a `asteroides`. Las demás pestañas y fichas no cambian. Verificación: con `scores` vacía para `arkanoid` se ve el estado vacío; tras guardar una puntuación aparece en ficha, Salón y Home sin reiniciar el servidor.
8. **Documentación.** En `CLAUDE.md`: añadir SPEC 09 a la lista de specs, `app/games/arkanoid/`, `arkanoid-canvas.tsx` y `public/games/arkanoid/` a la estructura, y `arkanoid` a la sección de Supabase (juegos con ranking real). Verificación: `npm run lint` y `npm run build`.

---

## Criterios de aceptación

Verificados con Playwright (Chromium) sobre `npm run dev`, más `npm run lint`, `npx tsc --noEmit`, `npm run build` y consultas SQL con el MCP de Supabase.

**Global**

- [x] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [x] No hay errores en la consola del navegador en `/juegos/arkanoid/jugar` durante una partida completa ni en `/home`, `/biblioteca`, `/salon`, `/acceso`, `/about` y `/juegos/arkanoid`.
- [x] La carpeta `references/started-games/04-arkanoid/` no se modifica (`git status`).

**Ficha y catálogo**

- [x] `/biblioteca` lista ARKANOID con categoría ARCADE, portada `.cover-arkanoid` propia y botón amarillo, y `bloque-buster` sigue existiendo con su texto y portada actuales.
- [x] `/juegos/arkanoid` muestra la ficha y su botón JUGAR lleva a `/juegos/arkanoid/jugar`.
- [x] `/home` muestra las mismas 6 tarjetas de juegos que antes.
- [x] Las pestañas de `/salon` incluyen ARKANOID y no rompen las demás.

**Jugabilidad**

- [x] Al cargar `/juegos/arkanoid/jugar` aparece el canvas (resolución lógica 800×600) llenando todo el recuadro del CRT, sin franjas ni recortes a 1440, 1024 y 390 px de ancho, con 60 bloques en 6 filas de 10 (con origen en `x = 80`, `y = 80`), la paleta centrada en `y = 560`, la pelota sobre ella y el HUD con `Score: 0`, `Nivel: 1` y 3 bolas.
- [x] Los sprites y la animación de explosión se ven con el aspecto del original (sin imagen rota ni rectángulos vacíos).
- [x] La pelota sale sola al empezar con velocidad `(200, −300)` px/s en el nivel 1.
- [x] Mantener `←` o `→` mueve la paleta a 400 px/s sin salirse de los bordes del lienzo.
- [x] Mover el ratón sobre el canvas centra la paleta bajo el puntero, a cualquier tamaño de pantalla, y no la saca de los bordes.
- [x] La pelota rebota en las paredes izquierda, derecha y superior; en la paleta solo si baja, siempre hacia arriba y sin cambiar su ángulo horizontal.
- [x] Romper un bloque suma exactamente 10 puntos, invierte la velocidad vertical, lo hace desaparecer y muestra su explosión de 4 fotogramas durante 150 ms.
- [x] Al limpiar el nivel 1 (60 bloques) aparece el nivel 2 (pirámide de 40 bloques), con la velocidad de la pelota ×1,10 (`(220, −330)`), el HUD muestra `Nivel: 2` y la puntuación se conserva; los niveles 3, 4 y 5 tienen 30, 39 y 39 bloques y velocidades ×1,21, ×1,33 y ×1,46.
- [x] Si la pelota cae por debajo del lienzo, se pierde una vida (el HUD pasa de 3 a 2 bolas), la pelota vuelve a la paleta con la velocidad del nivel actual y los bloques rotos siguen rotos.
- [x] Al perder la tercera vida, el canvas deja de avanzar y dibuja «GAME OVER» sobre un velo negro semitransparente, con la puntuación final conservada.
- [x] Al limpiar los 208 bloques de los 5 niveles sin perder ninguna pelota, la puntuación es exactamente 2.080 y el canvas dibuja «¡Completaste el juego!» completo, sin recortar por los lados.
- [x] Al rebotar en pared o paleta suena `ball-bounce.mp3`, y al romper un bloque suena `break-sound.mp3`; en pausa no suena nada.
- [x] `P`, `Escape` y los clics sobre el canvas no hacen nada.
- [x] Las flechas no desplazan la página mientras se juega.

**Integración con React**

- [x] La barra del reproductor muestra PUNTUACIÓN, VIDAS y NIVEL iguales a los del HUD del canvas en todo momento; VIDAS muestra `♥ ♥ ♥`, luego `♥ ♥`, `♥` y `—` al perder la última.
- [x] PAUSA congela la pelota, la paleta y las explosiones, muestra «EN PAUSA» y cambia el botón a REANUDAR; REANUDAR continúa sin que la pelota salte de posición. El canvas no dibuja overlay de pausa ni selector de nivel.
- [x] Con el foco en el botón PAUSA, `←` y `→` mueven la paleta y no activan ningún botón.
- [x] Al llegar a GAME OVER o a la victoria el modal «FIN DEL JUEGO» se abre solo con la puntuación real; FIN también lo abre pausando el juego.
- [x] Con el modal abierto, escribir en el campo de iniciales (incluidas las flechas) no mueve la paleta.
- [x] JUGAR DE NUEVO cierra el modal y reinicia con 0 puntos, nivel 1, 3 vidas y los 60 bloques del nivel 1.
- [x] SALIR y VOLVER AL VAULT detienen el bucle: tras navegar no quedan escuchas de teclado ni de ratón, ni `requestAnimationFrame` activos, y no suena nada (las flechas vuelven a desplazar la página).
- [x] A 390 px de ancho el canvas se ve completo y escalado dentro del CRT, mantiene la proporción 4:3 y la página no genera desborde horizontal.
- [x] `/juegos/asteroides/jugar` y `/juegos/tetris/jugar` conservan su jugabilidad, y `/juegos/bloque-buster/jugar` (y los otros juegos) conservan la maqueta con la puntuación al azar y sus 3 vidas.

**Base de datos y ranking**

- [x] `games` contiene la fila `arkanoid` / `ARKANOID` / `ARCADE` y las filas `asteroides` y `tetris` siguen intactas.
- [x] FIN, GAME OVER o victoria → GUARDAR PUNTUACIÓN crea una fila en `scores` con `game_id = 'arkanoid'`, el nombre en mayúsculas, la puntuación del canvas y `user_id` nulo; el modal muestra «PUNTUACIÓN GUARDADA».
- [x] Con la petición bloqueada o fallando, el modal muestra `[ERR]`, conserva el nombre escrito y no muestra «PUNTUACIÓN GUARDADA»; el botón no permite doble envío.
- [x] En `/juegos/bloque-buster/jugar` GUARDAR sigue usando `localStorage` y no crea filas en `scores`.
- [x] Con `scores` vacía para `arkanoid`, `/salon` (pestaña ARKANOID) y `/juegos/arkanoid` muestran el estado vacío «SIN PUNTUACIONES — SÉ EL PRIMERO» con enlace a `/juegos/arkanoid/jugar`.
- [x] Tras guardar, la puntuación aparece en la ficha y en el Salón sin reiniciar el servidor, y en las dos tarjetas de actividad del Home con el título ARKANOID y el color amarillo.
- [x] Un mismo nombre con dos puntuaciones de Arkanoid aparece una sola vez en su ranking, con la mayor, y no se mezcla con los rankings de Asteroides ni de Tetris.
- [x] «TU MEJOR MARCA» de la pestaña ARKANOID muestra la mejor marca del nombre en sesión (sin distinguir mayúsculas) y su puesto, y no aparece si no tiene ninguna.
- [x] Las pestañas de ASTEROIDES, TETRIS y de los otros 7 juegos conservan el comportamiento que tenían.
- [x] `get_advisors` de seguridad no reporta incidencias nuevas.
- [x] En `.next/static` no aparece la clave `service_role` ni la contraseña de la base de datos.
- [x] Las filas de prueba creadas en `scores` durante la verificación se borran al terminar.

---

## Decisiones

- **Sí:** una spec única para motor + reproductor + base de datos + rankings, porque la infraestructura de SPEC 07 ya existe. **No:** dividir en dos specs.
- **Sí:** entrada nueva `arkanoid` y dejar `bloque-buster` intacta. Es una maqueta ficticia distinta, como `rocas` frente a `asteroides` y `caida` frente a `tetris`. Color amarillo, para no repetir el cian de `bloque-buster`. Decisión del usuario.
- **Sí:** rama `gameId === "arkanoid"` en `GamePlayer` junto a las de Asteroides y Tetris. **No:** refactorizar hacia un registro de juegos; decisión cerrada, se hará en otro spec cuando pese.
- **Sí:** entrada al final de `GAMES` para no cambiar las 6 tarjetas del Home ni la pestaña inicial del Salón.
- **Sí:** `best: 0` y `plays: "0"`. **No:** inventar cifras.
- **Sí:** motor TypeScript en `app/games/arkanoid/` con callback a React. **No:** `<iframe>` ni `<script>` del original.
- **Sí:** `onChange` solo cuando cambian los valores. **No:** estado de React por fotograma.
- **Sí:** aspecto idéntico al original, con sus sprites. Los efectos del marco CRT no cuentan como cambio del juego. El HUD, GAME OVER y la victoria siguen dibujados en el canvas.
- **Sí:** copiar el spritesheet y los dos MP3 a `public/games/arkanoid/`, con sonido dentro del alcance. Decisión del usuario. **No:** dibujar los bloques con rectángulos (cambiaría el aspecto) ni dejar el juego mudo.
- **Sí:** estado `win` en el snapshot que abre el modal igual que `gameover`, conservando las vidas. Decisión del usuario. Permite guardar la puntuación de quien termina los 5 niveles. **No:** reutilizar `gameover` (perdería el matiz) ni reiniciar en bucle tras el nivel 5 (cambia la jugabilidad).
- **Sí:** quitar `P`, `Escape` y el selector de nivel; la pausa es solo el botón PAUSA de React. Decisión del usuario. Una sola fuente de verdad y un ranking que no se puede falsear saltando niveles. **No:** conservar el overlay de pausa del canvas.
- **Sí:** HUD de React con los valores reales: VIDAS 3 → 0 y NIVEL 1 a 5. Arkanoid ya tiene vidas y niveles, así que no hace falta adaptar la barra como en Tetris.
- **Sí:** ratón y flechas como en el original; el ratón se escucha en el canvas y se escala con `getBoundingClientRect`, porque el canvas se muestra con tamaño CSS distinto del lógico. **No:** controles táctiles.
- **Sí:** tope de `dt` de 50 ms y reinicio de `lastTime` al reanudar, como pide el patrón de SPEC 06. Es el único cambio de física respecto al original, que no limita `dt`; sin él, volver a la pestaña tras un rato podría atravesar bloques. No altera la jugabilidad normal.
- **Sí:** texto de victoria con `maxWidth` de 760 px, porque el original lo recorta. Único retoque visual.
- **Sí:** sin tope de puntuación en el snapshot: el máximo es 2.080 y el `CHECK` admite hasta 1.000.000.
- **Sí:** el `EmptyBoard` del Home sigue apuntando a `asteroides`; el Home no depende de qué juego tenga filas.
- **Sí:** `HallOfFame` recibe una prop más para `arkanoid`, en el mismo estilo que las de Asteroides y Tetris. **No:** un registro genérico de rankings.

---

## Riesgos

| Riesgo                                                                                                  | Mitigación                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strict Mode monta dos veces el efecto y quedaría un segundo bucle o escuchas duplicadas                 | `destroy()` cancela `requestAnimationFrame` y elimina los `keydown`/`keyup` de `window` y el `mousemove` del canvas; criterio de aceptación de limpieza al salir             |
| `destroy()` llega antes de que el spritesheet termine de cargar y el callback arranca un bucle huérfano | El callback de carga comprueba un indicador `destroyed` antes de iniciar el bucle; el motor no llama a `onChange` tras `destroy()`                                           |
| El spritesheet o un MP3 no cargan (ruta incorrecta, `public/` sin desplegar)                            | Verificación de las URLs `/games/arkanoid/…` en el paso 3; si el PNG falla, el motor registra un único `console.error` y no arranca el bucle; los fallos de audio se ignoran |
| El navegador bloquea la reproducción de audio sin gesto previo del usuario                              | `play()` se llama sobre una promesa con `catch` vacío; en la práctica el clic en JUGAR ya cuenta como interacción; el criterio de sonido se verifica tras interactuar        |
| Los sonidos se solapan y saturan al romper muchos bloques seguidos                                      | Un clon del elemento por reproducción, como el original; los clones se liberan al terminar. No se añade límite (cambiaría el sonido)                                         |
| Tras pulsar PAUSA el botón conserva el foco y las flechas no deberían activar nada                      | `preventDefault` en `keydown` y `keyup` de las flechas cuando el origen no es un campo editable; hay criterio de aceptación                                                  |
| El ratón desfasa la paleta porque el canvas se escala por CSS                                           | Conversión con `getBoundingClientRect` y la razón lógico/CSS en cada `mousemove`; criterio de aceptación a distintos anchos                                                  |
| El `dt` salta al reanudar tras una pausa o al volver a la pestaña                                       | Reiniciar `lastTime` al reanudar y limitar `dt` a 50 ms                                                                                                                      |
| `GamePlayer` asume que `gameover` es el único fin de partida                                            | La condición del modal pasa a `gameover` o `win`; cambio mínimo y localizado, sin registro genérico                                                                          |
| `GamePlayer` ya usa la unión de dos snapshots                                                           | El tipo pasa a la unión de los tres; los campos comunes son los mismos                                                                                                       |
| Con `cacheComponents: true`, leer el ranking de `arkanoid` sin `<Suspense>` rompe el prerrenderizado    | Se reutiliza el `<Suspense>` de `/salon` y de la ficha; `obtenerRanking` ya es una función `'use cache'` con etiqueta `ranking-arkanoid`                                     |
| La caché sirve rankings viejos tras guardar                                                             | `guardarPuntuacion` ya invalida `ranking-<id>`, `actividad-reciente` y `top-del-dia`; criterio de aceptación de actualización sin reiniciar                                  |
| El motor usa `document`/`window`/`Audio`/`Image` y rompe el prerrenderizado                             | Todo el acceso al DOM y a la API de audio ocurre dentro de `createArkanoidGame`, llamado desde `useEffect`; el componente es `"use client"`                                  |

---

## Qué **no** está en este spec

- Generalizar `GamePlayer` hacia un registro de juegos.
- Teclas `P` y `Escape` de pausa, selector de nivel, controles táctiles y control de volumen.
- Mejoras de jugabilidad (ángulo de rebote según la paleta, power-ups, bloques resistentes, saque manual, más niveles o modos) y cambios de aspecto.
- Autenticación real, anti-trampas, realtime y paginación del ranking.
- Portar otros juegos del catálogo o cambiar `bloque-buster` y las demás maquetas.
- Tests automatizados.

Cada uno de ellos, si se aborda, va en su propio spec.
