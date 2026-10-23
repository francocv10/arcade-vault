// Spritesheet de Arkanoid, portado de references/started-games/04-arkanoid/assets/spritesheet.js.
// Lógica pura: no accede a `document` ni a `window`. La imagen llega por
// parámetro; la carga ocurre dentro de `createArkanoidGame`.
import type { ColorBloque } from "./levels";
export interface Recorte {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}
export type NombreSprite = "paddle" | "ball" | `block_${ColorBloque}`;
// Cuatro fotogramas por color; `gray` reutiliza los del rojo, como el original.
function fotogramas(sy: number): Recorte[] {
  return [256, 288, 320, 352].map((sx) => ({ sx, sy, sw: 32, sh: 16 }));
}
export const EXPLOSION_FRAMES: Record<ColorBloque, Recorte[]> = {
  red: fotogramas(176),
  cyan: fotogramas(192),
  green: fotogramas(208),
  magenta: fotogramas(224),
  yellow: fotogramas(240),
  hotpink: fotogramas(256),
  gray: fotogramas(176),
};
export const EXPLOSION_DURATION = 150; // ms
export const SPRITES = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  } satisfies Record<ColorBloque, Recorte>,
} as const;
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  frame: Recorte,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.drawImage(img, frame.sx, frame.sy, frame.sw, frame.sh, x, y, w, h);
}
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  name: NombreSprite,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const sp = name.startsWith("block_")
    ? SPRITES.blocks[name.slice(6) as ColorBloque]
    : SPRITES[name as "paddle" | "ball"];
  drawFrame(ctx, img, sp, x, y, w, h);
}
