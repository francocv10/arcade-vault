# SPEC 17 — Rendimiento de FROGGER (medir primero, optimizar después)

> **Status:** Aprobado
> **Depends on:** `specs/game-jam/frogger/01-juego-frogger-motor.md` (motor de Frogger), SPEC 16 (skins y brillo `shadowBlur` de `neon`), SPEC 14 (consola táctil y compactación móvil)
> **Date:** 2026-11-02
> **Objective:** Medir con Playwright por qué Frogger baja de fotogramas (escritorio y móvil, en sus tres skins) y corregir los cuellos de botella confirmados hasta alcanzar ≥ 55 fps medios en escritorio y ≥ 30 fps en móvil emulado, sin cambiar su aspecto ni su jugabilidad.

---

## Por qué existe este spec

El usuario percibe fotogramas bajos y tirones en Frogger, en escritorio y en móvil, y sospecha que ocurre también en los demás juegos. **No hay ninguna medición todavía**, así que este spec no asume la causa: empieza midiendo y solo corrige lo que la medición confirme.

Sospechosos detectados al leer el código (son hipótesis, no hallazgos):

- **Canvas, trabajo repetido por fotograma.** `dibujar()` en `app/games/frogger/draw.ts` repinta todo cada fotograma: `drawFondo` rellena 5 zonas, traza ~48 ondas de río con dos `quadraticCurveTo` cada una (6 filas × 8 columnas) y 4 líneas discontinuas, y crea el array `zonas` de nuevo cada vez. Todo eso es estático (solo cambia con la skin) y se podría pintar una vez.
- **Canvas, brillo en `neon`.** `shadowBlur` se aplica por entidad (coches, camiones, troncos, tortugas por casilla, rana, bocas y textos), con `save()`/`restore()` cada una. Es el recurso más caro del canvas 2D.
- **CSS que rodea al canvas.** Cada fotograma del canvas se compone bajo capas que tienen coste de mezcla o repintado: `.crt-screen::after` (scanlines con `mix-blend-mode: multiply`, sobre el canvas), `.crt-screen::before` (viñeta con gradiente), `.crt-screen` con dos `inset box-shadow` grandes, `.av-bg::before` (rejilla en perspectiva con `animation: gridscroll` sobre `background-position`, que fuerza repintado continuo, más `mask-image`), `.av-bg::after` (`mix-blend-mode: overlay`) y `.av-noise` (SVG con `feTurbulence` a pantalla completa y `position: fixed`). Estas capas son comunes a todas las rutas de juego.
- **Escalado.** El canvas lógico es 800×600 escalado por CSS para llenar `.crt-screen`; en pantallas grandes el navegador reescala 800×600 cada fotograma.
- **Frecuencia de refresco.** El bucle usa `requestAnimationFrame` sin tope: en un monitor de 120/144 Hz hace el doble de trabajo que a 60 Hz.

---

## Alcance

**In:**

- **Medición base y final con Playwright (MCP)** de `/juegos/frogger/jugar`: fps medios, tiempo de fotograma (media y p95) y tareas largas, en escritorio (1280×800) y en móvil emulado (390×844, `pointer: coarse`, CPU ralentizada 4×), con cada una de las tres skins. Resultado en `references/performance-review.md`.
- **Aislamiento de la causa** durante la medición, apagando capas CSS inyectadas en tiempo de ejecución (sin tocar el código) para saber cuánto cuesta cada una.
- **Optimización del dibujo de Frogger**, solo de lo que la medición confirme. Candidatos ordenados por coste esperado/riesgo:
  1. Caché del fondo estático (zonas, ondas del río, líneas de carretera) en un canvas fuera de pantalla, regenerado al crear el motor y al cambiar de skin; el fotograma pasa a un único `drawImage`.
  2. Eliminar asignaciones por fotograma en `draw.ts` (arrays y closures en el bucle caliente).
  3. En `neon`, reducir el coste del brillo (menos `save()`/`restore()` y `shadowBlur` más bajo o agrupado por tipo) sin que deje de verse como brillo.
  4. Tope de fotogramas a 60 fps si la medición muestra que los monitores de alta frecuencia son el problema, conservando la física independiente del tiempo (`dt`).
- **Aligerar CSS compartido** del marco CRT y del fondo **solo si la medición lo señala** como cuello de botella, con un cambio perceptualmente neutro (p. ej. pausar `gridscroll` en `/juegos/*/jugar`, sustituir `mix-blend-mode` por un degradado semitransparente equivalente, o `will-change`/`contain` donde convenga).
- **Minimizar `useState` y los re-renders en la ruta de Frogger** (`FroggerCanvas`, `GamePlayer` mientras `gameId === "frogger"`): todo código nuevo o tocado usa `useRef` para lo que no se pinta en el DOM (caché del fondo, contadores de medición, valores leídos solo por el motor o por manejadores), no añade ningún `useState` nuevo, y se auditan y eliminan los re-renders evitables de `GamePlayer` durante la partida (por ejemplo, estado que solo se lee en un manejador pasa a `useRef`; `skinFrogger` se lee desde un ref en el motor, ya existe `skinRef`).
- Actualizar `CLAUDE.md` con lo aprendido (el patrón de caché de fondo, la nota sobre las capas CSS y la regla de refs frente a estado) para las specs de los demás juegos.

**Out of scope:**

- **Los demás juegos** (Asteroides, Tetris, Arkanoid, Snake): cada uno tendrá su spec propia, que seguirá el método y el informe de este. Cualquier cambio de CSS compartido debe ser neutro para ellos, pero no se mide ni se optimiza su motor aquí.
- Cambios de mecánicas, velocidades, tiempos, puntuación, colisiones o geometría de Frogger.
- Cambios de aspecto visibles en las tres skins (`clasico` debe verse idéntico).
- Soporte HiDPI/`devicePixelRatio` del canvas (rediseño del tamaño lógico): spec aparte si hace falta.
- Rendimiento de carga de página (bundle, SSR, Supabase) y de otras rutas.
- Un test runner o una suite de rendimiento permanente: la medición es manual con Playwright.
- Consola táctil y `GamePlayer`, salvo que la medición los señale (en ese caso, cambio mínimo y registrado en las decisiones).

---

## Modelo de datos

No introduce datos ni cambia contratos (`SnapshotFrogger`, `onChange`, `JuegoFrogger`, claves de `localStorage`, Supabase). Solo estado interno nuevo y opcional:

- En `app/games/frogger/game.ts`: un canvas fuera de pantalla con el fondo ya pintado (`fondoCache`) y su skin de origen; se reconstruye en `setSkin` y se descarta en `destroy()`. Se crea en `game.ts` y no en `draw.ts`, porque `draw.ts` no accede a `document`; `draw.ts` exporta la función que pinta el fondo estático y recibe la caché por parámetro.
- Archivo de informe nuevo: `references/performance-review.md`, con una tabla por medición (fecha, ruta, skin, dispositivo, fps medios, ms/fotograma media y p95, tareas largas).

---

## Plan de implementación

1. **Medición base (sin cambiar código).** Con `npm run dev` (o `build` + `start` para cifras representativas) y el MCP de Playwright, abrir `/juegos/frogger/jugar` y medir 10 s de partida por combinación escritorio/móvil × `clasico`/`neon`/`retro`. Fps con un contador de `requestAnimationFrame`, tiempo de fotograma (media y p95) y tareas largas con `PerformanceObserver`. Móvil: viewport 390×844, `pointer: coarse` y CPU ralentizada 4× por CDP. Guardar capturas en `.playwright-screenshots/` y las cifras en `references/performance-review.md`.
2. **Aislar la causa.** Repetir la medición inyectando CSS que apague por separado `.av-bg`, `.av-noise`, `.crt-screen::before`/`::after` y las sombras de `.crt-screen`, y comparando. Anotar el coste de cada capa y qué parte del tiempo de fotograma es de JavaScript (dibujo) y cuál de pintado/composición. Ordenar los cuellos de botella por impacto en el informe. Este paso decide cuáles de los pasos 3 a 5 se ejecutan; los que la medición no justifique se omiten y se registran como «no necesario».
   2 bis. **Auditar re-renders.** Contar cuántas veces se renderiza `GamePlayer` (y sus hijos, p. ej. `TouchControls`) durante 10 s de partida, con un contador en un `useRef` temporal que no se versiona o con el Profiler de React. Lista de los `useState` de `GamePlayer` clasificados en: se pinta en el DOM (se queda como estado) o solo se lee en manejadores/efectos (pasa a `useRef`). Solo el snapshot que cambia el HUD (`score`, `lives`, `level`) debe provocar render; ningún estado nuevo se añade. Cualquier valor por fotograma queda dentro del motor, nunca en estado de React.
3. **Dibujo de Frogger.** Aplicar, por orden de impacto medido: caché del fondo estático (`fondoCache`, con `drawImage` por fotograma y regeneración en `setSkin`), eliminación de asignaciones por fotograma, y reducción del coste del brillo de `neon`. Después de cada cambio, volver a medir y registrar la diferencia. `clasico` debe seguir viéndose idéntico.
4. **Bucle (solo si el paso 2 lo justifica).** Tope de 60 fps en el bucle de `game.ts`, manteniendo `dt` real y el límite `MAX_DT`.
5. **CSS compartido (solo si el paso 2 lo justifica).** Aligerar las capas señaladas en `app/globals.css` con cambios perceptualmente neutros. Comprobar visualmente que el marco CRT, las scanlines, la viñeta y el fondo se ven prácticamente igual en `/juegos/*/jugar`, `/home` y `/biblioteca`.
6. **Medición final.** Repetir la medición del paso 1 con la misma metodología y completar `references/performance-review.md` con la tabla antes/después y el veredicto frente a los umbrales.
7. **Documentación.** Actualizar `CLAUDE.md`: spec 17 en la lista de specs y, en la descripción de `app/games/frogger/`, la caché del fondo estático (y, si se tocó, la nota sobre el CSS compartido). Dejar en el informe una sección «Para las specs de los demás juegos» con el método y el orden de sospechosos.

---

## Criterios de aceptación

- [ ] `references/performance-review.md` existe y contiene la medición base y la final de Frogger, con la misma metodología, para escritorio y móvil emulado y para las tres skins.
- [ ] El informe identifica, con cifras, qué capas o partes del dibujo cuestan más y marca cada optimización candidata como «aplicada» o «no necesaria».
- [ ] En escritorio (1280×800) Frogger alcanza **≥ 55 fps medios** en `clasico`, `neon` y `retro` durante 10 s de partida.
- [ ] En móvil emulado (390×844, `pointer: coarse`, CPU 4× más lenta) Frogger alcanza **≥ 30 fps medios** en las tres skins.
- [ ] El tiempo de fotograma mejora frente a la medición base en cada combinación, o el informe explica por qué una combinación ya estaba dentro del umbral.
- [ ] `clasico` se ve igual que antes en una captura comparada con la de la medición base (río `#0b2a63`, zonas seguras `#166534`, carretera `#0f0f14`, rana `#4ade80`, sin brillo); `neon` y `retro` conservan sus paletas y el brillo de `neon` sigue siendo visible.
- [ ] Cambiar de skin con la partida corriendo, en pausa o en `gameover` redibuja el lienzo al instante con el fondo correcto (la caché se regenera) y no altera puntos, vidas, nivel, tiempo ni posiciones.
- [ ] La jugabilidad no cambia: mismos saltos de 120 ms, mismas colisiones, mismo arrastre por troncos y tortugas, misma puntuación y mismos tiempos de ronda.
- [ ] Reiniciar y desmontar el juego no deja fugas: tras `destroy()` no quedan escuchas ni bucle activo, y la caché se descarta.
- [ ] Si se tocó CSS compartido, `/home`, `/biblioteca` y `/juegos/[id]/jugar` de los otros cuatro juegos reales se ven igual a simple vista y sin errores en consola.
- [ ] La spec no añade ningún `useState` nuevo; el código nuevo guarda en `useRef` lo que no se pinta en el DOM.
- [ ] Durante 10 s de partida, `GamePlayer` solo se renderiza cuando cambia `score`, `lives`, `level` o `status` (o por una acción del usuario), nunca por fotograma; el informe incluye el recuento antes y después.
- [ ] Los `useState` de `GamePlayer` que solo se leían en manejadores o efectos pasaron a `useRef` sin cambiar el comportamiento (modal, guardado, skins, pausa y reinicio siguen igual).
- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `CLAUDE.md` menciona la spec 17 y el patrón de caché de fondo.

---

## Decisiones

- **Sí:** medir antes de optimizar. Las causas listadas son hipótesis; solo se aplica lo que la medición confirme.
- **Sí:** este spec cubre solo Frogger (decisión del usuario: «Frogger primero y luego una spec por juego»). El informe deja el método reutilizable para las siguientes.
- **Sí:** umbral fijo de ≥ 55 fps en escritorio y ≥ 30 fps en móvil emulado con CPU 4× más lenta, medido con Playwright antes y después.
- **Sí:** se permite tocar el CSS compartido (marco CRT, fondo animado) **solo si la medición lo señala**, con cambios perceptualmente neutros.
- **Sí:** caché del fondo estático como primera optimización del canvas: es el cambio de mayor ahorro esperado y el de menor riesgo, porque el fondo solo depende de la skin.
- **Sí:** la caché vive en `game.ts` y `draw.ts` sigue sin acceder a `document`.
- **Sí:** tres skins medidas por separado, porque el usuario no sabe si alguna empeora y `neon` añade `shadowBlur`.
- **No:** HiDPI/`devicePixelRatio` en este spec; es un cambio de tamaño lógico del canvas con otro alcance.
- **No:** medir u optimizar los motores de los otros cuatro juegos aquí.
- **Sí:** preferir `useRef` a `useState` para todo lo que no se pinta en el DOM y evitar re-renders (petición del usuario). Excepción: el estado que sí cambia la interfaz (HUD, modal, pausa, skin visible en el botón) se queda como `useState`; convertirlo a ref lo dejaría desactualizado en pantalla.
- **No:** un test runner o una suite de rendimiento permanente; informe manual en `references/`.
- **No:** reducir calidad visible de `clasico` ni cambiar geometría, colores o fuentes.

---

## Riesgos

| Riesgo                                                                                     | Mitigación                                                                                                                                              |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El modo `dev` de Next añade sobrecarga y falsea las cifras                                 | Medir también con `npm run build` + `npm run start` y anotar en el informe cuál se usó; los umbrales se comprueban con la build de producción.          |
| Playwright en emulación de móvil no reproduce un teléfono real                             | El umbral es sobre emulación con CPU 4× más lenta; dejar anotado que no sustituye una prueba en un dispositivo real.                                    |
| La medición de fps en un navegador sin cabeza (headless) no representa la GPU real         | Medir con el navegador de Playwright en modo con interfaz si es posible y anotar el modo; comparar siempre antes/después en las mismas condiciones.     |
| La caché del fondo queda con la skin anterior o se pierde al cambiar de tamaño             | Regenerar en `setSkin` y al crear el motor; criterio de aceptación explícito de cambio de skin en marcha, pausa y `gameover`.                           |
| Aligerar el CSS compartido cambia el aspecto del marco CRT en los otros juegos             | Solo si la medición lo exige, con cambios neutros y revisión visual en las rutas indicadas.                                                             |
| La causa real es una combinación de factores y ninguna optimización sola alcanza el umbral | Aplicar y medir de una en una, acumulando mejoras; si aun así no se cumple, el informe documenta el hallazgo y se abre una spec nueva en vez de forzar. |

---

## Qué **no** está en este spec

- Rendimiento de Asteroides, Tetris, Arkanoid y Snake (una spec por juego, después de esta).
- Cambios de mecánicas, geometría, velocidades, puntuación o aspecto de Frogger.
- HiDPI/`devicePixelRatio`.
- Rendimiento de carga de la página, SSR, bundle o Supabase.
- Un test runner o una suite de rendimiento permanente.
