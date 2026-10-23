// Tablero de Tetris, portado de references/started-games/03-tetris/game.js.
// Lógica pura: recibe el tablero por parámetro y no accede a `document` ni a `window`.
import type { Forma, Pieza } from "./pieces";
export const COLS = 10;
export const ROWS = 20;
export const BLOCK = 30;
export const LINE_SCORES = [0, 100, 300, 500, 800];
// Desplazamientos que prueba la rotación, en este orden.
export const WALL_KICKS = [0, -1, 1, -2, 2];
// ROWS × COLS: 0 = vacía, 1..7 = índice de color de la pieza.
export type Tablero = number[][];
export function createBoard(): Tablero {
  return Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));
}
export function collide(
  board: Tablero,
  shape: Forma,
  ox: number,
  oy: number,
): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}
// Fija la pieza en el tablero (lo modifica).
export function merge(board: Tablero, piece: Pieza): void {
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c])
        board[piece.y + r][piece.x + c] = piece.shape[r][c];
}
// Quita las filas completas (modifica el tablero) y devuelve cuántas fueron.
export function clearLines(board: Tablero): number {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every((v) => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array<number>(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  return cleared;
}
// Fila donde aterrizaría la pieza (posición de la pieza fantasma).
export function ghostY(board: Tablero, piece: Pieza): number {
  let gy = piece.y;
  while (!collide(board, piece.shape, piece.x, gy + 1)) gy++;
  return gy;
}
