# SPEC 15 — Apariencia del gamepad MK-II en la consola táctil

> **Status:** Aprobado
> **Depends on:** SPEC 14 (consola táctil: `touch-controls.tsx`, `controles-tactiles.ts` y estilos `.touch-*` de `app/globals.css`)
> **Date:** 2026-10-29
> **Objective:** Rediseñar solo el aspecto de la consola táctil para que sea idéntica al gamepad «MK-II» de `references/gamepad-assets/gamepad-assets/` (carcasa oscura con marco doble, cruceta de teclas con relieve y gema central, y botones B cian y A magenta con brillo y anillo), sin cambiar la emulación de teclado ni los tamaños táctiles de la spec 14.

---

## Por qué existe este spec

La consola de la spec 14 cumple su función (cruceta + A y B que emulan el teclado) pero con un aspecto genérico: botones planos con borde neón, A y B ambos magenta y etiquetas de texto debajo. El diseño ha preparado un gamepad de referencia más cuidado (`gamepad.html` y `gamepad-neon.png`) y se quiere que la consola del reproductor se vea igual.

Qué hay en la referencia (leído de `gamepad.html`):

- **Carcasa `.gp`**: degradado vertical `#1c1c28 → #0c0c14`, borde `1px` `rgba(0, 245, 255, 0.18)`, radio 22 px, sombra cian difusa, marco interior a 4 px (`::before`) y trama de puntos de 8 px (`::after`).
- **Cruceta**: cuatro teclas de 50 px con degradado, radio 10 px, relieve inferior (`0 4px 0`) y flecha SVG; al pulsarlas se hunden 3 px y se iluminan en cian. En el centro hay un cubo (`.dp-hub`) con una gema cian en forma de rombo que pulsa (`pulse-led`).
- **A y B**: botones circulares de 74 px (64 px en móvil) con borde de 2 px, brillo especular, relieve inferior (`0 6px 0`) y la letra en `Press Start 2P`; **B es cian y A es magenta**; B queda a la izquierda de A. Al pulsar se hunden 4 px y aparece un anillo punteado (`.ab-ring`).
- **Sin etiquetas de texto** bajo los botones.
- **Resalte por teclado**: la clase `.on` se aplica a los botones al pulsar la tecla física equivalente.

Lo que esta spec **no** hace es tocar el comportamiento: los tamaños táctiles (56/52/48 px la cruceta y 64/60/56 px A y B), la visibilidad por `(pointer: coarse)`, la emulación de teclas, la auto-repetición y la disposición en apaisado siguen siendo los de la spec 14.

---

## Alcance

**In:**

- Reestilar `.touch-console` como la carcasa `.gp` de la referencia (degradado, borde, marco interior, trama de puntos y sombra) con las variables de color existentes donde coincidan (`--cyan`, `--magenta`, `--ink-dim`, `--line`).
- Reestilar la cruceta: teclas con degradado y relieve, flecha SVG en lugar del glifo de texto, estado pulsado hundido con brillo cian, y el cubo central con la gema pulsante.
- Reestilar A y B: botones circulares con brillo especular, relieve, letra con `text-shadow` de neón y anillo punteado al pulsar. **B cian y A magenta** (hoy ambos magenta).
- Quitar las etiquetas de texto visibles (`DISPARO`, `CAÍDA`, `GIRAR`) y pasarlas al `aria-label` y a `title` de cada botón. Los botones deshabilitados no llevan `title`.
- Resalte por teclado físico: listeners de `keydown`/`keyup` en `window` que añaden y quitan la clase `.on` en el botón cuya tecla emulada (`code`) coincide, y solo si el botón está activo en el juego. Los eventos sintéticos de la propia consola pasan por el mismo camino, de modo que el estado pulsado es único.
- Botones deshabilitados: misma forma y relieve que los activos, atenuados (`opacity`), sin brillo ni gema pulsante, y sin respuesta a `:hover` ni `:active`.
- Animación de la gema (`pulse-led`) con `prefers-reduced-motion: reduce` respetado (queda fija).
- Conservar los tamaños y la disposición de la spec 14: en vertical la carcasa envuelve cruceta (izquierda) y A y B (derecha); en apaisado móvil (`(pointer: coarse) and (orientation: landscape) and (max-height: 500px)`) sigue siendo cruceta | canvas | A y B, con los botones sueltos y el estilo nuevo, **sin carcasa** (ver Decisiones).
- Verificación con Playwright en táctil y comparación visual con `gamepad-neon.png`.
- Actualizar `CLAUDE.md` (spec 15 en la lista y una frase en el párrafo de controles táctiles).

**Out of scope:**

- Cambios en `app/games/controles-tactiles.ts`, en `CONTROLES_TACTILES` y en la lógica de emulación de `touch-controls.tsx` (`presionar`, `soltar`, auto-repetición, liberación en `blur` y `visibilitychange`).
- Cambios en los motores (`app/games/*/game.ts`), en `GamePlayer`, en el marco `.crt`, en el HUD y en el modal de fin de juego.
- Aumentar o reducir los tamaños táctiles de la spec 14.
- Mostrar la consola en escritorio con puntero fino.
- Mapas de teclas propios de la referencia (`WASD`, `Z/J` = A, `X/K` = B): el resalte sigue las teclas que cada juego lee de verdad (`code` de `controles-tactiles.ts`).
- Copiar `gamepad.html`, `gamepad-neon.png` o `README.md` a `public/`: la carpeta `references/` queda solo como referencia visual.
- Sonido, vibración háptica y temas de color alternativos del mando.
- La página standalone del gamepad como ruta de la app.

---

## Modelo de datos

Esta funcionalidad no introduce estructuras de datos nuevas ni persistencia. Reutiliza `ControlesTactiles`, `BotonAccion` y `TECLAS_DIRECCION` de la spec 14 sin modificarlos.

Cambios de marcado de `app/components/touch-controls.tsx` (solo presentación):

| Elemento                   | Hoy (spec 14)                                 | Después (esta spec)                                                                                        |
| -------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Contenido de las flechas   | Glifos de texto `▲ ◀ ▶ ▼`                     | SVG inline de 24×24 con `fill="currentColor"` y las rutas de la referencia (`M12 4 L20 16 L4 16 Z`, etc.)  |
| Centro de la cruceta       | Celda vacía                                   | `<div className="touch-hub" aria-hidden="true"><span className="touch-hub-gem" /></div>` en la celda 2 / 2 |
| Botones A y B              | `<button>` con la letra                       | `<button>` con `<span className="touch-ring" aria-hidden="true">` y `<span className="touch-letter">`      |
| Etiqueta bajo A y B        | `<span className="touch-label">`              | Eliminada; la etiqueta pasa a `aria-label` y a `title` del botón                                           |
| Clase de estado de pulsado | `:active` de CSS                              | `:active` y clase `.on` (resalte por teclado y por pulsación de la consola)                                |
| Clases de color            | `.touch-action-a` y `.touch-action-b` iguales | `.touch-action-a` magenta y `.touch-action-b` cian, con variables `--ab-mid`, `--ab-deep` y `--ab-glow`    |

Tokens nuevos en `app/globals.css`, acotados a `.touch-console` para no contaminar el resto de la UI:

| Variable         | Valor     | Uso                                    |
| ---------------- | --------- | -------------------------------------- |
| `--gp-shell-top` | `#1c1c28` | Parte alta del degradado de la carcasa |
| `--gp-shell-bot` | `#0c0c14` | Parte baja del degradado de la carcasa |
| `--gp-key-top`   | `#1a1a25` | Parte alta de las teclas de la cruceta |
| `--gp-key-bot`   | `#0a0a12` | Parte baja de las teclas de la cruceta |
| `--gp-key-base`  | `#050507` | Relieve inferior de teclas y botones   |

---

## Plan de implementación

1. **Carcasa.** En `app/globals.css`, dentro de `@media (pointer: coarse)`, sustituir el fondo y el borde de `.touch-console` por los de `.gp` (degradado, `1px` `rgba(0, 245, 255, 0.18)`, radio 22 px, sombra cian) y añadir `::before` (marco interior a 4 px, radio 18 px) y `::after` (trama de puntos de 8 px a opacidad 0.6), ambos con `pointer-events: none`. `.touch-dpad` y `.touch-actions` pasan a `position: relative; z-index: 1`. Se conservan `display: grid`, el `gap` y el `padding` de la spec 14. Ruta: vertical funcional con carcasa nueva y botones aún antiguos.
2. **Cruceta.** En `touch-controls.tsx`, sustituir los glifos por los SVG de la referencia y añadir el cubo central `.touch-hub` con su gema. En CSS, estilar `.touch-dir` (degradado de `--gp-key-top` a `--gp-key-bot`, borde `1px` `rgba(255, 255, 255, 0.05)`, radio 10 px, relieve `0 4px 0 var(--gp-key-base)`, color `--ink-dim`), el estado `.on` y `:active` (hundido 3 px, color y borde cian, brillo exterior e interior, `drop-shadow` de la flecha), `.touch-hub` (radial `#181822 → #08080d`, borde `rgba(0, 245, 255, 0.15)`, radio 6 px) y la gema (12 px, rombo con `clip-path`, animación `pulse-led` de 2 s). La rejilla de 3×3 y los tamaños 56/52/48 px no cambian.
3. **Botones A y B.** En `touch-controls.tsx`, añadir `.touch-ring` y `.touch-letter` dentro de `BotonTactil` para A y B, y mover la etiqueta de `.touch-label` al `aria-label` y `title` del botón (sin `title` cuando está deshabilitado), borrando `.touch-label` del marcado y de `globals.css`. En CSS, estilar `.touch-action .touch-btn` como círculo con borde `2px currentColor`, doble radial (brillo especular y `--ab-mid`/`--ab-deep`), relieve `0 6px 0 var(--gp-key-base)`, brillo `--ab-glow` y letra `Press Start 2P` blanca con `text-shadow` de neón; B cian y A magenta con las variables de la referencia; hundido de 4 px y anillo punteado visible en `.on` y `:active`. Se quita el `margin-top: 24px` de `.touch-action:first-child` y se alinean al centro. Tamaños 64/60/56 px sin cambios.
4. **Resalte por teclado.** En `touch-controls.tsx`, un `useEffect` que escucha `keydown` y `keyup` en `window` y, por `e.code`, añade o quita la clase `.on` (mediante `classList` sobre refs o un `Set` en estado, a elección de quien implemente) al botón activo cuyo `tecla.code` coincide. Ignora `e.repeat` al añadir. Se limpia al desmontar y en `blur`. No consume ni cancela los eventos.
5. **Deshabilitado y movimiento reducido.** En CSS, `.touch-btn:disabled` conserva el relieve y la forma, con `opacity: 0.3`, sin `box-shadow` de brillo ni anillo, y sin cambios con `:hover`/`:active`/`.on`; `@media (prefers-reduced-motion: reduce)` detiene `pulse-led`.
6. **Apaisado y estrecho.** Comprobar y ajustar en `@media (pointer: coarse) and (orientation: landscape) and (max-height: 500px)` que, con `.touch-console` en `display: contents`, los pseudo-elementos `::before` y `::after` no generan cajas (`content: none`) y que los botones sueltos conservan el estilo nuevo (cruceta con cubo central, A y B con brillo) en la rejilla de la spec 14. En `@media (pointer: coarse) and (max-width: 420px)` se mantienen los tamaños reducidos, sin que A y B (60 px) más cruceta (52 px) desborden a 360 px.
7. **Documentación.** En `CLAUDE.md`, añadir el bloque de la spec 15 a la lista de specs y una frase en el párrafo «Controles táctiles (spec 14)» con el aspecto MK-II y el resalte por teclado. Actualizar la mención de la consola en `.claude/skills/new-game/puntos-de-integracion.md` solo si describe el aspecto de los botones.

---

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] No cambia ningún archivo de `app/games/` ni los tipos de `ControlesTactiles`, `BotonAccion` y `TECLAS_DIRECCION`.
- [ ] En escritorio (puntero fino) la consola sigue sin aparecer (`display: none`) y no se carga ninguna regla visible nueva.
- [ ] En un dispositivo táctil, `/juegos/<id>/jugar` muestra bajo el marco `.crt` una carcasa con degradado `#1c1c28 → #0c0c14`, borde cian tenue, marco interior y trama de puntos.
- [ ] La cruceta tiene cuatro teclas con flecha SVG y un cubo central con una gema cian que pulsa; el cubo no recibe eventos de puntero.
- [ ] B es cian y A es magenta, B a la izquierda de A, ambos circulares con la letra en `Press Start 2P`.
- [ ] No hay texto visible bajo A y B; cada botón activo tiene `aria-label` y `title` con su acción (p. ej. `Disparo` en A de Asteroides, `Girar` en B de Tetris) y los deshabilitados no tienen `title`.
- [ ] Al pulsar una tecla de la cruceta o A/B (con el dedo o con el teclado físico), el botón se hunde, se ilumina y, en A y B, muestra el anillo punteado; al soltar vuelve a su estado normal.
- [ ] Al pulsar una tecla física que corresponde a un botón deshabilitado en ese juego (p. ej. `ArrowDown` en Asteroides) no se resalta ningún botón.
- [ ] Los botones deshabilitados (↓ en Asteroides, A y B en Arkanoid y Snake) mantienen forma y relieve, se ven atenuados, no tienen gema ni brillo y no cambian al tocarlos.
- [ ] Con `prefers-reduced-motion: reduce` la gema central no se anima.
- [ ] Los tamaños táctiles no cambian: cada botón mide al menos 48 × 48 px y cruceta y A/B conservan 56/52/48 px y 64/60/56 px según el ancho y la orientación.
- [ ] A 360 × 640 y a 375 × 667 no hay scroll horizontal y cruceta, A y B caben en la carcasa sin solaparse.
- [ ] En apaisado 667 × 375 el canvas se ve entero sin scroll vertical, la cruceta queda a la izquierda y A y B a la derecha con el estilo nuevo, y no se ve ninguna carcasa ni se genera caja de `::before`/`::after`.
- [ ] Al pulsar un botón activo, un listener de `keydown` en `window` recibe el `code` y `key` esperados y, al soltar, un único `keyup`, igual que en la spec 14.
- [ ] Los cuatro juegos (Asteroides, Tetris, Arkanoid y Snake) siguen jugándose con la consola nueva, con la pausa, las skins, el botón TEMA, el modal de fin de juego y el guardado de puntuaciones sin cambios.
- [ ] Una captura de Playwright de la consola en vertical (375 × 667, táctil) se guarda en `.playwright-screenshots/` y coincide con `gamepad-neon.png` en la carcasa, la cruceta con cubo central y B cian y A magenta.
- [ ] `CLAUDE.md` menciona la spec 15 y el aspecto MK-II de la consola.

---

## Decisiones

- **Sí:** reutilizar la carcasa de la referencia solo en vertical. **No:** envolver cruceta y A/B de apaisado en paneles propios, porque el canvas ya ocupa casi toda la altura y las carcasas robarían ancho (decisión del usuario: botones sueltos con el estilo nuevo).
- **Sí:** mover las etiquetas `DISPARO`, `CAÍDA` y `GIRAR` a `aria-label` y `title` (decisión del usuario). **No:** conservarlas visibles ni quitar la información: cualquiera puede conocer la acción con un lector de pantalla o al mantener el puntero sobre el botón en tablets con ratón.
- **Sí:** botones deshabilitados con la misma silueta y atenuados, para que la consola sea idéntica entre juegos (principio ya fijado en la spec 14).
- **Sí:** incluir la gema pulsante, el anillo y el resalte por teclado de la referencia (decisión del usuario). El resalte útil está en tablets con teclado físico; con la consola oculta en escritorio no tiene efecto visible.
- **Sí:** el resalte sigue el `code` que cada juego lee (`controles-tactiles.ts`), no el mapa `WASD`/`Z`/`J`/`X`/`K` de la referencia, que no corresponde a lo que hacen los motores. **No:** copiar ese mapa, porque iluminaría botones que no hacen nada en ese juego.
- **Sí:** SVG inline para las flechas, como en la referencia, para poder aplicar `drop-shadow` al pulsar. **No:** seguir con glifos Unicode (se renderizan distinto según la fuente).
- **Sí:** mantener tamaños y disposición de la spec 14 aunque la referencia use 50/74 px: ya cumplen los 48 px mínimos y caben en 360 px. **No:** subir a 74 px.
- **Sí:** variables `--gp-*` acotadas a `.touch-console`; los colores `--cyan`, `--magenta`, `--ink-dim` y `--line` se reutilizan de la app. **No:** importar el `:root` de la referencia, que redefine `--bg`, `--ink` y `--cyan`.
- **Sí:** `references/gamepad-assets/` queda como material de referencia sin tocar. **No:** copiarlo a `public/` ni cargar sus fuentes: `Press Start 2P` y `JetBrains Mono` ya están en `app/layout.tsx`.
- **No:** transformar la consola en un componente configurable por temas; el aspecto es único.

---

## Riesgos

| Riesgo                                                                                                      | Mitigación                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Con `display: contents` en apaisado, `::before` y `::after` de `.touch-console` siguen generando cajas      | `content: none` en ese `@media` y comprobación visual a 667 × 375 (criterio de aceptación).                                                  |
| Los sombreados y brillos de la referencia añaden coste de pintado en móviles modestos                       | Sin `filter`/`backdrop-filter` en reposo; el `drop-shadow` solo se aplica a la flecha pulsada y la gema anima solo `opacity` y `transform`.  |
| El resalte por teclado duplica el estado pulsado del dedo y deja un botón iluminado si se pierde el `keyup` | `keyup` y `blur` limpian la clase; los eventos sintéticos de la consola pasan por el mismo camino y se limpian también al desmontar.         |
| El relieve `0 6px 0` y el anillo (`inset: -8px`) desbordan la carcasa a 360 px                              | Anillo con `pointer-events: none` y `overflow: visible` solo dentro de la carcasa; comprobar con 360 × 640 y ajustar el `padding` del medio. |
| El `clip-path` de la gema o los degradados cambian el área táctil real de los botones                       | Los botones conservan el `width`/`height` de la spec 14; los elementos decorativos son `aria-hidden` y `pointer-events: none`.               |
| Una regla `.touch-*` nueva no se aplica por el bundle obsoleto de Turbopack                                 | Seguir la nota de `CLAUDE.md`: detener `next dev`, borrar `.next/dev` y reiniciar.                                                           |

---

## Qué **no** está en este spec

- Cambios en la emulación de teclado, en la tabla `CONTROLES_TACTILES` o en los motores de los juegos.
- Mostrar la consola en escritorio o crear una página standalone del gamepad.
- Gestos, cruceta deslizante, botones adicionales, vibración o remapeo de teclas.
- Carcasa en apaisado móvil.
- Temas de color alternativos del mando.
- Copiar los assets de `references/gamepad-assets/` a `public/`.
