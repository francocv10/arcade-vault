# SPEC 01 (game-jam boxeo-pixel) — Motor de BOXEO PIXEL jugable en la plataforma

> **Status:** Borrador
> **Depends on:** SPEC 06 (patrón de motor de canvas y reproductor), SPEC 07 (tablas `games` y `scores`), SPEC 09 (estado `win` y vidas que se conservan al ganar), SPEC 10 (juego diseñado desde cero), SPEC 14 (entrada en `CONTROLES_TACTILES`)
> **Date:** 2026-11-03
> **Objective:** Diseñar desde cero un juego de boxeo por rondas contra 5 rivales de la CPU en un motor de canvas en TypeScript, publicarlo como el juego `boxeo-pixel` y conectarlo a `GamePlayer` con `score`, `lives`, `level` y `status`.

---

## Por qué existe este spec

Hoy son juegos reales `asteroides`, `tetris`, `arkanoid`, `snake` y `frogger`, y ninguno es de la categoría VERSUS: la única ficha VERSUS es la maqueta `duelo-pixel` (un Pong ficticio). `references/game-suggestions-todo.md` propone `boxeo-pixel` («combate por rondas con rivales de patrón propio»), el de mayor coste de la categoría, y avisa de que puede requerir dividir la spec. Por eso el trabajo se reparte en tres:

- **SPEC 01 (este)**: el juego completo y jugable (reglas, 5 rivales, motor, canvas, ficha y reproductor).
- **SPEC 02**: alta en `games` y ranking real (`02-juego-boxeo-pixel-ranking.md`).
- **SPEC 03**: sonido y efectos de impacto (`03-juego-boxeo-pixel-extras.md`, en borrador).

Particularidades frente a los juegos anteriores:

- **Sin juego de referencia ni assets.** Todo se dibuja con primitivas de canvas (rectángulos y arcos de pixel-art a escala 4×), como Frogger. No hay `public/games/boxeo-pixel/`.
- **Un jugador contra la CPU con teclado.** Es el primer juego VERSUS real. El rival es una pequeña máquina de estados con un patrón propio por nivel.
- **Vistas de perfil.** El ring se ve de lado: el jugador a la izquierda, el rival a la derecha, un eje de movimiento horizontal. No hay profundidad ni cámara.
- **Las vidas son derribos.** Regla de los tres derribos: cada vez que la salud del jugador llega a 0 pierde una vida y se levanta; con la tercera termina la partida por KO.
- **Estado `win`.** Vencer al quinto rival gana la partida (`status: "win"`), con las vidas que queden, como Arkanoid.
- **HUD de salud en el canvas.** Las barras de salud y el reloj los conoce solo el motor; la barra de React sigue mostrando PUNTUACIÓN, VIDAS y NIVEL.

El catálogo no tiene ninguna ficha con el id `boxeo-pixel`; `duelo-pixel` es otra maqueta y no se toca.

---

## Alcance

**In:**

- Entrada nueva `boxeo-pixel` **al final** de `GAMES` en `app/data/games.ts` (así `GAMES.slice(0, 6)` del Home no cambia) y portada CSS `.cover-boxeo-pixel` en `app/globals.css`, diseñada con `/frontend-design`, en estética arcade/neón (dos guantes pixel-art frente a frente sobre fondo oscuro con cuerdas amarillas).
- Motor del juego en `app/games/boxeo-pixel/`: ring de perfil, jugador y rival, movimiento horizontal, jab, gancho y guardia, daño, salud, reloj de ronda, derribos, KO, decisión por puntos, 5 rivales con patrón propio, puntuación y estados `playing`, `gameover` y `win`.
- HUD dibujado en el canvas: barras de salud de los dos boxeadores, reloj de ronda, nombre del rival y número de ronda, medidor de guardia, carteles «RONDA N», «¡KO!», «DERRIBO», «DECISIÓN», «GAME OVER» y «¡CAMPEÓN!».
- Controles de teclado: `←` `→` (o `A` `D`) para moverse, `↓` (o `S`) para la guardia, `Z` (o `J`) para el jab y `X` (o `K`) para el gancho.
- Lienzo lógico de 800×600 escalado con CSS para llenar `.crt-screen`.
- Componente cliente `app/components/boxeo-pixel-canvas.tsx`, calcado de `frogger-canvas.tsx`: monta el canvas, crea el motor en `useEffect`, lo destruye al desmontar (seguro con Strict Mode) y lo controla por `paused` y `restartKey`.
- Rama `gameId === "boxeo-pixel"` en `GamePlayer`: canvas en lugar de la arena de CSS, sin el `setInterval` de puntos falsos, barra `player-hud` con valores reales, PAUSA/REANUDAR, FIN, modal automático en `gameover` y en `win`, JUGAR DE NUEVO y SALIR.
- Entrada `boxeo-pixel` en `CONTROLES_TACTILES` (`app/games/controles-tactiles.ts`): cruceta `left`, `right` y `down`; A = gancho (`KeyX`), B = jab (`KeyZ`).
- CSS para que el canvas llene `.crt-screen` bajo las capas de escaneo y viñeta (clase `.boxeo-pixel-canvas`).
- El guardado en Supabase **no** está en este spec: hasta la SPEC 02, el modal del reproductor para `boxeo-pixel` no persiste la puntuación (ver «Riesgos»).

**Out of scope (para futuros specs):**

- Alta en `games`, `JUEGOS_CON_RANKING`, `guardarPuntuacion` y rankings (SPEC 02).
- Sonido, música, partículas, temblor de cámara y animación del público (SPEC 03).
- Skins `clasico`/`neon`/`retro` (las escribe `skin-designer` cuando el juego esté implementado; `draw.ts` deja los colores en una constante de módulo para facilitarlo).
- Modo de dos jugadores, selector de rival o de dificultad, esquivas por teclado, golpes al cuerpo y a la cabeza distintos, uppercut, combos encadenados del jugador, cuenta de 10 del rival y mejoras entre rondas.
- Pausa con teclado (`P`, `Escape`, `Espacio`): la pausa es solo el botón de React.
- Autenticación real (`user_id` queda en `NULL`), anti-trampas, realtime y paginación.
- Tests automatizados.

---

## Modelo de datos

Ficha del catálogo (mismo tipo `Juego` de SPEC 01):

```ts
{
  id: "boxeo-pixel",
  title: "BOXEO PIXEL",
  short: "Cinco rivales, tres derribos y un solo cinturón.",
  long: "Sube al ring y vence a cinco rivales con patrones de ataque distintos. Muévete con las flechas o AD, pega jabs con Z y ganchos con X, y cúbrete con la guardia (↓) antes de que se agote. Si tu salud llega a cero te derriban y pierdes una vida; con el tercer derribo, KO. Gana cada ronda por KO o por puntos y conquista el cinturón.",
  cat: "VERSUS",
  cover: "cover-boxeo-pixel",
  color: "yellow",
  best: 0,
  plays: "0",
}
```

Contrato entre el motor y React (`app/games/boxeo-pixel/types.ts`), el mismo patrón que Arkanoid (tres estados):

```ts
export type EstadoBoxeo = "playing" | "gameover" | "win";

export interface SnapshotBoxeo {
  score: number; // entero 0..1_000_000 (el máximo real es muy inferior)
  lives: number; // 3 a 0; se conservan al ganar
  level: number; // 1..5 (rival actual)
  status: EstadoBoxeo;
}

export interface JuegoBoxeo {
  pause(): void;
  resume(): void;
  restart(): void;
  destroy(): void;
}

export function createBoxeoPixelGame(
  canvas: HTMLCanvasElement,
  onChange: (snapshot: SnapshotBoxeo) => void,
): JuegoBoxeo;
```

Módulos de `app/games/boxeo-pixel/` (lógica pura, sin acceder a `document` ni a `window` al importarse):

- `config.ts`: constantes (`RING_X_MIN`, `RING_X_MAX`, `SUELO_Y`, tiempos de ataque, daños, `GUARDIA_MAX_MS`, `GUARDIA_ENFRIAMIENTO_MS`, `DURACION_RONDA_MS`) y los tipos de datos.
- `rivales.ts`: `RIVALES` (los 5 rivales con sus parámetros) y `decidirRival(rival, estado, dt)`, la IA como función pura que devuelve la acción del rival en ese fotograma (se le pasa un `azar: () => number` para poder fijarlo).
- `combate.ts`: `resolverGolpe(atacante, defensor, golpe)` (alcance, guardia, daño, empuje y puntos), `ventanaActiva(golpe, t)` y `puntosPorGolpe`.
- `draw.ts`: `dibujar(ctx, vista)`: ring, público en sombra, boxeadores, HUD y carteles, con una constante `COLORES` de módulo y `resolverFuentePixel()` de `app/games/asteroids/paletas.ts`.
- `game.ts`: `createBoxeoPixelGame`.

Reglas y números (todos son valores de esta spec; no hay juego de referencia):

| Concepto | Valor |
| --- | --- |
| Ring | suelo en `y = 470`; el centro de cada boxeador se mueve en `x` de 100 a 700 |
| Boxeadores | cuerpo de 80 px de ancho; el jugador empieza en `x = 280`, el rival en `x = 520`; siempre se miran |
| Salud | jugador 100 PV; rival `80 + 20 × nivel` (100, 120, 140, 160, 180) |
| Velocidad del jugador | 220 px/s; no se mueve mientras ataca o guarda |
| Jab (`Z`/`J`) | arranque 100 ms, activo 80 ms, recuperación 180 ms (360 ms); alcance 150 px entre centros; daño 6; empuje 12 px; 10 puntos |
| Gancho (`X`/`K`) | arranque 260 ms, activo 100 ms, recuperación 440 ms (800 ms); alcance 140 px; daño 14; empuje 40 px; 30 puntos |
| Guardia (`↓`/`S`) | mientras se mantiene reduce el daño recibido un 75 % (redondeado, mínimo 1); no se puede atacar ni moverse; máximo 1.500 ms seguidos y 1.000 ms de enfriamiento al soltarla o agotarla |
| Golpe al rival en guardia | daño reducido al 25 % (mínimo 1) y 0 puntos |
| Contragolpe | golpear al rival durante su arranque o su fase activa duplica los puntos del golpe |
| Aturdimiento | quien recibe un golpe sin guardia queda aturdido 250 ms (jab) o 450 ms (gancho): no actúa; un golpe recibido aturdido no reinicia el aturdimiento |
| Daño del rival | jab 5 y gancho 12, multiplicados por `1 + 0,1 × (nivel − 1)` y redondeados |
| Ronda | 60 s por combate; el reloj se detiene durante los carteles, la cuenta del derribo y el cartel de final |
| Derribo | salud del jugador a 0: pierde 1 vida, cuenta de 3 s con cartel «DERRIBO», se levanta con 40 PV, el rival conserva su salud y vuelven a sus posiciones iniciales; con 0 vidas, `gameover` |
| KO al rival | salud del rival a 0: gana la ronda; cartel «¡KO!» de 2 s |
| Decisión | al agotarse el reloj gana quien tenga mayor porcentaje de salud; el empate lo gana el jugador. Si gana el jugador, avanza; si pierde, pierde 1 vida y repite la ronda con ambos a salud completa (jugador 100 PV, rival su máximo) |
| Entre rondas | cartel «RONDA N — NOMBRE» de 2,5 s; el jugador recupera 30 PV (tope 100) |
| Fin | ganar la ronda 5 → `status: "win"` y cartel «¡CAMPEÓN!»; 0 vidas → `gameover` |

Rivales (`RIVALES`, nivel = índice + 1; el rival avisa cada ataque con 300 ms de parpadeo antes de su arranque, salvo el 5, que avisa 150 ms):

| Nivel | Nombre | Velocidad | Patrón |
| --- | --- | --- | --- |
| 1 | NOVATO | 140 px/s | Se acerca hasta 150 px y lanza un jab cada 1,4 a 2,2 s; nunca guarda |
| 2 | GUARDIÁN | 160 px/s | Guarda 1 s cada vez que recibe un golpe (reacción 250 ms); tras guardar contraataca con un gancho; pega poco |
| 3 | RÁFAGA | 200 px/s | Combos de 3 jabs seguidos y pausa de 1,2 s; guarda poco |
| 4 | ACORRALADOR | 230 px/s | Avanza sin parar y empuja al jugador hacia la cuerda; prefiere ganchos (60 %); la cuerda impide retroceder más |
| 5 | CAMPEÓN | 260 px/s | Mezcla los cuatro patrones al azar cada 4 s; retrocede 80 px cuando el jugador mantiene la guardia más de 1 s |

Puntuación (suma entera, sin tope; la cota teórica es inferior a 25.000, dentro del `CHECK` de `scores` de 0 a 1.000.000):

- Golpe conectado al rival: jab 10, gancho 30; ×2 si es contragolpe; 0 si está en guardia.
- Ronda ganada por KO: `500 + 100 × nivel` más `segundos restantes × 10`.
- Ronda ganada por decisión: `200 × nivel`.
- Bonus de vidas al ganar una ronda: `vidas × 200`.
- Ganar la ronda 5: +2.000.

Base de datos: este spec no la toca (SPEC 02).

Convenciones:

- `onChange` se llama al arrancar y solo cuando cambia algún valor del snapshot (puntos, vidas, nivel o estado), nunca por fotograma.
- Bucle `requestAnimationFrame` con `dt` limitado a 50 ms y `lastTime` reiniciado al reanudar. Todo cálculo de tiempo usa `dt` acumulado, no `Date.now()`.
- El motor escucha `keydown` y `keyup` en `window`, lee `e.code`, mantiene un conjunto de teclas pulsadas (para el movimiento y la guardia) y dispara los golpes en `keydown` sin `e.repeat`. Ignora eventos de `input`, `textarea` y `select` y las teclas con Ctrl/Meta/Alt, no actúa en pausa ni en `gameover`/`win`, y cancela con `preventDefault` también el `keyup` de las teclas que consumió para que no activen el botón enfocado. Al pausar o perder el foco (`blur`) suelta todas las teclas.
- Un golpe que llega a la vez que otro (mismo fotograma) se resuelve para ambos; el jugador no gana prioridad.
- Los textos de React están en español; los del canvas son los de esta spec («RONDA 1», «¡KO!», «DERRIBO», «DECISIÓN», «GAME OVER», «¡CAMPEÓN!», «Puntuación: N»).

---

## Plan de implementación

Antes de escribir código de Next.js, leer en `node_modules/next/dist/docs/01-app/` la guía de Client Components (`"use client"`), según `AGENTS.md`. Para la portada se usa `/frontend-design`. Cada paso deja el sistema funcional.

1. **Ficha del juego.** Entrada `boxeo-pixel` al final de `GAMES` y portada `.cover-boxeo-pixel`. Verificación: `/biblioteca` (filtro VERSUS incluido), `/juegos/boxeo-pixel` y `/juegos/boxeo-pixel/jugar` cargan sin errores con el reproductor como maqueta; `/home` no cambia; `duelo-pixel` sigue igual.
2. **Constantes y lógica pura.** `config.ts`, `combate.ts` y `rivales.ts`. Verificación: `npx tsc --noEmit` y `npm run lint`; con una comprobación temporal en un script de Node (no se versiona) un jab a 140 px de distancia impacta y a 160 px no, un gancho con guardia causa 3 de daño, y el contragolpe devuelve el doble de puntos.
3. **Dibujo.** `draw.ts` con ring, boxeadores en cada pose (reposo, jab, gancho, guardia, aturdido, caído), HUD y carteles. Verificación: `npx tsc --noEmit` y `npm run lint`.
4. **Motor.** `types.ts` y `game.ts`: entrada, bucle, fases (`anuncio`, `combate`, `derribo`, `final`), IA, derribos, KO, decisión, puntuación, `pause`/`resume`/`restart`/`destroy` y `onChange`. Verificación: `npx tsc --noEmit` y `npm run lint`.
5. **Componente de canvas.** `app/components/boxeo-pixel-canvas.tsx` con `<canvas width={800} height={600}>`, clase `.boxeo-pixel-canvas`, `role="img"`, `aria-label` y las props `onChange`, `paused` y `restartKey`. Verificación: montado en una ruta de prueba temporal el juego se ve y se juega; la ruta se elimina antes del paso siguiente.
6. **Integración en el reproductor.** En `app/components/game-player.tsx`, rama `gameId === "boxeo-pixel"` con el mismo patrón que `snake` y `arkanoid` (VIDAS inicial 3; el modal se abre en `gameover` y en `win`; el snapshot pasa a la unión de los seis); entrada en `CONTROLES_TACTILES`; en `app/globals.css`, `.boxeo-pixel-canvas` llena el `.crt-screen` (posición absoluta, `inset: 0`, 100 % de ancho y alto) y los pseudo-elementos de escaneo y viñeta quedan por encima (`z-index: 1`). Sin `mix-blend-mode`, `filter` ni animaciones de `background-position` sobre el canvas (spec 17). Verificación: partida completa hasta GAME OVER y hasta «¡CAMPEÓN!» (con las pruebas de más abajo); los otros 5 juegos reales y las maquetas se comportan igual.
7. **Documentación.** En `CLAUDE.md`: añadir la spec a la lista y `app/games/boxeo-pixel/` y `boxeo-pixel-canvas.tsx` a la estructura. Verificación: `npm run lint` y `npm run build`.

---

## Criterios de aceptación

Verificados con Playwright (Chromium) sobre `npm run dev`, más `npm run lint`, `npx tsc --noEmit` y `npm run build`.

**Global**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] No hay errores en la consola del navegador en `/juegos/boxeo-pixel/jugar` durante una partida completa ni en `/home`, `/biblioteca`, `/salon`, `/acceso`, `/about` y `/juegos/boxeo-pixel`.
- [ ] No se añade ningún archivo en `public/` ni se modifican `references/` ni otros motores.

**Ficha y catálogo**

- [ ] `/biblioteca` lista BOXEO PIXEL con categoría VERSUS, portada `.cover-boxeo-pixel` propia y botón amarillo, y `duelo-pixel` sigue con su texto y portada actuales.
- [ ] `/juegos/boxeo-pixel` muestra la ficha y su botón JUGAR lleva a `/juegos/boxeo-pixel/jugar`.
- [ ] `/home` muestra las mismas 6 tarjetas de juegos que antes.

**Jugabilidad**

- [ ] Al cargar `/juegos/boxeo-pixel/jugar` aparece el canvas (800×600 lógico) llenando el CRT sin franjas a 1440, 1024 y 390 px de ancho, con el cartel «RONDA 1 — NOVATO» durante 2,5 s, el jugador en `x = 280`, el rival en `x = 520`, las barras de salud llenas (100 y 100 PV) y el reloj en 60.
- [ ] `←`/`A` y `→`/`D` mueven al jugador a 220 px/s (±1 fotograma) sin salir de `x = 100` a `700`; los boxeadores no se atraviesan (el centro no baja de 80 px del rival).
- [ ] `Z`/`J` lanza un jab de 360 ms: impacta a 150 px o menos y no a más; quita 6 PV al rival y suma 10 puntos. `X`/`K` lanza un gancho de 800 ms que quita 14 PV y suma 30.
- [ ] No se puede atacar mientras se ataca, se guarda o se está aturdido; mantener `Z` no repite el golpe.
- [ ] La guardia (`↓`/`S`) reduce el daño recibido un 75 %, se agota a los 1.500 ms (el medidor se vacía) y no se puede reactivar hasta pasados 1.000 ms.
- [ ] Un golpe al rival durante su arranque o fase activa suma el doble de puntos (contragolpe); un golpe contra su guardia suma 0 y quita el 25 % del daño (mínimo 1).
- [ ] Los 5 rivales se comportan según la tabla: NOVATO solo da jabs sin guardia; GUARDIÁN guarda y contraataca con gancho; RÁFAGA lanza 3 jabs y pausa 1,2 s; ACORRALADOR avanza sin parar y empuja al jugador; CAMPEÓN alterna patrones y retrocede ante una guardia larga. Cada ataque del rival parpadea 300 ms antes (150 ms el campeón).
- [ ] Reducir la salud del rival a 0 muestra «¡KO!» 2 s, suma `500 + 100 × nivel` más `segundos restantes × 10` más `vidas × 200`, y pasa a la ronda siguiente con +30 PV para el jugador (tope 100) y el reloj en 60.
- [ ] Al agotarse el reloj gana quien tenga mayor porcentaje de salud (empate: el jugador). Ganar así suma `200 × nivel` más `vidas × 200`; perder resta 1 vida y repite la ronda con ambos a salud completa.
- [ ] Que la salud del jugador llegue a 0 muestra «DERRIBO» con cuenta de 3 s, resta 1 vida (`♥` en la barra), lo levanta con 40 PV, devuelve a ambos a sus posiciones y conserva la salud del rival. El reloj no corre durante la cuenta.
- [ ] Con el tercer derribo la partida pasa a `gameover`: el canvas deja de avanzar y dibuja «GAME OVER» y «Puntuación: N» sobre un velo semitransparente.
- [ ] Ganar la ronda 5 suma además 2.000, pasa a `win`, dibuja «¡CAMPEÓN!» y «Puntuación: N», y conserva las vidas restantes.
- [ ] Las flechas y `Espacio` no desplazan la página mientras se juega.

**Integración con React**

- [ ] La barra del reproductor muestra PUNTUACIÓN, VIDAS (`♥ ♥ ♥`, una menos por derribo) y NIVEL (1 a 5) iguales a los del motor en todo momento.
- [ ] PAUSA congela el reloj, los boxeadores y la IA, y suelta las teclas (si se mantenía `←`, al reanudar el jugador no sigue andando); REANUDAR continúa sin saltos.
- [ ] Con el foco en el botón PAUSA, las flechas, `ZXJK` y `WASD` actúan sobre el juego y no activan ningún botón.
- [ ] Al llegar a `gameover` o `win` el modal «FIN DEL JUEGO» se abre solo con la puntuación real; FIN lo abre pausando el juego.
- [ ] Con el modal abierto, escribir en el campo de iniciales (incluidas `A`, `D`, `S`, `Z`, `X`, `J` y `K`) no mueve ni golpea.
- [ ] JUGAR DE NUEVO reinicia con 0 puntos, nivel 1, 3 vidas y el cartel «RONDA 1 — NOVATO».
- [ ] SALIR y VOLVER AL VAULT detienen el bucle: tras navegar no quedan escuchas de teclado ni `requestAnimationFrame` activos.
- [ ] A 390 px de ancho el canvas se ve completo con proporción 4:3 y sin desborde horizontal; con `pointer: coarse` aparece la consola táctil con cruceta de 3 direcciones (`←` `→` `↓`) y A (gancho) y B (jab) activos, y los botones manejan el juego.
- [ ] El render de React no se dispara por fotograma: el contador de re-renders de `GamePlayer` solo sube con cambios del snapshot o acciones del usuario.
- [ ] `/juegos/asteroides/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar`, `/juegos/snake/jugar` y `/juegos/frogger/jugar` conservan su jugabilidad y `/juegos/duelo-pixel/jugar` (y las demás maquetas) conservan la simulación al azar.

---

## Decisiones

**Definición rápida sin aclaraciones detalladas.** El agente `game-jam` nocturno no puede preguntar al usuario: las decisiones siguientes se tomaron por defecto, priorizando la opción recomendada. El usuario puede cambiarlas al revisar el borrador.

- **Sí:** un solo spec para el motor completo y dos specs aparte (ranking y extras), porque la sugerencia del planificador pedía dividir. **No:** meter el ranking en este spec.
- **Sí:** `id` `boxeo-pixel`, categoría VERSUS, color amarillo (el que sugiere el registro) y entrada al final de `GAMES` (el Home no cambia). **No:** tocar `duelo-pixel`.
- **Sí:** vista de perfil con ejes horizontales. **No:** vista cenital, ni profundidad, ni cámara, que exigen más sprites y colisiones 2D.
- **Sí:** todo dibujado con primitivas de canvas y sin assets. **No:** spritesheet.
- **Sí:** estilo visual pixel-art a escala 4×, con fondo oscuro y público en sombra. Decisión de aspecto fijada por defecto; los colores quedan en una constante para las skins posteriores.
- **Sí:** tres acciones (jab, gancho, guardia) y dos botones de acción en móvil. **No:** esquivas, cabeza y cuerpo, ni uppercut.
- **Sí:** teclado `←` `→` `↓` más `A` `D` `S` y `Z`/`X` más `J`/`K`; la pausa es solo el botón de React, como en Tetris y Snake. **No:** `Espacio` ni `P`.
- **Sí:** guardia con límite de 1,5 s y enfriamiento de 1 s, para que quedarse agachado no sea una estrategia ganadora.
- **Sí:** 3 vidas = 3 derribos, con `lives: 3 → 0` en el snapshot. **No:** una vida ni vidas infinitas.
- **Sí:** 5 rondas, una por rival, y `level` = rival actual. Estado `win` al vencer al último, con vidas conservadas como Arkanoid. **No:** rondas infinitas, que obligarían a inventar rivales sin fin.
- **Sí:** ronda de 60 s con decisión por puntos (el empate lo gana el jugador) y repetición de la ronda si se pierde. **No:** `gameover` inmediato por perder una decisión.
- **Sí:** puntuación por golpe, contragolpe, KO, tiempo, vidas y victoria final, sin tope porque la cota (menos de 25.000) cabe en el `CHECK`.
- **Sí:** HUD de salud y reloj en el canvas, y PUNTUACIÓN/VIDAS/NIVEL en React. **No:** enviar la salud a React por fotograma.
- **Sí:** `onChange` solo cuando cambian los valores y `dt` limitado a 50 ms. **No:** estado de React por fotograma.
- **Sí:** sin sonido en este spec (SPEC 03). **No:** WebAudio aquí.
- **Sí:** entrada táctil: A = gancho, B = jab, sin auto-repetición (el motor lee las teclas mantenidas).
- **Sí:** el rival avisa cada ataque con un parpadeo para que ganar sea cuestión de lectura y reflejos, no de azar.
- **Sí:** daño del rival escala un 10 % por nivel; la salud del rival crece 20 PV por nivel.
- **Sí:** todos los números de la tabla son un punto de partida para afinar al probar el juego; si alguno hace injugable un rival, se corrige en el spec antes de aprobar.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El combate resulta injusto o aburrido (rivales muy fáciles o imposibles) | Los números están en `config.ts` y `rivales.ts`; el parpadeo de aviso y el aturdimiento dan margen de reacción; se afinan con partidas de prueba antes de pasar a `Implementado` |
| El jugador abusa de la guardia o del retroceso | Guardia limitada a 1,5 s con enfriamiento de 1 s; el ACORRALADOR y el CAMPEÓN presionan; el reloj fuerza la decisión por puntos |
| Strict Mode monta dos veces el efecto y quedan dos bucles o escuchas duplicadas | `destroy()` cancela `requestAnimationFrame` y elimina `keydown`/`keyup`/`blur`; criterio de limpieza al salir |
| Teclas «pegadas» tras pausar, abrir el modal o cambiar de pestaña | Se sueltan todas las teclas al pausar, en `blur` y al ocultarse la pestaña; hay criterio de aceptación |
| `Z`/`X` activan el botón enfocado de la barra | `preventDefault` también en `keyup` de las teclas consumidas |
| Hasta la SPEC 02 el modal de fin de juego no persiste la puntuación y parece un fallo | La rama de `GamePlayer` muestra el modal con la puntuación y sin llamar a `guardarPuntuacion`; la SPEC 02 es el siguiente paso inmediato y no debe fusionarse la 01 sola en producción |
| El tipo del snapshot en `GamePlayer` sigue creciendo | Pasa a la unión de los seis; los campos comunes son los mismos; refactorizar a un registro de juegos queda para otro spec |
| Strict Mode o la IA usan `Math.random` y hacen la prueba no reproducible | `decidirRival` recibe `azar` por parámetro; las comprobaciones puras lo fijan |
| El motor usa `document`/`window` y rompe el prerrenderizado | Todo el acceso al DOM ocurre dentro de `createBoxeoPixelGame`, llamado desde `useEffect`; el componente es `"use client"` |
| Las capas CSS sobre el canvas bajan los fotogramas (spec 17) | No se añaden `mix-blend-mode`, `filter` ni animaciones de fondo; si baja de fps se aplica `references/performance-review.md` con `perf-auditor` |

---

## Qué **no** está en este spec

- Alta en Supabase, `JUEGOS_CON_RANKING`, guardado y rankings (SPEC 02).
- Sonido, efectos de impacto y animación del público (SPEC 03).
- Skins, dos jugadores, selección de rival, dificultad, uppercut, esquivas y cuenta de 10.
- Generalizar `GamePlayer` hacia un registro de juegos.
- Autenticación real, anti-trampas, realtime y paginación del ranking.
- Tests automatizados.

Cada uno de ellos, si se aborda, va en su propio spec.
