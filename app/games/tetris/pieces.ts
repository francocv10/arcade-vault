// Piezas de Tetris, portadas de references/started-games/03-tetris/game.js.
// Lógica pura: no accede a `document` ni a `window`.
export type Forma = number[][];
export interface Pieza {
  type: number; // 1..7, índice en COLORS y valor de sus celdas
  shape: Forma;
  x: number;
  y: number;
}
// Colores por índice de pieza: 1 I, 2 O, 3 T, 4 S, 5 Z, 6 J, 7 L.
export const COLORS: readonly (string | null)[] = [
  null,
  "#4dd0e1",
  "#ffd54f",
  "#ba68c8",
  "#81c784",
  "#e57373",
  "#90caf9",
  "#ffb74d",
];
export const PIECES: readonly (Forma | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
];
export const PIECE_TYPES = PIECES.length - 1;
// Rotación horaria: transponer e invertir cada fila.
export function rotateCW(shape: Forma): Forma {
  const rows = shape.length;
  const cols = shape[0].length;
  const result: Forma = Array.from({ length: cols }, () =>
    new Array<number>(rows).fill(0),
  );
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}
// Pieza nueva con la misma probabilidad entre los 7 tipos, centrada en `cols`.
export function randomPiece(cols: number): Pieza {
  const type = Math.floor(Math.random() * PIECE_TYPES) + 1;
  const shape = PIECES[type]!.map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(cols / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}
