// Constantes y tipos de Frogger: lógica pura, sin acceso a `document` ni a `window`.
// Coordenadas de casilla con el origen arriba a la izquierda de la rejilla.
export const COLS = 16;
export const ROWS = 14;
export const CELL = 40;
// Rejilla de juego en píxeles lógicos (640 × 560).
export const GRID_W = COLS * CELL;
export const GRID_H = ROWS * CELL;
// Canvas lógico de 800 × 600, igual que los demás motores. La rejilla va centrada
// en horizontal y deja arriba una franja de 40 px para el HUD del canvas.
export const CANVAS_W = 800;
export const CANVAS_H = 600;
export const GRID_X = (CANVAS_W - GRID_W) / 2;
export const GRID_Y = CANVAS_H - GRID_H;
// Zonas (índice de fila, 0 = arriba).
export const ROW_GOALS = 0;
export const ROW_RIVER_TOP = 1;
export const ROW_RIVER_BOT = 6;
export const ROW_SAFE_MID = 7;
export const ROW_ROAD_TOP = 8;
export const ROW_ROAD_BOT = 12;
export const ROW_START = 13;
export const START_COL = COLS / 2;
export const GOAL_COUNT = 5;
export const GOAL_WIDTH = 2;
export const LIVES_INICIALES = 3;
export const JUMP_MS = 120;
// Ciclo de inmersión de las tortugas: visibles 3 s y bajo el agua 1,5 s.
export const TURTLE_VISIBLE_MS = 3000;
export const TURTLE_SUBMERGED_MS = 1500;
export type Direction = "up" | "down" | "left" | "right";
export type EntityType = "car" | "truck" | "log" | "turtle";
export interface Entity {
  col: number;
  width: number;
  type: EntityType;
  submerged?: boolean;
  // Solo tortugas: milisegundos dentro de su ciclo de inmersión (cada grupo tiene el suyo).
  fase?: number;
}
export interface Lane {
  row: number;
  speed: number;
  dir: 1 | -1;
  entities: Entity[];
}
export interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number;
  targetCol: number;
  targetRow: number;
}
