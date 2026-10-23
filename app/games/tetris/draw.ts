// Dibujo de Tetris en canvas. Paletas y medidas portadas de
// references/started-games/03-tetris/style.css; el panel, que en el original
// vive en el DOM, se dibuja aquí. No accede a `document` ni a `window`.
import { BLOCK, COLS, ROWS, ghostY, type Tablero } from "./board";
import { COLORS, type Forma, type Pieza } from "./pieces";
import type { TemaTetris } from "./types";
export const CANVAS_W = 800;
export const CANVAS_H = 600;
const BOARD_X = 150;
const PANEL_X = 480;
const NEXT_Y = 276;
const NEXT_SIZE = 120;
interface Paleta {
  bg: string;
  board: string;
  border: string;
  label: string;
  grid: string;
  value: string;
  controlsText: string;
  kbdBg: string;
  kbdBorder: string;
  kbdText: string;
  overlay: string;
}
const PALETAS: Record<TemaTetris, Paleta> = {
  dark: {
    bg: "#0f0f17",
    board: "#1a1a25",
    border: "#2a2a3a",
    label: "#555570",
    grid: "#22222e",
    value: "#7aa2f7",
    controlsText: "#888888",
    kbdBg: "#22223a",
    kbdBorder: "#3a3a5a",
    kbdText: "#aaaaaa",
    overlay: "rgba(10, 10, 20, 0.75)",
  },
  light: {
    bg: "#f0f0f8",
    board: "#e4e4f0",
    border: "#b0b0c8",
    label: "#6060a0",
    grid: "#c8c8dc",
    value: "#7aa2f7",
    controlsText: "#404060",
    kbdBg: "#dcdcf0",
    kbdBorder: "#9090b8",
    kbdText: "#3a3a6a",
    overlay: "rgba(210, 210, 230, 0.85)",
  },
};
const MONO = "'Courier New', Courier, monospace";
const SANS = "system-ui, -apple-system, sans-serif";
const CONTROLES: { teclas: string[]; texto: string }[] = [
  { teclas: ["←", "→"], texto: "mover" },
  { teclas: ["↑"], texto: "rotar" },
  { teclas: ["↓"], texto: "bajar" },
  { teclas: ["Space"], texto: "caída" },
];
export interface VistaTetris {
  board: Tablero;
  current: Pieza;
  next: Pieza;
  score: number;
  lines: number;
  level: number;
  gameOver: boolean;
}
function drawBlock(
  c: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  x: number,
  y: number,
  colorIndex: number,
  alpha = 1,
) {
  if (!colorIndex) return;
  c.globalAlpha = alpha;
  c.fillStyle = COLORS[colorIndex]!;
  c.fillRect(ox + x * BLOCK + 1, oy + y * BLOCK + 1, BLOCK - 2, BLOCK - 2);
  c.fillStyle = "rgba(255,255,255,0.12)"; // brillo superior
  c.fillRect(ox + x * BLOCK + 1, oy + y * BLOCK + 1, BLOCK - 2, 4);
  c.globalAlpha = 1;
}
function drawShape(
  c: CanvasRenderingContext2D,
  shape: Forma,
  ox: number,
  oy: number,
  x: number,
  y: number,
  alpha = 1,
) {
  for (let r = 0; r < shape.length; r++)
    for (let col = 0; col < shape[r].length; col++)
      drawBlock(c, ox, oy, x + col, y + r, shape[r][col], alpha);
}
function drawBoard(c: CanvasRenderingContext2D, p: Paleta, v: VistaTetris) {
  c.fillStyle = p.board;
  c.fillRect(BOARD_X, 0, COLS * BLOCK, ROWS * BLOCK);
  c.strokeStyle = p.grid;
  c.lineWidth = 0.5;
  for (let col = 1; col < COLS; col++) {
    c.beginPath();
    c.moveTo(BOARD_X + col * BLOCK, 0);
    c.lineTo(BOARD_X + col * BLOCK, ROWS * BLOCK);
    c.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    c.beginPath();
    c.moveTo(BOARD_X, r * BLOCK);
    c.lineTo(BOARD_X + COLS * BLOCK, r * BLOCK);
    c.stroke();
  }
  for (let r = 0; r < ROWS; r++)
    for (let col = 0; col < COLS; col++)
      drawBlock(c, BOARD_X, 0, col, r, v.board[r][col]);
  const { current } = v;
  const gy = ghostY(v.board, current);
  drawShape(c, current.shape, BOARD_X, 0, current.x, gy, 0.2);
  drawShape(c, current.shape, BOARD_X, 0, current.x, current.y);
  c.strokeStyle = p.border;
  c.lineWidth = 1;
  c.strokeRect(BOARD_X + 0.5, 0.5, COLS * BLOCK - 1, ROWS * BLOCK - 1);
}
function drawLabel(
  c: CanvasRenderingContext2D,
  p: Paleta,
  texto: string,
  y: number,
) {
  c.fillStyle = p.label;
  c.font = `600 10px ${SANS}`;
  c.letterSpacing = "2px";
  c.fillText(texto, PANEL_X, y);
  c.letterSpacing = "0px";
}
function drawStat(
  c: CanvasRenderingContext2D,
  p: Paleta,
  etiqueta: string,
  valor: number,
  y: number,
) {
  drawLabel(c, p, etiqueta, y);
  c.fillStyle = p.value;
  c.font = `700 26px ${MONO}`;
  c.letterSpacing = "1px";
  c.fillText(valor.toLocaleString("es-ES"), PANEL_X, y + 30);
  c.letterSpacing = "0px";
}
function drawNext(c: CanvasRenderingContext2D, p: Paleta, next: Pieza) {
  drawLabel(c, p, "NEXT", NEXT_Y - 12);
  c.fillStyle = p.board;
  c.fillRect(PANEL_X, NEXT_Y, NEXT_SIZE, NEXT_SIZE);
  const { shape } = next;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  drawShape(c, shape, PANEL_X, NEXT_Y, offX, offY);
  c.strokeStyle = p.border;
  c.lineWidth = 1;
  c.strokeRect(PANEL_X + 0.5, NEXT_Y + 0.5, NEXT_SIZE - 1, NEXT_SIZE - 1);
}
function drawControls(c: CanvasRenderingContext2D, p: Paleta) {
  drawLabel(c, p, "CONTROLS", 436);
  let y = 452; // borde superior de la primera fila
  for (const { teclas, texto } of CONTROLES) {
    let x = PANEL_X;
    for (const tecla of teclas) {
      c.font = `11px ${SANS}`;
      const w = Math.ceil(c.measureText(tecla).width) + 14;
      c.fillStyle = p.kbdBg;
      c.strokeStyle = p.kbdBorder;
      c.lineWidth = 1;
      c.beginPath();
      c.roundRect(x + 0.5, y + 0.5, w - 1, 18, 3);
      c.fill();
      c.stroke();
      c.fillStyle = p.kbdText;
      c.fillText(tecla, x + 7, y + 13);
      x += w + 4;
    }
    c.fillStyle = p.controlsText;
    c.font = `12px ${SANS}`;
    c.fillText(texto, x, y + 13);
    y += 26;
  }
}
function drawGameOver(c: CanvasRenderingContext2D, p: Paleta, score: number) {
  c.fillStyle = p.overlay;
  c.fillRect(0, 0, CANVAS_W, CANVAS_H);
  c.textAlign = "center";
  c.fillStyle = "#e57373";
  c.font = `800 28px ${SANS}`;
  c.letterSpacing = "4px";
  c.fillText("GAME OVER", CANVAS_W / 2, CANVAS_H / 2 - 8);
  c.letterSpacing = "0px";
  c.fillStyle = "#7aa2f7";
  c.font = `14px ${MONO}`;
  c.fillText(
    `Puntuación: ${score.toLocaleString("es-ES")}`,
    CANVAS_W / 2,
    CANVAS_H / 2 + 24,
  );
  c.textAlign = "left";
}
export function drawGame(
  c: CanvasRenderingContext2D,
  tema: TemaTetris,
  v: VistaTetris,
) {
  const p = PALETAS[tema];
  c.textAlign = "left";
  c.fillStyle = p.bg;
  c.fillRect(0, 0, CANVAS_W, CANVAS_H);
  drawBoard(c, p, v);
  drawStat(c, p, "SCORE", v.score, 24);
  drawStat(c, p, "LINES", v.lines, 104);
  drawStat(c, p, "LEVEL", v.level, 184);
  drawNext(c, p, v.next);
  drawControls(c, p);
  if (v.gameOver) drawGameOver(c, p, v.score);
}
