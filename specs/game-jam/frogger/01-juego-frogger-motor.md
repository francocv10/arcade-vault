# GJ FROGGER 01 — Juego FROGGER jugable en la plataforma (motor de canvas)

> **Status:** Borrador
> **Depends on:** SPEC 06 (patrón de motor de canvas y reproductor), SPEC 07 (tablas `games` y `scores`, aún sin tocar aquí), SPEC 08 (snapshot y canvas por `gameId`), SPEC 09 (3 vidas, niveles y modal de fin de juego), SPEC 10 (cuarto juego real y último de la plataforma)
> **Date:** 2026-10-28
> **Objective:** Diseñar desde cero un Frogger de canvas en TypeScript con carriles de coches, troncos y tortugas, colisiones por zona, 3 vidas y niveles, publicarlo como el juego `frogger` y conectarlo a `GamePlayer`, con el guardado de puntuaciones todavía en `localStorage`.

---

## Por qué existe este spec

Hoy `asteroides`, `tetris`, `arkanoid` y `snake` son juegos reales y ninguno es verde. El catálogo tiene una maqueta de Frogger, `ranaria` (ARCADE, verde, portada `.cover-rana`), pero es ficticia: simula puntos con `setInterval`. Este spec crea el juego real. Es el primero cuya mecánica es **cruzar** (no disparar, no rebotar, no comer) y el primero que exige tres cosas nuevas:

- **Carriles** con objetos que se desplazan a distinta velocidad y en distinto sentido.
- **Soportes móviles** (troncos y tortugas) que transportan a la rana.
- **Colisión por zona:** cada franja del tablero tiene su propia regla (la carretera mata por contacto, el río mata por ausencia de soporte, la mediana y la salida son seguras, la meta tiene bahías).

No hay juego de referencia en `references/started-games/`, así que reglas, constantes y aspecto se fijan aquí. `ranaria` queda intacta: `frogger` es una entrada nueva con su propia portada `.cover-rana-real`, igual que `snake` frente a `serpentina`.

Este spec solo cubre el motor y el reproductor. El alta en Supabase y los rankings reales van en `02-juego-frogger-ranking.md`; mientras tanto GUARDAR PUNTUACIÓN usa `localStorage`, como las maquetas. No hay sonido en ningún spec de este juego: se añadirá más adelante en un spec propio.

---

## Alcance

**In:**

- Entrada nueva `frogger` **al final** de `GAMES` en `app/data/games.ts` (así `GAMES.slice(0, 6)` del Home no cambia) y portada CSS nueva `.cover-rana-real` en `app/globals.css`, diseñada con `/frontend-design`, en estética arcade/neón verde y distinta de `.cover-rana`.
- Motor del juego en `app/games/frogger/`: tablero de 16×15 casillas de 50×40 px, 14 filas jugables más una franja de temporizador, 5 carriles de carretera, 6 de río, mediana, orilla de salida y meta con 5 bahías; rana que salta casilla a casilla; coches y camiones; troncos; tortugas que se sumergen desde el nivel 2; temporizador de 30 s por intento; 3 vidas; niveles con velocidad creciente.
- Colisión por zona: atropello en carretera, ahogamiento en río, arrastre fuera de la pantalla, muro o bahía ocupada en la meta y tiempo agotado.
- Aspecto neón de la plataforma dibujado en canvas, sin assets.
- Barra de tiempo del intento dibujada en la franja inferior del canvas, y pantalla de GAME OVER («GAME OVER» y «Puntuación: N») sobre un velo semitransparente, sin botón propio. No hay más HUD en el canvas.
- Control con `←` `↑` `→` `↓` y con `W` `A` `S` `D`, un salto por pulsación.
- Lienzo lógico de 800×600, escalado con CSS para llenar `.crt-screen`.
- Componente cliente `app/components/frogger-canvas.tsx`, calcado de `snake-canvas.tsx`: monta el canvas, crea el motor en `useEffect`, lo destruye al desmontar (seguro con Strict Mode) y lo controla por `paused` y `restartKey`.
- Rama `gameId === "frogger"` en `GamePlayer`: canvas en lugar de la arena de CSS, sin el `setInterval` de puntos falsos, barra `player-hud` con SCORE, VIDAS (3 a 0) y NIVEL reales, PAUSA/REANUDAR, FIN, modal automático en `gameover`, JUGAR DE NUEVO y SALIR. El guardado sigue en `localStorage`.
- CSS para que el canvas llene `.crt-screen` bajo las capas de líneas de escaneo y viñeta (clase `.frogger-canvas`).

**Out of scope (para futuros specs):**

- Ranking real en Supabase, alta en `games` y `JUEGOS_CON_RANKING` (spec `02-juego-frogger-ranking.md`).
- Sonido y música, de cualquier tipo (ni archivos ni WebAudio). El usuario lo implementará después.
- Generalizar `GamePlayer` hacia un registro de juegos (decisión cerrada).
- Controles táctiles, ratón, pausa con teclado (`P`, `Escape`, `Espacio`) y selector de nivel.
- Moscas bonus, cocodrilos, serpientes, nutrias, vidas extra, victoria (`win`) o final del juego.
- Assets o sprites (todo se dibuja con formas en canvas).
- Autenticación real, anti-trampas, realtime y paginación.
- Tocar la maqueta `ranaria` o las demás maquetas.
- Tests automatizados.

---

## Modelo de datos

Ficha del catálogo (mismo tipo `Juego` de SPEC 01):

```ts
{
  id: "frogger",
  title: "FROGGER",
  short: "Cruza la carretera y salta de tronco en tronco.",
  long: "Guía a la rana con las flechas o WASD desde la orilla hasta los nenúfares. Esquiva coches y camiones, salta sobre troncos y tortugas para cruzar el río y llega a los cinco nenúfares antes de que se acabe el tiempo. Tienes 3 vidas y cada nivel va más rápido.",
  cat: "ARCADE",
  cover: "cover-rana-real",
  color: "green",
  best: 0,
  plays: "0",
}
```

Contrato entre el motor y React (`app/games/frogger/types.ts`):

```ts
export type EstadoFrogger = "playing" | "gameover";

export interface SnapshotFrogger {
  score: number; // entero 0..1_000_000 (tope en el motor)
  lives: number; // 3 a 0
  level: number; // 1 en adelante, sin tope
  status: EstadoFrogger;
}

export interface JuegoFrogger {
  pause(): void;
  resume(): void;
  restart(): void;
  destroy(): void;
}

export function createFroggerGame(
  canvas: HTMLCanvasElement,
  onChange: (snapshot: SnapshotFrogger) => void,
): JuegoFrogger;
```

Módulos de `app/games/frogger/` (lógica pura y sin acceder a `document` ni a `window` al importarse):

- `lanes.ts`: constantes del tablero (`COLS`, `ROWS`, `CELL_W`, `CELL_H`), el tipo `Carril`, la tabla `CARRILES` con los 11 carriles, `BAHIAS`, `multiplicadorVelocidad(nivel)`, `posicionObjeto(carril, indice, desfase)` y `tortugaSostiene(tiempo, indice)`.
- `zones.ts`: `zonaDeFila(fila)`, `colisionaConVehiculo(carril, desfase, ranaX)`, `soporteBajoRana(carril, desfase, ranaX, tiempo)` (devuelve el índice del objeto que sostiene o `-1`) y `bahiaEn(ranaX)` (índice de bahía o `-1`).
- `draw.ts`: funciones de dibujo que reciben el contexto y el estado por parámetro.
- `game.ts`: `createFroggerGame`.

Tipo de carril (en `lanes.ts`):

```ts
export type Carril = {
  fila: number; // 1..12
  tipo: "coche" | "camion" | "tronco" | "tortuga";
  dir: 1 | -1; // 1 = hacia la derecha
  vel: number; // casillas por segundo en el nivel 1
  largo: number; // casillas que ocupa cada objeto
  cuantos: number; // objetos del carril
  paso: number; // casillas entre el inicio de un objeto y el del siguiente
};
```

Tabla `CARRILES` (la longitud del bucle de un carril es `cuantos × paso` casillas y siempre es ≥ 16 + `largo`, así que no hay huecos de aparición):

| Fila | Zona      | Tipo    | Dir | Vel (casillas/s) | Largo | Cuántos | Paso |
| ---- | --------- | ------- | --- | ---------------- | ----- | ------- | ---- |
| 1    | río       | tronco  | -1  | 2,0              | 3     | 4       | 5    |
| 2    | río       | tortuga | 1   | 1,5              | 3     | 4       | 6    |
| 3    | río       | tronco  | -1  | 1,0              | 4     | 3       | 7    |
| 4    | río       | tronco  | 1   | 2,5              | 5     | 3       | 7    |
| 5    | río       | tortuga | -1  | 2,0              | 2     | 4       | 5    |
| 6    | río       | tronco  | 1   | 1,5              | 3     | 4       | 5    |
| 8    | carretera | camion  | -1  | 2,5              | 3     | 3       | 8    |
| 9    | carretera | coche   | 1   | 4,0              | 1     | 3       | 7    |
| 10   | carretera | camion  | -1  | 1,5              | 2     | 3       | 7    |
| 11   | carretera | coche   | 1   | 3,0              | 1     | 3       | 7    |
| 12   | carretera | coche   | -1  | 2,0              | 1     | 4       | 5    |

Mapa de filas (la fila 0 está arriba; la fila `r` ocupa `y = r × 40`):

| Fila   | Zona      | Regla                                                  |
| ------ | --------- | ------------------------------------------------------ |
| 0      | meta      | 5 bahías de 2 casillas; el resto es muro               |
| 1 a 6  | río       | muere si no hay un tronco o tortuga firme bajo la rana |
| 7      | mediana   | segura                                                 |
| 8 a 12 | carretera | muere al tocar un vehículo                             |
| 13     | salida    | segura; la rana aparece aquí                           |
| 14     | tiempo    | no jugable: barra del temporizador                     |

Bahías (`BAHIAS`): 5 intervalos en píxeles `[x, x + 100)` con `x = (1 + 3k) × 50` para `k = 0..4`, es decir `[50,150)`, `[200,300)`, `[350,450)`, `[500,600)` y `[650,750)`.

Estado interno del motor (no se expone):

```ts
// rana: { x: number (centro, px), fila: number (0..13), vx: number, vy: number (posición visual para la animación) }
// desfases: number[] (px recorridos por cada carril, módulo la longitud de su bucle)
// bahiasLlenas: boolean[5]; reloj: number (s, avanza con dt, para las tortugas)
// tiempoRestante: number (s); filaMax: number (fila más alta alcanzada en este intento)
// score, lives, level, status: 'playing' | 'gameover'; muerte: { causa, restante } | null; paused
```

Base de datos: este spec no introduce datos nuevos ni toca Supabase. El guardado reutiliza el de las maquetas (`localStorage`).

Convenciones:

- `onChange` se llama al arrancar y solo cuando cambia algún valor del snapshot, nunca por fotograma. Un salto sin puntos no lo dispara.
- Tablero: `COLS = 16`, `ROWS = 15`, `CELL_W = 50`, `CELL_H = 40`; 800×600 exacto, sin márgenes. Origen arriba a la izquierda.
- Rana: hitbox de 30×24 px centrada en `(x, fila × 40 + 20)`. Aparece en la fila 13 con `x = 425` (centro de la columna 8). Los centros de las columnas son `25 + 50 × columna`.
- Salto: una pulsación mueve la rana una casilla (±50 px en `x`, ±1 en `fila`). El estado lógico cambia al instante y la posición dibujada se interpola en 90 ms. Se ignora la repetición de teclado (`e.repeat`) y cualquier salto que deje el centro fuera de `[25, 775]`, que suba de la fila 0 o baje de la fila 13. No hay cola de saltos: cada pulsación se aplica desde el estado lógico actual.
- Movimiento de carriles: cada carril acumula un desfase `desfase += dir × vel × multiplicador × 50 × dt` (px). El objeto `i` está en `x = ((desfase + i × paso × 50) mod (cuantos × paso × 50)) − largo × 50`. El desfase solo avanza mientras el juego no está en pausa ni en `gameover`; sí avanza durante la animación de muerte.
- Velocidad por nivel: `multiplicadorVelocidad(nivel) = min(2, 1 + 0,1 × (nivel − 1))` (tope 2× desde el nivel 11). Afecta a todos los carriles.
- Colisión en carretera (filas 8 a 12): la rana muere si el intervalo `[x − 15, x + 15]` solapa con `[xv + 4, xv + largo × 50 − 4]` de algún vehículo de su carril. Se comprueba cada fotograma, incluso si el vehículo la alcanza por detrás.
- Colisión en río (filas 1 a 6): la rana muere («agua») si su centro `x` no cae dentro de `[xo, xo + largo × 50]` de algún tronco o de alguna tortuga que sostenga en ese instante. Si lo hay, la rana se desplaza con él: `x += dir × vel × multiplicador × 50 × dt`. Si `x` sale de `[0, 800]`, muere («pantalla»).
- Tortugas: desde el nivel 2 cada tortuga repite un ciclo de 6 s con su propio desfase `i × 2` s: `[0, 3,5)` emergida, `[3,5, 4,5)` hundiéndose (parpadea, aún sostiene), `[4,5, 5,5)` sumergida (no sostiene) y `[5,5, 6)` emergiendo (parpadea, ya sostiene). En el nivel 1 siempre están emergidas.
- Meta (fila 0): al aterrizar en la fila 0, si el centro cae en una bahía libre, esa bahía se llena y la rana reaparece; si cae en el muro o en una bahía ya llena, muere («muro»).
- Mediana y salida (filas 7 y 13): seguras, sin transporte.
- Temporizador: 30 s por intento. Se reinicia al reaparecer; al llegar a 0 muere («tiempo»). Sigue corriendo mientras la rana está viva y se detiene con la pausa. La barra ocupa `y = 560..600`; es verde, pasa a amarilla por debajo de 15 s y a roja por debajo de 8 s, con la etiqueta «TIEMPO N» (segundos enteros hacia arriba).
- Muerte: se pierde una vida al instante (`lives − 1`, `onChange`), la rana se dibuja como una X roja durante 800 ms ignorando el teclado y luego reaparece en la fila 13 con `x = 425`, el temporizador a 30 s y `filaMax = 13`. Si `lives` llega a 0, el estado pasa a `gameover` en el mismo instante y no hay reaparición.
- Puntuación: 10 puntos al llegar por primera vez en un intento a una fila de índice menor que `filaMax` (hasta la fila 0 inclusive, 13 filas); 50 puntos por llenar una bahía más 10 por cada segundo entero que reste en el temporizador; 1.000 puntos al llenar la quinta bahía. Volver atrás no resta ni vuelve a puntuar. El snapshot lleva `min(score, 1_000_000)`.
- Nivel: al llenar la quinta bahía se suma 1.000, `level + 1`, las bahías se vacían y la rana reaparece. Los niveles no tienen fin: no hay `win`.
- Máximo por intento: 13 × 10 + 50 + 30 × 10 = 480 puntos; por nivel: 5 × 480 + 1.000 = 3.400.
- Teclado en `window`: flechas y `WASD` (lee `e.key` en minúscula). Se ignoran los eventos de `input`, `textarea` y `select`, los de Ctrl/Meta/Alt, la pausa y `gameover`. `preventDefault` de las teclas de juego solo mientras se juega; el motor cancela también el `keyup` de las teclas que consumió (Espacio incluido) para que no activen el botón enfocado.
- Bucle: `requestAnimationFrame`, `dt` limitado a 50 ms y `lastTime` reiniciado al reanudar.
- Dibujo (paleta neón): fondo `#05060f`; carretera `#11131f` con rayas discontinuas `rgba(255,255,255,0.25)` entre carriles; río `#052b44` con ondas `#00e5ff` tenues; mediana, salida y muro `#0b2a14` con borde `#39ff14`; coches en `#ff2bd6`, `#ffe600` y `#00e5ff` y camiones en `#ff8a00`, todos como rectángulos con borde luminoso (`shadowBlur`); troncos `#7a4a1e` con borde `#ffb35c`; tortugas como óvalos `#2bff88`; nenúfares `#2bff88` y bahía llena con una rana pequeña; rana `#39ff14` con ojos blancos orientados según el último salto. Sin borde propio del canvas.
- Los textos nuevos de la interfaz de React están en español; el canvas usa los de esta spec («TIEMPO N», «GAME OVER», «Puntuación: N»).

---

## Plan de implementación

Antes de escribir código de Next.js, leer en `node_modules/next/dist/docs/01-app/` la guía de Client Components (`"use client"`), según `AGENTS.md`. Para la portada se usa `/frontend-design`, respetando la estética arcade/neón de la plataforma; el contenido del canvas no se rediseña. Cada paso deja el sistema funcional.

1. **Ficha del juego.** Entrada `frogger` al final de `GAMES` y portada `.cover-rana-real` (fondo oscuro, rana verde sobre un nenúfar con líneas de carril, en el estilo de `.cover-asteroides`). Verificación: `/biblioteca`, `/salon`, `/juegos/frogger` y `/juegos/frogger/jugar` cargan sin errores (el reproductor sigue siendo la maqueta); `/home` no cambia; `ranaria` sigue con su ficha y su portada `.cover-rana`.
2. **Datos puros.** `app/games/frogger/lanes.ts` y `zones.ts`: constantes, tabla `CARRILES`, `BAHIAS` y funciones de posición, soporte, colisión y bahía. Verificación: `npx tsc --noEmit` y `npm run lint`; cada carril cumple `cuantos × paso ≥ 16 + largo` y hay 11 carriles.
3. **Motor.** `types.ts` y `game.ts` con `createFroggerGame`: teclado, bucle `requestAnimationFrame`, movimiento de carriles, salto con interpolación, colisión por zona, arrastre, tortugas, bahías, temporizador, vidas, niveles, puntuación y `pause`/`resume`/`restart`/`destroy` con `onChange`. Verificación: `npx tsc --noEmit` y `npm run lint`.
4. **Dibujo.** `draw.ts` y su uso en `game.ts`: tablero por zonas, vehículos, troncos, tortugas con parpadeo, rana, X de muerte, barra de tiempo y GAME OVER. Verificación: `npx tsc --noEmit` y `npm run lint`.
5. **Componente de canvas.** `app/components/frogger-canvas.tsx` con `<canvas width={800} height={600}>`, clase `.frogger-canvas`, `role="img"` y `aria-label`, y las props `onChange`, `paused` y `restartKey`. Verificación: montado en una ruta de prueba temporal, el juego se ve y se juega; la ruta se elimina antes del paso siguiente.
6. **Integración en el reproductor.** En `app/components/game-player.tsx`, cuando `gameId === "frogger"`: renderizar `FroggerCanvas`, no arrancar el `setInterval` de puntos falsos, alimentar JUGADOR/PUNTUACIÓN/VIDAS/NIVEL con el snapshot (VIDAS inicial 3), abrir el modal al llegar a `gameover`, mantener el guardado de las maquetas (`localStorage`). El tipo del snapshot pasa a ser la unión de los cinco. En `app/globals.css`: `.frogger-canvas` llena el `.crt-screen` (posición absoluta, `inset: 0`, 100 % de ancho y alto) y los pseudo-elementos de líneas de escaneo y viñeta quedan por encima (`z-index: 1`), igual que con `.snake-canvas`. Verificación: partida completa en `/juegos/frogger/jugar` hasta GAME OVER; los otros juegos se comportan igual que antes.

---

## Criterios de aceptación

Verificados con Playwright (Chromium) sobre `npm run dev`, más `npm run lint`, `npx tsc --noEmit` y `npm run build`.

**Global**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] No hay errores en la consola del navegador en `/juegos/frogger/jugar` durante una partida completa ni en `/home`, `/biblioteca`, `/salon`, `/acceso`, `/about` y `/juegos/frogger`.
- [ ] No se crea ningún archivo en `public/` ni se modifica `references/`.

**Ficha y catálogo**

- [ ] `/biblioteca` lista FROGGER con categoría ARCADE, portada `.cover-rana-real` propia y botón verde, y `ranaria` sigue existiendo con su texto, `best: 18900` y portada actuales.
- [ ] `/juegos/frogger` muestra la ficha con `best: 0` y `plays: "0"`, y su botón JUGAR lleva a `/juegos/frogger/jugar`.
- [ ] `/home` muestra las mismas 6 tarjetas de juegos que antes.
- [ ] `/salon` conserva sus pestañas actuales (FROGGER aparece en ellas con el ranking de maqueta hasta el spec 02).

**Jugabilidad**

- [ ] Al cargar `/juegos/frogger/jugar` el canvas (resolución lógica 800×600) llena todo el recuadro del CRT sin franjas ni recortes a 1440, 1024 y 390 px de ancho, con la meta arriba, 6 carriles de río, la mediana, 5 carriles de carretera, la salida y la barra de tiempo abajo.
- [ ] La rana aparece en la fila 13, columna 8 (`x = 425`), con el temporizador en 30 y la barra verde llena.
- [ ] Cada pulsación de `↑` `↓` `←` `→` `W` `S` `A` `D` mueve la rana una casilla (50 px en horizontal, 40 px en vertical); mantener la tecla pulsada no repite el salto.
- [ ] La rana no sale por los lados (el salto se ignora en las columnas 0 y 15), no baja de la fila 13 ni sube de la fila 0.
- [ ] Llegar por primera vez a la fila 12 suma exactamente 10 puntos; volver a la 13 y subir otra vez a la 12 no suma; llegar a la 11 suma 10 más.
- [ ] Tocar un coche o camión en cualquiera de las filas 8 a 12 quita una vida; estar en la fila 7 o 13 con un vehículo en otra fila no la quita.
- [ ] En el río, estar sobre un tronco o una tortuga emergida es seguro y la rana se desplaza con él a su velocidad; saltar a un hueco entre troncos quita una vida.
- [ ] Un tronco que arrastra a la rana fuera de `[0, 800]` quita una vida.
- [ ] En el nivel 1 las tortugas nunca se sumergen; desde el nivel 2 se sumergen cada 6 s (hundiéndose 1 s con parpadeo, sumergidas 1 s) y quitan una vida a la rana que sigue encima.
- [ ] Llegar a la fila 0 en una bahía libre suma 50 puntos más 10 por segundo entero restante, llena la bahía (dibujada con una rana) y reaparece la rana con el temporizador a 30; llegar al muro o a una bahía llena quita una vida.
- [ ] Llenar la quinta bahía suma 1.000, pasa el nivel de 1 a 2, vacía las bahías y reaparece la rana.
- [ ] La velocidad de los carriles sube un 10 % por nivel (nivel 2: 1,1×) y no supera 2× (nivel 11 y siguientes).
- [ ] Al agotarse el temporizador se pierde una vida; la barra pasa a amarilla por debajo de 15 s y a roja por debajo de 8 s.
- [ ] Tras perder una vida la rana se dibuja como una X roja durante 800 ms, ignora el teclado y reaparece en la fila 13 con el temporizador a 30.
- [ ] Con 0 vidas el canvas deja de avanzar y dibuja «GAME OVER» y «Puntuación: N» sobre un velo semitransparente, con la puntuación conservada.
- [ ] Las flechas y `Espacio` no desplazan la página mientras se juega.

**Integración con React**

- [ ] La barra del reproductor muestra PUNTUACIÓN, VIDAS (3, 2, 1 y 0) y NIVEL iguales a los de la partida en todo momento.
- [ ] PAUSA congela los carriles, la rana y el temporizador, muestra «EN PAUSA» y cambia el botón a REANUDAR; REANUDAR continúa sin saltos bruscos de los objetos ni pérdida de tiempo. El canvas no dibuja overlay de pausa.
- [ ] Con el foco en el botón PAUSA, las flechas y `WASD` actúan sobre el juego y no activan ningún botón.
- [ ] Al llegar a GAME OVER el modal «FIN DEL JUEGO» se abre solo con la puntuación real; FIN también lo abre pausando el juego.
- [ ] Con el modal abierto, escribir en el campo de iniciales (incluidas las flechas y las letras `W`, `A`, `S` y `D`) no mueve la rana.
- [ ] JUGAR DE NUEVO cierra el modal y reinicia con 0 puntos, nivel 1, 3 vidas, bahías vacías y la rana en la fila 13.
- [ ] GUARDAR PUNTUACIÓN en `/juegos/frogger/jugar` guarda en `localStorage`, igual que las maquetas, y no crea filas en `scores`.
- [ ] SALIR y VOLVER AL VAULT detienen el bucle: tras navegar no quedan escuchas de teclado ni `requestAnimationFrame` activos (las flechas vuelven a desplazar la página).
- [ ] A 390 px de ancho el canvas se ve completo y escalado dentro del CRT, mantiene la proporción 4:3 y la página no genera desborde horizontal.
- [ ] `/juegos/asteroides/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar` y `/juegos/snake/jugar` conservan su jugabilidad y su guardado, y `/juegos/ranaria/jugar` (y las demás maquetas) conservan la simulación con puntuación al azar.

---

## Decisiones

- **Sí:** dividir el juego en dos specs: motor (esta) y ranking (02). Decisión del usuario. **No:** una tercera spec de extras ni de sonido; el usuario implementará el sonido después.
- **Sí:** entrada nueva `frogger` y dejar `ranaria` intacta, como `snake` frente a `serpentina`. Decisión del usuario. Portada propia `.cover-rana-real`, porque `.cover-rana` ya existe.
- **Sí:** título visible «FROGGER», `cat: ARCADE` y `color: green`. Decisión del usuario (nombre libre «Frogger»). Es el primer juego real verde.
- **Sí:** aspecto neón de la plataforma, dibujado en canvas, sin assets. Decisión del usuario. **No:** sprites ni estilo 16 bits.
- **Sí:** barra de React con SCORE, VIDAS y NIVEL, y en el canvas solo el temporizador. Decisión del usuario. **No:** HUD completo dentro del canvas.
- **Sí:** flechas y `WASD`, un salto por pulsación y pausa solo con el botón de React. Decisión del usuario. **No:** salto continuo al mantener la tecla, ratón ni `P`, `Escape` o `Espacio`.
- **Sí:** sin sonido en ninguna spec. Decisión del usuario.
- **Sí:** reglas de puntos del usuario: 10 por fila nueva, 50 por nenúfar, 10 por segundo sobrante y 1.000 por los 5 nenúfares. Se pierde una vida por atropello, agua, tiempo o salida de pantalla; el muro y las bahías ocupadas también cuestan vida (Recomendación aceptada).
- **Sí:** +10 % de velocidad por nivel con tope de 2× y sin `win`, solo `gameover`. Decisión del usuario. **No:** final tras N niveles.
- **Sí:** los troncos transportan a la rana y las tortugas se sumergen desde el nivel 2, dentro del motor. Decisión del usuario.
- **Sí:** 3 vidas y temporizador de 30 s por intento. Recomendación aceptada; los valores concretos los fija esta spec.
- **Sí:** tablero de 16×15 casillas de 50×40 px, con una franja de 40 px para el temporizador, para llenar 800×600 sin recomponer. **No:** casillas cuadradas, que no cuadrarían con 4:3 y 14 filas más la barra.
- **Sí:** el estado lógico del salto cambia al instante y la animación es solo visual (90 ms). Así las colisiones no dependen de la animación.
- **Sí:** hitbox de la rana más pequeño que la casilla (30×24) y vehículos acortados 4 px por lado, para que la colisión sea justa.
- **Sí:** `score` con tope en `1_000_000` en el snapshot, como Tetris, porque los niveles no tienen fin. **No:** tope de nivel.
- **Sí:** rama `gameId === "frogger"` en `GamePlayer` junto a las otras. **No:** refactorizar hacia un registro de juegos; decisión cerrada.
- **Sí:** entrada al final de `GAMES` para no cambiar las 6 tarjetas del Home ni la pestaña inicial del Salón.
- **Sí:** `best: 0` y `plays: "0"`. **No:** inventar cifras.
- **Sí:** motor TypeScript en `app/games/frogger/` con callback a React; `onChange` solo cuando cambian los valores. **No:** estado de React por fotograma.
- **Sí:** tope de `dt` de 50 ms y reinicio de `lastTime` al reanudar.

---

## Riesgos

| Riesgo                                                                                     | Mitigación                                                                                                                          |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Strict Mode monta dos veces el efecto y quedaría un segundo bucle o escuchas duplicadas    | `destroy()` cancela `requestAnimationFrame` y elimina `keydown`/`keyup` de `window`; criterio de limpieza al salir                  |
| Con `dt` grande una rana en un tronco atraviesa un hueco o un vehículo "salta" a la rana   | `dt` limitado a 50 ms; a 5 casillas/s y 2× eso son como mucho 0,5 casillas, menos que el margen de la hitbox                        |
| La rana muere al aterrizar justo en el borde de un tronco por el redondeo                  | Se evalúa el centro de la rana contra `[xo, xo + largo × 50]`, sin margen negativo; criterio de aceptación sobre troncos            |
| Las tortugas se hunden bajo la rana sin avisar                                             | Fase de hundimiento de 1 s con parpadeo y la rana sigue sostenida en ese tramo                                                      |
| Tras pulsar PAUSA el botón conserva el foco y las flechas o `Espacio` podrían activarlo    | `preventDefault` en `keydown` y `keyup` de las teclas de juego cuando el origen no es un campo editable; hay criterio de aceptación |
| Las letras `W`, `A`, `S` y `D` mueven la rana mientras se escribe en el campo de iniciales | El motor ignora eventos de `input`, `textarea` y `select`; el modal pausa el motor; hay criterio de aceptación                      |
| El `dt` salta al reanudar tras una pausa o al volver a la pestaña                          | Reiniciar `lastTime` al reanudar y limitar `dt` a 50 ms                                                                             |
| `GamePlayer` ya usa la unión de cuatro snapshots y el tipo crece                           | El tipo pasa a la unión de los cinco; los campos comunes son los mismos                                                             |
| El motor usa `document`/`window` y rompe el prerrenderizado                                | Todo el acceso al DOM ocurre dentro de `createFroggerGame`, llamado desde `useEffect`; el componente es `"use client"`              |

---

## Qué **no** está en este spec

- Ranking real, alta en `games` y `JUEGOS_CON_RANKING` (spec `02-juego-frogger-ranking.md`).
- Sonido y música de cualquier tipo.
- Generalizar `GamePlayer` hacia un registro de juegos.
- Controles táctiles, ratón y pausa con teclado.
- Moscas bonus, cocodrilos, serpientes, vidas extra, victoria o final del juego.
- Assets o sprites.
- Autenticación real, anti-trampas, realtime y paginación del ranking.
- Cambiar `ranaria` y las demás maquetas.
- Tests automatizados.

Cada uno de ellos, si se aborda, va en su propio spec.
