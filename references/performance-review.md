# Revisión de rendimiento

Informe de la spec 17 (`specs/17-rendimiento-frogger.md`). Método reutilizable para las specs de rendimiento de los demás juegos.

## Metodología

- **Ruta:** `/juegos/frogger/jugar`, sin tocar nada durante la medición (la rana espera en la casilla de salida; el temporizador de ronda es de 14 s, así que no hay `gameover` en los 10 s).
- **Servidor:** build de producción (`npm run build` + `npx next start -p 3100`).
- **Navegador:** Chromium del MCP de Playwright. El `requestAnimationFrame` supera los 60 Hz (hasta 92 fps en `retro`), por lo que el navegador no está limitado a 60 Hz: las cifras son «sin tope» y sirven para comparar antes/después, no como fps de un monitor concreto.
- **Escritorio:** viewport 1280×800.
- **Móvil emulado:** contexto nuevo con viewport 390×844, `isMobile`, `hasTouch` (`pointer: coarse` verificado `true`), `deviceScaleFactor` 1 y CPU ralentizada 4× por CDP (`Emulation.setCPUThrottlingRate`). No sustituye una prueba en un teléfono real.
- **Medición:** 10 s tras 2-2,5 s de espera con la skin ya cargada (se fija `av-frogger-skin` en `localStorage` y se recarga). Contador de `requestAnimationFrame` (fps = fotogramas / tiempo, ms/fotograma media y p95) y `PerformanceObserver` de `longtask`.
- **Capturas:** `.playwright-screenshots/perf-base-<dispositivo>-<skin>.png`.

## Medición base (2026-11-02, antes de cambiar código)

| Dispositivo    | Skin      | fps medios | ms/fotograma (media) | ms/fotograma (p95) | Tareas largas |
| -------------- | --------- | ---------- | -------------------- | ------------------ | ------------- |
| Escritorio     | `clasico` | 80,7       | 12,39                | 20,8               | 0             |
| Escritorio     | `neon`    | **41,2**   | 24,25                | 28,9               | 0             |
| Escritorio     | `retro`   | 92,4       | 10,82                | 14,1               | 0             |
| Móvil (CPU 4×) | `clasico` | 50,9       | 19,66                | 28,2               | 0             |
| Móvil (CPU 4×) | `neon`    | **32,9**   | 30,40                | 41,7               | 0             |
| Móvil (CPU 4×) | `retro`   | 70,0       | 14,29                | 27,7               | 0             |

### Lectura provisional (sin aislar todavía)

- Umbrales de la spec: escritorio ≥ 55 fps, móvil ≥ 30 fps. Por cifras, solo `neon` en escritorio (41,2 fps) incumple; en móvil las tres skins pasan por poco (`neon` 32,9).
- `neon` cuesta el doble por fotograma que `clasico` y `retro` (24,3 ms frente a 12,4 y 10,8): coincide con la hipótesis del `shadowBlur` por entidad.
- `clasico` es más lento que `retro` (12,4 frente a 10,8 ms), lo que apunta a trabajo común (fondo y capas CSS) más que a la skin.
- No hay tareas largas en ningún caso: los tirones, si existen, son de ritmo de fotograma (p95) y no de bloqueos puntuales.

## Paso 2: aislamiento de la causa (2026-11-02)

Misma ruta y build. Se inyecta CSS con `page.addStyleTag` tras cargar (sin tocar código) y se repite la medición. El navegador de Playwright llega a ~144 fps como tope, así que 140-144 fps significa «sin cuello de botella». La variación entre réplicas es grande (la base de `clasico` salió 57, 73, 76 y 91 fps en distintas tandas), por eso se comparan órdenes de magnitud y no diferencias pequeñas.

### Separación JavaScript / pintado (`neon`, escritorio, CDP `Performance.getMetrics`, 10 s)

| Métrica (% del tiempo del hilo principal) | Valor  |
| ----------------------------------------- | ------ |
| `ScriptDuration` (JS, incluido el dibujo) | ~3 %   |
| `TaskDuration` (todo el hilo principal)   | ~8 %   |
| `LayoutDuration`                          | 0 %    |
| `RecalcStyleDuration`                     | ~0,6 % |

El JS del motor cuesta ~0,5 ms por fotograma y no hay layout ni recálculo de estilos apreciables. El tiempo de fotograma se va en **rasterizado y composición** (GPU/proceso de compositor), no en el hilo principal.

### Capas CSS, escritorio, `clasico` (8 s)

| Escenario                                                                               | fps     | ms/fotograma (media) |
| --------------------------------------------------------------------------------------- | ------- | -------------------- |
| Base                                                                                    | 91      | 10,99                |
| `.av-bg::before` oculto                                                                 | 144     | 6,95                 |
| `.av-bg::before` solo sin `animation` (`gridscroll`)                                    | 142,5   | 7,02                 |
| `.av-bg::before` sin `mask-image`                                                       | 106     | 9,41                 |
| `.av-bg::after` oculto (scanlines `overlay`)                                            | 109,5   | 9,13                 |
| `.crt-screen::after` con `mix-blend-mode: normal`                                       | 112     | 8,91                 |
| **Arreglo candidato** (sin `gridscroll` + sin `mix-blend-mode` en `.crt-screen::after`) | **143** | **6,98**             |

Tanda previa (10 s, réplicas): `clasico` base 57-76 fps, sin `.av-bg` 135, sin `.crt-screen::after` 83, sin ambas 144. `neon`: base 54-57, sin `.av-bg` 73, sin `.crt-screen::after` 60, sin ambas 85. Sin `.av-noise`, sin `.crt-screen::before` y sin las sombras de `.crt-screen` no hubo diferencia fuera del ruido.

### Capas CSS, móvil emulado (CPU 4×, 8 s)

| Skin      | Base | Sin `gridscroll` | `.crt-screen::after` sin blend | Arreglo candidato (ambos) |
| --------- | ---- | ---------------- | ------------------------------ | ------------------------- |
| `clasico` | 54,9 | 69,2             | 67,1                           | **122,9**                 |
| `neon`    | 41,9 | 52,6             | 44,5                           | **53,3**                  |

### Cuellos de botella ordenados por impacto

1. **`.av-bg::before` con `animation: gridscroll`.** Anima `background-position`, que no se compone en la GPU: fuerza un repintado continuo de una capa grande con `perspective`, `rotateX` y `mask-image`, y esa capa va debajo del canvas. Apagar solo la animación recupera casi todo el coste (91 → 142 fps en escritorio).
2. **`.crt-screen::after` con `mix-blend-mode: multiply`.** El modo de mezcla obliga a recomponer el canvas con la capa de scanlines en cada fotograma (+~20 fps al quitarlo en solitario).
3. **Brillo `shadowBlur` de `neon`.** Con todo el CSS apagado `neon` sigue en ~85 fps frente a ~140 de `clasico` en escritorio, y en móvil queda en ~53 fps frente a ~123. Es el coste propio del canvas.
4. **`.av-bg::after` (`overlay`) y `mask-image`**: aportan algo (~+15-20 fps al quitarlos), menor que los dos primeros.
5. **No relevantes:** `.av-noise`, `.crt-screen::before` y las sombras `inset` de `.crt-screen` (dentro del ruido). La caché del fondo del canvas y las asignaciones por fotograma de `draw.ts` ahorran como mucho una fracción de los ~0,5 ms de JS por fotograma.

### Decisión sobre los pasos 3 a 5

| Candidato de la spec                                 | Veredicto                                                                           |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 3.1 Caché del fondo estático (`fondoCache`)          | Dudosa: el JS del dibujo es ~0,5 ms/fotograma. A decidir con el usuario.            |
| 3.2 Eliminar asignaciones por fotograma en `draw.ts` | Coste mínimo: cambio barato, ganancia pequeña.                                      |
| 3.3 Reducir el coste del brillo de `neon`            | **Justificada** (~35 % del tiempo de `neon` móvil con el CSS ya arreglado).         |
| 4. Tope de 60 fps en el bucle                        | No justificada por las cifras: ningún caso baja de umbral por exceso de fotogramas. |
| 5. CSS compartido (`gridscroll` y `mix-blend-mode`)  | **Justificada**: es el mayor cuello de botella.                                     |

## Paso 2 bis: renders de `GamePlayer` (antes de cambiar nada)

Contador temporal en el cuerpo de `GamePlayer` (ya retirado, no se versiona), build de producción, escritorio.

| Situación (10 s)                                                    | Renders                                                |
| ------------------------------------------------------------------- | ------------------------------------------------------ |
| Partida quieta, sin pulsar nada                                     | **0**                                                  |
| Partida con 3 saltos de la rana (`score` 0→30 y la partida terminó) | 5 (todos por un cambio de `score`, `lives` o `status`) |

Ningún render es por fotograma: `onChange` solo notifica cuando cambia el snapshot. Los `useState` de `GamePlayer` (`snap`, `paused`, `over`, `saved`, `saving`, `errorGuardado`, `editedName`, `restartKey`, `tema` y las skins) se leen en el JSX, así que se quedan como estado: pasarlos a `useRef` dejaría el HUD, el modal o los botones desactualizados. **Ninguna conversión a `useRef` es necesaria** y no se añadió ningún `useState` nuevo.

## Paso 3: dibujo de Frogger (`app/games/frogger/draw.ts`)

Aplicado (el JS del dibujo es ~0,5 ms/fotograma, así que el objetivo es el coste de rasterizado):

- **Brillo de `neon` (3.3):** el `shadowBlur` ya no se aplica a los detalles. Se apaga tras el cuerpo de coches y camiones (ruedas, cristales), troncos (vetas), tortugas (dibujo interior) y rana (ojos). El cuerpo conserva el brillo. Antes cada coche, camión y tronco hacía de 6 a 10 dibujos con desenfoque.
- **Asignaciones por fotograma (3.2):** el array `zonas` y las listas de `setLineDash` pasan a constantes de módulo.
- **Caché del fondo (3.1):** **no necesaria** por ahora (JS del dibujo ~0,5 ms/fotograma; se reevalúa tras el CSS).

Medición tras el Paso 3 (build de producción, 10 s; el CSS compartido aún sin cambiar):

| Dispositivo    | Skin      | fps  | ms/fotograma (media / p95) | Base (Paso 1)         |
| -------------- | --------- | ---- | -------------------------- | --------------------- |
| Escritorio     | `clasico` | 79,0 | 12,66 / 20,8               | 80,7                  |
| Escritorio     | `neon`    | 59,3 | 16,87 / 21,0               | 41,2 (réplicas 54-57) |
| Escritorio     | `retro`   | 87,5 | 11,43 / 14,1               | 92,4                  |
| Móvil (CPU 4×) | `neon`    | 38,3 | 26,10 / 41,7               | 32,9 (réplica 41,9)   |

`clasico` y `retro` no cambian (su `brillo` es 0: el cambio no les afecta; la diferencia es ruido). `neon` mejora ~1,3 ms/fotograma en escritorio sobre las réplicas de la base (18,2 → 16,9 ms) y supera ya los 55 fps. Captura: `.playwright-screenshots/perf-paso3-desktop-neon.png` frente a `perf-base-desktop-neon.png` (visualmente equivalentes).

## Paso 4: tope de 60 fps

**No necesario.** Ninguna combinación estaba por debajo del umbral por hacer demasiados fotogramas: el coste era de capas CSS y de brillo, no de la frecuencia del bucle.

## Paso 5: CSS compartido (`app/globals.css`)

Aplicado, ambos cambios acotados:

- **`.crt-screen::after`: quitado `mix-blend-mode: multiply`.** Las scanlines son `rgba(0, 0, 0, 0.18)`; multiplicar negro con alfa da `(1 - α) · fondo`, idéntico a la mezcla normal de negro con alfa. El resultado es el mismo píxel a píxel y el canvas deja de recomponerse con un modo de mezcla en cada fotograma. Afecta a todos los `.crt-screen`, sin cambio visual.
- **`body:has(.av-player) .av-bg::before { animation: none }`.** La rejilla en perspectiva queda quieta solo en `/juegos/[id]/jugar`. En `/home`, `/biblioteca` y el resto sigue animada (comprobado: `animation-name` es `gridscroll` en `/home` y `/biblioteca` y `none` en las pantallas de juego; `mix-blend-mode` es `normal` en todas).

No se tocó `.av-noise`, `.crt-screen::before`, las sombras `inset` ni `.av-bg::after` (sin efecto medible o menor).

Medición tras el Paso 5 (build de producción, 10 s, Pasos 3 y 5 aplicados):

| Dispositivo    | Skin      | fps   | ms/fotograma (media / p95) | Base (Paso 1) |
| -------------- | --------- | ----- | -------------------------- | ------------- |
| Escritorio     | `clasico` | 127,5 | 7,84 / 14,0                | 80,7          |
| Escritorio     | `neon`    | 97,1  | 10,30 / 14,0               | 41,2          |
| Escritorio     | `retro`   | 144,0 | 6,95 / 7,2                 | 92,4          |
| Móvil (CPU 4×) | `clasico` | 92,3  | 10,83 / 20,8               | 50,9          |
| Móvil (CPU 4×) | `neon`    | 63,0  | 15,88 / 27,9               | 32,9          |
| Móvil (CPU 4×) | `retro`   | 77,1  | 12,97 / 21,0               | 70,0          |

Capturas: `.playwright-screenshots/perf-paso5-*.png` (juego en las tres skins, `/home`, `/biblioteca` y `/juegos/tetris/jugar`). Sin errores en consola (solo el aviso de precarga de CSS).

> Pendiente: Paso 6 (medición final con la misma metodología y veredicto frente a los umbrales, más `lint`/`build` y comprobar `clasico` idéntico) y Paso 7 (documentación en `CLAUDE.md`).
