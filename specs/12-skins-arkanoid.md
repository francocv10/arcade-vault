# SPEC 12 — Skins `clasico`, `neon` y `retro` para ARKANOID

> **Status:** Implementado
> **Depends on:** SPEC 09 (motor de canvas de Arkanoid y `GamePlayer`), SPEC 11 (base compartida `app/games/skins.ts` y patrón de paletas, `setSkin`, prop `skin` y botón `SKIN` de Asteroides)
> **Date:** 2026-10-29
> **Objective:** Dar a Arkanoid tres skins de canvas (`clasico`, `neon` y `retro`) seleccionables con un botón `SKIN` en el reproductor y recordadas en `localStorage`, resolviendo las skins no clásicas con formas vectoriales en lugar de filtrar el spritesheet.

---

## Por qué existe este spec

Arkanoid dibuja con un spritesheet (`public/games/arkanoid/spritesheet-breakout.png`: bloques de colores, paleta metálica, pelota y explosiones) y con unos pocos colores escritos a mano en `game.ts` (fondo `#000`, texto `#fff`, velo `rgba(0, 0, 0, 0.6)` y fuente `monospace`). No hay un único sitio donde cambiar el aspecto. Este spec crea una tabla de paletas, hace que todo el dibujo pase por ella y añade el selector, igual que en Asteroides (SPEC 11) y Tetris (SPEC 08).

Particularidades de Arkanoid:

- **Juego con sprites.** Un tinte o filtro sobre el PNG sería poco fiable: `ctx.filter` no funciona en todos los navegadores (Safari), y un tinte con `globalCompositeOperation` sobre una imagen con transparencia obliga a un lienzo auxiliar por sprite y por fotograma. Por eso `clasico` sigue usando el spritesheet tal cual y `neon` y `retro` **sustituyen los sprites por formas** (rectángulos, trazos y cuadrados) dibujadas con la paleta. No se crean assets nuevos.
- **`clasico` es el aspecto actual**, píxel por píxel (fondo `#000000`, sprites originales, texto `#ffffff`). Es el valor por defecto.
- **La geometría no cambia.** Las formas ocupan exactamente los rectángulos de colisión actuales (bloques 64×24, paleta 81×14, pelota 16×16), así que la skin no altera la jugabilidad.
- **Los sonidos no cambian** con la skin.
- **Reutiliza la base compartida** `app/games/skins.ts` (`SKINS_BASE`, `NOMBRES_SKIN`, `siguienteSkin`), que ya existe por la SPEC 11. No se modifica.

---

## Alcance

**In:**

- Tipo `SkinArkanoid` y método `setSkin(skin)` en `app/games/arkanoid/types.ts`.
- Módulo `app/games/arkanoid/paletas.ts` con `PALETAS: Record<SkinArkanoid, PaletaArkanoid>` (hex concretos) y `resolverFuentePixel()`.
- Módulo `app/games/arkanoid/formas.ts` (lógica pura, sin `document`) con `dibujarBloque`, `dibujarPaleta`, `dibujarPelota` y `dibujarExplosion`, que reciben el contexto y la paleta.
- `draw()` y `drawOverlay()` de `game.ts` dibujan con la paleta activa: con `modo: "sprites"` usan `drawSprite`/`drawFrame` como hoy; con `modo: "formas"` usan `formas.ts`. HUD (Score, Nivel, bolas de vidas) y velo de GAME OVER / victoria incluidos.
- `setSkin(skin)` en el motor: no hace nada si es la misma skin o tras `destroy()`, y redibuja de inmediato si el bucle está parado (pausa, `gameover` o `win`) y el spritesheet ya cargó.
- Prop `skin` en `ArkanoidCanvas`, aplicada al crear el motor y en un `useEffect`.
- Botón `SKIN: <NOMBRE>` (`btn cyan`) en `GamePlayer` solo para `arkanoid`, que rota `clasico → neon → retro → clasico`, con persistencia en `localStorage` (`av-arkanoid-skin`).
- Actualizar `CLAUDE.md` y `.claude/skills/new-game/puntos-de-integracion.md`.

**Out of scope (para otros specs):**

- Skins de Tetris, Snake y las demás: cada juego tiene su propio spec `NN-skins-<id>.md`.
- Sonido, nuevas mecánicas, cambios de puntuación, de niveles, de velocidades o de colisiones.
- Nuevos assets (no se crea ningún PNG ni se edita `spritesheet-breakout.png`).
- El marco CRT (`.crt`, `.crt-screen`), la barra `player-hud` de React, el modal de fin de juego y la portada `.cover-arkanoid`.
- Skins por usuario o sincronizadas con Supabase.
- Convertir `GamePlayer` en un registro genérico de juegos (decisión cerrada).

---

## Modelo de datos

### `app/games/arkanoid/types.ts`

```ts
export type SkinArkanoid = "clasico" | "neon" | "retro";
export interface JuegoArkanoid {
  pause(): void;
  resume(): void;
  restart(): void;
  setSkin(skin: SkinArkanoid): void; // no-op si es la misma o tras destroy(); redibuja
  destroy(): void;
}
```

`SnapshotArkanoid` y el contrato de `onChange` (`score`, `lives`, `level`, `status`) no cambian.

### `app/games/arkanoid/paletas.ts` (nuevo)

```ts
import type { ColorBloque } from "./levels";
export interface PaletaArkanoid {
  modo: "sprites" | "formas"; // "sprites": spritesheet original; "formas": figuras vectoriales
  fondo: string; // relleno del lienzo
  bloques: Record<ColorBloque, string>; // color de cada bloque (solo modo "formas")
  bloqueBorde: string; // trazo interior de los bloques (solo modo "formas")
  paleta: string; // relleno de la paleta (solo "formas")
  paletaBorde: string; // trazo y franjas de la paleta (solo "formas")
  pelota: string; // relleno de la pelota y de las bolas de vidas (solo "formas")
  hud: string; // Score, Nivel
  overlayFondo: string; // velo de GAME OVER y victoria
  overlayTexto: string; // texto central del velo
  grosor: number; // lineWidth de los bordes (solo "formas")
  brillo: number; // shadowBlur de bloques, paleta, pelota y texto (0 = no se toca)
  fuenteHud: string;
  fuenteOverlay: string;
}
```

Valores (colores en hex salvo `overlayFondo`, que es un `rgba` por llevar transparencia):

| Campo             | `clasico`             | `neon`                | `retro`                 |
| ----------------- | --------------------- | --------------------- | ----------------------- |
| `modo`            | `sprites`             | `formas`              | `formas`                |
| `fondo`           | `#000000`             | `#05010f`             | `#0a140a`               |
| `bloques.red`     | (sprite)              | `#ff006e`             | `#33ff33`               |
| `bloques.yellow`  | (sprite)              | `#f5ff00`             | `#20b020`               |
| `bloques.cyan`    | (sprite)              | `#00f5ff`             | `#33ff33`               |
| `bloques.magenta` | (sprite)              | `#d100ff`             | `#20b020`               |
| `bloques.hotpink` | (sprite)              | `#ff5fa2`             | `#33ff33`               |
| `bloques.green`   | (sprite)              | `#00ff88`             | `#20b020`               |
| `bloques.gray`    | (sprite)              | `#8a8fb5`             | `#106010`               |
| `bloqueBorde`     | (sprite)              | `#05010f`             | `#0a140a`               |
| `paleta`          | (sprite)              | `#00f5ff`             | `#33ff33`               |
| `paletaBorde`     | (sprite)              | `#ffffff`             | `#0a140a`               |
| `pelota`          | (sprite)              | `#f5ff00`             | `#33ff33`               |
| `hud`             | `#ffffff`             | `#00f5ff`             | `#33ff33`               |
| `overlayFondo`    | `rgba(0, 0, 0, 0.6)`  | `rgba(5, 1, 15, 0.7)` | `rgba(10, 20, 10, 0.8)` |
| `overlayTexto`    | `#ffffff`             | `#ff006e`             | `#33ff33`               |
| `grosor`          | `1`                   | `2`                   | `2`                     |
| `brillo`          | `0`                   | `12`                  | `0`                     |
| `fuenteHud`       | `bold 18px monospace` | `bold 18px monospace` | `12px` + `FUENTE_PIXEL` |
| `fuenteOverlay`   | `bold 64px monospace` | `bold 64px monospace` | `34px` + `FUENTE_PIXEL` |

En `clasico` los campos marcados «(sprite)» no se usan: se rellenan con los hex de la columna `neon` solo para satisfacer el tipo, o se declaran opcionales; el implementador elige, siempre que en `clasico` el dibujo siga siendo el del spritesheet.

### Cómo se dibuja cada elemento en `modo: "formas"` (`formas.ts`)

Todas las figuras ocupan el mismo rectángulo que el sprite al que sustituyen.

| Elemento       | `neon`                                                                                                                                                          | `retro`                                                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Bloque 64×24   | Rectángulo con relleno `bloques[color]` al 25 % de alfa y trazo `bloques[color]` de `grosor` inset 1 px; brillo `shadowBlur` con `shadowColor` del propio color | Rectángulo macizo `bloques[color]` sin trazo exterior y marco interior de 2 px en `bloqueBorde` (efecto ladrillo de 8 bits)       |
| Paleta 81×14   | Relleno `paleta`, trazo `paletaBorde` y brillo del color de la paleta                                                                                           | Relleno `paleta` con dos tapas de 4 px en `paletaBorde` a cada extremo                                                            |
| Pelota 16×16   | Círculo de radio 8 relleno de `pelota` con brillo                                                                                                               | Cuadrado 12×12 centrado relleno de `pelota`, sin brillo                                                                           |
| Explosión      | El mismo rectángulo del bloque que se expande 6 px por lado y se desvanece (alfa 1, 0,66, 0,33, 0,1 en los 4 fotogramas), trazo del color del bloque            | Cuatro cuadrados de 6 px en las esquinas del bloque que se alejan 2 px por fotograma y desaparecen en el cuarto, color del bloque |
| Bolas de vidas | Misma pelota de la skin a 16×16 en el HUD                                                                                                                       | Idem                                                                                                                              |

El fotograma de la explosión se calcula con la misma fórmula del motor (`Math.min(Math.floor((elapsed / EXPLOSION_DURATION) * 4), 3)`); la duración (150 ms) no cambia. Sin degradados en ninguna skin: el desvanecimiento es transparencia (`globalAlpha`), no un gradiente.

Notas de cada skin:

- **`clasico`**: idéntica al código actual. Con `brillo: 0` no se toca `shadowBlur`.
- **`neon`**: fondo casi negro y los colores del tema arcade de `app/globals.css` (`--cyan #00f5ff`, `--magenta #ff006e`, `--yellow #f5ff00`, `--green #00ff88`) más tres tonos de apoyo (`#d100ff`, `#ff5fa2`, `#8a8fb5`) para distinguir los 7 colores de bloque. El brillo usa `shadowBlur = 12` con `shadowColor` igual al color de la forma, dentro de `save()`/`restore()`. Las explosiones llevan brillo reducido a la mitad (`6`): puede haber varias a la vez.
- **`retro`**: solo tres verdes de fósforo (`#33ff33`, `#20b020`, `#106010`) sobre `#0a140a`, sin brillo ni degradados y tipografía pixel. Los siete colores de bloque se agrupan en claro/medio/oscuro alternando por fila, de modo que las filas siguen distinguiéndose. `FUENTE_PIXEL` es la familia de `Press Start 2P`: `resolverFuentePixel()` (misma implementación que `app/games/asteroids/paletas.ts`: lee `--font-press-start` con `getComputedStyle` y, si viene vacía, usa `"Courier New", monospace`) se llama desde el motor, nunca desde `formas.ts`.

### Persistencia

- Clave: `av-arkanoid-skin`. Valores válidos: `clasico`, `neon`, `retro`. Cualquier otro valor, o `localStorage` bloqueado, deja `clasico`.
- Lectura en un `useEffect` tras hidratar (como `av-asteroides-skin`) para evitar desajustes de hidratación; escritura dentro de `try/catch`.

---

## Plan de implementación

1. **Tipos.** En `app/games/arkanoid/types.ts` añadir `SkinArkanoid` y `setSkin` a `JuegoArkanoid`. El paso 5 va en el mismo commit para no romper el tipado.
2. **Paletas.** Crear `app/games/arkanoid/paletas.ts` con `PaletaArkanoid`, `PALETAS` (valores de la tabla) y `resolverFuentePixel()`. Comprobación: `npm run lint` pasa; nadie la usa aún.
3. **Formas.** Crear `app/games/arkanoid/formas.ts` con `dibujarBloque`, `dibujarPaleta`, `dibujarPelota` y `dibujarExplosion` (reciben `ctx`, rectángulo, color/fotograma y paleta; con `paleta.brillo > 0` envuelven el trazo en `save()`/`restore()` con `shadowBlur`/`shadowColor`). No tocan `document`. `sprites.ts` no cambia.
4. **Motor, dibujo.** En `game.ts`: variable `skin` (por defecto `"clasico"`) y `const paleta = () => PALETAS[skin]`; `draw()` rellena con `paleta().fondo`, y por cada bloque, explosión, paleta, pelota y bola de vidas elige entre `drawSprite`/`drawFrame` (`modo: "sprites"`) y las funciones de `formas.ts` (`modo: "formas"`); el texto del HUD usa `hud` y `fuenteHud`; `drawOverlay` usa `overlayFondo`, `overlayTexto` y `fuenteOverlay`. La fuente pixel se resuelve una sola vez al crear el motor. Con `skin === "clasico"` el resultado es idéntico al actual (`#000`, `#fff`, `bold 18px monospace`, `bold 64px monospace`).
5. **Motor, `setSkin`.** Añadir `setSkin(nueva)` al objeto devuelto: `if (destroyed || nueva === skin) return; skin = nueva; if (ready && rafId === null) draw();`. Con el bucle en marcha el siguiente fotograma ya usa la nueva skin; con pausa, `gameover` o `win` el `draw()` refresca el lienzo. Si el spritesheet aún no cargó, solo se guarda la skin y `sheet.onload` ya dibuja con ella. Cambiar de skin no toca puntos, vidas, nivel, bloques, posiciones ni sonidos.
6. **Canvas de React.** En `app/components/arkanoid-canvas.tsx` añadir la prop `skin?: SkinArkanoid` (por defecto `"clasico"`), guardarla en un ref actualizado junto a `onChange` y `paused`, aplicarla con `game.setSkin(skinRef.current)` justo tras crear el motor y en un `useEffect([skin])` (mismo patrón que `skin` en `asteroids-canvas.tsx`). El motor sigue creándose una sola vez.
7. **Reproductor.** En `app/components/game-player.tsx`, replicando la rama de Asteroides: estado `skinArkanoid` (`SkinArkanoid`, inicial `"clasico"`); `useEffect([esArkanoid])` que lee `av-arkanoid-skin`, acepta solo valores de `SKINS_BASE` y envuelve en `try/catch`; `cambiarSkinArkanoid` con `siguienteSkin(SKINS_BASE, skinArkanoid)`, que guarda en estado y en `localStorage` (con `try/catch`); botón `btn cyan` con el texto `SKIN: {NOMBRES_SKIN[skinArkanoid]}` en `hud-actions`, junto a PAUSA y solo si `esArkanoid`; y `skin={skinArkanoid}` en `<ArkanoidCanvas>`. No se crea un registro genérico: es una rama más. El botón TEMA de Tetris y el SKIN de Asteroides no se tocan.
8. **Documentación.** Actualizar `CLAUDE.md`: spec 12 en la lista, y en la descripción de `app/games/arkanoid/` los módulos `paletas.ts` y `formas.ts`, `setSkin`, la prop `skin` y el botón `SKIN` (clave `av-arkanoid-skin`). Actualizar `.claude/skills/new-game/puntos-de-integracion.md`: cómo resolver las skins en un juego con spritesheet (`modo: "sprites" | "formas"`, sin assets nuevos).

---

## Criterios de aceptación

- [ ] `npm run lint` termina sin errores.
- [ ] `npm run build` termina sin errores.
- [ ] `PALETAS` de Arkanoid tiene exactamente las claves `clasico`, `neon` y `retro`, con todos los colores en hex (salvo `overlayFondo`, en `rgba`).
- [ ] No queda ningún color ni fuente literal de dibujo en `draw()` ni en `drawOverlay()` de `game.ts`, ni en `formas.ts`.
- [ ] `app/games/skins.ts` no se modifica y `GamePlayer` usa `SKINS_BASE`, `NOMBRES_SKIN` y `siguienteSkin` para Arkanoid.
- [ ] No se añade ni se modifica ningún archivo de `public/`.
- [ ] En `/juegos/arkanoid/jugar` la skin inicial (sin `localStorage`) es `clasico` y se ve igual que antes: fondo `#000000`, bloques, paleta, pelota y explosiones del spritesheet, texto blanco.
- [ ] Con `neon` se ven el fondo `#05010f`, bloques con contorno de color y brillo, paleta cian, pelota amarilla redonda y explosiones que se expanden y desvanecen; no se dibuja ningún sprite del PNG.
- [ ] Con `retro` solo aparecen `#33ff33`, `#20b020` y `#106010` sobre `#0a140a`, sin brillo; la pelota es un cuadrado, las explosiones son cuatro cuadrados y el HUD usa la tipografía pixel (o `monospace` si no está disponible).
- [ ] El botón muestra `SKIN: CLÁSICO`, `SKIN: NEÓN` o `SKIN: RETRO` y, al pulsarlo, rota en ese orden y vuelve a `clasico` tras `retro`.
- [ ] Cambiar de skin con el juego en pausa, en `gameover` o en `win` redibuja el lienzo al instante, sin reanudar la partida.
- [ ] Cambiar de skin en mitad de la partida no reinicia ni altera puntos, vidas, nivel, bloques vivos, posición de la paleta ni de la pelota.
- [ ] Los bloques, la paleta y la pelota de `neon` y `retro` ocupan los mismos rectángulos que los sprites: la pelota rebota exactamente igual en las tres skins.
- [ ] Recargar la página conserva la skin elegida (`localStorage["av-arkanoid-skin"]`).
- [ ] Un valor inválido en `av-arkanoid-skin` (p. ej. `"x"`) o `localStorage` bloqueado dejan `clasico` sin errores en consola.
- [ ] `onChange` sigue enviando solo `score`, `lives`, `level` y `status`; el marco CRT, la barra de React, el modal de fin de juego y los sonidos no cambian con la skin.
- [ ] Los demás juegos funcionan igual que antes y no muestran un botón SKIN que no les corresponde.
- [ ] `CLAUDE.md` y `.claude/skills/new-game/puntos-de-integracion.md` mencionan las skins de Arkanoid y el enfoque `sprites`/`formas`.

---

## Decisiones

- **Sí:** `clasico` conserva el spritesheet y `neon`/`retro` lo sustituyen por formas vectoriales. **No:** tintar o filtrar el PNG (`ctx.filter`, `globalCompositeOperation` con lienzo auxiliar): compatibilidad irregular entre navegadores, coste por fotograma y resultado impreciso con sprites que ya tienen sombreado propio.
- **No:** crear spritesheets nuevos por skin. Duplicaría assets, cargas de red y estados de carga; las formas se definen con la paleta.
- **Sí:** `modo` en la paleta (`sprites` | `formas`), para que `clasico` no cambie ni un píxel y el motor decida el camino en un solo punto.
- **Sí:** las formas ocupan los mismos rectángulos que los sprites; así colisiones y jugabilidad no dependen de la skin.
- **Sí:** módulo `paletas.ts` y módulo `formas.ts` propios. `sprites.ts` sigue siendo lógica pura del spritesheet y no se mezcla.
- **Sí:** `neon` usa los hex de `app/globals.css` (más tres tonos de apoyo) en lugar de leer variables CSS en el canvas, para que la paleta sea explícita.
- **Sí:** `retro` con tres verdes y bloques alternados claro/oscuro por color, para mantener legibles las filas con solo la paleta de fósforo.
- **Sí:** brillo con `shadowBlur` solo en `neon`, reducido en las explosiones, por coste de dibujo.
- **Sí:** la lista de skins de Arkanoid es exactamente `SKINS_BASE` (tres).
- **No:** guardar la skin en Supabase o en la sesión; `localStorage` basta.
- **No:** generalizar `GamePlayer` a un registro de juegos (decisión cerrada).
- **No:** cambiar los sonidos con la skin: fuera de alcance.

---

## Riesgos

| Riesgo                                                                             | Mitigación                                                                                                                                                                  |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setSkin` llamado antes de que cargue el spritesheet: el motor aún no dibuja       | Solo guarda la skin; `sheet.onload` ya dibuja con ella. Las skins de formas no necesitan el PNG, pero el arranque sigue esperando a `onload` para no tocar el flujo actual. |
| La fuente `Press Start 2P` no está cargada la primera vez que se dibuja en `retro` | Resolver la familia con `--font-press-start`, con respaldo `monospace`; el bucle redibuja cada fotograma. En pausa se acepta el respaldo hasta el siguiente redibujado.     |
| `shadowBlur` en 60+ bloques de `neon` baja los fotogramas en equipos modestos      | Brillo solo en `neon`; medir con el nivel 1 (60 bloques). Si baja de 50 fps, limitar el brillo a paleta, pelota y texto y dejar los bloques solo con trazo.                 |
| Los 7 colores de bloque se vuelven indistinguibles en `retro` (3 tonos)            | Alternar tono por color y marco interior; comprobar visualmente los 5 niveles. No es información de jugabilidad: los bloques valen 10 puntos todos.                         |
| Texto del HUD de `retro` más ancho y solapado con las bolas de vidas               | Cuerpo de 12 px en `retro`; comprobar con Score de 4 cifras y 3 vidas.                                                                                                      |
| Olvidar un color literal y que una skin deje un elemento blanco                    | Criterio de aceptación explícito y revisión visual de las tres skins con bloques, explosión, `gameover` y `win`.                                                            |

---

## Qué **no** está en este spec

- Skins de Tetris y Snake (cada uno en su propio spec).
- Cambios de sonido, de mecánicas, de puntuación, de niveles o de colisiones de Arkanoid.
- Assets nuevos o edición del spritesheet.
- Cambios en el marco CRT, la barra de React, el modal de fin de juego o las portadas.
- Persistencia de la skin en Supabase o por usuario.
- Un registro genérico de juegos en `GamePlayer`.
