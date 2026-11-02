// Dibujo de Frogger con primitivas de canvas (sin imágenes). Recibe el estado
// y la paleta por parámetro y no accede a `document` ni a `window`.
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
import type { PaletaFrogger } from "./paletas";
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
// Brillo de la skin: el llamador lo envuelve en save()/restore().
function brillar(c: CanvasRenderingContext2D, p: PaletaFrogger, color: string) {
  if (p.brillo <= 0) return;
  c.shadowBlur = p.brillo;
  c.shadowColor = color;
}
const px = (col: number) => GRID_X + col * CELL;
const py = (row: number) => GRID_Y + row * CELL;
function drawFondo(c: CanvasRenderingContext2D, p: PaletaFrogger) {
  c.fillStyle = p.fondo;
  c.fillRect(0, 0, CANVAS_W, CANVAS_H);
  const zonas: [number, number, string][] = [
    [ROW_GOALS, ROW_GOALS, p.meta],
    [ROW_RIVER_TOP, ROW_RIVER_BOT, p.rio],
    [ROW_SAFE_MID, ROW_SAFE_MID, p.segura],
    [ROW_ROAD_TOP, ROW_ROAD_BOT, p.carretera],
    [ROW_START, ROW_START, p.segura],
  ];
  for (const [desde, hasta, color] of zonas) {
    c.fillStyle = color;
    c.fillRect(GRID_X, py(desde), GRID_W, (hasta - desde + 1) * CELL);
  }
  // Ondas del río.
  c.strokeStyle = p.rioOla;
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
  c.strokeStyle = p.linea;
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
function drawBocas(
  c: CanvasRenderingContext2D,
  ocupadas: readonly boolean[],
  p: PaletaFrogger,
) {
  GOAL_COLS.forEach((col, i) => {
    const x = px(col);
    const y = py(ROW_GOALS);
    const w = GOAL_WIDTH * CELL;
    c.save();
    brillar(c, p, p.boca);
    c.fillStyle = p.boca;
    c.fillRect(x, y + 4, w, CELL - 4);
    c.strokeStyle = p.bocaBorde;
    c.lineWidth = 3;
    c.strokeRect(x + 1.5, y + 5.5, w - 3, CELL - 7);
    c.restore();
    if (ocupadas[i]) drawRana(c, x + w / 2, y + CELL / 2 + 2, false, p, 0.8);
  });
}
function drawCoche(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  dir: 1 | -1,
  color: string,
  p: PaletaFrogger,
) {
  c.save();
  brillar(c, p, color);
  c.fillStyle = color;
  c.fillRect(x + 3, y + 7, w - 6, CELL - 14);
  // Parabrisas en el lado hacia el que avanza.
  c.fillStyle = p.cristal;
  const cristalX = dir === 1 ? x + w - 14 : x + 6;
  c.fillRect(cristalX, y + 10, 8, CELL - 20);
  c.fillStyle = p.rueda;
  for (const rx of [x + 9, x + w - 9]) {
    for (const ry of [y + 7, y + CELL - 7]) {
      c.beginPath();
      c.arc(rx, ry, 4, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.restore();
}
function drawCamion(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  dir: 1 | -1,
  p: PaletaFrogger,
) {
  c.save();
  brillar(c, p, p.camionCarga);
  const cabina = CELL - 4;
  const cargaX = dir === 1 ? x + 2 : x + cabina;
  const cabinaX = dir === 1 ? x + w - cabina : x + 2;
  c.fillStyle = p.camionCarga;
  c.fillRect(cargaX, y + 6, w - cabina - 2, CELL - 12);
  c.fillStyle = p.camionCabina;
  c.fillRect(cabinaX, y + 8, cabina - 2, CELL - 16);
  c.fillStyle = p.cristal;
  c.fillRect(
    dir === 1 ? cabinaX + cabina - 10 : cabinaX + 2,
    y + 12,
    6,
    CELL - 24,
  );
  c.fillStyle = p.rueda;
  for (const rx of [x + 10, x + w / 2, x + w - 10]) {
    for (const ry of [y + 6, y + CELL - 6]) {
      c.beginPath();
      c.arc(rx, ry, 4, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.restore();
}
function drawTronco(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  p: PaletaFrogger,
) {
  c.save();
  brillar(c, p, p.tronco);
  c.fillStyle = p.tronco;
  c.beginPath();
  c.roundRect(x + 2, y + 6, w - 4, CELL - 12, 8);
  c.fill();
  c.strokeStyle = p.troncoVeta;
  c.lineWidth = 2;
  for (let lx = x + 14; lx < x + w - 8; lx += 18) {
    c.beginPath();
    c.moveTo(lx, y + 10);
    c.lineTo(lx + 6, y + CELL - 10);
    c.stroke();
  }
  c.restore();
}
function drawTortugas(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  e: Entity,
  p: PaletaFrogger,
) {
  const hundida = e.submerged === true;
  // Parpadea justo antes de sumergirse para avisar al jugador.
  const aviso = !hundida && (e.fase ?? 0) >= TURTLE_VISIBLE_MS - 600;
  c.save();
  c.globalAlpha = hundida ? 0.35 : aviso ? 0.65 : 1;
  brillar(c, p, p.tortuga);
  for (let i = 0; i < e.width; i++) {
    const cx = x + i * CELL + CELL / 2;
    const cy = y + CELL / 2;
    c.beginPath();
    c.arc(cx, cy, 15, 0, Math.PI * 2);
    if (hundida) {
      c.strokeStyle = p.tortuga;
      c.lineWidth = 2;
      c.stroke();
      continue;
    }
    c.fillStyle = p.tortuga;
    c.fill();
    c.strokeStyle = p.tortugaOscura;
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
function drawEntidades(
  c: CanvasRenderingContext2D,
  lanes: readonly Lane[],
  p: PaletaFrogger,
) {
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
        const color = p.coches[(lane.row + i) % p.coches.length];
        drawCoche(c, x, y, w, lane.dir, color, p);
      } else if (e.type === "truck") drawCamion(c, x, y, w, lane.dir, p);
      else if (e.type === "log") drawTronco(c, x, y, w, p);
      else drawTortugas(c, x, y, e, p);
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
  p: PaletaFrogger,
  escala = 1,
) {
  c.save();
  brillar(c, p, p.rana);
  c.translate(x, y);
  c.scale(escala, escala);
  c.fillStyle = p.ranaOscura;
  const patas = saltando ? 16 : 11;
  for (const lado of [-1, 1]) {
    c.fillRect(lado * patas - 4, -11, 8, 6);
    c.fillRect(lado * patas - 4, 5, 8, 6);
  }
  c.fillStyle = p.rana;
  c.beginPath();
  c.ellipse(0, 0, 14, 12, 0, 0, Math.PI * 2);
  c.fill();
  for (const lado of [-1, 1]) {
    c.fillStyle = p.ojoBlanco;
    c.beginPath();
    c.arc(lado * 6, -9, 4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = p.ojoPupila;
    c.beginPath();
    c.arc(lado * 6, -10, 2, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}
function drawJugador(
  c: CanvasRenderingContext2D,
  frog: Frog,
  p: PaletaFrogger,
) {
  const t = frog.animating ? Math.min(1, frog.animT / JUMP_MS) : 0;
  const col = frog.col + (frog.targetCol - frog.col) * t;
  const row = frog.row + (frog.targetRow - frog.row) * t;
  drawRana(c, px(col) + CELL / 2, py(row) + CELL / 2, frog.animating, p);
}
function drawHud(
  c: CanvasRenderingContext2D,
  v: VistaFrogger,
  p: PaletaFrogger,
) {
  c.save();
  brillar(c, p, p.texto);
  c.fillStyle = p.texto;
  c.font = p.fuenteHud;
  c.textBaseline = "middle";
  c.textAlign = "left";
  c.fillText("SCORE " + v.score, GRID_X, 14);
  c.textAlign = "center";
  c.fillText("NIVEL " + v.level, CANVAS_W / 2, 14);
  c.restore();
  for (let i = 0; i < v.lives; i++) {
    c.fillStyle = p.rana;
    c.beginPath();
    c.arc(GRID_X + GRID_W - 10 - i * 24, 14, 8, 0, Math.PI * 2);
    c.fill();
  }
  const ratio = Math.max(0, Math.min(1, v.tiempo / v.tiempoMax));
  c.fillStyle = p.barraFondo;
  c.fillRect(GRID_X, 28, GRID_W, 8);
  c.fillStyle =
    ratio > 0.5 ? p.tiempoAlto : ratio > 0.25 ? p.tiempoMedio : p.tiempoBajo;
  c.fillRect(GRID_X, 28, GRID_W * ratio, 8);
}
function drawGameOver(
  c: CanvasRenderingContext2D,
  score: number,
  p: PaletaFrogger,
) {
  c.fillStyle = p.veloGameOver;
  c.fillRect(0, 0, CANVAS_W, CANVAS_H);
  c.save();
  brillar(c, p, p.texto);
  c.fillStyle = p.texto;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = p.fuenteTitulo;
  c.fillText("GAME OVER", CANVAS_W / 2, CANVAS_H / 2 - 24, 760);
  c.font = p.fuenteSub;
  c.fillText("Puntuación: " + score, CANVAS_W / 2, CANVAS_H / 2 + 36, 760);
  c.restore();
}
export function dibujar(
  c: CanvasRenderingContext2D,
  v: VistaFrogger,
  p: PaletaFrogger,
) {
  drawFondo(c, p);
  drawBocas(c, v.ocupadas, p);
  drawEntidades(c, v.lanes, p);
  drawJugador(c, v.frog, p);
  drawHud(c, v, p);
  if (v.status === "gameover") drawGameOver(c, v.score, p);
}
