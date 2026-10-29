# SPEC 13 — Skins `clasico`, `neon` y `retro` para SNAKE

> **Status:** Aprobado
> **Depends on:** SPEC 10 (motor de canvas de Snake y `GamePlayer`), SPEC 11 (patrón de skins: `app/games/skins.ts`, `paletas.ts`, `setSkin`, prop `skin` y botón `SKIN`)
> **Date:** 2026-10-29
> **Objective:** Dar a Snake tres skins de canvas (`clasico`, `neon` y `retro`) seleccionables con un botón `SKIN` en el reproductor y recordadas en `localStorage` (`av-snake-skin`), reutilizando la base compartida y el patrón de Asteroides y resolviendo cómo se aplican `neon` y `retro` a las frutas del atlas `fruits.png`.

---

## Por qué existe este spec

Snake dibuja con colores escritos a mano en `app/games/snake/game.ts`: las casillas del tablero (`TILE_LIGHT` `#aad751` y `TILE_DARK` `#a2d149`), la serpiente (`SNAKE_COLOR` `#4e7cf6`), los ojos (`#fff` y `#000`), los velos de la leyenda inicial y del GAME OVER (`rgba(0, 0, 0, …)`), el texto (`#fff`, `bold Npx monospace`) y las frutas, que salen del atlas `public/games/snake/fruits.png` a través de `drawFruit`. No hay un único sitio donde cambiar el aspecto. Este spec crea una tabla de paletas, hace que todo el dibujo pase por ella y añade el selector, igual que en Asteroides (SPEC 11).

Particularidades de Snake:

- **Tablero y serpiente son formas de canvas** dentro de `game.ts` (`drawBoard`, `drawSnake`, `drawText`, `draw`), así que se pasan por la paleta sin más. No hay `draw.ts`: la tabla va en un módulo nuevo, `app/games/snake/paletas.ts`, como en Asteroides.
- **Las frutas son raster** (22 recortes a todo color de una fila de `fruits.png`). Decisión de este spec, sin crear assets nuevos:
  - `clasico`: el atlas tal cual, sin cambios (aspecto actual).
  - `neon`: el mismo atlas con **brillo**: `shadowBlur` + `shadowColor` alrededor del sprite (la sombra se genera a partir del canal alfa del recorte, así que funciona con `drawImage` en todos los navegadores). No se usa `ctx.filter` porque Safari no lo soporta en canvas.
  - `retro`: **sustitución por formas**. El atlas no se dibuja; la fruta es un cuadrado de pixel-art de un solo color con un «tallo» (dos rectángulos). Una paleta de 2 verdes no admite 22 frutas a todo color, y un tinte por `globalCompositeOperation` exigiría un lienzo auxiliar por fruta.
  - La fruta (`kind`) sigue sorteándose igual en todas las skins: la skin solo cambia cómo se pinta, no cuál sale ni su casilla.
- **`clasico` es el aspecto actual**, píxel por píxel. Es el valor por defecto.
- **Reutiliza** `app/games/skins.ts`, que ya existe (SPEC 11): no se modifica.

---

## Alcance

**In:**

- Tipo `SkinSnake` y método `setSkin(skin)` en `app/games/snake/types.ts`.
- Módulo `app/games/snake/paletas.ts` con `PALETAS: Record<SkinSnake, PaletaSnake>` (valores hex concretos) y reutilización de `resolverFuentePixel()` de `app/games/asteroids/paletas.ts` (se importa; si se prefiere no acoplar juegos, se mueve a `app/games/skins.ts` y Asteroides lo importa de allí, ver Decisiones).
- Tablero, serpiente (cuerpo, cabeza y ojos), fruta, velos y textos de `game.ts` dibujados con la paleta activa.
- `drawFruit` en `app/games/snake/sprites.ts` no cambia; la rama de formas de `retro` y el brillo de `neon` viven en `game.ts` (función `drawFruta`).
- `setSkin(skin)` en el motor: no hace nada si es la misma skin o tras `destroy()`, y redibuja de inmediato (en pausa, en `gameover` o corriendo; si `fruits.png` aún no ha cargado, el redibujado lo hará `onload`).
- Prop `skin` en `SnakeCanvas`, aplicada al crear el motor y en un `useEffect`.
- Botón `SKIN: <NOMBRE>` (`btn cyan`) en `GamePlayer` solo para `snake`, que rota `clasico → neon → retro → clasico`, con persistencia en `localStorage` (`av-snake-skin`).
- Actualizar `CLAUDE.md` y `.claude/skills/new-game/puntos-de-integracion.md`.

**Out of scope:**

- Otros juegos (Tetris, Arkanoid, Asteroides y maquetas, cada uno con su spec).
- Sonido (Snake no tiene), nuevas mecánicas, velocidad, niveles, puntuación, tamaño del tablero (20×15, celdas de 40 px) y geometría de la serpiente.
- Crear o modificar `fruits.png` ni añadir assets.
- El marco CRT (`.crt`, `.crt-screen`), la barra `player-hud`, el modal de fin de juego y las portadas (`.cover-snake-real`).
- Persistencia de la skin en Supabase o por usuario.
- Convertir `GamePlayer` en un registro genérico de juegos (decisión cerrada): se añade una rama más condicionada por `esSnake`.

---

## Modelo de datos

### `app/games/snake/types.ts`

```ts
export type SkinSnake = "clasico" | "neon" | "retro";
export interface JuegoSnake {
  pause(): void;
  resume(): void;
  restart(): void;
  setSkin(skin: SkinSnake): void; // no-op si es la misma o tras destroy(); redibuja
  destroy(): void;
}
```

`SnapshotSnake`, `EstadoSnake` y el contrato de `onChange` (`score`, `lives`, `level`, `status`) no cambian.

### `app/games/snake/paletas.ts` (nuevo)

```ts
export interface PaletaSnake {
  casillaClara: string; // casilla (x + y) par
  casillaOscura: string; // casilla (x + y) impar
  serpiente: string; // cuerpo y cabeza
  ojoBlanco: string;
  ojoPupila: string;
  frutaModo: "sprite" | "forma"; // sprite = atlas fruits.png; forma = cuadrado pixel-art
  frutaBrillo: number; // shadowBlur del sprite (0 = sin brillo)
  frutaBrilloColor: string; // shadowColor del sprite
  frutaForma: string; // cuerpo de la forma (solo modo "forma")
  frutaTallo: string; // tallo de la forma (solo modo "forma")
  brilloSerpiente: number; // shadowBlur del cuerpo y la cabeza (0 = sin brillo)
  velo: string; // fondo de la leyenda inicial
  veloGameOver: string; // velo a pantalla completa del GAME OVER
  texto: string;
  fuenteLeyenda: string;
  fuenteTitulo: string;
  fuenteSub: string;
}
```

Valores (colores en hex salvo los velos `rgba`, que llevan alfa):

| Campo              | `clasico`             | `neon`                 | `retro`                  |
| ------------------ | --------------------- | ---------------------- | ------------------------ |
| `casillaClara`     | `#aad751`             | `#0b0620`              | `#0a140a`                |
| `casillaOscura`    | `#a2d149`             | `#07031a`              | `#0d1a0d`                |
| `serpiente`        | `#4e7cf6`             | `#00f5ff`              | `#33ff33`                |
| `ojoBlanco`        | `#ffffff`             | `#ffffff`              | `#0a140a`                |
| `ojoPupila`        | `#000000`             | `#ff006e`              | `#33ff33`                |
| `frutaModo`        | `sprite`              | `sprite`               | `forma`                  |
| `frutaBrillo`      | `0`                   | `14`                   | `0`                      |
| `frutaBrilloColor` | `#000000` (sin uso)   | `#f5ff00`              | `#000000` (sin uso)      |
| `frutaForma`       | `#000000` (sin uso)   | `#000000` (sin uso)    | `#20b020`                |
| `frutaTallo`       | `#000000` (sin uso)   | `#000000` (sin uso)    | `#33ff33`                |
| `brilloSerpiente`  | `0`                   | `12`                   | `0`                      |
| `velo`             | `rgba(0, 0, 0, 0.55)` | `rgba(5, 1, 15, 0.7)`  | `rgba(10, 20, 10, 0.85)` |
| `veloGameOver`     | `rgba(0, 0, 0, 0.6)`  | `rgba(5, 1, 15, 0.75)` | `rgba(10, 20, 10, 0.9)`  |
| `texto`            | `#ffffff`             | `#00ff88`              | `#33ff33`                |
| `fuenteLeyenda`    | `bold 28px monospace` | `bold 28px monospace`  | `16px` + `FUENTE_PIXEL`  |
| `fuenteTitulo`     | `bold 64px monospace` | `bold 64px monospace`  | `36px` + `FUENTE_PIXEL`  |
| `fuenteSub`        | `bold 32px monospace` | `bold 32px monospace`  | `18px` + `FUENTE_PIXEL`  |

Notas de cada skin:

- **`clasico`**: idéntica al código actual (`TILE_LIGHT`, `TILE_DARK`, `SNAKE_COLOR`, ojos, velos y fuentes). Los campos «sin uso» existen solo para que el tipo sea uniforme y no se leen con `frutaModo: "sprite"` y brillo 0.
- **`neon`**: fondo casi negro con un tablero de ajedrez apenas visible (`#0b0620` / `#07031a`), serpiente cian (`--cyan #00f5ff`), pupilas magenta (`--magenta`, `#ff006e`), texto verde (`--green #00ff88`) y brillo amarillo (`--yellow #f5ff00`) en las frutas. El brillo se hace con `shadowBlur` y `shadowColor` dentro de `save()`/`restore()`; en la serpiente el `shadowColor` es el propio `serpiente`. Se dibuja el brillo del trazo del cuerpo y del círculo de la cabeza, no el de los ojos.
- **`retro`**: solo dos verdes de fósforo (`#33ff33` y `#20b020`) sobre `#0a140a`/`#0d1a0d`, sin brillo ni degradados, tipografía `Press Start 2P`. Las frutas son formas: cuadrado de 24×24 px centrado en la casilla (color `frutaForma`) más un tallo de 4×8 px (color `frutaTallo`) sobre el centro superior del cuadrado. `FUENTE_PIXEL` es la familia que devuelve `resolverFuentePixel()` (lee `--font-press-start` y tiene respaldo `"Courier New", monospace`). Los cuerpos de texto son menores porque la fuente pixel es más ancha (la leyenda «PULSA UNA FLECHA PARA EMPEZAR» mide ≈ 29 × 16 = 464 px, dentro del límite de 760 px de `fillText`).
- La geometría (ancho 30 del cuerpo, radio 18 de la cabeza, radios 6 y 3 de los ojos, caja de 36 px de la fruta, franja de la leyenda en `y = 480`, alto 56) **no cambia** con la skin.

### Persistencia

- Clave: `av-snake-skin`. Valores válidos: `clasico`, `neon`, `retro`. Cualquier otro valor, o `localStorage` bloqueado, deja `clasico`.
- Lectura en un `useEffect([esSnake])` tras hidratar; escritura dentro de `try/catch`.

---

## Plan de implementación

1. **Tipos.** En `app/games/snake/types.ts` añadir `SkinSnake` y `setSkin` a `JuegoSnake`. Los pasos 3 a 5 van en el mismo commit para no romper el tipado.
2. **Paletas.** Crear `app/games/snake/paletas.ts` con `PaletaSnake` y `PALETAS` con los valores de la tabla. En `retro`, `fuenteLeyenda`, `fuenteTitulo` y `fuenteSub` son getters que llaman a `resolverFuentePixel()` (mismo patrón que `paletas.ts` de Asteroides). Importar `resolverFuentePixel` desde `@/app/games/asteroids/paletas` (o moverla a `app/games/skins.ts`, ver Decisiones).
3. **Motor.** En `app/games/snake/game.ts`: eliminar `TILE_LIGHT`, `TILE_DARK` y `SNAKE_COLOR`; variable `skin` (por defecto `"clasico"`) y `const paleta = () => PALETAS[skin]`. `drawBoard` usa `casillaClara`/`casillaOscura`; `drawSnake` usa `serpiente`, `ojoBlanco`, `ojoPupila` y, si `brilloSerpiente > 0`, `shadowBlur`/`shadowColor` en `save()`/`restore()` solo alrededor del cuerpo y la cabeza; `drawText` usa `texto` y la fuente que recibe; los velos usan `velo` y `veloGameOver`. Extraer `drawFruta(c)`: con `frutaModo === "sprite"` llama a `drawFruit` (con `shadowBlur`/`shadowColor` dentro de `save()`/`restore()` si `frutaBrillo > 0`; `imageSmoothingEnabled = false` como hoy); con `"forma"` dibuja el cuadrado y el tallo de `retro` sin tocar el atlas. Añadir `setSkin(nueva)`: `if (destroyed || nueva === skin) return; skin = nueva; if (ready) draw();`. Con `skin === "clasico"` el resultado es idéntico al actual. No se tocan la lógica, los pasos, la cola de giros ni `notify`.
4. **Canvas de React.** En `app/components/snake-canvas.tsx` añadir la prop `skin?: SkinSnake` (por defecto `"clasico"`), un `skinRef` que se actualiza junto a `onChange` y `paused`, `game.setSkin(skinRef.current)` justo tras crear el motor y un `useEffect([skin])` con `gameRef.current?.setSkin(skin)`. El motor se sigue creando una sola vez.
5. **Reproductor.** En `app/components/game-player.tsx`: constante `CLAVE_SKIN_SNAKE = "av-snake-skin"`; estado `skinSnake` (`SkinSnake`, inicial `"clasico"`); `useEffect([esSnake])` que lee la clave, acepta solo valores de `SKINS_BASE` y envuelve en `try/catch`; función de rotación con `siguienteSkin(SKINS_BASE, skinSnake)` que guarda en estado y en `localStorage` (con `try/catch`), reutilizando o generalizando `cambiarSkin` de Asteroides sin crear un registro de juegos; botón `btn cyan` con `SKIN: {NOMBRES_SKIN[skinSnake]}` en `hud-actions`, junto a PAUSA y solo si `esSnake`; y `skin={skinSnake}` en `<SnakeCanvas>`. Los botones de Asteroides y Tetris no cambian.
6. **Documentación.** Actualizar `CLAUDE.md`: spec 13 en la lista, `paletas.ts`, `setSkin`, la prop `skin` y el botón `SKIN` en la descripción de `app/games/snake/` (y la clave `av-snake-skin`). Actualizar `.claude/skills/new-game/puntos-de-integracion.md` con el caso de juegos con spritesheet (brillo con `shadowBlur` o sustitución por formas en `retro`).

---

## Criterios de aceptación

- [ ] `npm run lint` termina sin errores.
- [ ] `npm run build` termina sin errores.
- [ ] `PALETAS` de Snake tiene exactamente las claves `clasico`, `neon` y `retro`, con colores en hex (salvo los `rgba` de los velos).
- [ ] No quedan en `game.ts` colores ni fuentes literales de dibujo (`TILE_*`, `SNAKE_COLOR`, `#fff`, `#000`, `rgba(0, 0, 0, …)`, `monospace`). Quedan literales solo la geometría y las medidas de la forma de fruta de `retro`.
- [ ] En `/juegos/snake/jugar` la skin inicial (sin `localStorage`) es `clasico` y se ve igual que antes: tablero verde `#aad751`/`#a2d149`, serpiente azul `#4e7cf6`, frutas del atlas y sin brillo.
- [ ] Con `neon` se ven el tablero casi negro, la serpiente cian con brillo, las frutas del atlas con brillo amarillo y los textos en `#00ff88`.
- [ ] Con `retro` solo aparecen `#33ff33`, `#20b020` y los fondos `#0a140a`/`#0d1a0d`; las frutas son cuadrados con tallo (el atlas no se dibuja); no hay brillo y el texto usa la tipografía pixel (o `monospace` si no está disponible).
- [ ] El botón muestra `SKIN: CLÁSICO`, `SKIN: NEÓN` o `SKIN: RETRO` y, al pulsarlo, rota en ese orden y vuelve a `clasico` tras `retro`.
- [ ] Cambiar de skin con el juego en pausa, antes de la primera flecha, en `gameover` o en el modal de fin de juego redibuja el lienzo al instante, sin reanudar la partida.
- [ ] Cambiar de skin en mitad de la partida no reinicia ni altera puntos, nivel, serpiente, fruta ni velocidad, y los giros encolados se conservan.
- [ ] Recargar la página conserva la skin (`localStorage["av-snake-skin"]`).
- [ ] Un valor inválido en `av-snake-skin` (p. ej. `"x"`) o `localStorage` bloqueado dejan `clasico` sin errores en consola.
- [ ] `onChange` sigue enviando solo `score`, `lives`, `level` y `status`, y el marco CRT, la barra de React y el modal no cambian con la skin.
- [ ] Asteroides sigue funcionando con su botón SKIN y su clave `av-asteroides-skin`; Tetris con su botón TEMA; Arkanoid y las maquetas no cambian.
- [ ] `CLAUDE.md` y `.claude/skills/new-game/puntos-de-integracion.md` mencionan las skins de Snake.

---

## Decisiones

- **Sí:** módulo `paletas.ts` propio en `app/games/snake/`, como en Asteroides, y `game.ts` solo lee de la paleta.
- **Sí:** `clasico` reproduce los valores actuales; los `rgba` de los velos se conservan tal cual.
- **Sí:** `neon` mantiene el atlas y añade brillo con `shadowBlur`. **No:** `ctx.filter` (Safari no lo soporta en canvas) ni tinte con lienzo auxiliar (coste y complejidad por fruta).
- **Sí:** `retro` sustituye las frutas por una forma de pixel-art de dos verdes. **No:** convertir el atlas a verde con composición, porque las 22 frutas pasarían a ser manchas indistinguibles, y **no** crear un atlas nuevo (sin assets nuevos).
- **Sí:** un único tipo de forma de fruta en `retro` para las 22; la identidad de la fruta no afecta a la jugabilidad ni a la puntuación (10 puntos por fruta).
- **Sí:** brillo de la serpiente solo en `neon`, aplicado al trazo del cuerpo y al círculo de la cabeza, no a los ojos. Un único brillo por fotograma no tiene coste apreciable.
- **Sí:** la lista de skins de Snake es exactamente `SKINS_BASE` (tres).
- **Sí:** `neon` usa los hex de `app/globals.css` (`--cyan`, `--magenta`, `--yellow`, `--green`) como valores explícitos, no variables CSS leídas en el canvas.
- **Sí:** reutilizar `resolverFuentePixel()` de Asteroides. Si el implementador prefiere evitar que un juego importe de otro, puede moverla a `app/games/skins.ts` y que ambos la importen, sin cambiar su comportamiento.
- **No:** guardar la skin en Supabase o en la sesión; `localStorage` basta.
- **No:** generalizar `GamePlayer` a un registro de juegos (decisión cerrada); se añade una rama condicionada por `esSnake`.
- **No:** tocar `app/games/skins.ts`, ni los archivos de Arkanoid (`specs/12-skins-arkanoid.md`).

---

## Riesgos

| Riesgo                                                                                     | Mitigación                                                                                                                                        |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Press Start 2P` no está cargada en el primer dibujado de `retro` y se usa el respaldo     | `resolverFuentePixel()` con respaldo `monospace`; el bucle redibuja cada fotograma. En pausa se acepta el respaldo hasta el siguiente redibujado. |
| `setSkin` llamado antes de que cargue `fruits.png` dibuja el tablero sin fruta             | `setSkin` solo redibuja si `ready`; `onload` ya llama a `draw()` con la skin activa.                                                              |
| El brillo amarillo de las frutas con `shadowBlur` no se ve sobre el tablero de `neon`      | Comprobar visualmente; si hace falta, subir `frutaBrillo` (valor numérico de la paleta) sin cambiar el contrato.                                  |
| Olvidar un color literal y que una skin deje elementos del `clasico` (ojos, velos, textos) | Criterio de aceptación explícito y revisión visual de las tres skins con la leyenda inicial, una fruta comida y el GAME OVER.                     |
| Texto pixel de `retro` desbordando el ancho de 800 px                                      | Cuerpos de 16, 36 y 18 px y límite de 760 px en `fillText`; comprobar con puntuaciones de 4 dígitos.                                              |

---

## Qué **no** está en este spec

- Skins de Tetris, Arkanoid y Asteroides (cada uno en su spec).
- Cambios de mecánicas, velocidad, niveles o puntuación de Snake.
- Assets nuevos o modificación de `fruits.png`.
- Cambios en el marco CRT, la barra de React, el modal de fin de juego o las portadas.
- Persistencia de la skin en Supabase o por usuario.
- Un registro genérico de juegos en `GamePlayer`.
