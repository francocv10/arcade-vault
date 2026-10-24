// Atlas de frutas de Snake, portado de references/source-assets/snake-assets/sprites.js
// (fila mediana de fruits.png, 3790×442 px). Lógica pura: no accede a `document`
// ni a `window`. La imagen llega por parámetro; la carga ocurre dentro de
// `createSnakeGame`.
export interface RecorteFruta {
  x: number;
  y: number;
  w: number;
  h: number;
}
export const FRUITS_SHEET = { w: 3790, h: 442 } as const;
export const FRUITS = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  orange: { x: 186, y: 136, w: 150, h: 160 },
  grape: { x: 378, y: 136, w: 110, h: 160 },
  garlic: { x: 540, y: 136, w: 130, h: 160 },
  eggplant: { x: 712, y: 136, w: 130, h: 160 },
  strawberry: { x: 894, y: 136, w: 110, h: 160 },
  cherry: { x: 1066, y: 136, w: 110, h: 160 },
  carrot: { x: 1228, y: 136, w: 130, h: 160 },
  mushroom: { x: 1400, y: 136, w: 130, h: 160 },
  broccoli: { x: 1582, y: 136, w: 110, h: 160 },
  watermelon: { x: 1734, y: 136, w: 150, h: 160 },
  pepper: { x: 1906, y: 136, w: 150, h: 160 },
  kiwi: { x: 2068, y: 136, w: 170, h: 160 },
  lemon: { x: 2250, y: 136, w: 140, h: 160 },
  peach: { x: 2432, y: 136, w: 130, h: 160 },
  peanut: { x: 2604, y: 136, w: 130, h: 160 },
  apple: { x: 2786, y: 136, w: 110, h: 160 },
  tomato: { x: 2948, y: 136, w: 130, h: 160 },
  berries: { x: 3110, y: 136, w: 150, h: 160 },
  grapes2: { x: 3302, y: 136, w: 110, h: 160 },
  pineapple: { x: 3454, y: 136, w: 150, h: 160 },
  melon: { x: 3637, y: 136, w: 130, h: 160 },
} satisfies Record<string, RecorteFruta>;
export type NombreFruta = keyof typeof FRUITS;
export const NOMBRES_FRUTA = Object.keys(FRUITS) as NombreFruta[];
// Dibuja la fruta centrada en (cx, cy), escalada para caber en `caja`×`caja`
// px conservando la proporción del recorte.
export function drawFruit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  kind: NombreFruta,
  cx: number,
  cy: number,
  caja: number,
): void {
  const { x, y, w, h } = FRUITS[kind];
  const escala = Math.min(caja / w, caja / h);
  const dw = w * escala;
  const dh = h * escala;
  ctx.drawImage(img, x, y, w, h, cx - dw / 2, cy - dh / 2, dw, dh);
}
