# SPEC 11 — Skins `clasico`, `neon` y `retro` para ASTEROIDES

> **Status:** Implementado
> **Depends on:** SPEC 06 (motor de canvas de Asteroides y `GamePlayer`), SPEC 08 (patrón de tema de Tetris: paletas, `setTheme`, prop `theme` y botón TEMA)
> **Date:** 2026-10-29
> **Objective:** Dar a Asteroides tres skins de canvas (`clasico`, `neon` y `retro`) seleccionables con un botón `SKIN` en el reproductor y recordadas en `localStorage`, generalizando el patrón de temas de Tetris.

---

## Por qué existe este spec

Hoy solo Tetris tiene temas (`dark` y `light`, con el botón TEMA). Asteroides dibuja con colores escritos a mano en cada entidad (`#fff`, `#0ff`, `rgba(255, 130, 0, 0.85)`, `rgba(255,255,255,…)`) y en `game.ts` (HUD, icono de vidas, GAME OVER), así que no hay un único sitio donde cambiar el aspecto. Este spec crea una tabla de paletas, hace que todo el dibujo pase por ella y añade el selector, igual que `PALETAS` y `setTheme` en Tetris.

Particularidades de Asteroides:

- **No tiene archivo de dibujo.** Cada entidad de `entities.ts` se dibuja a sí misma (`draw(ctx)`) y el HUD y el GAME OVER viven en `game.ts`. Por eso la tabla de paletas va en un módulo nuevo, `app/games/asteroids/paletas.ts`, y las entidades reciben la paleta por parámetro (siguen sin acceder a `document`).
- **Es un juego vectorial.** No hay spritesheet: todo son trazos de líneas sobre fondo negro. La skin cambia colores, grosor de línea, brillo y tipografía, nunca la geometría ni los radios de colisión.
- **`clasico` es el aspecto actual**, píxel por píxel (fondo `#000000`, trazos blancos, power-up cian, llama naranja). Es el valor por defecto.
- **Esta spec crea la base compartida** `app/games/skins.ts`, que todavía no existe. Las specs de skins de los demás juegos la reutilizarán.

---

## Alcance

**In:**

- Base compartida `app/games/skins.ts`: `SKINS_BASE` (`["clasico", "neon", "retro"]`), `NOMBRES_SKIN` (nombre visible en mayúsculas) y `siguienteSkin(lista, actual)`.
- Tipo `SkinAsteroides` y método `setSkin(skin)` en `app/games/asteroids/types.ts`.
- Módulo `app/games/asteroids/paletas.ts` con `PALETAS: Record<SkinAsteroides, PaletaAsteroides>` y valores hex concretos.
- Todas las entidades de `entities.ts` (`Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`) y el HUD, el icono de vidas y el GAME OVER de `game.ts` dibujan con la paleta activa.
- `setSkin(skin)` en el motor: no hace nada si es la misma skin o tras `destroy()`, y redibuja de inmediato (con el juego en pausa, en `gameover` o corriendo).
- Prop `skin` en `AsteroidsCanvas`, aplicada al crear el motor y en un `useEffect`.
- Botón `SKIN: <NOMBRE>` (`btn cyan`) en `GamePlayer` solo para `asteroides`, que rota `clasico → neon → retro → clasico`, con persistencia en `localStorage` (`av-asteroides-skin`).
- Actualizar `CLAUDE.md` y `.claude/skills/new-game/puntos-de-integracion.md`.

**Out of scope (para otros specs):**

- Skins de Tetris (`dark` → `clasico`, `light`, migración de `av-tetris-theme`), Arkanoid y Snake: cada juego tiene su propio spec `NN-skins-<id>.md`.
- Sonido (Asteroides no tiene), nuevas mecánicas, cambios de puntuación, de colisiones, de velocidades o de niveles.
- El marco CRT (`.crt`, `.crt-screen`), la barra `player-hud` de React, el modal de fin de juego y las portadas.
- Skins por usuario o sincronizadas con Supabase: la preferencia vive solo en el navegador.
- Convertir `GamePlayer` en un registro genérico de juegos (decisión cerrada): se añade una rama más, como las de Tetris.

---

## Modelo de datos

### `app/games/skins.ts` (nuevo, compartido)

```ts
export const SKINS_BASE = ["clasico", "neon", "retro"] as const;
export type SkinBase = (typeof SKINS_BASE)[number];
export const NOMBRES_SKIN: Record<string, string> = {
  clasico: "CLÁSICO",
  neon: "NEÓN",
  retro: "RETRO",
};
// Devuelve la skin siguiente de la lista; si `actual` no está, la primera.
export function siguienteSkin<T extends string>(
  lista: readonly T[],
  actual: T,
): T;
```

### `app/games/asteroids/types.ts`

```ts
export type SkinAsteroides = "clasico" | "neon" | "retro";
export interface JuegoAsteroides {
  pause(): void;
  resume(): void;
  restart(): void;
  setSkin(skin: SkinAsteroides): void; // no-op si es la misma o tras destroy(); redibuja
  destroy(): void;
}
```

`SnapshotAsteroides` y el contrato de `onChange` (`score`, `lives`, `level`, `status`) no cambian.

### `app/games/asteroids/paletas.ts` (nuevo)

```ts
export interface PaletaAsteroides {
  fondo: string; // relleno del lienzo
  nave: string; // trazo de la nave
  asteroide: string; // trazo de los asteroides
  bala: string; // relleno de las balas
  particulaRgb: string; // "r,g,b" de las chispas; el alfa lo pone la vida restante
  powerUp: string; // marco y texto "3x"
  llamaRgb: string; // "r,g,b" de la llama del propulsor
  llamaAlfa: number;
  hud: string; // SCORE y NIVEL
  hudExtra: string; // contador "3x  N.Ns"
  iconoVida: string; // trazo del icono de vidas
  overlayTitulo: string; // "GAME OVER"
  overlaySub: string; // subtítulo del GAME OVER
  grosor: number; // lineWidth de nave y asteroides
  grosorVida: number; // lineWidth del icono de vidas
  union: CanvasLineJoin; // lineJoin de nave, asteroides e icono
  brillo: number; // shadowBlur de nave, asteroides, balas, power-up y texto (0 = sin brillo)
  fuenteHud: string;
  fuenteTitulo: string;
  fuenteSub: string;
  fuentePowerUp: string;
}
```

Valores (todos los colores en hex salvo `*Rgb` y el subtítulo del `clasico`, que conserva su `rgba` actual):

| Campo                    | `clasico`                | `neon`                | `retro`                 |
| ------------------------ | ------------------------ | --------------------- | ----------------------- |
| `fondo`                  | `#000000`                | `#05010f`             | `#0a140a`               |
| `nave`                   | `#ffffff`                | `#00f5ff`             | `#33ff33`               |
| `asteroide`              | `#ffffff`                | `#ff006e`             | `#20b020`               |
| `bala`                   | `#ffffff`                | `#f5ff00`             | `#33ff33`               |
| `particulaRgb`           | `255,255,255`            | `255,0,110`           | `51,255,51`             |
| `powerUp`                | `#00ffff`                | `#00ff88`             | `#33ff33`               |
| `llamaRgb` / `llamaAlfa` | `255,130,0` / `0.85`     | `245,255,0` / `0.85`  | `32,176,32` / `1`       |
| `hud`                    | `#ffffff`                | `#00f5ff`             | `#33ff33`               |
| `hudExtra`               | `#00ffff`                | `#00ff88`             | `#33ff33`               |
| `iconoVida`              | `#ffffff`                | `#00f5ff`             | `#33ff33`               |
| `overlayTitulo`          | `#ffffff`                | `#ff006e`             | `#33ff33`               |
| `overlaySub`             | `rgba(255,255,255,0.65)` | `#00f5ff`             | `#20b020`               |
| `grosor`                 | `1.5`                    | `2`                   | `2`                     |
| `grosorVida`             | `1.2`                    | `1.6`                 | `2`                     |
| `union`                  | `round`                  | `round`               | `miter`                 |
| `brillo`                 | `0`                      | `12`                  | `0`                     |
| `fuenteHud`              | `15px monospace`         | `15px monospace`      | `10px` + `FUENTE_PIXEL` |
| `fuenteTitulo`           | `bold 46px monospace`    | `bold 46px monospace` | `28px` + `FUENTE_PIXEL` |
| `fuenteSub`              | `18px monospace`         | `18px monospace`      | `11px` + `FUENTE_PIXEL` |
| `fuentePowerUp`          | `bold 12px monospace`    | `bold 12px monospace` | `9px` + `FUENTE_PIXEL`  |

Notas de cada skin:

- **`clasico`**: idéntica al código actual. `brillo: 0` significa que no se toca `shadowBlur`.
- **`neon`**: fondo casi negro y los cuatro colores del tema arcade de `app/globals.css` (`--cyan #00f5ff`, `--magenta #ff006e`, `--yellow #f5ff00`, `--green #00ff88`). El brillo se logra con `shadowBlur = 12` y `shadowColor` igual al color del propio trazo, dentro de `save()`/`restore()`. Las chispas de explosión no llevan brillo (hay decenas a la vez; es una decisión de rendimiento).
- **`retro`**: solo dos verdes de fósforo (`#33ff33` y `#20b020`) sobre `#0a140a`, sin brillo ni degradados, trazos de 2 px con unión `miter` y tipografía pixel. `FUENTE_PIXEL` es la familia de `Press Start 2P`: el motor la resuelve una vez con `getComputedStyle(document.documentElement).getPropertyValue("--font-press-start")` y, si viene vacía, usa `"Courier New", monospace`. Como la fuente pixel es más ancha, los cuerpos de texto son menores que en las otras skins. El desvanecimiento por alfa de las chispas se conserva: es una transparencia, no un degradado.

### Persistencia

- Clave: `av-asteroides-skin`. Valores válidos: `clasico`, `neon`, `retro`. Cualquier otro valor, o `localStorage` bloqueado, deja `clasico`.
- Lectura en un `useEffect` tras hidratar (igual que `CLAVE_TEMA_TETRIS`) para evitar desajustes de hidratación; escritura dentro de `try/catch`.

---

## Plan de implementación

1. **Base compartida.** Crear `app/games/skins.ts` con `SKINS_BASE`, `SkinBase`, `NOMBRES_SKIN` y `siguienteSkin`. Comprobación: `npm run lint` pasa; nadie la usa aún.
2. **Tipos.** En `app/games/asteroids/types.ts` añadir `SkinAsteroides` y `setSkin` a `JuegoAsteroides`. Mientras el motor no lo implemente, el paso 5 va en el mismo commit que este para no romper el tipado.
3. **Paletas.** Crear `app/games/asteroids/paletas.ts` con `PaletaAsteroides` y `PALETAS` con los valores de la tabla. Exportar también `resolverFuentePixel()`, que lee `--font-press-start` (solo se llama desde el motor, dentro del navegador).
4. **Entidades.** En `app/games/asteroids/entities.ts` cambiar las firmas a `draw(ctx, paleta)` en `Bullet`, `Asteroid`, `PowerUp`, `Ship` y `Particle`, y sustituir cada color, `lineWidth`, `lineJoin` y fuente fijos por campos de la paleta. Con `paleta.brillo > 0`, envolver el trazo en `save()`/`restore()` con `shadowBlur` y `shadowColor`. La geometría, las constantes y los radios de colisión no se tocan.
5. **Motor.** En `app/games/asteroids/game.ts`: variable `skin` (por defecto `"clasico"`), `const paleta = () => PALETAS[skin]`; `draw()` rellena con `paleta().fondo` y pasa la paleta a las entidades; `drawHUD`, `drawLifeIcon` y `drawOverlay` usan sus campos; añadir `setSkin(nueva)`: `if (destroyed || nueva === skin) return; skin = nueva; draw();`. Con el juego en pausa o terminado (bucle parado) el `draw()` de `setSkin` es el que refresca el lienzo. Con `skin === "clasico"` el resultado es idéntico al actual.
6. **Canvas de React.** En `app/components/asteroids-canvas.tsx` añadir la prop `skin?: SkinAsteroides` (por defecto `"clasico"`), guardarla en un ref que se actualiza junto a `onChange` y `paused`, aplicarla con `game.setSkin(skinRef.current)` justo tras crear el motor y en un `useEffect([skin])` (mismo patrón que `theme` en `tetris-canvas.tsx`). El motor sigue creándose una sola vez.
7. **Reproductor.** En `app/components/game-player.tsx`: estado `skinAsteroides` (`SkinAsteroides`, inicial `"clasico"`); `useEffect([esAsteroides])` que lee `av-asteroides-skin`, acepta solo valores de `SKINS_BASE` y envuelve en `try/catch`; `cambiarSkin` que calcula la siguiente con `siguienteSkin(SKINS_BASE, skinAsteroides)`, la guarda en estado y en `localStorage` (con `try/catch`); botón `btn cyan` con el texto `SKIN: {NOMBRES_SKIN[skinAsteroides]}` en `hud-actions`, junto a PAUSA y solo si `esAsteroides`; y `skin={skinAsteroides}` en `<AsteroidsCanvas>`. El botón TEMA de Tetris y su lógica no se tocan en esta spec.
8. **Documentación.** Actualizar `CLAUDE.md`: spec 11 en la lista, `app/games/skins.ts` y `paletas.ts` en la descripción de `app/games/asteroids/`, la prop `skin` y el botón `SKIN` de Asteroides. Actualizar `.claude/skills/new-game/puntos-de-integracion.md`: fila para `app/games/skins.ts` y el patrón de paletas, `setSkin`, prop `skin` y clave `av-<id>-skin` que debe llevar un juego nuevo.

---

## Criterios de aceptación

- [x] `npm run lint` termina sin errores.
- [x] `npm run build` termina sin errores.
- [x] `app/games/skins.ts` existe y exporta `SKINS_BASE`, `NOMBRES_SKIN` y `siguienteSkin`.
- [x] `PALETAS` de Asteroides tiene exactamente las claves `clasico`, `neon` y `retro`, todos los colores en hex (salvo `particulaRgb`, `llamaRgb` y el `rgba` del subtítulo de `clasico`).
- [x] No queda ningún color ni fuente literal de dibujo en `entities.ts` ni en las funciones `draw*` de `game.ts`. Excepción aceptada: el `lineWidth` del marco del power-up (2) y el de las partículas (1) siguen literales, porque la paleta no tiene campo para ellos y no cambian con la skin.
- [x] En `/juegos/asteroides/jugar` la skin inicial (sin `localStorage`) es `clasico` y se ve igual que antes: fondo `#000000`, nave y asteroides blancos, power-up cian, sin brillo.
- [x] Con `neon` se ven el fondo `#05010f`, la nave cian, los asteroides magenta, las balas amarillas y el brillo en nave, asteroides y balas.
- [x] Con `retro` solo aparecen los verdes `#33ff33` y `#20b020` sobre `#0a140a`, sin brillo, y el HUD usa la tipografía pixel (o `monospace` si la fuente no está disponible).
- [x] El botón muestra `SKIN: CLÁSICO`, `SKIN: NEÓN` o `SKIN: RETRO` y, al pulsarlo, rota en ese orden y vuelve a `clasico` tras `retro`.
- [x] Cambiar de skin con el juego en pausa, en el modal de fin de juego o en `gameover` redibuja el lienzo al instante, sin reanudar la partida.
- [x] Cambiar de skin en mitad de la partida no reinicia ni altera puntos, vidas, nivel, posición de la nave ni asteroides.
- [x] Recargar la página conserva la skin elegida (`localStorage["av-asteroides-skin"]`).
- [x] Un valor inválido en `av-asteroides-skin` (p. ej. `"x"`) o `localStorage` bloqueado dejan `clasico` sin errores en consola.
- [x] `onChange` sigue enviando solo `score`, `lives`, `level` y `status`, y el marco CRT, la barra de React y el modal no cambian de aspecto con la skin.
- [x] Los demás juegos (Tetris con su botón TEMA, Arkanoid, Snake y las maquetas) funcionan igual que antes y no muestran botón SKIN.
- [x] `CLAUDE.md` y `.claude/skills/new-game/puntos-de-integracion.md` mencionan las skins y `app/games/skins.ts`.

---

## Decisiones

- **Sí:** módulo `paletas.ts` propio en `app/games/asteroids/`. Asteroides no tiene `draw.ts` y meter la tabla en `entities.ts` o `game.ts` mezclaría datos y lógica; así las entidades siguen sin tocar `document`.
- **No:** crear un `draw.ts` que reescriba el dibujo de las entidades. Sería un refactor sin relación con las skins; basta con pasar la paleta a los `draw` existentes.
- **Sí:** las entidades reciben la paleta por parámetro en cada `draw`. Cambiar de skin no obliga a reconstruir asteroides ni balas, y la partida continúa intacta.
- **Sí:** `clasico` reproduce los valores actuales, incluido el `rgba` del subtítulo, para que el aspecto por defecto no cambie.
- **Sí:** `neon` usa los hex de `app/globals.css` (`--cyan`, `--magenta`, `--yellow`, `--green`) en lugar de leer las variables CSS en el canvas, para que la paleta sea explícita y testeable.
- **Sí:** brillo con `shadowBlur` solo en `neon`, y no en las chispas, por coste de dibujo.
- **Sí:** `retro` con dos verdes, trazos de 2 px y unión `miter`, y fuente `Press Start 2P` resuelta desde `--font-press-start` con respaldo `monospace`. **No:** un `<link>` o `FontFace` propio, porque `next/font` ya la carga en `app/layout.tsx`.
- **Sí:** la lista de skins de Asteroides es exactamente `SKINS_BASE` (tres). No hay skins extra como `light` de Tetris.
- **Sí:** crear `app/games/skins.ts` aquí por ser la primera spec de skins en llegar; si otra spec la crea antes, esta solo la reutiliza.
- **No:** guardar la skin en Supabase o en la sesión. Es una preferencia de presentación; `localStorage` basta y no exige auth.
- **No:** generalizar `GamePlayer` a un registro de juegos con skins (decisión cerrada); se añade una rama condicionada por `esAsteroides`.
- **No:** tocar el botón TEMA de Tetris ni su clave `av-tetris-theme`: su migración a `SKIN` va en `NN-skins-tetris`.

---

## Riesgos

| Riesgo                                                                                                                         | Mitigación                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La fuente `Press Start 2P` no está cargada cuando se dibuja por primera vez en `retro`, y el canvas usa el respaldo sin avisar | Resolver la familia con `--font-press-start` y redibujar en `setSkin`; el bucle redibuja cada fotograma, así que se corrige solo. Con la partida en pausa se acepta el respaldo `monospace` hasta el siguiente redibujado. |
| `shadowBlur` baja los fotogramas en equipos modestos                                                                           | Brillo solo en `neon`, nunca en las chispas; en `clasico` y `retro` vale 0 y no se toca el contexto.                                                                                                                       |
| Olvidar un color literal y que una skin deje elementos blancos                                                                 | Criterio de aceptación explícito (sin colores literales en `entities.ts` y `draw*`) y revisión visual de las tres skins con una partida que incluya power-up, explosiones y GAME OVER.                                     |
| Texto del HUD de `retro` más ancho que en `monospace` y solapado con el contador `3x`                                          | Cuerpos de fuente menores en `retro` (10, 11 y 9 px); comprobar visualmente con SCORE de 6 dígitos y 3 vidas.                                                                                                              |

---

## Qué **no** está en este spec

- Skins de Tetris, Arkanoid y Snake (cada uno en su propio spec).
- Cambios de sonido, de mecánicas, de puntuación o de colisiones de Asteroides.
- Cambios en el marco CRT, la barra de React, el modal de fin de juego o las portadas.
- Persistencia de la skin en Supabase o por usuario.
- Un registro genérico de juegos en `GamePlayer`.
