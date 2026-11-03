# GJ ciempies 02 — Juego CIEMPIÉS «cosecha» (munición limitada y racha) jugable en la plataforma con ranking real

> **Status:** Borrador
> **Depends on:** SPEC 06 (patrón de motor de canvas y reproductor), SPEC 07 (tablas `games` y `scores`, vista `leaderboard` y rankings reales), SPEC 08, SPEC 09 y SPEC 10 (snapshot y canvas por `gameId`, prop por juego en `HallOfFame`), SPEC 14 (tabla `CONTROLES_TACTILES`)
> **Date:** 2026-11-03
> **Objective:** Diseñar desde cero un Centipede de canvas en TypeScript donde la munición se cosecha de las setas y los aciertos seguidos multiplican los puntos, publicarlo como el juego `ciempies`, conectarlo al reproductor y guardar y mostrar sus puntuaciones en Supabase.

---

## Por qué existe este spec

Este spec sale del game jam de `references/game-suggestions-todo.md`, con **CIEMPIÉS** (`ciempies`, SHOOTER, green, M) como tema. Es la **variante con giro** del mismo juego base. La variante clásica es `01-juego-ciempies-clasico.md`. Las dos son alternativas para el mismo `id`: solo se implementa una. Si el usuario quiere las dos, esta cambia de `id` (por ejemplo `ciempies-cosecha`) antes de implementarse.

El giro cambia lo que decide el jugador en cada segundo. En el clásico se dispara sin parar. Aquí cada disparo cuesta munición, y la munición sale de destruir setas y recoger las esporas que sueltan. Eso convierte el campo de setas en un recurso y no solo en un obstáculo. A la vez, los aciertos seguidos contra enemigos suben un multiplicador que se pierde al fallar. El resultado premia la puntería y castiga disparar a ciegas:

- **Munición limitada.** 30 disparos al empezar, 60 como máximo. Una recarga lenta de emergencia evita quedarse bloqueado.
- **Esporas.** Una seta destruida suelta una espora que cae; recogerla da 5 disparos.
- **Racha.** Cada 4 aciertos seguidos contra enemigos el multiplicador sube 1, hasta ×8. Un disparo que se pierde por arriba lo devuelve a ×1.
- **Campo vivo.** Cada 10 s brotan 3 setas nuevas, hasta 120, para que siempre haya algo que cosechar y el ciempiés gire más a menudo.
- **Bono de oleada.** Al limpiar una oleada, cada disparo que sobra vale 5 puntos.

Para que la spec siga siendo M, esta variante no tiene pulga ni cabezas extra en la zona del jugador: la presión viene de la munición y del campo que crece.

Encaja con la plataforma igual que el clásico. Es un SHOOTER verde sin assets, con vidas (3), oleadas (`level`) y una puntuación «mayor es mejor» limitada a 1.000.000. No hay juego de partida en `references/started-games/` ni existe una maqueta `ciempies` en `GAMES`.

La ejecución del jam fue desatendida (tarea programada), así que no hubo fase de preguntas. Las decisiones son recomendaciones por defecto pendientes de que el usuario las revise.

---

## Alcance

**In:**

- Entrada nueva `ciempies` **al final** de `GAMES` en `app/data/games.ts` y portada CSS nueva `.cover-ciempies` en `app/globals.css`, diseñada con `/frontend-design` en estética arcade/neón.
- Motor del juego en `app/games/ciempies/`, diseñado desde cero: campo de setas que crece, ciempiés que baja zigzagueando y se parte al recibir disparos, araña, munición limitada con recarga de emergencia, esporas que se recogen, multiplicador de racha, bono de oleada, 3 vidas, vida extra cada 15.000 puntos, oleadas que aceleran y GAME OVER.
- Todo dibujado con primitivas de canvas, con los colores en una sola constante `COLORES` de `draw.ts`.
- HUD dibujado en el canvas (franja superior de 40 px en dos líneas: puntuación, oleada y vidas; barra de munición y multiplicador) y overlays de «OLEADA NN», «+N BONO» y GAME OVER.
- Control con `←` `→` `↑` `↓` o `WASD` para moverse y `Espacio` para disparar (mantener = disparo automático mientras haya munición).
- Lienzo lógico de 800×600, escalado con CSS para llenar `.crt-screen`.
- Componente cliente `app/components/ciempies-canvas.tsx`, calcado de `frogger-canvas.tsx` sin la prop `skin`.
- Rama `gameId === "ciempies"` en `GamePlayer` con valores reales en `player-hud`, PAUSA/REANUDAR, FIN, modal automático al llegar a `gameover`, JUGAR DE NUEVO y SALIR.
- CSS del canvas (clase `.ciempies-canvas`) dentro de `.crt-screen`.
- Entrada `ciempies` en `CONTROLES_TACTILES`: cruceta de 4 direcciones y botón A = DISPARO (`Espacio`).
- Alta en Supabase (`insert into public.games` y `JUEGOS_CON_RANKING`), guardado con `guardarPuntuacion` y aviso `[ERR]`, y rankings reales en `/salon`, `/juegos/ciempies` y el Home con `EmptyBoard`.
- Documentar la spec y los archivos nuevos en `CLAUDE.md`.

**Out of scope (para futuros specs):**

- Mostrar la munición o el multiplicador en la barra de React (exigiría ampliar el contrato del snapshot y `GamePlayer`).
- Skins y botón SKIN (spec propia de `skin-designer`).
- Sonido.
- Pulga, escorpión, setas envenenadas y cabezas extra en la zona del jugador.
- Tipos de munición, mejoras o tienda.
- La variante clásica (`01-juego-ciempies-clasico.md`).
- Generalizar `GamePlayer` hacia un registro de juegos.
- Teclas `P` y `Escape` de pausa.
- Autenticación real (`user_id` queda en `NULL`), anti-trampas, realtime y paginación.
- Tests automatizados.

---

## Modelo de datos

Ficha del catálogo (mismo tipo `Juego` de SPEC 01):

```ts
{
  id: "ciempies",
  title: "CIEMPIÉS",
  short: "Cosecha munición de las setas y parte al ciempiés.",
  long: "Un ciempiés baja zigzagueando entre setas hacia tu zona, pero tus disparos son limitados. Destruye setas y recoge las esporas que sueltan para recargar. Encadena aciertos para multiplicar los puntos hasta ×8 y guarda munición: la que te sobre al limpiar la oleada también puntúa. Tienes 3 vidas.",
  cat: "SHOOTER",
  cover: "cover-ciempies",
  color: "green",
  best: 0,
  plays: "0",
}
```

Contrato entre el motor y React (`app/games/ciempies/types.ts`), el mismo que el resto de juegos. La munición y el multiplicador **no** salen del motor:

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

- `board.ts`: constantes de la rejilla, de las zonas y de la economía (`MUNICION_INICIAL`, `MUNICION_MAX`…), tipos `Celda`, `Seta`, `Cadena`, `Arana`, `Espora` y `Rect`, y utilidades `rectDeCelda(celda)` y `solapan(a, b)`.
- `setas.ts`: `generarCampo(rng, cantidad)`, `golpearSeta(setas, celda)` y `brotarSetas(setas, ocupadas, rng)`.
- `cadenas.ts`: `crearOleada(level)`, `pasoCadena(cadena, setas)`, `partirCadena(cadena, indice)` y `pasosPorSegundo(level)`.
- `enemigos.ts`: `actualizarArana(arana, dt, setas, rng)` y `puntosArana(arana, jugador)`.
- `economia.ts`: `multiplicador(aciertos)`, `sumarMunicion(municion, n)` y `bonoOleada(municion)`.
- `draw.ts`: `COLORES` y `dibujar(ctx, vista)`.
- `game.ts`: `createCiempiesGame`.

Estado interno del motor (no se expone):

```ts
// setas: Map<string, Seta>            // clave "col,row"; Seta = { col, row, hp: 1..4 }
// cadenas: Cadena[]                   // Cadena = { segs: Celda[]; prev: Celda[]; dir: 1 | -1; vdir: 1 | -1 }
// acumPaso: number
// jugador: { x, y, w: 16, h: 16 }
// disparo: { x, y, w: 3, h: 12 } | null
// arana: { x, y, w: 20, h: 12, vx, vy, cambioEn } | null; esperaArana: number
// esporas: { x, y, w: 10, h: 10 }[]
// municion: number; esperaRecarga: number
// aciertos: number                    // aciertos seguidos contra enemigos
// esperaBrote: number
// bono: { puntos: number; t: number } | null   // aviso «+N BONO» en pantalla
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

- **Rejilla.** `CELL = 20` px, `COLS = 40`, `ROWS = 30` (800×600). Filas 0 y 1 (`y` 0–40): HUD. Campo de juego: filas 2 a 29. Zona del jugador: filas 24 a 29 (`ZONA_TOP = 24`, `y` 480–600).
- **Setas.** Rectángulo de 16×16 centrado en su casilla, con 4 puntos de vida. Cada disparo le quita 1 y la dibuja más baja (`16 × hp / 4`). Al llegar a 0 desaparece, suma 1 punto y suelta una espora en su centro. El campo inicial tiene 45 setas al azar en las filas 3 a 22, sin repetir casilla.
- **Brote.** Mientras la fase es `jugando`, cada 10.000 ms brotan 3 setas en casillas vacías al azar de las filas 3 a 23 que no ocupe ningún segmento. No brotan si ya hay 120 setas. Las setas no se regeneran al pasar de oleada.
- **Esporas.** Rectángulo de 10×10 que cae a 120 px/s. Si solapa al jugador, desaparece y suma 5 de munición. Si pasa de `y = 600`, se pierde. Las setas que se come la araña no sueltan esporas.
- **Munición.** `MUNICION_INICIAL = 30` y `MUNICION_MAX = 60`. Cada disparo cuesta 1. Con 0, `Espacio` no hace nada. Acertar un segmento suma 2 y acertar la araña 10. Toda suma se limita a 60.
- **Recarga de emergencia.** Si la munición es 0, no hay ningún disparo vivo y no cae ninguna espora, se suma 1 cada 1.500 ms.
- **Racha.** `aciertos` cuenta los impactos seguidos contra segmentos o la araña. `multiplicador(aciertos) = min(8, 1 + floor(aciertos / 4))`. Un disparo que sale por `y < 40` sin impactar pone `aciertos` a 0. Dar a una seta ni suma ni reinicia. Morir pone `aciertos` a 0.
- **Ciempiés.** Cada oleada `n` crea una cadena de `max(6, 12 − (n − 1))` segmentos más `min(6, n − 1)` cabezas sueltas. La cadena aparece en la fila 2 con la cabeza en la columna 20 y el cuerpo hacia la izquierda, con `dir = +1` y `vdir = +1`. Las cabezas sueltas aparecen en la fila 2, en las columnas 4, 10, 16, 24, 30 y 36 (las primeras `n − 1`), con `dir` alterno empezando por `−1`.
- **Movimiento por pasos.** `pasosPorSegundo(level) = min(20, 10 + 2 × (level − 1))`. En cada paso la cabeza intenta ir a `(col + dir, row)`. Si esa casilla está fuera de los bordes o tiene una seta, baja a `(col, row + vdir)` e invierte `dir`. El movimiento vertical ignora las setas. Si `row + vdir > 29`, `vdir` pasa a `−1`. Si `vdir = −1` y `row + vdir < 24`, `vdir` pasa a `+1`. El cuerpo sigue a la cabeza casilla a casilla. Las cadenas se dibujan interpoladas entre `prev` y `segs` con `t = acumPaso / msPorPaso`. Las colisiones usan ese rectángulo interpolado de 16×16.
- **Partir.** Un disparo que acierta el segmento `k` lo elimina y crea una seta en `segs[k]`, si está vacía, en las filas 2 a 29 y sin solapar al jugador. La cabeza vale `100 × multiplicador` y un segmento del cuerpo `10 × multiplicador`, con el multiplicador calculado **después** de sumar el acierto. Los segmentos `0..k−1` siguen como cadena. Los segmentos `k+1..` forman una cadena nueva con cabeza `segs[k+1]` y `dir = sign(segs[k].col − segs[k+1].col)`; si vale 0, `dir = −dir` de la original. Hereda `vdir`.
- **Jugador.** Rectángulo de 16×16 que empieza en `x = 392`, `y = 576`. Se mueve en 2D a 300 px/s dentro de `x` 0–784 e `y` 480–584 y no atraviesa setas (movimiento resuelto eje por eje).
- **Disparo.** Solo uno en pantalla. Rectángulo de 3×12 que sale del centro superior del jugador y sube a 900 px/s, en subpasos de 8 px como máximo. Se detiene en el primer impacto, con prioridad segmento, araña y seta. Con `Espacio` mantenido se dispara en cuanto no hay disparo vivo y queda munición.
- **Araña.** La primera aparece a los 6 s de empezar. Después, entre 6 y 10 s (al azar) tras desaparecer la anterior. Entra por `x = −20` o `x = 800` con `y = 520`. Velocidad horizontal `min(200, 100 + 10 × (level − 1))` px/s y vertical 160 px/s. Rebota entre `y = 480` e `y = 588` e invierte `vy` cada 0,4 a 0,9 s al azar. Se come las setas que solapa. Vale 900, 600 o 300 según su distancia vertical al jugador (menos de 40 px, menos de 80 px, el resto), por el multiplicador.
- **Muerte.** El jugador muere si solapa un segmento (interpolado) o la araña. Pierde una vida y `aciertos` vuelve a 0. Si quedan vidas, la fase pasa a `muerte` durante 1.000 ms, con el jugador parpadeando y todo congelado. Después las setas dañadas recuperan sus 4 puntos de vida (+5 puntos cada una), desaparecen la araña, el disparo y las esporas, la munición pasa a `max(municion, 20)` y los segmentos que quedaban se reagrupan en una sola cadena desde la fila 2 (cabeza en la columna 20). Luego se pasa a `intro`. Si era la última vida, `status` pasa a `gameover` al instante.
- **Oleadas y bono.** Cuando no queda ningún segmento se suma `bonoOleada(municion) = municion × 5`. Durante 1.500 ms se dibuja «+N BONO» bajo «OLEADA NN». La munición se conserva. `level` sube en 1, se crea la oleada siguiente y la fase pasa a `intro`.
- **Intro.** Al empezar, tras cada muerte y en cada oleada nueva, durante 1.000 ms se dibuja «OLEADA NN» centrado y nada se mueve. Los temporizadores de brote, araña y recarga no avanzan.
- **Vidas extra.** +1 cada 15.000 puntos (`siguienteVidaExtra` empieza en 15.000), hasta un máximo de 6.
- **Puntuación.** Seta destruida 1, seta restaurada 5, cuerpo `10 × m`, cabeza `100 × m`, araña `300/600/900 × m` y bono de oleada `munición × 5`. Se limita con `Math.min(score, 1_000_000)`.
- **HUD del canvas.** Línea 1 (`y` 0–20, `bold 14px monospace`): `SCORE 000000` a la izquierda, `OLEADA NN` centrado e iconos de vida a la derecha. Línea 2 (`y` 20–40): `MUNICIÓN` y una barra de 240×8 px proporcional a `municion / 60` a la izquierda, con el número al lado (la barra parpadea con 5 o menos), y `×M` a la derecha (oculto con ×1).
- **GAME OVER.** Velo negro con alfa 0,6 y «GAME OVER» centrado en `bold 56px monospace`, con «Puntuación: N» debajo.
- **Colores (`COLORES` en `draw.ts`).** Fondo `#05060a`. Seta `#39ff88` con borde `#0f7a3f`. Espora `#c8ff5a`. Cabeza `#ff3df0`. Cuerpo `#ffd23f`. Jugador `#3df5ff`. Disparo `#ffffff`. Araña `#ff6b3d`. Barra de munición `#3df5ff`, que pasa a `#ff3d5a` con 5 o menos. Multiplicador `#ffd23f`. Texto `#e8f6ff`. Velo `rgba(0, 0, 0, 0.6)`.
- **`onChange`.** Se llama al arrancar y solo cuando cambia `score`, `lives`, `level` o `status`. Los cambios de munición, de racha o de esporas no lo disparan.
- **Teclado.** Las teclas se escuchan en `window` y se leen por `e.code`: `ArrowLeft`/`KeyA`, `ArrowRight`/`KeyD`, `ArrowUp`/`KeyW`, `ArrowDown`/`KeyS` y `Space`. Se ignoran los eventos de `input`, `textarea` y `select`, con Ctrl/Meta/Alt pulsados, y mientras el juego está en pausa o terminado. Mientras se juega se hace `preventDefault` del `keydown` y del `keyup` de las teclas consumidas. `P`, `Escape` y los clics sobre el canvas no hacen nada.
- **Pausa y tiempo.** Al reanudar se reinicia `lastTime`. `dt` tiene un tope de 50 ms. Al pausar se vacía `teclas`. Todos los temporizadores (brote, araña, recarga, bono, fases) avanzan solo con `dt` de juego, así que se congelan en pausa.
- Los textos nuevos de la interfaz de React están en español.

---

## Plan de implementación

Antes de escribir código de Next.js, leer en `node_modules/next/dist/docs/01-app/` la guía de Client Components (`"use client"`) y, para los rankings, las de Cache Components y Server Actions, según `AGENTS.md`. La portada se diseña con `/frontend-design`. Cada paso deja el sistema funcional.

1. **Ficha del juego.** Entrada `ciempies` al final de `GAMES` y portada `.cover-ciempies` (fondo oscuro con setas verdes, esporas cayendo y un ciempiés magenta y amarillo, en el estilo de `.cover-asteroides`). Verificación: `/biblioteca`, `/salon`, `/juegos/ciempies` y `/juegos/ciempies/jugar` cargan sin errores (el reproductor sigue siendo la maqueta); `/home` no cambia.
2. **Alta en la base de datos.** Aplicar con `apply_migration` (nombre `add_ciempies_game`) el `insert` en `games` y añadir `"ciempies"` a `JUEGOS_CON_RANKING`, incluido su comentario. Verificación: `execute_sql` muestra seis filas en `games`; `get_advisors` (security) sin incidencias nuevas; `npx tsc --noEmit` y `npm run lint` sin errores.
3. **Rejilla, setas y economía.** `board.ts`, `setas.ts` y `economia.ts`. Verificación: `npx tsc --noEmit` y `npm run lint`; con un `rng` fijo, `generarCampo` da 45 setas distintas en las filas 3 a 22 y `brotarSetas` nunca pasa de 120; `multiplicador(0) = 1`, `multiplicador(4) = 2` y `multiplicador(40) = 8`; `bonoOleada(37) = 185`.
4. **Cadenas.** `cadenas.ts`. Verificación: `npx tsc --noEmit` y `npm run lint`; `crearOleada(1)` da una cadena de 12 y `crearOleada(3)` una de 10 más 2 cabezas sueltas.
5. **Araña.** `enemigos.ts`. Verificación: `npx tsc --noEmit` y `npm run lint`.
6. **Dibujo.** `draw.ts` con `COLORES` y `dibujar(ctx, vista)`, incluida la segunda línea del HUD. Verificación: `npx tsc --noEmit` y `npm run lint`; `draw.ts` no tiene colores literales fuera de `COLORES`.
7. **Motor.** `types.ts` y `game.ts` con `createCiempiesGame`: teclado, bucle `requestAnimationFrame` con acumulador de pasos, fases, disparo con subpasos y coste de munición, esporas, recarga de emergencia, racha, brote, bono, colisiones, vidas extra, oleadas, `pause`/`resume`/`restart`/`destroy` y `onChange`. El bucle arranca al crear el motor. Verificación: `npx tsc --noEmit` y `npm run lint`.
8. **Componente de canvas.** `app/components/ciempies-canvas.tsx` con `<canvas width={800} height={600}>`, clase `.ciempies-canvas`, `role="img"` y `aria-label` («Juego CIEMPIÉS: muévete con las flechas o WASD, dispara con Espacio y recoge esporas para recargar»), y las props `onChange`, `paused` y `restartKey`. Verificación: montado en una ruta de prueba temporal, el juego se ve y se juega; la ruta se elimina antes del paso siguiente.
9. **Integración en el reproductor.** En `game-player.tsx`: `esCiempies`, añadido a `esReal`; `SnapshotCiempies` en la unión de `snap`; rama `<CiempiesCanvas>` antes de la arena falsa; VIDAS inicial `LIVES` (3). En `app/globals.css`: `.ciempies-canvas` llena el `.crt-screen` y `.crt-screen:has(.ciempies-canvas)::before/::after` llevan `z-index: 1`, como `.frogger-canvas`. En `controles-tactiles.ts`: entrada `ciempies` con `direcciones: ["up", "down", "left", "right"]`, `a: { etiqueta: "DISPARO", tecla: ESPACIO }`, `b: null` y `repetir: false`. Verificación: partida completa en `/juegos/ciempies/jugar` hasta GAME OVER y guardado; los otros cinco juegos reales y las maquetas no cambian.
10. **Rankings.** `/salon` añade `obtenerRanking("ciempies", 12)` y la prop `ciempies` de `HallOfFame`; `hall-of-fame.tsx` la añade a su tipo y a `reales`; `app/juegos/[id]/page.tsx` añade `game.id === "ciempies"` a la condición de `RankingReal`. El `EmptyBoard` del Home sigue en `asteroides`. Verificación: estado vacío sin filas; tras guardar, la puntuación aparece en ficha, Salón y Home sin reiniciar el servidor.
11. **Documentación.** En `CLAUDE.md`: la spec en la lista, `app/games/ciempies/` (con la economía de munición) y `ciempies-canvas.tsx` en la estructura, y `ciempies` en la sección de Supabase. Revisar `puntos-de-integracion.md`. Verificación: `npm run lint` y `npm run build`.

---

## Criterios de aceptación

Verificados con Playwright (Chromium) sobre `npm run dev`, más `npm run lint`, `npx tsc --noEmit`, `npm run build` y consultas SQL con el MCP de Supabase. Los screenshots van a `.playwright-screenshots/`.

**Global**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] No hay errores en la consola del navegador en `/juegos/ciempies/jugar` durante una partida completa ni en `/home`, `/biblioteca`, `/salon`, `/acceso`, `/about` y `/juegos/ciempies`.
- [ ] No se crea `public/games/ciempies/` ni se carga ninguna imagen o audio.

**Ficha y catálogo**

- [ ] `/biblioteca` lista CIEMPIÉS con categoría SHOOTER, portada `.cover-ciempies` propia y botón verde.
- [ ] `/juegos/ciempies` muestra la ficha y su botón JUGAR lleva a `/juegos/ciempies/jugar`.
- [ ] `/home` muestra las mismas 6 tarjetas de juegos que antes.
- [ ] Las pestañas de `/salon` incluyen CIEMPIÉS y no rompen las demás.

**Jugabilidad**

- [ ] El canvas (800×600 lógico) llena el CRT sin franjas ni recortes a 1440, 1024 y 390 px de ancho.
- [ ] Al empezar hay exactamente 45 setas en las filas 3 a 22, la barra de munición marca 30 de 60, no se ve multiplicador y durante 1 s se ve «OLEADA 01» sin que nada se mueva.
- [ ] El ciempiés de la oleada 1 tiene 12 segmentos, entra por la fila 2 y avanza a 10 casillas/s; gira al chocar con setas o bordes y, tras llegar al fondo, zigzaguea entre las filas 24 y 29.
- [ ] El jugador se mueve a 300 px/s dentro de la zona de las filas 24 a 29 sin atravesar setas.
- [ ] Cada disparo resta exactamente 1 de munición; con 0, `Espacio` no dispara.
- [ ] Con 0 de munición, sin disparo vivo y sin esporas cayendo, la munición sube 1 cada 1,5 s.
- [ ] Una seta desaparece al cuarto disparo, suma 1 punto y suelta una espora que cae a 120 px/s; tocarla suma 5 de munición; si llega al fondo sin tocarla, se pierde.
- [ ] La munición nunca pasa de 60.
- [ ] Acertar un segmento suma 2 de munición y acertar la araña 10.
- [ ] Con 4 aciertos seguidos contra enemigos aparece `×2` en el HUD y el siguiente segmento del cuerpo suma 20; con 28 seguidos el multiplicador es `×8` y no sube más.
- [ ] Un disparo que sale por arriba sin impactar devuelve el multiplicador a ×1 (desaparece del HUD); dar a una seta no lo cambia.
- [ ] Acertar un segmento deja una seta en su casilla y parte la cadena en dos que siguen moviéndose.
- [ ] Cada 10 s de juego brotan 3 setas nuevas en las filas 3 a 23, y nunca hay más de 120.
- [ ] La araña aparece a los 6 s, se come las setas que toca (sin soltar esporas) y da 300, 600 o 900 puntos por el multiplicador.
- [ ] Al limpiar la oleada 1 con 37 de munición se suman exactamente 185 puntos, se ve «+185 BONO», la munición sigue en 37 y la oleada 2 tiene una cadena de 11 segmentos y una cabeza suelta a 12 casillas/s.
- [ ] No aparecen pulgas ni cabezas extra en la zona del jugador en ninguna oleada.
- [ ] Tocar un segmento o la araña quita una vida, el multiplicador vuelve a ×1, las setas dañadas se restauran sumando 5 cada una, las esporas desaparecen y la munición queda en al menos 20.
- [ ] Al llegar a 15.000 puntos se gana una vida extra, y nunca se pasa de 6.
- [ ] Al perder la última vida el canvas deja de avanzar y dibuja «GAME OVER» y «Puntuación: N».
- [ ] `P`, `Escape` y los clics sobre el canvas no hacen nada; las flechas y `Espacio` no desplazan la página mientras se juega.

**Integración con React**

- [ ] La barra del reproductor muestra PUNTUACIÓN, VIDAS y NIVEL iguales a los del HUD del canvas; no muestra munición ni multiplicador.
- [ ] Gastar munición o recoger esporas no provoca renders de `GamePlayer` (no cambia el snapshot).
- [ ] PAUSA congela todo, incluidos el brote, la recarga de emergencia y la caída de esporas; REANUDAR continúa sin saltos y sin que el jugador se mueva solo.
- [ ] Con el foco en el botón PAUSA, `Espacio` dispara y las flechas mueven al jugador sin activar ningún botón.
- [ ] Al llegar a GAME OVER el modal «FIN DEL JUEGO» se abre solo con la puntuación real; FIN también lo abre pausando el juego.
- [ ] Con el modal abierto, escribir en el campo de iniciales no mueve al jugador ni gasta munición.
- [ ] JUGAR DE NUEVO reinicia con 0 puntos, oleada 1, 3 vidas, 30 de munición, ×1 y un campo nuevo de 45 setas.
- [ ] SALIR y VOLVER AL VAULT detienen el bucle: no quedan escuchas de teclado ni `requestAnimationFrame` activos.
- [ ] Con `pointer: coarse`, la consola táctil muestra la cruceta de 4 direcciones y el botón A, que dispara mientras se mantiene pulsado.
- [ ] A 390 px de ancho el canvas se ve completo, mantiene 4:3 y la página no tiene desborde horizontal; la segunda línea del HUD se lee.
- [ ] Los otros cinco juegos reales y las maquetas conservan su comportamiento.

**Base de datos y ranking**

- [ ] `games` contiene la fila `ciempies` / `CIEMPIÉS` / `SHOOTER` y las cinco filas anteriores siguen intactas.
- [ ] GUARDAR PUNTUACIÓN crea una fila en `scores` con `game_id = 'ciempies'`, el nombre en mayúsculas, la puntuación del canvas y `user_id` nulo; el modal muestra «PUNTUACIÓN GUARDADA».
- [ ] Con la petición fallando, el modal muestra `[ERR]`, conserva el nombre y no permite doble envío.
- [ ] Sin filas para `ciempies`, `/salon` y `/juegos/ciempies` muestran «SIN PUNTUACIONES — SÉ EL PRIMERO» con enlace a `/juegos/ciempies/jugar`.
- [ ] Tras guardar, la puntuación aparece en la ficha, el Salón y las tarjetas del Home (título CIEMPIÉS, color verde) sin reiniciar el servidor.
- [ ] Un mismo nombre con dos puntuaciones aparece una sola vez en el ranking de CIEMPIÉS, con la mayor.
- [ ] «TU MEJOR MARCA» de la pestaña CIEMPIÉS muestra la mejor marca del nombre en sesión y su puesto.
- [ ] `get_advisors` de seguridad no reporta incidencias nuevas.
- [ ] Las filas de prueba creadas en `scores` se borran al terminar.

---

## Decisiones

- **Sí:** definición rápida sin aclaraciones detalladas. El jam corrió como tarea programada sin nadie que contestara la fase de preguntas, así que todo lo de abajo es «Recomendación por defecto» pendiente de revisar.
- **Sí:** mismo `id`, título, categoría y color que la variante clásica (`ciempies`, `CIEMPIÉS`, `SHOOTER`, `green`); las dos specs son alternativas. **No:** dos fichas a la vez. Si se quieren ambas, esta pasa a `ciempies-cosecha`. Recomendación por defecto.
- **Sí:** una spec única para motor + reproductor + base de datos + rankings, como SPEC 09 y la de Frogger. **No:** el reparto en tres specs del agente `game-jam`, porque el encargo pedía variantes completas. Recomendación por defecto.
- **Sí:** munición limitada que se cosecha de las setas. Es el giro que distingue esta variante: el campo deja de ser solo obstáculo. Recomendación por defecto.
- **Sí:** recarga de emergencia de 1 disparo cada 1,5 s. **No:** quedarse sin munición para siempre (bloquearía la partida sin GAME OVER). Recomendación por defecto.
- **Sí:** las esporas hay que recogerlas. **No:** munición instantánea al destruir la seta. Recogerla obliga a moverse por la zona y arriesgarse. Recomendación por defecto.
- **Sí:** multiplicador de racha hasta ×8 que se reinicia al fallar por arriba. **No:** reiniciarlo al dar a una seta, porque cosechar setas es parte del juego. Recomendación por defecto.
- **Sí:** bono de oleada `munición × 5`. Premia ahorrar y equilibra el gasto en setas. Recomendación por defecto.
- **Sí:** brote de 3 setas cada 10 s con tope de 120. Siempre hay recurso y el ciempiés gira más a menudo; el tope evita un campo lleno. Recomendación por defecto.
- **Sí:** sin pulga ni cabezas extra en la zona, para que la spec siga siendo M y la presión venga de la economía. Recomendación por defecto.
- **Sí:** munición y multiplicador solo en el HUD del canvas. **No:** ampliar el snapshot ni la barra de React. Ampliarlos obligaría a generalizar `GamePlayer`, que es una decisión cerrada. Recomendación por defecto.
- **Sí:** tras morir, la munición queda en al menos 20, para evitar una espiral de derrota. Recomendación por defecto.
- **Sí:** vida extra cada 15.000 (más que en el clásico, porque el multiplicador infla la puntuación), máximo 6. Recomendación por defecto.
- **Sí:** tope de puntuación con `Math.min(score, 1_000_000)`. Recomendación por defecto.
- **Sí:** primitivas de canvas con `COLORES` y sin sonido, como Frogger y Snake. Recomendación por defecto.
- **Sí:** entrada en `CONTROLES_TACTILES` con A = DISPARO. Recomendación por defecto.
- **Sí:** pausa solo con el botón de React, rama propia en `GamePlayer`, prop `ciempies` en `HallOfFame`, entrada al final de `GAMES` con `best: 0` y `plays: "0"`. Decisiones cerradas de la plataforma.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La economía queda desequilibrada (siempre sobra o siempre falta munición) | Todas las cifras viven en constantes de `board.ts` (`MUNICION_INICIAL`, `MUNICION_MAX`, munición por espora, segmento y araña, `BROTE_MS`); se ajustan tras jugar sin tocar la lógica |
| El jugador espera quieto a la recarga de emergencia para no gastar | La recarga es lenta (1 cada 1,5 s) y el ciempiés sigue bajando; esperar cuesta vidas |
| El multiplicador ×8 dispara la puntuación y satura el ranking | Tope de 1.000.000 y vida extra cada 15.000; el ranking es solo de este juego |
| El brote coloca una seta encima de un segmento o del jugador | `brotarSetas` recibe las casillas ocupadas y descarta las de segmentos y las que solapan al jugador |
| Varias esporas cayendo a la vez afectan al rendimiento | Como mucho una por seta destruida y se borran al salir del lienzo; es un array pequeño sin asignaciones por fotograma más allá de él |
| Strict Mode monta dos veces el efecto | `destroy()` cancela `requestAnimationFrame`, quita las escuchas de `window` y marca `destroyed` |
| El disparo atraviesa algo en un fotograma largo | Subpasos de 8 px y `dt` con tope de 50 ms |
| Tras pulsar PAUSA, `Espacio` activa el botón enfocado | `preventDefault` en `keydown` y `keyup` de las teclas consumidas mientras se juega |
| Los temporizadores avanzan durante la pausa (brote, recarga) | Todos dependen del `dt` de juego, que no corre en pausa; criterio de aceptación |
| La segunda línea del HUD no se lee a 390 px | Fuente de 14 px lógicos y barra de 240 px; criterio de aceptación en móvil |
| Con `cacheComponents: true`, leer el ranking sin `<Suspense>` rompe el prerrenderizado | Se reutilizan los `<Suspense>` de `/salon` y de la ficha |
| El motor accede al DOM al importarse | Todo acceso ocurre dentro de `createCiempiesGame`, llamado desde `useEffect` |

---

## Qué **no** está en este spec

- Munición y multiplicador en la barra de React.
- Skins y botón SKIN (spec propia de `skin-designer`).
- Sonido, pulga, escorpión, setas envenenadas y cabezas extra en la zona del jugador.
- Tipos de munición, mejoras o tienda.
- La variante clásica (`01-juego-ciempies-clasico.md`).
- Generalizar `GamePlayer` hacia un registro de juegos.
- Teclas `P` y `Escape` de pausa.
- Autenticación real, anti-trampas, realtime y paginación del ranking.
- Tests automatizados.

Cada uno de ellos, si se aborda, va en su propio spec.
