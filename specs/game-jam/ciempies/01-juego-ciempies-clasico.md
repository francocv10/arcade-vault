# GJ ciempies 01 — Juego CIEMPIÉS clásico jugable en la plataforma con ranking real

> **Status:** Borrador
> **Depends on:** SPEC 06 (patrón de motor de canvas y reproductor), SPEC 07 (tablas `games` y `scores`, vista `leaderboard` y rankings reales), SPEC 08, SPEC 09 y SPEC 10 (snapshot y canvas por `gameId`, prop por juego en `HallOfFame`), SPEC 14 (tabla `CONTROLES_TACTILES`)
> **Date:** 2026-11-03
> **Objective:** Diseñar desde cero un Centipede clásico de canvas en TypeScript, publicarlo como el juego `ciempies` (3 vidas, setas, araña y pulga), conectarlo al reproductor y guardar y mostrar sus puntuaciones en Supabase.

---

## Por qué existe este spec

Este spec sale del game jam de `references/game-suggestions-todo.md`: **CIEMPIÉS** (`ciempies`, SHOOTER, green, M) estaba en la lista de pendientes como «recomendado de la categoría». Encaja con la plataforma por tres motivos:

- **Hueco en el catálogo real.** El único SHOOTER real es `asteroides` (cian). Ciempiés es otro SHOOTER, verde, con una mecánica distinta: disparo vertical de precisión contra un enemigo que se fragmenta, en lugar de rotación e inercia.
- **Sin assets.** Todo se dibuja con primitivas de canvas, como Frogger. No hace falta `public/games/ciempies/`.
- **Cabe en el contrato del reproductor.** Tiene vidas (3), oleadas (`level`) y una puntuación «mayor es mejor» sin tope natural, que se limita a 1.000.000.

En `specs/game-jam/ciempies/` hay **dos specs alternativas** para el mismo `id`: esta (modo clásico) y `02-juego-ciempies-cosecha.md` (munición limitada y racha). Solo se implementa una. Si el usuario quiere las dos, la segunda cambia de `id` antes de implementarse.

No hay juego de partida en `references/started-games/` ni assets en `references/source-assets/`: el juego se diseña desde cero, como Snake y Frogger. No existe ninguna maqueta `ciempies` en `GAMES`.

La ejecución del jam fue desatendida (tarea programada), así que no hubo fase de preguntas. Las decisiones de la sección Decisiones son recomendaciones por defecto pendientes de que el usuario las revise.

---

## Alcance

**In:**

- Entrada nueva `ciempies` **al final** de `GAMES` en `app/data/games.ts` (así `GAMES.slice(0, 6)` del Home no cambia) y portada CSS nueva `.cover-ciempies` en `app/globals.css`, diseñada con `/frontend-design` en estética arcade/neón.
- Motor del juego en `app/games/ciempies/`, diseñado desde cero: campo de setas, ciempiés que baja zigzagueando y se parte al recibir disparos, cabezas sueltas en la zona del jugador, araña, pulga, 3 vidas, vida extra cada 12.000 puntos, oleadas que aceleran y GAME OVER.
- Todo dibujado con primitivas de canvas, con los colores en una sola constante `COLORES` de `draw.ts` (sin literales sueltos) para que la futura spec de skins solo tenga que sustituirla.
- HUD dibujado en el canvas (franja superior de 40 px: puntuación, oleada y vidas) y overlays de «OLEADA NN» y GAME OVER.
- Control con `←` `→` `↑` `↓` o `WASD` para moverse y `Espacio` para disparar (mantener = disparo automático).
- Lienzo lógico de 800×600, escalado con CSS para llenar `.crt-screen`.
- Componente cliente `app/components/ciempies-canvas.tsx`, calcado de `frogger-canvas.tsx` sin la prop `skin`: monta el canvas, crea el motor en `useEffect`, lo destruye al desmontar (seguro con Strict Mode) y lo controla por `paused` y `restartKey`.
- Rama `gameId === "ciempies"` en `GamePlayer`: canvas en lugar de la arena de CSS, sin el `setInterval` de puntos falsos, barra `player-hud` con valores reales, PAUSA/REANUDAR, FIN, modal automático al llegar a `gameover`, JUGAR DE NUEVO y SALIR.
- CSS para que el canvas llene `.crt-screen` bajo las capas de líneas de escaneo y viñeta (clase `.ciempies-canvas`).
- Entrada `ciempies` en `CONTROLES_TACTILES` (`app/games/controles-tactiles.ts`): cruceta de 4 direcciones y botón A = DISPARO (`Espacio`).
- Alta en Supabase: `insert into public.games` con el MCP y el `id` `ciempies` en `JUEGOS_CON_RANKING` (`app/lib/leaderboard/schema.ts`).
- Guardado: GUARDAR PUNTUACIÓN llama a `guardarPuntuacion({ game: "ciempies", name, score })` con aviso `[ERR]` si falla.
- Rankings reales de `ciempies` en `/salon` (pestaña CIEMPIÉS y «TU MEJOR MARCA»), `/juegos/ciempies` y las tarjetas de actividad del Home, con estado vacío `EmptyBoard`.
- Documentar la spec y los archivos nuevos en `CLAUDE.md`.

**Out of scope (para futuros specs):**

- Skins `clasico`/`neon`/`retro` y el botón SKIN (las escribe `skin-designer` en su propia spec tras implementar esta).
- Sonido.
- El escorpión del original y sus setas envenenadas.
- Cambio de colores por oleada.
- La variante de munición limitada y racha (`02-juego-ciempies-cosecha.md`).
- Generalizar `GamePlayer` hacia un registro de juegos.
- Teclas `P` y `Escape` de pausa: la pausa es solo el botón PAUSA de React.
- Autenticación real (`user_id` queda en `NULL`), anti-trampas, realtime y paginación.
- Tests automatizados.

---

## Modelo de datos

Ficha del catálogo (mismo tipo `Juego` de SPEC 01):

```ts
{
  id: "ciempies",
  title: "CIEMPIÉS",
  short: "Parte al ciempiés antes de que llegue abajo.",
  long: "Un ciempiés baja zigzagueando entre setas hacia tu zona. Dispárale: cada segmento que aciertas se convierte en seta y parte al bicho en dos. Esquiva la araña y la pulga, limpia cada oleada y aguanta con tus 3 vidas todo lo que puedas.",
  cat: "SHOOTER",
  cover: "cover-ciempies",
  color: "green",
  best: 0,
  plays: "0",
}
```

Contrato entre el motor y React (`app/games/ciempies/types.ts`), el mismo patrón que Frogger:

```ts
export type EstadoCiempies = "playing" | "gameover";

export interface SnapshotCiempies {
  score: number; // entero 0..1_000_000
  lives: number; // 3 al empezar, hasta 6 con vidas extra; 0 en gameover
  level: number; // oleada, >= 1
  status: EstadoCiempies;
}

export interface JuegoCiempies {
  pause(): void;
  resume(): void;
  restart(): void;
  destroy(): void;
}

export function createCiempiesGame(
  canvas: HTMLCanvasElement,
  onChange: (snapshot: SnapshotCiempies) => void,
): JuegoCiempies;
```

Módulos de `app/games/ciempies/` (lógica pura, sin acceder a `document` ni a `window` al importarse; el azar llega como parámetro `rng: () => number`):

- `board.ts`: constantes de la rejilla y de las zonas, tipos `Celda`, `Seta`, `Cadena`, `Arana`, `Pulga` y `Rect`, y utilidades `rectDeCelda(celda)` y `solapan(a, b)`.
- `setas.ts`: `generarCampo(rng, cantidad)`, `golpearSeta(setas, celda)` y `setasEnZonaJugador(setas)`.
- `cadenas.ts`: `crearOleada(level)`, `pasoCadena(cadena, setas)`, `partirCadena(cadena, indice)` y `pasosPorSegundo(level)`.
- `enemigos.ts`: `actualizarArana(arana, dt, setas, rng)`, `actualizarPulga(pulga, dt, setas, rng)` y `puntosArana(arana, jugador)`.
- `draw.ts`: `COLORES` y `dibujar(ctx, vista)`, que pinta fondo, setas, cadenas interpoladas, jugador, disparo, araña, pulga, HUD y overlays.
- `game.ts`: `createCiempiesGame`.

Estado interno del motor (no se expone):

```ts
// setas: Map<string, Seta>            // clave "col,row"; Seta = { col, row, hp: 1..4 }
// cadenas: Cadena[]                   // Cadena = { segs: Celda[]; prev: Celda[]; dir: 1 | -1; vdir: 1 | -1 }
// acumPaso: number                    // ms acumulados hacia el siguiente paso de las cadenas
// jugador: { x, y, w: 16, h: 16 }     // esquina superior izquierda, px lógicos
// disparo: { x, y, w: 3, h: 12 } | null
// arana: { x, y, w: 20, h: 12, vx, vy, cambioEn } | null; esperaArana: number
// pulga: { x, y, w: 14, h: 14, vy, golpes, filaPrevia } | null; esperaPulga: number
// cabezasExtra: number; esperaCabeza: number
// lives, score, level, siguienteVidaExtra, status
// fase: "intro" | "jugando" | "muerte"; tFase: number
// teclas: Set<string>; paused; destroyed; rafId; lastTime
```

Base de datos (migración que describe la spec y aplicará `/spec-impl` con `apply_migration`; no cambia el esquema, solo añade una fila):

```sql
insert into public.games (id, title, category)
values ('ciempies', 'CIEMPIÉS', 'SHOOTER');
```

Convenciones:

- **Rejilla.** `CELL = 20` px, `COLS = 40`, `ROWS = 30` (800×600). Las filas 0 y 1 (`y` 0–40) son la franja del HUD. El campo de juego son las filas 2 a 29. La zona del jugador son las filas 24 a 29 (`ZONA_TOP = 24`, `y` 480–600). Origen arriba a la izquierda.
- **Setas.** Cada seta ocupa su casilla (rectángulo de 16×16 centrado en la casilla de 20×20) y tiene 4 puntos de vida. Cada disparo le quita 1; dibujada, su altura es `16 × hp / 4` desde abajo. Al llegar a 0 desaparece y suma 1 punto. El campo inicial tiene 45 setas al azar en las filas 3 a 22, sin repetir casilla. Las setas no se regeneran al pasar de oleada.
- **Ciempiés.** Cada oleada `n` crea una cadena de `max(6, 12 − (n − 1))` segmentos más `min(6, n − 1)` cabezas sueltas de un segmento. Siempre suman 12 segmentos hasta la oleada 7. La cadena aparece en la fila 2 con la cabeza en la columna 20 y el cuerpo hacia la izquierda (columnas 19, 18…), con `dir = +1` y `vdir = +1`. Las cabezas sueltas aparecen en la fila 2, en las columnas 4, 10, 16, 24, 30 y 36 (las primeras `n − 1`), con `dir` alterno empezando por `−1`.
- **Movimiento por pasos.** Todas las cadenas avanzan una casilla por paso. `pasosPorSegundo(level) = min(20, 10 + 2 × (level − 1))`, es decir, 10 casillas/s (200 px/s) en la oleada 1 y 20 desde la 6. En cada paso la cabeza intenta ir a `(col + dir, row)`. Si esa casilla está fuera de los bordes (`col < 0` o `col ≥ 40`) o tiene una seta, baja a `(col, row + vdir)` e invierte `dir`. El movimiento vertical ignora las setas. Si `row + vdir > 29`, `vdir` pasa a `−1`. Si `vdir = −1` y `row + vdir < 24`, `vdir` pasa a `+1`. Así, tras llegar al fondo, la cadena se queda zigzagueando dentro de la zona del jugador. El cuerpo sigue a la cabeza: cada segmento ocupa la casilla anterior del que va delante.
- **Interpolación.** Las cadenas guardan `prev` (casillas del paso anterior) y se dibujan interpoladas entre `prev` y `segs` con `t = acumPaso / msPorPaso`. Las colisiones con el disparo y con el jugador usan ese rectángulo interpolado de 16×16. La lógica de paso usa las casillas enteras.
- **Partir.** Un disparo que acierta el segmento `k` de una cadena lo elimina y crea una seta en su casilla lógica (`segs[k]`), si está vacía, está en las filas 2 a 29 y no solapa al jugador. La cabeza (`k = 0`) vale 100 puntos y un segmento del cuerpo, 10. Los segmentos `0..k−1` siguen como cadena con su `dir` y su `vdir`. Los segmentos `k+1..` forman una cadena nueva cuya cabeza es `segs[k+1]`, con `dir = sign(segs[k].col − segs[k+1].col)`; si vale 0 (eslabón vertical), `dir = −dir` de la cadena original. Hereda `vdir`.
- **Cabezas en la zona.** Mientras algún segmento esté en la zona del jugador, cada 5 s aparece una cabeza suelta en la fila 24, alternando la columna 0 (`dir = +1`) y la 39 (`dir = −1`). Como máximo 4 por oleada.
- **Jugador.** Rectángulo de 16×16 que empieza en `x = 392`, `y = 576`. Se mueve en 2D a 300 px/s dentro de `x` 0–784 e `y` 480–584. No atraviesa setas: el movimiento se resuelve eje por eje y se cancela el eje que acabaría solapando una seta.
- **Disparo.** Solo un disparo en pantalla. Rectángulo de 3×12 que sale desde el centro superior del jugador y sube a 900 px/s. Con `Espacio` mantenido se dispara en cuanto no hay ningún disparo vivo. Para no atravesar nada con `dt` alto, el disparo avanza en subpasos de 8 px como máximo y se detiene en el primer impacto. Prioridad dentro de un subpaso: segmento, pulga, araña y seta. Si sale por `y < 40`, desaparece.
- **Araña.** La primera aparece a los 6 s de empezar. Después, entre 6 y 10 s (al azar) tras desaparecer la anterior. Entra por la izquierda (`x = −20`) o por la derecha (`x = 800`) con `y = 520`. Velocidad horizontal `min(200, 100 + 10 × (level − 1))` px/s y vertical de 160 px/s. Rebota entre `y = 480` e `y = 588` y además invierte `vy` cada 0,4 a 0,9 s al azar. Se come (borra sin puntos) las setas que solapa. Sale al cruzar el borde opuesto. Al acertarla da 900 puntos si la distancia vertical entre su centro y el del jugador es menor que 40 px, 600 si es menor que 80 y 300 en otro caso.
- **Pulga.** Solo desde la oleada 2. Aparece cuando hay menos de 5 setas en la zona del jugador, no hay otra pulga y han pasado 3 s desde la última. Cae desde `y = 40` en una columna al azar, a 240 px/s. Al entrar en cada fila nueva de la 2 a la 28, con probabilidad 0,3 crea una seta en esa casilla (si está vacía y no solapa al jugador). Necesita 2 disparos: el primero dobla su velocidad a 480 px/s y el segundo la destruye (200 puntos). Sale al pasar de `y = 600`.
- **Muerte.** El jugador muere si su rectángulo solapa un segmento (interpolado), la araña o la pulga. Pierde una vida. Si quedan vidas, la fase pasa a `muerte` durante 1.000 ms con el jugador parpadeando y todo congelado. Después las setas dañadas recuperan sus 4 puntos de vida (+5 puntos cada una), desaparecen la araña, la pulga y el disparo, y los segmentos que quedaban se reagrupan en una sola cadena desde la fila 2 (cabeza en la columna 20, `dir = +1`, `vdir = +1`). Luego se pasa a `intro` y el jugador vuelve a `(392, 576)`. Si era la última vida, `status` pasa a `gameover` al instante, sin la fase de muerte.
- **Oleadas.** Cuando no queda ningún segmento, `level` sube en 1, `cabezasExtra` vuelve a 0 y se crea la oleada siguiente. La araña sigue. La fase pasa a `intro`.
- **Intro.** Al empezar la partida, tras cada muerte y en cada oleada nueva, durante 1.000 ms se dibuja «OLEADA NN» centrado y nada se mueve (ni el jugador).
- **Vidas extra.** +1 vida cada 12.000 puntos (`siguienteVidaExtra` empieza en 12.000), hasta un máximo de 6.
- **Puntuación.** Seta destruida 1, segmento del cuerpo 10, cabeza 100, pulga 200, araña 300/600/900 y seta restaurada 5. Se limita con `Math.min(score, 1_000_000)`, dentro del `CHECK` de `scores`.
- **HUD del canvas.** En la franja de 40 px: `SCORE 000000` a la izquierda (6 dígitos con ceros), `OLEADA NN` centrado e iconos del jugador a la derecha, uno por vida. Fuente `bold 16px monospace`.
- **GAME OVER.** Velo negro con alfa 0,6 y «GAME OVER» centrado en `bold 56px monospace`, con «Puntuación: N» debajo.
- **Colores (`COLORES` en `draw.ts`).** Fondo `#05060a`. Seta `#39ff88` con borde `#0f7a3f`. Cabeza `#ff3df0`. Cuerpo `#ffd23f`. Jugador `#3df5ff`. Disparo `#ffffff`. Araña `#ff6b3d`. Pulga `#b07cff`. Texto `#e8f6ff`. Velo `rgba(0, 0, 0, 0.6)`.
- **`onChange`.** Se llama al arrancar y solo cuando cambia algún valor del snapshot, nunca por fotograma.
- **Teclado.** Las teclas se escuchan en `window` y se leen por `e.code`: `ArrowLeft`/`KeyA`, `ArrowRight`/`KeyD`, `ArrowUp`/`KeyW`, `ArrowDown`/`KeyS` y `Space`. Se ignoran los eventos de `input`, `textarea` y `select`, con Ctrl/Meta/Alt pulsados, y mientras el juego está en pausa o terminado. Mientras se juega se hace `preventDefault` del `keydown` y del `keyup` de las teclas consumidas, para que `Espacio` y las flechas no activen el botón enfocado ni desplacen la página. `P`, `Escape` y los clics sobre el canvas no hacen nada.
- **Pausa y tiempo.** Al reanudar se reinicia `lastTime`. `dt` tiene un tope de 50 ms. En pausa no se dibuja overlay propio: lo pone React. Al pausar se vacía `teclas`, para que el jugador no siga moviéndose al reanudar.
- Los textos nuevos de la interfaz de React están en español.

---

## Plan de implementación

Antes de escribir código de Next.js, leer en `node_modules/next/dist/docs/01-app/` la guía de Client Components (`"use client"`) y, para los rankings, las de Cache Components y Server Actions, según `AGENTS.md`. La portada se diseña con `/frontend-design`. Cada paso deja el sistema funcional. El alta en la base de datos va antes de la integración en el reproductor para que el guardado funcione en cuanto el juego sea jugable.

1. **Ficha del juego.** Entrada `ciempies` al final de `GAMES` y portada `.cover-ciempies` (fondo oscuro con setas verdes y un ciempiés de segmentos magenta y amarillo, en el estilo de `.cover-asteroides` con sus `::before`/`::after`). Verificación: `/biblioteca`, `/salon`, `/juegos/ciempies` y `/juegos/ciempies/jugar` cargan sin errores (el reproductor sigue siendo la maqueta); `/home` no cambia.
2. **Alta en la base de datos.** Aplicar con `apply_migration` (nombre `add_ciempies_game`) el `insert` en `games` y añadir `"ciempies"` a `JUEGOS_CON_RANKING` en `app/lib/leaderboard/schema.ts`, incluido su comentario. Verificación: `execute_sql` muestra seis filas en `games`; `get_advisors` (security) sin incidencias nuevas; `npx tsc --noEmit` y `npm run lint` sin errores.
3. **Rejilla y setas.** `board.ts` y `setas.ts`. Verificación: `npx tsc --noEmit` y `npm run lint`; `generarCampo` con un `rng` fijo devuelve 45 setas distintas, todas en las filas 3 a 22.
4. **Cadenas.** `cadenas.ts` con `crearOleada`, `pasoCadena`, `partirCadena` y `pasosPorSegundo`. Verificación: `npx tsc --noEmit` y `npm run lint`; `crearOleada(1)` da una cadena de 12 y `crearOleada(3)` una de 10 más 2 cabezas sueltas.
5. **Enemigos.** `enemigos.ts` con la araña y la pulga. Verificación: `npx tsc --noEmit` y `npm run lint`.
6. **Dibujo.** `draw.ts` con `COLORES` y `dibujar(ctx, vista)`. Verificación: `npx tsc --noEmit` y `npm run lint`; `draw.ts` no tiene colores literales fuera de `COLORES`.
7. **Motor.** `types.ts` y `game.ts` con `createCiempiesGame`: entrada de teclado, bucle `requestAnimationFrame` con acumulador de pasos, fases `intro`/`jugando`/`muerte`, disparo con subpasos, colisiones, vidas extra, oleadas, `pause`/`resume`/`restart`/`destroy` y `onChange`. El bucle arranca al crear el motor (no hay nada que cargar). Verificación: `npx tsc --noEmit` y `npm run lint`.
8. **Componente de canvas.** `app/components/ciempies-canvas.tsx` con `<canvas width={800} height={600}>`, clase `.ciempies-canvas`, `role="img"` y `aria-label` («Juego CIEMPIÉS: muévete con las flechas o WASD y dispara con Espacio al ciempiés antes de que llegue abajo»), y las props `onChange`, `paused` y `restartKey`. Verificación: montado en una ruta de prueba temporal, el juego se ve y se juega; la ruta se elimina antes del paso siguiente.
9. **Integración en el reproductor.** En `app/components/game-player.tsx`: `esCiempies = gameId === "ciempies"`, añadido a `esReal`; `SnapshotCiempies` en la unión de `snap`; rama `<CiempiesCanvas>` antes de la arena falsa; VIDAS inicial `LIVES` (3). En `app/globals.css`: `.ciempies-canvas` llena el `.crt-screen` (posición absoluta, `inset: 0`, 100 % de ancho y alto) y `.crt-screen:has(.ciempies-canvas)::before/::after` quedan por encima con `z-index: 1`, igual que `.frogger-canvas`. En `app/games/controles-tactiles.ts`: entrada `ciempies` con `direcciones: ["up", "down", "left", "right"]`, `a: { etiqueta: "DISPARO", tecla: ESPACIO }`, `b: null` y `repetir: false`. Verificación: partida completa en `/juegos/ciempies/jugar` hasta GAME OVER y guardado; los otros cinco juegos reales y las maquetas se comportan igual que antes.
10. **Rankings.** `/salon` añade `obtenerRanking("ciempies", 12)` al `Promise.all` y se lo pasa a `HallOfFame` como prop `ciempies`; `hall-of-fame.tsx` la añade a su tipo y a `reales`; `app/juegos/[id]/page.tsx` añade `game.id === "ciempies"` a la condición de `RankingReal`. El `EmptyBoard` del Home sigue invitando a `asteroides`. Verificación: con `scores` vacía para `ciempies` se ve el estado vacío; tras guardar una puntuación aparece en ficha, Salón y Home sin reiniciar el servidor.
11. **Documentación.** En `CLAUDE.md`: la spec en la lista (como las de `game-jam/frogger/`), `app/games/ciempies/` y `ciempies-canvas.tsx` en la estructura, y `ciempies` en la sección de Supabase (juegos con ranking real y filas de `games`). Revisar `puntos-de-integracion.md` por si algún punto cambió. Verificación: `npm run lint` y `npm run build`.

---

## Criterios de aceptación

Verificados con Playwright (Chromium) sobre `npm run dev`, más `npm run lint`, `npx tsc --noEmit`, `npm run build` y consultas SQL con el MCP de Supabase. Los screenshots van a `.playwright-screenshots/`.

**Global**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] No hay errores en la consola del navegador en `/juegos/ciempies/jugar` durante una partida completa ni en `/home`, `/biblioteca`, `/salon`, `/acceso`, `/about` y `/juegos/ciempies`.
- [ ] No se crea `public/games/ciempies/` ni se carga ninguna imagen o audio en `/juegos/ciempies/jugar`.

**Ficha y catálogo**

- [ ] `/biblioteca` lista CIEMPIÉS con categoría SHOOTER, portada `.cover-ciempies` propia y botón verde.
- [ ] `/juegos/ciempies` muestra la ficha y su botón JUGAR lleva a `/juegos/ciempies/jugar`.
- [ ] `/home` muestra las mismas 6 tarjetas de juegos que antes.
- [ ] Las pestañas de `/salon` incluyen CIEMPIÉS y no rompen las demás.

**Jugabilidad**

- [ ] Al cargar `/juegos/ciempies/jugar` el canvas (resolución lógica 800×600) llena el recuadro del CRT sin franjas ni recortes a 1440, 1024 y 390 px de ancho.
- [ ] Al empezar hay exactamente 45 setas en las filas 3 a 22, el HUD muestra `SCORE 000000`, `OLEADA 01` y 3 iconos de vida, y durante 1 s se ve «OLEADA 01» sin que nada se mueva.
- [ ] El ciempiés de la oleada 1 tiene 12 segmentos, entra por la fila 2 con la cabeza en la columna 20 y avanza a 10 casillas/s.
- [ ] Al chocar con una seta o con un borde, la cabeza baja una fila e invierte su sentido; tras llegar a la fila 29 zigzaguea entre las filas 24 y 29 sin salir de ellas.
- [ ] Mantener las flechas o `WASD` mueve al jugador a 300 px/s dentro de la zona de las filas 24 a 29, sin atravesar setas ni salirse del lienzo.
- [ ] `Espacio` dispara un único proyectil; manteniéndolo, el siguiente sale en cuanto desaparece el anterior.
- [ ] Una seta desaparece al cuarto disparo y suma exactamente 1 punto; con cada disparo se ve más baja.
- [ ] Acertar la cabeza suma 100 y un segmento del cuerpo 10; el segmento acertado deja una seta en su casilla y la cadena se parte en dos que siguen moviéndose.
- [ ] Acertar el segmento central de la cadena de 12 deja dos cadenas, y la trasera tiene cabeza propia (se dibuja con el color de cabeza).
- [ ] Mientras algún segmento está en la zona del jugador aparece una cabeza suelta cada 5 s por la fila 24, como máximo 4 por oleada.
- [ ] La araña aparece a los 6 s, zigzaguea entre `y = 480` e `y = 588`, se come las setas que toca y da 300, 600 o 900 puntos según su distancia vertical al jugador.
- [ ] Desde la oleada 2, con menos de 5 setas en la zona del jugador, cae una pulga que deja setas a su paso; el primer disparo la acelera y el segundo la destruye sumando 200.
- [ ] Al limpiar la oleada 1 aparece «OLEADA 02», el HUD muestra `OLEADA 02`, la nueva oleada tiene una cadena de 11 segmentos y una cabeza suelta, y avanza a 12 casillas/s.
- [ ] Tocar un segmento, la araña o la pulga quita una vida (3 → 2 iconos), el jugador parpadea 1 s, las setas dañadas se restauran sumando 5 cada una y los segmentos que quedaban vuelven a entrar como una sola cadena por la fila 2.
- [ ] Al llegar a 12.000 puntos se gana una vida extra, y nunca se pasa de 6.
- [ ] Al perder la última vida el canvas deja de avanzar y dibuja «GAME OVER» y «Puntuación: N» sobre un velo semitransparente.
- [ ] `P`, `Escape` y los clics sobre el canvas no hacen nada.
- [ ] Las flechas y `Espacio` no desplazan la página mientras se juega.

**Integración con React**

- [ ] La barra del reproductor muestra PUNTUACIÓN, VIDAS y NIVEL iguales a los del HUD del canvas en todo momento; VIDAS muestra `♥ ♥ ♥`, `♥ ♥`, `♥` y `—` al perder la última.
- [ ] PAUSA congela el ciempiés, el jugador, el disparo, la araña y la pulga, y muestra «EN PAUSA»; REANUDAR continúa sin saltos y sin que el jugador se mueva solo.
- [ ] Con el foco en el botón PAUSA, `Espacio` dispara y las flechas mueven al jugador sin activar ningún botón.
- [ ] Al llegar a GAME OVER el modal «FIN DEL JUEGO» se abre solo con la puntuación real; FIN también lo abre pausando el juego.
- [ ] Con el modal abierto, escribir en el campo de iniciales (incluidos `Espacio` y las flechas) no mueve al jugador ni dispara.
- [ ] JUGAR DE NUEVO reinicia con 0 puntos, oleada 1, 3 vidas y un campo nuevo de 45 setas.
- [ ] SALIR y VOLVER AL VAULT detienen el bucle: tras navegar no quedan escuchas de teclado ni `requestAnimationFrame` activos.
- [ ] Con `pointer: coarse` (emulación móvil), la consola táctil muestra la cruceta de 4 direcciones y el botón A, que dispara mientras se mantiene pulsado.
- [ ] A 390 px de ancho el canvas se ve completo dentro del CRT, mantiene la proporción 4:3 y la página no tiene desborde horizontal.
- [ ] Los otros cinco juegos reales conservan su jugabilidad y las maquetas su puntuación al azar y sus 3 vidas.

**Base de datos y ranking**

- [ ] `games` contiene la fila `ciempies` / `CIEMPIÉS` / `SHOOTER` y las cinco filas anteriores siguen intactas.
- [ ] FIN o GAME OVER → GUARDAR PUNTUACIÓN crea una fila en `scores` con `game_id = 'ciempies'`, el nombre en mayúsculas, la puntuación del canvas y `user_id` nulo; el modal muestra «PUNTUACIÓN GUARDADA».
- [ ] Con la petición bloqueada o fallando, el modal muestra `[ERR]`, conserva el nombre y no permite doble envío.
- [ ] Con `scores` vacía para `ciempies`, `/salon` (pestaña CIEMPIÉS) y `/juegos/ciempies` muestran «SIN PUNTUACIONES — SÉ EL PRIMERO» con enlace a `/juegos/ciempies/jugar`.
- [ ] Tras guardar, la puntuación aparece en la ficha y en el Salón sin reiniciar el servidor, y en las tarjetas de actividad del Home con el título CIEMPIÉS y el color verde.
- [ ] Un mismo nombre con dos puntuaciones aparece una sola vez en el ranking de CIEMPIÉS, con la mayor, y no se mezcla con los de otros juegos.
- [ ] «TU MEJOR MARCA» de la pestaña CIEMPIÉS muestra la mejor marca del nombre en sesión y su puesto, y no aparece si no tiene ninguna.
- [ ] `get_advisors` de seguridad no reporta incidencias nuevas.
- [ ] Las filas de prueba creadas en `scores` durante la verificación se borran al terminar.

---

## Decisiones

- **Sí:** definición rápida sin aclaraciones detalladas. El jam corrió como tarea programada sin nadie que contestara la fase de preguntas, así que todo lo de abajo es «Recomendación por defecto» pendiente de revisar.
- **Sí:** `id` `ciempies`, título `CIEMPIÉS`, `SHOOTER` y color `green`, tal como los registró `game-planner` en `references/game-suggestions-todo.md`. Recomendación por defecto.
- **Sí:** dos specs alternativas para el mismo `id` en esta carpeta; se implementa una. **No:** dos fichas parecidas en el catálogo a la vez. Recomendación por defecto.
- **Sí:** una spec única para motor + reproductor + base de datos + rankings, como SPEC 09 y la de Frogger. **No:** el reparto en tres specs (`motor`/`ranking`/`extras`) del agente `game-jam`: el encargo pedía variantes jugables completas, y la de Frogger demostró que el ranking cabe en la misma spec. Recomendación por defecto.
- **Sí:** primitivas de canvas y colores en `COLORES`. **No:** sprites ni assets. No hay assets de Centipede en el repo, y así la spec de skins solo sustituye la paleta, como en Frogger. Recomendación por defecto.
- **Sí:** rejilla de 20 px (40×30) que llena el 800×600 sin recomponer nada, con 40 px arriba para el HUD. Recomendación por defecto.
- **Sí:** movimiento por pasos de casilla con dibujo interpolado. **No:** movimiento continuo con trayectorias. Los pasos hacen exactas las reglas de giro y de partir, y la interpolación evita el aspecto a saltos. Recomendación por defecto.
- **Sí:** araña y pulga. **No:** escorpión ni setas envenenadas. Con dos enemigos extra el juego ya tiene la presión del original y cabe en una spec M. Recomendación por defecto.
- **Sí:** 3 vidas, vida extra cada 12.000 y máximo 6. VIDAS de React muestra las vidas reales, sin adaptar la barra. Recomendación por defecto.
- **Sí:** NIVEL = oleada. Recomendación por defecto.
- **Sí:** tope de puntuación con `Math.min(score, 1_000_000)`, porque el juego no tiene máximo natural. Recomendación por defecto.
- **Sí:** disparo automático con `Espacio` mantenido, así el botón A táctil funciona sin auto-repetición. Recomendación por defecto.
- **Sí:** entrada en `CONTROLES_TACTILES`; sin ella el juego no se puede jugar en móvil (`puntos-de-integracion.md`). **No:** controles táctiles propios del motor. Recomendación por defecto.
- **Sí:** sin sonido, como Snake y Frogger. Recomendación por defecto.
- **Sí:** quitar `P` y `Escape`; la pausa es solo el botón PAUSA de React. Decisión cerrada de la plataforma.
- **Sí:** rama `gameId === "ciempies"` en `GamePlayer` y prop `ciempies` en `HallOfFame`. **No:** registro de juegos. Decisión cerrada de la plataforma.
- **Sí:** entrada al final de `GAMES`, `best: 0` y `plays: "0"`. **No:** inventar cifras. Decisión cerrada de la plataforma.
- **Sí:** el `EmptyBoard` del Home sigue apuntando a `asteroides`. Recomendación por defecto.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Strict Mode monta dos veces el efecto y quedaría un segundo bucle o escuchas duplicadas | `destroy()` cancela `requestAnimationFrame`, quita `keydown`/`keyup` de `window` y marca `destroyed`; el motor no llama a `onChange` tras `destroy()` |
| El disparo a 900 px/s atraviesa una seta o un segmento en un fotograma largo | Subpasos de 8 px como máximo y `dt` con tope de 50 ms; criterio de aceptación de impacto |
| Varias cadenas pisan la misma casilla y se solapan | Es comportamiento del original y no rompe la lógica: cada cadena se mueve por su cuenta; el disparo solo procesa el primer impacto |
| La cadena queda encerrada entre setas y bordes sin poder bajar | El movimiento vertical ignora las setas, así que siempre hay salida |
| La araña se come todas las setas de la zona y la partida pierde reto | Es el equilibrio del original: la pulga repone setas desde la oleada 2 |
| Partida infinita: el juego no termina nunca solo | La velocidad sube hasta 20 casillas/s, las cabezas sueltas crecen y la araña acelera; el tope de 1.000.000 protege el `CHECK` |
| Tras pulsar PAUSA el botón conserva el foco y `Espacio` lo activaría | `preventDefault` en `keydown` y `keyup` de las teclas consumidas mientras se juega; criterio de aceptación |
| Al reanudar el jugador sigue moviéndose con una tecla soltada durante la pausa | Al pausar se vacía `teclas` |
| El `dt` salta al reanudar o al volver a la pestaña | Reiniciar `lastTime` al reanudar y limitar `dt` a 50 ms |
| Con `cacheComponents: true`, leer el ranking sin `<Suspense>` rompe el prerrenderizado | Se reutilizan los `<Suspense>` de `/salon` y de la ficha; `obtenerRanking` ya etiqueta `ranking-ciempies` |
| El motor usa `window` o `document` al importarse y rompe el prerrenderizado | Todo acceso al DOM ocurre dentro de `createCiempiesGame`, llamado desde `useEffect`; los módulos puros no tocan el DOM |
| El título con tilde (`CIEMPIÉS`) se ve mal en la fuente pixel o en la base | La fila de `games` y la ficha usan el mismo texto UTF-8; se comprueba en `/biblioteca` y en el Salón |

---

## Qué **no** está en este spec

- Skins y botón SKIN (spec propia de `skin-designer`).
- Sonido, escorpión, setas envenenadas y cambio de colores por oleada.
- La variante de munición limitada y racha (`02-juego-ciempies-cosecha.md`).
- Generalizar `GamePlayer` hacia un registro de juegos.
- Teclas `P` y `Escape` de pausa.
- Autenticación real, anti-trampas, realtime y paginación del ranking.
- Tests automatizados.

Cada uno de ellos, si se aborda, va en su propio spec.
