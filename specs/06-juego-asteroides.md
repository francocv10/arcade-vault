# SPEC 06 — Juego ASTEROIDES jugable en la plataforma

> **Status:** Aprobado
> **Depends on:** SPEC 01 (catálogo, ficha y reproductor), SPEC 04 (`useDialog` y modal de fin de juego)
> **Date:** 2026-10-19
> **Objective:** Portar el juego Asteroids de `references/started-games/02-asteroids/` a un módulo TypeScript con canvas, publicarlo como el juego nuevo `asteroides` y conectarlo al reproductor existente, que recibe del canvas los puntos, las vidas y el nivel.

---

## Por qué existe este spec

Hoy `GamePlayer` (`app/components/game-player.tsx`) es una maqueta: suma puntos al azar con un `setInterval`, pinta enemigos de CSS y no hay ningún juego real detrás. Asteroids ya está creado como una página suelta (`index.html` + `game.js`, canvas de 800×600, sin dependencias) y hay que adaptarlo a Next.js. Es el primer juego real de la plataforma, así que este spec también fija el patrón que seguirán los siguientes: un motor de canvas en TypeScript que avisa a React de su estado mediante un callback.

El catálogo ya tiene una ficha parecida, `rocas` («Pulveriza asteroides en gravedad cero»). Es un juego ficticio distinto y no se toca: `asteroides` es una entrada nueva.

---

## Alcance

**In:**

- Entrada nueva `asteroides` al final de `GAMES` en `app/data/games.ts` (para que `GAMES.slice(0, 6)` del Home no cambie) y portada CSS nueva `.cover-asteroides` en `app/globals.css`.
- Motor del juego en `app/games/asteroids/`, portado del original sin cambiar la jugabilidad: nave con inercia y envolvimiento toroidal, disparo, asteroides de 3 tamaños que se parten, power-up de disparo triple `3x`, 3 vidas con invencibilidad al reaparecer, niveles con más asteroides y partículas de explosión.
- Aspecto idéntico al original: líneas blancas sobre negro, fuente `monospace`, HUD (SCORE, NIVEL, vidas, contador `3x`) y pantalla «GAME OVER — ESPACIO PARA REINICIAR» dibujados dentro del canvas.
- Componente cliente `app/components/asteroids-canvas.tsx` que monta el canvas de 800×600, arranca el motor y lo destruye al desmontar.
- El motor notifica a React, mediante un callback, los puntos, las vidas, el nivel y el estado. La barra `player-hud` de `GamePlayer` muestra esos valores reales para `asteroides`.
- PAUSA/REANUDAR congela y reanuda el juego; FIN pausa el juego y abre el modal de fin de juego con la puntuación real; GUARDAR PUNTUACIÓN llama a `saveScore({ game: "asteroides", score, name })`; JUGAR DE NUEVO reinicia el juego; SALIR vuelve a la ficha.
- El lienzo llena por completo el recuadro `.crt-screen` del reproductor (pantalla 4:3 fluida del marco CRT, igual que la maqueta actual): resolución lógica 800×600 y escalado con CSS (`width: 100%; height: 100%`), sin barras ni desplazamiento, de modo que el juego luce igual de bien dentro del marco a cualquier ancho.
- Documentar el spec y los archivos nuevos en `CLAUDE.md`.

**Out of scope (para futuros specs):**

- Controles táctiles: en móvil el lienzo se ve completo y escalado, pero el juego solo es jugable con teclado.
- Sonido (el original no tiene).
- Cambios visuales al juego (colores neón, brillos, fuente pixel) y mejoras de jugabilidad (OVNIs, hiperespacio, más power-ups).
- Abrir el modal de guardar puntuación automáticamente al llegar a 0 vidas: queda en el botón FIN.
- Persistencia en Supabase y ranking real: las puntuaciones siguen yendo por `saveScore` a `localStorage`.
- Reemplazar la maqueta de los otros 7 juegos: siguen con el `setInterval` actual.
- Tests automatizados.

---

## Modelo de datos

Entrada nueva del catálogo (mismo tipo `Juego` de SPEC 01):

```ts
{
  id: "asteroides",
  title: "ASTEROIDES",
  short: "Parte rocas en un espacio sin bordes.",
  long: "Tu nave triangular flota en un campo de asteroides sin límites. Rota, propulsa y dispara para partir las rocas grandes en medianas y las medianas en pequeñas. Recoge el power-up 3x para disparar en abanico.",
  cat: "SHOOTER",
  cover: "cover-asteroides",
  color: "cyan",
  best: 0,
  plays: "0",
}
```

Contrato entre el motor y React (`app/games/asteroids/types.ts`):

```ts
export type EstadoAsteroides = "playing" | "dead" | "gameover";

export interface SnapshotAsteroides {
  score: number;
  lives: number;
  level: number;
  status: EstadoAsteroides;
}

export interface JuegoAsteroides {
  pause(): void;
  resume(): void;
  restart(): void;
  destroy(): void;
}

export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  onChange: (snapshot: SnapshotAsteroides) => void,
): JuegoAsteroides;
```

Convenciones:

- `onChange` se llama al arrancar y solo cuando cambia algún valor del snapshot, nunca una vez por fotograma, para no provocar 60 renders por segundo en React.
- Constantes del original sin modificar: canvas 800×600, `dt` limitado a 50 ms, `RADII = [0, 16, 30, 50]`, `SPEEDS = [0, 85, 55, 32]`, `POINTS = [0, 100, 50, 20]` (indexados por tamaño), 3 vidas, `POWERUP_DROP_CHANCE = 0.15`, `POWERUP_DURATION = 5`, `POWERUP_TTL = 12`, `TRIPLE_SPREAD = 0.18`.
- Controles: `←` `→` rotan, `↑` propulsa, `Espacio` dispara (un disparo por pulsación) y reinicia en GAME OVER.
- Las teclas se escuchan en `window`; se ignoran los eventos que vienen de un `input`, `textarea` o `select` y mientras el juego está en pausa.
- Los textos nuevos de la interfaz React están en español; el canvas conserva los del original.

---

## Plan de implementación

Antes de escribir código de Next.js hay que leer en `node_modules/next/dist/docs/01-app/` la guía de Client Components (`"use client"`), según `AGENTS.md`. Para la portada y el contenedor del lienzo se usa `/frontend-design`, respetando la estética arcade/neón de la plataforma; el contenido del canvas no se rediseña.

1. **Ficha del juego.** Añadir la entrada `asteroides` al final de `GAMES` y la portada `.cover-asteroides` (fondo oscuro con rocas y una nave, en el estilo de `.cover-rocas`). Verificación: `/biblioteca`, `/salon`, `/juegos/asteroides` y `/juegos/asteroides/jugar` cargan sin errores (el reproductor sigue siendo la maqueta); `/home` no cambia.
2. **Entidades.** Crear `app/games/asteroids/entities.ts` con `Bullet`, `Asteroid`, `PowerUp`, `Ship` y `Particle`, portadas de `game.js` con tipos y sin acceder a `document`. Cada una recibe el contexto de dibujo y el tamaño del lienzo en lugar de usar globales. Verificación: `npx tsc --noEmit` y `npm run lint` sin errores.
3. **Motor.** Crear `app/games/asteroids/types.ts` y `app/games/asteroids/game.ts` con `createAsteroidsGame`: entrada de teclado, bucle `requestAnimationFrame`, colisiones, niveles, HUD y GAME OVER en canvas, `pause`/`resume`/`restart`/`destroy` y las llamadas a `onChange`. Verificación: `npx tsc --noEmit` y `npm run lint` sin errores.
4. **Componente de canvas.** Crear `app/components/asteroids-canvas.tsx`: `<canvas width={800} height={600}>`, motor creado en `useEffect` y destruido en la limpieza (seguro con el doble montaje de React Strict Mode), y control del motor por props (`paused`, `restartKey`) o por `ref`. Verificación: montado en una ruta de prueba temporal, el juego se ve y se juega; la ruta se elimina antes del paso siguiente.
5. **Integración en el reproductor.** En `app/components/game-player.tsx`, cuando `gameId === "asteroides"`: renderizar `AsteroidsCanvas` en lugar de la arena de CSS, no arrancar el `setInterval` de puntos falsos, alimentar JUGADOR/PUNTUACIÓN/VIDAS/NIVEL con el snapshot, conectar PAUSA/REANUDAR (el aviso «EN PAUSA» actual se mantiene), abrir el modal con FIN pausando el juego, y reiniciar el motor con JUGAR DE NUEVO. En `app/globals.css`: el canvas ocupa todo el `.crt-screen` (posición absoluta, `inset: 0`, 100 % de ancho y alto, `image-rendering` por defecto) y queda bajo las capas de líneas de escaneo y viñeta del marco. Verificación visual contra la captura de referencia: sin franjas, recortes ni bordes propios del canvas (se omite el `border: 1px solid #222` del original). Verificación: partida completa en `/juegos/asteroides/jugar`; los otros 7 juegos se comportan igual que antes.
6. **Documentación.** En `CLAUDE.md`: añadir SPEC 06 a la lista de specs y `app/games/` a la estructura de `app/`. Verificación: `npm run lint` y `npm run build` sin errores.

---

## Criterios de aceptación

Verificados con Playwright (Chromium) sobre `npm run dev`, más `npm run lint` y `npm run build`.

**Global**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] No hay errores en la consola del navegador en `/juegos/asteroides/jugar` durante una partida completa ni en `/home`, `/biblioteca`, `/salon`, `/acceso`, `/about` y `/juegos/asteroides`.
- [ ] La carpeta `references/started-games/02-asteroids/` no se modifica (`git status`).

**Ficha y catálogo**

- [ ] `/biblioteca` lista ASTEROIDES con categoría SHOOTER, portada propia y botón cyan, y `rocas` sigue existiendo con su texto actual.
- [ ] `/juegos/asteroides` muestra la ficha y su botón JUGAR lleva a `/juegos/asteroides/jugar`.
- [ ] `/home` muestra las mismas 6 tarjetas de juegos que antes.
- [ ] Las pestañas de `/salon` incluyen ASTEROIDES y no rompen las demás.

**Jugabilidad**

- [ ] Al cargar `/juegos/asteroides/jugar` aparece el canvas (resolución lógica 800×600) llenando todo el recuadro del CRT, sin franjas ni recortes a 1440, 1024 y 390 px de ancho, con la nave en el centro, 4 asteroides grandes y el HUD del canvas con `SCORE  0`, `NIVEL 1` y 3 iconos de vida.
- [ ] `←` y `→` rotan la nave, `↑` la acelera con inercia y la nave que sale por un borde reaparece por el opuesto.
- [ ] `Espacio` dispara una bala por pulsación (mantenerlo pulsado no repite) con 0,2 s de enfriamiento.
- [ ] Destruir un asteroide grande suma 20 puntos, uno mediano 50 y uno pequeño 100; el grande da dos medianos, el mediano dos pequeños y el pequeño ninguno.
- [ ] Al chocar con un asteroide la nave se destruye, se pierde una vida y reaparece a los 2 s con invencibilidad parpadeante durante 3 s.
- [ ] Al destruir todos los asteroides sube el nivel y aparecen `3 + nivel` asteroides grandes.
- [ ] Recoger el power-up `3x` dispara tres balas en abanico y el HUD muestra la cuenta atrás de 5 s.
- [ ] Al perder la tercera vida el canvas dibuja «GAME OVER» y «PUNTAJE: N — ESPACIO PARA REINICIAR»; `Espacio` reinicia con 0 puntos, 3 vidas y nivel 1.
- [ ] Las flechas y `Espacio` no desplazan la página mientras se juega.
- [ ] El canvas es visualmente igual al original: fondo `#000`, trazos blancos, texto `monospace`.

**Integración con React**

- [ ] La barra del reproductor muestra PUNTUACIÓN, VIDAS y NIVEL iguales a los del HUD del canvas en todo momento, y VIDAS baja de 3 a 0 al perder vidas.
- [ ] PAUSA congela asteroides, balas y power-ups, muestra «EN PAUSA» y cambia el botón a REANUDAR; REANUDAR continúa sin saltos bruscos de posición.
- [ ] Con el foco en el botón PAUSA, pulsar `Espacio` dispara y no activa el botón.
- [ ] FIN pausa el juego y abre el modal «FIN DEL JUEGO» con la puntuación real del canvas.
- [ ] Con el modal abierto, escribir espacios y flechas en el campo de iniciales no mueve la nave ni dispara.
- [ ] GUARDAR PUNTUACIÓN guarda en `localStorage` una entrada con `game: "asteroides"`, la puntuación y el nombre, y muestra «PUNTUACIÓN GUARDADA».
- [ ] JUGAR DE NUEVO cierra el modal y reinicia el juego con 0 puntos, 3 vidas y nivel 1.
- [ ] Al llegar a GAME OVER el modal no se abre solo; sí se abre al pulsar FIN, con la puntuación final.
- [ ] SALIR y VOLVER AL VAULT detienen el bucle: tras navegar no quedan escuchas de teclado ni `requestAnimationFrame` activos (las flechas vuelven a desplazar la página).
- [ ] A 390 px de ancho el canvas se ve completo y escalado dentro del CRT, mantiene la proporción 4:3 y la página no genera desborde horizontal.
- [ ] `/juegos/bloque-buster/jugar` (y los otros juegos) conservan la maqueta con la puntuación al azar.

---

## Decisiones

- **Sí:** entrada nueva `asteroides` y dejar `rocas` intacto. Decisión del usuario: son juegos distintos y la coincidencia de nombre es casual.
- **Sí:** portar a un motor TypeScript en `app/games/asteroids/` en lugar de incrustar `game.js` con `<script>` o un `<iframe>`. Permite tipos, limpieza al desmontar y comunicación con React por callback. **No:** `<iframe>` de `index.html`, que no podría avisar de puntos ni de vidas sin `postMessage` y sacaría el juego del layout.
- **Sí:** el canvas conserva su HUD y su pantalla de GAME OVER, y además notifica a React. Decisión del usuario. Por eso la barra `player-hud` de React duplica la información; es lo esperado.
- **Sí:** aspecto idéntico al original (blanco sobre negro, `monospace`). Decisión del usuario. Los efectos del marco CRT (líneas de escaneo y viñeta de `.crt-screen`) son de la plataforma y no cuentan como cambio del juego.
- **Sí:** resolución lógica 800×600 escalada por CSS para llenar el `.crt-screen` (4:3), porque el usuario pidió que el juego luzca bien en el recuadro del reproductor (captura de referencia). Es la misma proporción del marco, así que no hay deformación. **No:** lienzo fijo de 800 px con scroll horizontal (descartado tras esa petición) ni controles táctiles.
- **Sí:** el modal de guardar puntuación se abre con FIN, no automáticamente. El GAME OVER del canvas reinicia con `Espacio` sin guardar. Es la opción recomendada elegida por el usuario.
- **Sí:** `onChange` solo cuando cambian los valores, no por fotograma. **No:** estado de React actualizado en cada `requestAnimationFrame`.
- **Sí:** abrir el modal pausa el motor y el motor ignora los eventos de teclado que vienen de campos editables, para poder escribir las iniciales sin disparar.
- **Sí:** entrada nueva al final del array `GAMES`. Evita cambiar las 6 tarjetas del Home y la pestaña inicial del Salón.
- **Sí:** `best: 0` y `plays: "0"` en la ficha, porque aún no hay datos reales. **No:** inventar cifras.
- **No:** reemplazar la maqueta de los demás juegos. Cada uno se porta en su propio spec.
- **No:** refactorizar `GamePlayer` hacia un registro genérico de juegos. Con un solo juego real, la rama `gameId === "asteroides"` es suficiente; se generaliza cuando haya un segundo.

---

## Riesgos

| Riesgo                                                                                        | Mitigación                                                                                                                                         |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| React Strict Mode monta dos veces el efecto y quedaría un segundo bucle o escuchas duplicadas | `destroy()` cancela `requestAnimationFrame` y elimina los `keydown`/`keyup` de `window`; criterio de aceptación de limpieza al salir               |
| Tras pulsar PAUSA el botón conserva el foco y `Espacio` lo activaría en lugar de disparar     | `preventDefault` en `keydown` y `keyup` de `Espacio` y flechas cuando el origen no es un campo editable; hay criterio de aceptación para este caso |
| El `dt` salta al reanudar tras una pausa o al volver a la pestaña                             | Se reinicia `lastTime` al reanudar y se mantiene el tope de 50 ms del original                                                                     |
| `onChange` llamado en cada fotograma provoca renders excesivos                                | Comparar con el último snapshot enviado y notificar solo si cambia                                                                                 |
| El canvas escalado se ve borroso o deformado dentro del `.crt-screen`                         | Misma proporción 4:3 que el marco; el canvas se dibuja a 800×600 y solo se escala con CSS; verificación visual a 1440, 1024 y 390 px               |
| El motor usa `document`/`window` y rompe el prerrenderizado                                   | Todo el acceso al DOM ocurre dentro de `useEffect`; el componente es `"use client"`                                                                |
| Las flechas y `Espacio` desplazan la página mientras se juega                                 | `preventDefault` sobre esas teclas solo mientras el motor está activo y no en pausa                                                                |

---

## Qué **no** está en este spec

- Controles táctiles y sonido.
- Cambios de aspecto del juego o nuevas mecánicas (OVNIs, hiperespacio, más power-ups).
- Modal automático al llegar a GAME OVER.
- Guardado de puntuaciones en Supabase o ranking real.
- Portar los demás juegos del catálogo o generalizar el reproductor.
- Cambios en `rocas` y tests automatizados.

Cada uno de ellos, si se aborda, va en su propio spec.
