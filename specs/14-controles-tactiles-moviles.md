# SPEC 14 — Controles táctiles para jugar en móvil

> **Status:** Implementado
> **Depends on:** SPEC 06 (Asteroides), SPEC 08 (Tetris), SPEC 09 (Arkanoid), SPEC 10 (Snake) y `GamePlayer`
> **Date:** 2026-10-29
> **Objective:** Permitir jugar a los cuatro juegos reales en un móvil táctil añadiendo bajo el canvas una consola con cruceta y dos botones (A y B) que emula el teclado que ya leen los motores, y compactando el reproductor para que canvas y consola quepan en pantalla.

---

## Por qué existe este spec

Hoy los cuatro motores de canvas solo leen teclado (`keydown`/`keyup` en `window`); Arkanoid añade `mousemove`. Ninguno escucha `touch` ni `pointer`, así que en un móvil se puede abrir `/juegos/<id>/jugar` pero no jugar. Además, en vertical el HUD (jugador, puntuación, vidas, nivel, SKIN y tres botones) ocupa casi media pantalla antes del canvas y el marco CRT deja el lienzo pequeño.

Decisiones de diseño de este spec (tomadas con el usuario, a partir de una captura del reproductor en un Samsung):

- **Una sola consola para los cuatro juegos**: canvas arriba, consola debajo (fuera del canvas, sin taparlo), con una **cruceta** a la izquierda y **dos botones de acción, A y B**, a la derecha. La mayoría de los juegos arcade necesitan como máximo dos acciones.
- **Se emula el teclado, no se toca ningún motor.** La consola despacha `KeyboardEvent` sintéticos en `window` con los mismos `code`/`key` que ya leen los motores. Así `GamePlayer` y los motores no cambian y los juegos futuros solo declaran qué teclas usan.
- **Vale también para los juegos reales futuros**: la consola se configura con una tabla por `gameId`; dar de alta un juego real nuevo añade una entrada.
- **Solo en dispositivos táctiles** (`(pointer: coarse)`). En escritorio no aparece y el teclado funciona como hasta ahora.

Teclas que leen hoy los motores (comprobado en el código):

| Juego      | Teclas                                                                                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Asteroides | `ArrowLeft`/`ArrowRight` (rotar), `ArrowUp` (impulso), `Space` (disparo). Estado mantenido (`keys[code]`).                                                                                             |
| Tetris     | `ArrowLeft`/`ArrowRight`/`ArrowDown` (mover y bajar), `ArrowUp` o `KeyX` (girar), `Space` (caída rápida). Una acción por `keydown`, sin ignorar `repeat`: en escritorio repite el teclado del sistema. |
| Arkanoid   | Solo `ArrowLeft`/`ArrowRight` (estado mantenido). Sin botones de acción.                                                                                                                               |
| Snake      | `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight` y WASD; lee `e.key` en minúscula. Un giro por `keydown`. Sin botones de acción.                                                                         |

---

## Alcance

**In:**

- Tabla `CONTROLES_TACTILES` por `gameId` en `app/games/controles-tactiles.ts` (qué direcciones están activas, qué tecla emula A y cuál B, etiquetas y si las direcciones repiten).
- Componente cliente `app/components/touch-controls.tsx`: cruceta de 4 botones y botones A y B, que despachan `keydown`/`keyup` sintéticos en `window` con `pointerdown`/`pointerup`.
- Montaje en `GamePlayer` justo debajo del marco `.crt`, solo si el `gameId` tiene entrada en la tabla.
- Los botones que el juego no usa se muestran **deshabilitados** (atenuados, sin emitir teclas) para mantener la consola idéntica entre juegos.
- Auto-repetición de las direcciones mantenidas solo donde la tabla lo pide (Tetris).
- Liberación segura de teclas: al soltar, `pointercancel`, pérdida de captura, `blur` de ventana, pestaña oculta y desmontaje.
- CSS en `app/globals.css`: consola visible solo con `(pointer: coarse)`, objetivos táctiles de al menos 48 × 48 px, `touch-action: none`, `user-select: none`, `-webkit-touch-callout: none` y `-webkit-tap-highlight-color: transparent` en consola y canvas; `contextmenu` cancelado en la consola.
- Compactación del reproductor en móvil (`@media (max-width: 720px)`): estadísticas en una fila, botones PAUSA/SKIN/TEMA/FIN/SALIR en una fila pequeña, marco `.crt` con menos relleno.
- Disposición en apaisado móvil sin scroll para ver el canvas completo.
- Verificación con emulación móvil de Playwright y prueba en un móvil real.
- Actualizar `CLAUDE.md` y `.claude/skills/new-game/puntos-de-integracion.md`.

**Out of scope:**

- Gestos sobre el canvas (swipe, arrastre para mover la pala de Arkanoid).
- Cruceta deslizante (arrastrar el dedo de un botón a otro sin soltar).
- Cambios en los motores (`game.ts`), en la lógica de los juegos y en el contrato `onChange`.
- Botones extra (más de A y B), vibración háptica y configuración de controles por el usuario.
- Bloquear el zoom global (`user-scalable=no`) ni tocar la meta `viewport`.
- Bloquear u obligar la orientación de la pantalla.
- Las 7 maquetas (simulación con `setInterval`): no tienen control real.
- Cambios en el resto de páginas, el modal de fin de juego o la barra de navegación.

---

## Modelo de datos

### `app/games/controles-tactiles.ts` (nuevo)

```ts
export type DireccionTactil = "up" | "down" | "left" | "right";
export interface TeclaEmulada {
  code: string; // KeyboardEvent.code que lee el motor
  key: string; // KeyboardEvent.key (Snake lee `key`)
}
export interface BotonAccion {
  etiqueta: string; // texto bajo el botón, p. ej. "DISPARO"
  tecla: TeclaEmulada;
}
export interface ControlesTactiles {
  direcciones: DireccionTactil[]; // activas; las demás se muestran deshabilitadas
  a: BotonAccion | null; // null = deshabilitado
  b: BotonAccion | null;
  repetir: boolean; // auto-repetición de las direcciones mantenidas
}
export const TECLAS_DIRECCION: Record<DireccionTactil, TeclaEmulada> = {
  up: { code: "ArrowUp", key: "ArrowUp" },
  down: { code: "ArrowDown", key: "ArrowDown" },
  left: { code: "ArrowLeft", key: "ArrowLeft" },
  right: { code: "ArrowRight", key: "ArrowRight" },
};
export const CONTROLES_TACTILES: Record<string, ControlesTactiles>;
```

Valores de `CONTROLES_TACTILES`:

| `gameId`     | `direcciones`                 | `a`                         | `b`                      | `repetir` |
| ------------ | ----------------------------- | --------------------------- | ------------------------ | --------- |
| `asteroides` | `left`, `right`, `up`         | `DISPARO` → `Space` (`" "`) | `null`                   | `false`   |
| `tetris`     | `left`, `right`, `down`, `up` | `CAÍDA` → `Space` (`" "`)   | `GIRAR` → `KeyX` (`"x"`) | `true`    |
| `arkanoid`   | `left`, `right`               | `null`                      | `null`                   | `false`   |
| `snake`      | `up`, `down`, `left`, `right` | `null`                      | `null`                   | `false`   |

En Tetris la flecha ↑ de la cruceta también gira (como en el teclado); B es un segundo acceso al giro con el pulgar derecho.

### Comportamiento de la emulación

- `pointerdown` en un botón activo: `preventDefault()`, `setPointerCapture(pointerId)` y se despacha `window.dispatchEvent(new KeyboardEvent("keydown", { code, key, bubbles: true, cancelable: true }))`. El destino es `window`, no un elemento, así que el filtro `esCampoEditable` de los motores no lo descarta.
- Soltar el dedo (`pointerup`, `pointercancel` o `lostpointercapture`): un único `keyup` con el mismo `code`/`key`, solo si la tecla seguía marcada como pulsada.
- Auto-repetición (solo direcciones con `repetir: true`): tras 250 ms pulsado, un `keydown` con `repeat: true` cada 80 ms hasta soltar.
- Varios dedos a la vez (p. ej. ← y A) funcionan porque cada botón gestiona su propio `pointerId`.
- Un `Set` de teclas pulsadas permite soltarlas todas con `keyup` al desmontar, en `blur` de la ventana y con `visibilitychange` oculto.
- Con la partida en pausa o terminada los motores ignoran el `keydown`; el `keyup` se envía igualmente.

### Persistencia

Ninguna. No se guarda nada en `localStorage`, Supabase ni cookies.

---

## Plan de implementación

1. **Tabla de controles.** Crear `app/games/controles-tactiles.ts` con los tipos, `TECLAS_DIRECCION` y `CONTROLES_TACTILES` según la tabla.
2. **Componente de consola.** Crear `app/components/touch-controls.tsx` (`"use client"`, prop `gameId`). Si el `gameId` no está en la tabla, devuelve `null`. Renderiza `<div role="group" aria-label="Controles táctiles">` con la cruceta (rejilla 3 × 3: ↑ arriba, ← y → a los lados, ↓ abajo) y los botones A y B, cada uno un `<button type="button">` con `aria-label` ("Arriba", "Izquierda", "Disparo"…), `disabled` si no se usa, y la lógica de emulación descrita. La etiqueta de A y B se pinta bajo cada botón.
3. **Estilos.** En `app/globals.css`: clases `.touch-console`, `.touch-dpad`, `.touch-btn` y `.touch-actions`, con `display: none` por defecto y `display: grid` dentro de `@media (pointer: coarse)`; objetivos de 56 px la cruceta y 64 px A y B; estética arcade de las variables existentes (`--cyan`, `--magenta`, `--pixel`); estado `:active` visible y `:disabled` atenuado. `touch-action: none`, `user-select: none`, `-webkit-touch-callout: none` y `-webkit-tap-highlight-color: transparent` en la consola y en `.asteroids-canvas`, `.tetris-canvas`, `.arkanoid-canvas` y `.snake-canvas`.
4. **Montaje en el reproductor.** En `app/components/game-player.tsx`, renderizar `<TouchControls gameId={gameId} />` justo después de `<div className="crt">…</div>`. Sin ramas por juego: solo la consulta a la tabla. No se tocan los canvases, las skins ni el modal.
5. **Compactar el HUD y el marco en móvil.** En `app/globals.css`, bajo `@media (max-width: 720px)`: `.hud-stats` en una sola fila con valores más pequeños (el nombre del jugador se recorta con `text-overflow: ellipsis`), `.hud-actions` en una fila de botones pequeños sin desbordar (se permite `flex-wrap` solo si no caben a 360 px) y `.crt` con relleno y radios menores para que el canvas gane ancho. No cambia el escritorio.
6. **Apaisado.** Con `(pointer: coarse) and (orientation: landscape) and (max-height: 500px)`, el canvas debe verse entero sin scroll vertical; la consola se coloca a los lados del marco (cruceta a la izquierda, A y B a la derecha) o en la misma fila, a elección de quien implemente mientras cumpla el criterio de aceptación.
7. **Verificación.** Con el MCP de Playwright emular un móvil táctil (p. ej. un dispositivo Pixel con `hasTouch` e `isMobile` creado con `browser_run_code_unsafe`, porque `browser_resize` por sí solo no activa `pointer: coarse`) a ≈ 375 × 667 y en apaisado 667 × 375; guardar capturas en `.playwright-screenshots/`. Probar los cuatro juegos con la consola y, además, en un móvil real a través de la IP de la red local (ver Riesgos).
8. **Documentación.** Actualizar `CLAUDE.md` (spec 14 en la lista y un párrafo sobre `controles-tactiles.ts`, `touch-controls.tsx` y la emulación de teclado) y `.claude/skills/new-game/puntos-de-integracion.md` con el paso «añadir la entrada del juego en `CONTROLES_TACTILES`».

---

## Criterios de aceptación

- [x] `npm run lint` y `npm run build` terminan sin errores.
- [x] `CONTROLES_TACTILES` tiene exactamente las claves `asteroides`, `tetris`, `arkanoid` y `snake`, con los valores de la tabla.
- [x] No cambia ningún archivo de `app/games/*/game.ts` ni los tipos de los motores.
- [x] En escritorio (puntero fino) la consola no aparece (`display: none`) y el teclado funciona igual que antes en los cuatro juegos.
- [x] En un dispositivo táctil, `/juegos/<id>/jugar` de los cuatro juegos muestra bajo el marco `.crt` la cruceta a la izquierda y los botones A y B a la derecha; en `/juegos/<id>` y en las maquetas no aparece.
- [x] Cada botón de la consola mide al menos 48 × 48 px.
- [x] Al pulsar un botón activo, un listener de `keydown` en `window` recibe el `code` y `key` esperados; al soltar, un único `keyup`.
- [x] Asteroides: ← y → giran la nave, ↑ impulsa y A dispara; se puede mantener ← y pulsar A a la vez; B aparece deshabilitado y ↓ también.
- [x] Tetris: ← → ↓ mueven la pieza y, manteniendo pulsado, repiten (250 ms de retardo y 80 ms de intervalo); ↑ y B giran; A hace caída rápida.
- [x] Arkanoid: ← y → mueven la pala mientras se mantienen y la detienen al soltar; ↑, ↓, A y B aparecen deshabilitados.
- [x] Snake: las cuatro flechas giran la serpiente sin reversas y la primera pulsación arranca la partida; A y B aparecen deshabilitados.
- [x] Mantener pulsado un botón y levantar el dedo fuera de él, o recibir `pointercancel`, libera la tecla: la nave no queda girando y la pala no queda desplazándose.
- [x] Al cambiar de pestaña, pulsar PAUSA o salir del reproductor no queda ninguna tecla sintética pulsada.
- [x] Mantener pulsado un botón no abre el menú contextual, no selecciona texto, no hace scroll de la página ni hace zoom con doble toque sobre la consola o el canvas.
- [x] A 375 × 667, con la consola, el HUD compacto y el canvas, no hay scroll horizontal y el canvas se ve completo con la consola visible tras como máximo un desplazamiento vertical corto; a 360 px de ancho los botones del HUD no se desbordan.
- [x] En apaisado 667 × 375 el canvas se ve entero sin scroll vertical y la consola es utilizable.
- [x] Las skins, el botón TEMA, la pausa, el modal de fin de juego y el guardado de puntuaciones siguen funcionando con la consola.
- [x] Se probó en al menos un móvil real y se anotó el resultado en el PR.
- [x] `CLAUDE.md` y `.claude/skills/new-game/puntos-de-integracion.md` mencionan la consola táctil y el paso de alta de un juego nuevo.

---

## Decisiones

- **Sí:** consola física simulada debajo del canvas, igual para todos los juegos (decisión del usuario). **No:** controles superpuestos al canvas (tapan el tablero) ni gestos por juego.
- **Sí:** emular teclado con `KeyboardEvent` sintéticos en `window`. Así los cuatro motores no cambian y el filtro de campos editables y la lógica de pausa siguen valiendo. **No:** añadir `pointer`/`touch` a cada motor (duplica código y riesgo de regresión).
- **Sí:** dos botones (A y B) como máximo, según el usuario; el A siempre es `Space` y el B `KeyX` para que las convenciones se mantengan en juegos futuros.
- **Sí:** botones sin uso deshabilitados en lugar de ocultos, para que la consola tenga siempre la misma forma y el pulgar no tenga que reaprender la posición entre juegos.
- **Sí:** configuración declarativa por `gameId` en una tabla. No es el «registro genérico de juegos» descartado en las specs 11 a 13: solo guarda teclas, no componentes, y evita ramas `esXxx` por juego para un juego nuevo.
- **Sí:** auto-repetición en el componente, solo para Tetris, porque su motor actúa por `keydown` y en un móvil no hay repetición del sistema. Los motores de estado mantenido (Asteroides, Arkanoid) no la necesitan y Snake gira una vez por pulsación.
- **Sí:** visibilidad por `(pointer: coarse)`. **No:** por ancho de pantalla (en escritorio con la ventana estrecha estorbaría).
- **Sí:** `touch-action: none` y `user-select: none` en consola y canvas. **No:** `user-scalable=no` en la meta viewport (perjudicaría la accesibilidad del resto de la web).
- **Sí:** compactar el HUD solo en `max-width: 720px`; el escritorio queda igual.
- **No:** mover la pala de Arkanoid con arrastre sobre el canvas ni cruceta deslizante en esta spec; se pueden pedir después si la cruceta resulta incómoda.

---

## Riesgos

| Riesgo                                                                                            | Mitigación                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Playwright MCP no activa `(pointer: coarse)` con un simple `browser_resize` y la consola no se ve | Crear un contexto con `hasTouch` e `isMobile` (dispositivo Pixel) mediante `browser_run_code_unsafe`, y confirmar en un móvil real.                                  |
| Cada pulsación emula una tecla; una animación o un `keyup` perdido deja la nave girando           | Liberación en `pointerup`, `pointercancel`, `lostpointercapture`, `blur`, `visibilitychange` y desmontaje (criterios de aceptación).                                 |
| Sin cruceta deslizante, cambiar rápido de ← a → en Asteroides exige levantar el dedo              | Se acepta en esta spec; los botones grandes (56 px) minimizan fallos. Si resulta incómodo, spec aparte.                                                              |
| Con el HUD compacto y la consola, el canvas sigue siendo pequeño en pantallas muy bajas           | Apaisado con la consola a los lados; si no cabe, se acepta un desplazamiento vertical corto en vertical.                                                             |
| `next dev` bloquea el acceso desde el móvil por IP de la red local (`allowedDevOrigins`)          | `next.config.ts` ya tiene `allowedDevOrigins` con una IP local; para probar en el móvil añadir temporalmente la IP actual (p. ej. `192.168.50.34`) y no commitearla. |
| Un juego real futuro olvida su entrada en `CONTROLES_TACTILES` y en móvil no se puede jugar       | Paso explícito en `puntos-de-integracion.md` y en `/new-game`.                                                                                                       |
| `touch-action: none` en el canvas impide hacer scroll con el dedo sobre él                        | Es deliberado mientras se juega; el resto de la página (HUD y consola) sigue desplazable.                                                                            |

---

## Qué **no** está en este spec

- Gestos (swipe, arrastre) y cruceta deslizante.
- Cambios de los motores de Asteroides, Tetris, Arkanoid y Snake.
- Botones adicionales, vibración o remapeo de teclas por el usuario.
- Bloqueo de zoom global o de orientación.
- Controles para las maquetas.
