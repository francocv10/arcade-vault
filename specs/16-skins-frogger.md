# SPEC 16 — Skins `clasico`, `neon` y `retro` para FROGGER

> **Status:** Aprobado
> **Depends on:** `specs/game-jam/frogger/01-juego-frogger-motor.md` (motor de canvas de Frogger y `GamePlayer`, ya implementado en `app/games/frogger/`), SPEC 11 (patrón de skins: `app/games/skins.ts`, `paletas.ts`, `setSkin`, prop `skin` y botón `SKIN`)
> **Date:** 2026-11-02
> **Objective:** Dar a Frogger tres skins de canvas (`clasico`, `neon` y `retro`) seleccionables con un botón `SKIN` en el reproductor y recordadas en `localStorage` (`av-frogger-skin`), reutilizando la base compartida y el patrón de Asteroides y Snake.

---

## Por qué existe este spec

Frogger dibuja con colores escritos a mano en `app/games/frogger/draw.ts`: el objeto `COLOR` (fondo, zonas, río, troncos, tortugas, rana, texto y velo), `COLORES_COCHE`, los literales de `drawCoche`, `drawCamion` y `drawRana` (parabrisas `rgba(255, 255, 255, 0.55)`, ruedas `#111`, camión `#9ca3af`/`#4b5563`, ojos `#fff`/`#000`), los de `drawHud` (barra de tiempo `#4ade80`/`#facc15`/`#ef4444` y su fondo `rgba(255, 255, 255, 0.15)`) y las fuentes `FUENTE` y `bold Npx monospace`. No hay un único sitio donde cambiar el aspecto. Este spec crea una tabla de paletas, hace que todo el dibujo pase por ella y añade el selector.

Particularidades de Frogger:

- **Todo es primitiva de canvas** (rectángulos, arcos, elipses, curvas), sin imágenes ni spritesheet: no hay problema de assets. Las skins solo cambian colores, brillo y tipografía; la geometría (rejilla de 16×14 casillas de 40 px, `GRID_X`, `GRID_Y`, formas de coche, camión, tronco, tortuga y rana) **no cambia**.
- **Dibujo en `draw.ts`**: `dibujar(c, v)` pasa a recibir la paleta. La tabla va en un módulo nuevo, `app/games/frogger/paletas.ts`, como en Asteroides y Snake.
- **`clasico` es el aspecto actual**, píxel por píxel, y el valor por defecto.
- **Reutiliza** `app/games/skins.ts` (existe desde la SPEC 11) y `resolverFuentePixel()` de `app/games/asteroids/paletas.ts`. `skins.ts` no se modifica.
- **El motor ya redibuja cada fotograma** mientras corre; `setSkin` solo necesita redibujar cuando el bucle está parado (pausa o `gameover`).

---

## Alcance

**In:**

- Tipo `SkinFrogger` y método `setSkin(skin)` en `app/games/frogger/types.ts`.
- Módulo `app/games/frogger/paletas.ts` con `PALETAS: Record<SkinFrogger, PaletaFrogger>` (valores hex concretos).
- `draw.ts` dibujado solo con la paleta recibida: fondo, zonas, ondas del río, líneas de carretera, bocas, coches, camiones, troncos, tortugas, rana, HUD, barra de tiempo y GAME OVER.
- `setSkin(skin)` en el motor: no hace nada si es la misma skin o tras `destroy()`, y redibuja si el bucle está parado (pausa o `gameover`).
- Prop `skin` en `FroggerCanvas`, aplicada al crear el motor y en un `useEffect`.
- Botón `SKIN: <NOMBRE>` (`btn cyan`) en `GamePlayer` solo para `frogger`, que rota `clasico → neon → retro → clasico`, con persistencia en `localStorage` (`av-frogger-skin`).
- Actualizar `CLAUDE.md` y `.claude/skills/new-game/puntos-de-integracion.md`.

**Out of scope:**

- Otros juegos (Tetris, Asteroides, Arkanoid, Snake y maquetas, cada uno con su spec).
- Sonido (Frogger no tiene), nuevas mecánicas, velocidades, niveles, tiempos de ronda, puntuación, colisiones y geometría de la rejilla.
- Crear assets o imágenes.
- El marco CRT (`.crt`, `.crt-screen`), la barra `player-hud`, el modal de fin de juego, la consola táctil y las portadas.
- Persistencia de la skin en Supabase o por usuario.
- Convertir `GamePlayer` en un registro genérico de juegos (decisión cerrada): se añade una rama más condicionada por `esFrogger`.

---

## Modelo de datos

### `app/games/frogger/types.ts`

```ts
export type SkinFrogger = "clasico" | "neon" | "retro";
export interface JuegoFrogger {
  pause(): void;
  resume(): void;
  restart(): void;
  setSkin(skin: SkinFrogger): void; // no-op si es la misma o tras destroy(); redibuja si el bucle está parado
  destroy(): void;
}
```

`SnapshotFrogger`, `EstadoFrogger` y el contrato de `onChange` (`score`, `lives`, `level`, `status`) no cambian.

### `app/games/frogger/paletas.ts` (nuevo)

```ts
export interface PaletaFrogger {
  fondo: string; // fondo del canvas fuera de la rejilla
  meta: string; // fila de bocas
  boca: string;
  bocaBorde: string;
  rio: string;
  rioOla: string;
  segura: string; // franja central y casilla de inicio
  carretera: string;
  linea: string; // líneas discontinuas entre carriles
  tronco: string;
  troncoVeta: string;
  tortuga: string;
  tortugaOscura: string;
  rana: string;
  ranaOscura: string; // patas
  ojoBlanco: string;
  ojoPupila: string;
  coches: readonly [string, string, string, string]; // se reparten por (fila + índice) % 4
  camionCarga: string;
  camionCabina: string;
  cristal: string; // parabrisas
  rueda: string;
  barraFondo: string; // fondo de la barra de tiempo
  tiempoAlto: string; // ratio > 0,5
  tiempoMedio: string; // ratio > 0,25
  tiempoBajo: string; // ratio <= 0,25
  texto: string;
  veloGameOver: string;
  brillo: number; // shadowBlur de entidades, rana, bocas y textos (0 = sin brillo)
  fuenteHud: string;
  fuenteTitulo: string;
  fuenteSub: string;
}
```

Valores (hex salvo los `rgba`, que llevan alfa):

| Campo           | `clasico`                         | `neon`                            | `retro`                           |
| --------------- | --------------------------------- | --------------------------------- | --------------------------------- |
| `fondo`         | `#05060f`                         | `#05030f`                         | `#0a140a`                         |
| `meta`          | `#14532d`                         | `#0b0620`                         | `#143014`                         |
| `boca`          | `#4ade80`                         | `#00ff88`                         | `#20b020`                         |
| `bocaBorde`     | `#facc15`                         | `#f5ff00`                         | `#33ff33`                         |
| `rio`           | `#0b2a63`                         | `#07052e`                         | `#0d1a0d`                         |
| `rioOla`        | `#1d4ed8`                         | `#00f5ff`                         | `#20b020`                         |
| `segura`        | `#166534`                         | `#0f0a2e`                         | `#143014`                         |
| `carretera`     | `#0f0f14`                         | `#05010f`                         | `#0a140a`                         |
| `linea`         | `rgba(255,255,255,0.28)`          | `rgba(255,0,110,0.5)`             | `#20b020`                         |
| `tronco`        | `#7c4a21`                         | `#ff006e`                         | `#20b020`                         |
| `troncoVeta`    | `#5a3416`                         | `#5c0027`                         | `#0a140a`                         |
| `tortuga`       | `#22c55e`                         | `#00ff88`                         | `#33ff33`                         |
| `tortugaOscura` | `#15803d`                         | `#007a42`                         | `#0a140a`                         |
| `rana`          | `#4ade80`                         | `#f5ff00`                         | `#33ff33`                         |
| `ranaOscura`    | `#16a34a`                         | `#a8b000`                         | `#20b020`                         |
| `ojoBlanco`     | `#ffffff`                         | `#ffffff`                         | `#0a140a`                         |
| `ojoPupila`     | `#000000`                         | `#ff006e`                         | `#33ff33`                         |
| `coches`        | `#ef4444 #facc15 #3b82f6 #f472b6` | `#ff006e #f5ff00 #00f5ff #b967ff` | `#33ff33 #20b020 #33ff33 #20b020` |
| `camionCarga`   | `#9ca3af`                         | `#6b5bff`                         | `#20b020`                         |
| `camionCabina`  | `#4b5563`                         | `#00f5ff`                         | `#33ff33`                         |
| `cristal`       | `rgba(255,255,255,0.55)`          | `rgba(255,255,255,0.7)`           | `#0a140a`                         |
| `rueda`         | `#111111`                         | `#000000`                         | `#143014`                         |
| `barraFondo`    | `rgba(255,255,255,0.15)`          | `rgba(0,245,255,0.15)`            | `#143014`                         |
| `tiempoAlto`    | `#4ade80`                         | `#00ff88`                         | `#33ff33`                         |
| `tiempoMedio`   | `#facc15`                         | `#f5ff00`                         | `#20b020`                         |
| `tiempoBajo`    | `#ef4444`                         | `#ff006e`                         | `#ffb000`                         |
| `texto`         | `#ffffff`                         | `#00ff88`                         | `#33ff33`                         |
| `veloGameOver`  | `rgba(0,0,0,0.7)`                 | `rgba(5,1,15,0.78)`               | `rgba(10,20,10,0.9)`              |
| `brillo`        | `0`                               | `10`                              | `0`                               |
| `fuenteHud`     | `bold 16px monospace`             | `bold 16px monospace`             | `12px` + `FUENTE_PIXEL`           |
| `fuenteTitulo`  | `bold 64px monospace`             | `bold 64px monospace`             | `36px` + `FUENTE_PIXEL`           |
| `fuenteSub`     | `bold 32px monospace`             | `bold 32px monospace`             | `18px` + `FUENTE_PIXEL`           |

Notas de cada skin:

- **`clasico`**: idéntica al código actual (`COLOR`, `COLORES_COCHE` y los literales de coche, camión, rana y HUD). Es el aspecto por defecto y no cambia ni un píxel.
- **`neon`**: fondo casi negro con río índigo oscuro, ondas cian, carretera negra con líneas magenta, coches y troncos saturados (`--magenta #ff006e`, `--yellow #f5ff00`, `--cyan #00f5ff`, `--green #00ff88` de `app/globals.css`, como valores explícitos y no variables CSS leídas en el canvas) y rana amarilla para que destaque sobre las tortugas verdes. El brillo se hace con `shadowBlur = brillo` y `shadowColor` igual al color de relleno de la pieza, dentro de `save()`/`restore()`, solo en coches, camiones, troncos, tortugas, rana, bocas y textos del HUD; no en el fondo, las zonas ni las ondas (coste de rendimiento).
- **`retro`**: paleta de fósforo verde (`#33ff33`, `#20b020`, `#143014`, `#0d1a0d`, `#0a140a`), sin brillo ni degradados y con `Press Start 2P`. Con tan pocos tonos, las zonas se distinguen por contraste y textura (ondas, líneas discontinuas y veta de los troncos, que siguen dibujándose). La única excepción es `tiempoBajo` en ámbar `#ffb000`, para que el aviso de poco tiempo no se pierda en el verde. `FUENTE_PIXEL` es la familia que devuelve `resolverFuentePixel()` (respaldo `"Courier New", monospace`). Los cuerpos de texto son menores porque la fuente pixel es más ancha: «GAME OVER» mide ≈ 9 × 36 = 324 px y «Puntuación: 123456» ≈ 18 × 18 = 324 px, dentro del límite de 760 px de `fillText`; el HUD («SCORE 123456» ≈ 13 × 12 = 156 px y «NIVEL 12») cabe en los 640 px de la rejilla sin solaparse.
- **Brillo y tortugas sumergidas**: el trazo de la tortuga hundida y el parpadeo de aviso (`globalAlpha`) se conservan en las tres skins; el brillo sigue el mismo alfa.
- La geometría (casillas de 40 px, tamaños de rana, coche, camión, tronco y tortuga, posición del HUD y de la barra de tiempo) **no cambia** con la skin.

### Persistencia

- Clave: `av-frogger-skin`. Valores válidos: `clasico`, `neon`, `retro`. Cualquier otro valor, o `localStorage` bloqueado, deja `clasico`.
- Lectura en un `useEffect([esFrogger])` tras hidratar; escritura dentro de `try/catch`.

---

## Plan de implementación

1. **Tipos.** En `app/games/frogger/types.ts` añadir `SkinFrogger` y `setSkin` a `JuegoFrogger`. Los pasos 2 a 5 van en el mismo commit para no romper el tipado.
2. **Paletas.** Crear `app/games/frogger/paletas.ts` con `PaletaFrogger` y `PALETAS` con los valores de la tabla. En `retro`, `fuenteHud`, `fuenteTitulo` y `fuenteSub` son getters que llaman a `resolverFuentePixel()` importada de `@/app/games/asteroids/paletas` (mismo patrón que `app/games/snake/paletas.ts`).
3. **Dibujo.** En `app/games/frogger/draw.ts`: eliminar `COLOR`, `COLORES_COCHE` y `FUENTE`; `dibujar(c, v, paleta)` pasa la paleta a `drawFondo`, `drawBocas`, `drawEntidades` (y `drawCoche`, `drawCamion`, `drawTronco`, `drawTortugas`), `drawRana`, `drawJugador`, `drawHud` y `drawGameOver`. Sustituir todos los literales de color y fuente por campos de la paleta (parabrisas, ruedas, ojos, barra de tiempo, texto). Con `brillo > 0`, aplicar `shadowBlur`/`shadowColor` dentro de `save()`/`restore()` solo a las piezas indicadas arriba. Con `clasico` el resultado es idéntico al actual. La geometría no se toca.
4. **Motor.** En `app/games/frogger/game.ts`: variable `skin` (por defecto `"clasico"`), `draw()` pasa `PALETAS[skin]` a `dibujar`, y `setSkin(nueva)`: `if (destroyed || nueva === skin) return; skin = nueva; if (rafId === null) draw();` (redibuja con el bucle parado por pausa o `gameover`; con el bucle corriendo, el siguiente fotograma ya usa la skin nueva). No se tocan la lógica, las colisiones, los tiempos ni `notify`.
5. **Canvas de React.** En `app/components/frogger-canvas.tsx` añadir la prop `skin?: SkinFrogger` (por defecto `"clasico"`), un `skinRef` que se actualiza junto a `onChange` y `paused`, `game.setSkin(skinRef.current)` justo tras crear el motor y un `useEffect([skin])` con `gameRef.current?.setSkin(skin)`. El motor se sigue creando una sola vez.
6. **Reproductor.** En `app/components/game-player.tsx`: constante `CLAVE_SKIN_FROGGER = "av-frogger-skin"`; estado `skinFrogger` (`SkinFrogger`, inicial `"clasico"`); `useEffect([esFrogger])` que lee la clave, acepta solo valores de `SKINS_BASE` y envuelve en `try/catch`; función de rotación con `siguienteSkin(SKINS_BASE, skinFrogger)` que guarda en estado y en `localStorage` (con `try/catch`), como `cambiarSkinSnake`; botón `btn cyan` con `SKIN: {NOMBRES_SKIN[skinFrogger]}` en `hud-actions`, junto a PAUSA y solo si `esFrogger`; y `skin={skinFrogger}` en `<FroggerCanvas>`. Los botones de los demás juegos no cambian.
7. **Documentación.** Actualizar `CLAUDE.md`: spec 16 en la lista de specs, y `paletas.ts`, `setSkin`, la prop `skin` y el botón `SKIN` (clave `av-frogger-skin`) en la descripción de `app/games/frogger/` (si CLAUDE.md aún no la tiene, añadirla junto a la del resto de juegos reales). Actualizar `.claude/skills/new-game/puntos-de-integracion.md` con el caso de un juego de primitivas puras (paleta completa, brillo con `shadowBlur` en `neon`, sin sustitución de assets).

---

## Criterios de aceptación

- [ ] `npm run lint` termina sin errores.
- [ ] `npm run build` termina sin errores.
- [ ] `PALETAS` de Frogger tiene exactamente las claves `clasico`, `neon` y `retro`, con colores en hex (salvo los `rgba` de línea, parabrisas, barra y velo).
- [ ] No quedan en `draw.ts` colores ni fuentes literales de dibujo (`COLOR`, `COLORES_COCHE`, `#fff`, `#000`, `#111`, `rgba(…)`, `monospace`). Quedan literales solo la geometría.
- [ ] En `/juegos/frogger/jugar` la skin inicial (sin `localStorage`) es `clasico` y se ve igual que antes: río `#0b2a63`, zonas seguras `#166534`, carretera `#0f0f14`, rana `#4ade80` y sin brillo.
- [ ] Con `neon` se ven el fondo casi negro, el río índigo con ondas cian, los coches y troncos saturados con brillo, la rana amarilla y los textos en `#00ff88`.
- [ ] Con `retro` solo aparecen los verdes `#33ff33`, `#20b020`, `#143014`, `#0d1a0d`, `#0a140a` (y el ámbar `#ffb000` en la barra de tiempo baja); no hay brillo y el texto usa la tipografía pixel (o `monospace` si no está disponible). Río, carretera y zonas seguras se distinguen entre sí.
- [ ] El botón muestra `SKIN: CLÁSICO`, `SKIN: NEÓN` o `SKIN: RETRO` y, al pulsarlo, rota en ese orden y vuelve a `clasico` tras `retro`.
- [ ] Cambiar de skin con el juego en pausa o en `gameover` (incluido con el modal de fin de juego abierto) redibuja el lienzo al instante, sin reanudar la partida.
- [ ] Cambiar de skin en mitad de la partida no reinicia ni altera puntos, vidas, nivel, tiempo, posición de la rana ni de los carriles.
- [ ] Recargar la página conserva la skin (`localStorage["av-frogger-skin"]`).
- [ ] Un valor inválido en `av-frogger-skin` (p. ej. `"x"`) o `localStorage` bloqueado dejan `clasico` sin errores en consola.
- [ ] `onChange` sigue enviando solo `score`, `lives`, `level` y `status`, y el marco CRT, la barra de React, la consola táctil y el modal no cambian con la skin.
- [ ] Asteroides, Arkanoid y Snake siguen con su botón SKIN y su clave; Tetris con su botón TEMA; las maquetas no cambian.
- [ ] `CLAUDE.md` y `.claude/skills/new-game/puntos-de-integracion.md` mencionan las skins de Frogger.

---

## Decisiones

- **Sí:** módulo `paletas.ts` propio en `app/games/frogger/`, como en Asteroides y Snake; `draw.ts` solo lee de la paleta recibida por parámetro.
- **Sí:** `clasico` reproduce los valores actuales de `COLOR`, `COLORES_COCHE` y los literales de las funciones de dibujo.
- **Sí:** `neon` con rana amarilla y no verde: sobre tortugas y bocas verdes `#00ff88` una rana verde se perdería.
- **Sí:** `retro` admite un único acento ámbar (`#ffb000`) en `tiempoBajo`; sin él, el aviso de tiempo agotándose no se distinguiría. El enunciado permite verde o ámbar como paleta fósforo.
- **Sí:** brillo de `neon` limitado a piezas móviles, rana, bocas y textos. **No:** brillo en el fondo y las ondas del río (muchas curvas por fotograma, sin ganancia visual).
- **Sí:** `setSkin` redibuja solo si `rafId === null`; el motor no tiene carga de assets, así que no hace falta una bandera `ready`.
- **Sí:** la lista de skins de Frogger es exactamente `SKINS_BASE` (tres).
- **Sí:** las rutas son las reales (`app/games/frogger/`, `app/components/frogger-canvas.tsx`), no las de `components/games/FroggerGame.tsx` que menciona la spec original del juego.
- **Sí:** reutilizar `resolverFuentePixel()` de Asteroides, como Snake.
- **No:** guardar la skin en Supabase o en la sesión; `localStorage` basta.
- **No:** generalizar `GamePlayer` a un registro de juegos (decisión cerrada); se añade una rama condicionada por `esFrogger`.
- **No:** tocar `app/games/skins.ts` ni los archivos de otros juegos.

---

## Riesgos

| Riesgo                                                                                                           | Mitigación                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Press Start 2P` no está cargada en el primer dibujado de `retro` y se usa el respaldo                           | `resolverFuentePixel()` con respaldo `monospace`; el bucle redibuja cada fotograma. En pausa se acepta el respaldo hasta el siguiente redibujado.  |
| `shadowBlur` en `neon` baja los fotogramas con muchas entidades (5 carriles de coches, 6 de río)                 | Brillo solo en piezas móviles y rana; comprobar a nivel alto. Si hace falta, bajar `brillo` (valor numérico de la paleta) sin cambiar el contrato. |
| Con la paleta limitada de `retro`, río y carretera se confunden                                                  | Zonas con tonos distintos (`#0d1a0d`, `#0a140a`, `#143014`) y textura propia (ondas, líneas, vetas); comprobar visualmente las tres zonas.         |
| Olvidar un color literal y que una skin deje elementos del `clasico` (ruedas, ojos, parabrisas, barra de tiempo) | Criterio de aceptación explícito y revisión visual de las tres skins con coches, camión, tronco, tortugas hundidas y GAME OVER.                    |
| Texto pixel de `retro` desbordando el HUD o el GAME OVER                                                         | Cuerpos de 12, 36 y 18 px y límite de 760 px en `fillText`; comprobar con puntuaciones de 6 dígitos.                                               |

---

## Qué **no** está en este spec

- Skins de Tetris, Asteroides, Arkanoid y Snake (cada uno en su spec).
- Cambios de mecánicas, velocidades, tiempos de ronda, niveles o puntuación de Frogger.
- Assets nuevos.
- Cambios en el marco CRT, la barra de React, el modal de fin de juego, la consola táctil o las portadas.
- Persistencia de la skin en Supabase o por usuario.
- Un registro genérico de juegos en `GamePlayer`.
