// Dibujo de Frogger con primitivas de canvas (sin imágenes). Recibe el estado
// por parámetro y no accede a `document` ni a `window`.
import {
  CANVAS_H,
  CANVAS_W,
  CELL,
  COLS,
  GOAL_COLS,
  GOAL_WIDTH,
  GRID_H,
  GRID_W,
  GRID_X,
  GRID_Y,
  JUMP_MS,
  ROW_GOALS,
  ROW_RIVER_BOT,
  ROW_RIVER_TOP,
  ROW_ROAD_BOT,
  ROW_ROAD_TOP,
  ROW_SAFE_MID,
  ROW_START,
  TURTLE_VISIBLE_MS,
} from "./board";
import type { Entity, Frog, Lane } from "./board";
import type { EstadoFrogger } from "./types";
export interface VistaFrogger {
  lanes: readonly Lane[];
  frog: Frog;
  ocupadas: readonly boolean[];
  score: number;
  level: number;
  lives: number;
  tiempo: number; // ms restantes
  tiempoMax: number; // ms de la ronda
  status: EstadoFrogger;
}
const COLOR = {
  fondo: "#05060f",
  meta: "#14532d",
  boca: "#4ade80",
  bocaBorde: "#facc15",
  rio: "#0b2a63",
  rioOla: "#1d4ed8",
  segura: "#166534",
  carretera: "#0f0f14",
  linea: "rgba(255, 255, 255, 0.28)",
  tronco: "#7c4a21",
  troncoVeta: "#5a3416",
  tortuga: "#22c55e",
  tortugaOscura: "#15803d",
  rana: "#4ade80",
  ranaOscura: "#16a34a",
  texto: "#ffffff",
  veloGameOver: "rgba(0, 0, 0, 0.7)",
};
const COLORES_COCHE = ["#ef4444", "#facc15", "#3b82f6", "#f472b6"];
const FUENTE = "bold 16px monospace";
const px = (col: number) => GRID_X + col * CELL;
const py = (row: number) => GRID_Y + row * CELL;
function drawFondo(c: CanvasRenderingContext2D) {
  c.fillStyle = COLOR.fondo;
  c.fillRect(0, 0, CANVAS_W, CANVAS_H);
  const zonas: [number, number, string][] = [
    [ROW_GOALS, ROW_GOALS, COLOR.meta],
    [ROW_RIVER_TOP, ROW_RIVER_BOT, COLOR.rio],
    [ROW_SAFE_MID, ROW_SAFE_MID, COLOR.segura],
    [ROW_ROAD_TOP, ROW_ROAD_BOT, COLOR.carretera],
    [ROW_START, ROW_START, COLOR.segura],
  ];
  for (const [desde, hasta, color] of zonas) {
    c.fillStyle = color;
    c.fillRect(GRID_X, py(desde), GRID_W, (hasta - desde + 1) * CELL);
  }
  // Ondas del río.
  c.strokeStyle = COLOR.rioOla;
  c.lineWidth = 2;
  for (let row = ROW_RIVER_TOP; row <= ROW_RIVER_BOT; row++) {
    for (let col = 0; col < COLS; col += 2) {
      const x = px(col) + 8;
      const y = py(row) + CELL / 2;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + 6, y - 5, x + 12, y);
      c.quadraticCurveTo(x + 18, y + 5, x + 24, y);
      c.stroke();
    }
  }
  // Líneas discontinuas entre carriles de carretera.
  c.strokeStyle = COLOR.linea;
  c.lineWidth = 2;
  c.setLineDash([16, 14]);
  for (let row = ROW_ROAD_TOP + 1; row <= ROW_ROAD_BOT; row++) {
    c.beginPath();
    c.moveTo(GRID_X, py(row));
    c.lineTo(GRID_X + GRID_W, py(row));
    c.stroke();
  }
  c.setLineDash([]);
}
function drawBocas(c: CanvasRenderingContext2D, ocupadas: readonly boolean[]) {
  GOAL_COLS.forEach((col, i) => {
    const x = px(col);
    const y = py(ROW_GOALS);
    const w = GOAL_WIDTH * CELL;
    c.fillStyle = COLOR.boca;
    c.fillRect(x, y + 4, w, CELL - 4);
    c.strokeStyle = COLOR.bocaBorde;
    c.lineWidth = 3;
    c.strokeRect(x + 1.5, y + 5.5, w - 3, CELL - 7);
    if (ocupadas[i]) drawRana(c, x + w / 2, y + CELL / 2 + 2, false, 0.8);
  });
}
function drawCoche(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  dir: 1 | -1,
  color: string,
) {
  c.fillStyle = color;
  c.fillRect(x + 3, y + 7, w - 6, CELL - 14);
  // Parabrisas en el lado hacia el que avanza.
  c.fillStyle = "rgba(255, 255, 255, 0.55)";
  const cristalX = dir === 1 ? x + w - 14 : x + 6;
  c.fillRect(cristalX, y + 10, 8, CELL - 20);
  c.fillStyle = "#111";
  for (const rx of [x + 9, x + w - 9]) {
    for (const ry of [y + 7, y + CELL - 7]) {
      c.beginPath();
      c.arc(rx, ry, 4, 0, Math.PI * 2);
      c.fill();
    }
  }
}
function drawCamion(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  dir: 1 | -1,
) {
  const cabina = CELL - 4;
  const cargaX = dir === 1 ? x + 2 : x + cabina;
  const cabinaX = dir === 1 ? x + w - cabina : x + 2;
  c.fillStyle = "#9ca3af";
  c.fillRect(cargaX, y + 6, w - cabina - 2, CELL - 12);
  c.fillStyle = "#4b5563";
  c.fillRect(cabinaX, y + 8, cabina - 2, CELL - 16);
  c.fillStyle = "rgba(255, 255, 255, 0.55)";
  c.fillRect(
    dir === 1 ? cabinaX + cabina - 10 : cabinaX + 2,
    y + 12,
    6,
    CELL - 24,
  );
  c.fillStyle = "#111";
  for (const rx of [x + 10, x + w / 2, x + w - 10]) {
    for (const ry of [y + 6, y + CELL - 6]) {
      c.beginPath();
      c.arc(rx, ry, 4, 0, Math.PI * 2);
      c.fill();
    }
  }
}
function drawTronco(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
) {
  c.fillStyle = COLOR.tronco;
  c.beginPath();
  c.roundRect(x + 2, y + 6, w - 4, CELL - 12, 8);
  c.fill();
  c.strokeStyle = COLOR.troncoVeta;
  c.lineWidth = 2;
  for (let lx = x + 14; lx < x + w - 8; lx += 18) {
    c.beginPath();
    c.moveTo(lx, y + 10);
    c.lineTo(lx + 6, y + CELL - 10);
    c.stroke();
  }
}
function drawTortugas(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  e: Entity,
) {
  const hundida = e.submerged === true;
  // Parpadea justo antes de sumergirse para avisar al jugador.
  const aviso = !hundida && (e.fase ?? 0) >= TURTLE_VISIBLE_MS - 600;
  c.save();
  c.globalAlpha = hundida ? 0.35 : aviso ? 0.65 : 1;
  for (let i = 0; i < e.width; i++) {
    const cx = x + i * CELL + CELL / 2;
    const cy = y + CELL / 2;
    c.beginPath();
    c.arc(cx, cy, 15, 0, Math.PI * 2);
    if (hundida) {
      c.strokeStyle = COLOR.tortuga;
      c.lineWidth = 2;
      c.stroke();
      continue;
    }
    c.fillStyle = COLOR.tortuga;
    c.fill();
    c.strokeStyle = COLOR.tortugaOscura;
    c.lineWidth = 2;
    c.beginPath();
    c.arc(cx, cy, 9, 0, Math.PI * 2);
    c.moveTo(cx - 9, cy);
    c.lineTo(cx + 9, cy);
    c.moveTo(cx, cy - 9);
    c.lineTo(cx, cy + 9);
    c.stroke();
  }
  c.restore();
}
function drawEntidades(c: CanvasRenderingContext2D, lanes: readonly Lane[]) {
  // Lo que sale de la rejilla no se ve: se recorta a su rectángulo.
  c.save();
  c.beginPath();
  c.rect(GRID_X, GRID_Y, GRID_W, GRID_H);
  c.clip();
  for (const lane of lanes) {
    lane.entities.forEach((e, i) => {
      const x = px(e.col);
      const y = py(lane.row);
      const w = e.width * CELL;
      if (e.type === "car") {
        const color = COLORES_COCHE[(lane.row + i) % COLORES_COCHE.length];
        drawCoche(c, x, y, w, lane.dir, color);
      } else if (e.type === "truck") drawCamion(c, x, y, w, lane.dir);
      else if (e.type === "log") drawTronco(c, x, y, w);
      else drawTortugas(c, x, y, e);
    });
  }
  c.restore();
}
// (x, y) es el centro de la rana.
function drawRana(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  saltando: boolean,
  escala = 1,
) {
  c.save();
  c.translate(x, y);
  c.scale(escala, escala);
  c.fillStyle = COLOR.ranaOscura;
  const patas = saltando ? 16 : 11;
  for (const lado of [-1, 1]) {
    c.fillRect(lado * patas - 4, -11, 8, 6);
    c.fillRect(lado * patas - 4, 5, 8, 6);
  }
  c.fillStyle = COLOR.rana;
  c.beginPath();
  c.ellipse(0, 0, 14, 12, 0, 0, Math.PI * 2);
  c.fill();
  for (const lado of [-1, 1]) {
    c.fillStyle = "#fff";
    c.beginPath();
    c.arc(lado * 6, -9, 4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#000";
    c.beginPath();
    c.arc(lado * 6, -10, 2, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}
function drawJugador(c: CanvasRenderingContext2D, frog: Frog) {
  const t = frog.animating ? Math.min(1, frog.animT / JUMP_MS) : 0;
  const col = frog.col + (frog.targetCol - frog.col) * t;
  const row = frog.row + (frog.targetRow - frog.row) * t;
  drawRana(c, px(col) + CELL / 2, py(row) + CELL / 2, frog.animating);
}
function drawHud(c: CanvasRenderingContext2D, v: VistaFrogger) {
  c.fillStyle = COLOR.texto;
  c.font = FUENTE;
  c.textBaseline = "middle";
  c.textAlign = "left";
  c.fillText("SCORE " + v.score, GRID_X, 14);
  c.textAlign = "center";
  c.fillText("NIVEL " + v.level, CANVAS_W / 2, 14);
  for (let i = 0; i < v.lives; i++) {
    c.fillStyle = COLOR.rana;
    c.beginPath();
    c.arc(GRID_X + GRID_W - 10 - i * 24, 14, 8, 0, Math.PI * 2);
    c.fill();
  }
  const ratio = Math.max(0, Math.min(1, v.tiempo / v.tiempoMax));
  c.fillStyle = "rgba(255, 255, 255, 0.15)";
  c.fillRect(GRID_X, 28, GRID_W, 8);
  c.fillStyle = ratio > 0.5 ? "#4ade80" : ratio > 0.25 ? "#facc15" : "#ef4444";
  c.fillRect(GRID_X, 28, GRID_W * ratio, 8);
}
function drawGameOver(c: CanvasRenderingContext2D, score: number) {
  c.fillStyle = COLOR.veloGameOver;
  c.fillRect(0, 0, CANVAS_W, CANVAS_H);
  c.fillStyle = COLOR.texto;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = "bold 64px monospace";
  c.fillText("GAME OVER", CANVAS_W / 2, CANVAS_H / 2 - 24, 760);
  c.font = "bold 32px monospace";
  c.fillText("Puntuación: " + score, CANVAS_W / 2, CANVAS_H / 2 + 36, 760);
}
export function dibujar(c: CanvasRenderingContext2D, v: VistaFrogger) {
  drawFondo(c);
  drawBocas(c, v.ocupadas);
  drawEntidades(c, v.lanes);
  drawJugador(c, v.frog);
  drawHud(c, v);
  if (v.status === "gameover") drawGameOver(c, v.score);
}
