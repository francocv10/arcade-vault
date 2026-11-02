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

> Pendiente: Paso 2 (aislar capas CSS y separar JS de pintado), Paso 2 bis (re-renders), y las tablas «después» de los pasos 3 a 6.
