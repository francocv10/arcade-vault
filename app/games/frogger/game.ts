// Motor de Frogger: canvas puro, sin imágenes. Avisa a React de su estado con
// `onChange`, solo cuando cambia algún valor.
import {
  COLS,
  GOAL_COUNT,
  JUMP_MS,
  LIVES_INICIALES,
  ROW_START,
  START_COL,
  TURTLE_SUBMERGED_MS,
  TURTLE_VISIBLE_MS,
  tiempoRonda,
} from "./board";
import type { Direction, Frog, Lane } from "./board";
import {
  carrilDeLaRana,
  checkGoal,
  checkRoadCollision,
  getSupport,
} from "./collisions";
import { dibujar } from "./draw";
import { PERIODO, buildLanes, esCarrilRio } from "./lanes";
import type { EstadoFrogger, JuegoFrogger, SnapshotFrogger } from "./types";
const PUNTOS_POR_FILA = 10;
const PUNTOS_BOCA = 50;
const PUNTOS_POR_SEGUNDO = 10; // bonus por cada segundo que sobra al llegar a una boca
const MAX_DT = 50; // ms: un salto de tiempo no debe mover las entidades de golpe
const CICLO_TORTUGA_MS = TURTLE_VISIBLE_MS + TURTLE_SUBMERGED_MS;
// Las entidades viven en el circuito [-4, COLS) de PERIODO casillas.
const LIMITE_IZQUIERDO = COLS - PERIODO;
const DIRECCIONES: Record<string, Direction> = {
  arrowup: "up",
  w: "up",
  arrowdown: "down",
  s: "down",
  arrowleft: "left",
  a: "left",
  arrowright: "right",
  d: "right",
};
function esCampoEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}
function nuevaRana(): Frog {
  return {
    col: START_COL,
    row: ROW_START,
    animating: false,
    animT: 0,
    targetCol: START_COL,
    targetRow: ROW_START,
  };
}
export function createFroggerGame(
  canvas: HTMLCanvasElement,
  onChange: (snapshot: SnapshotFrogger) => void,
): JuegoFrogger {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo obtener el contexto 2D del lienzo.");
  // ── Estado del juego ───────────────────────────────────────────────────────
  let lanes: Lane[] = [];
  let frog: Frog = nuevaRana();
  let ocupadas: boolean[] = [];
  let pendingDir: Direction | null = null;
  let filaMaxima = ROW_START; // fila más alta alcanzada desde que reapareció
  let score = 0;
  let lives = LIVES_INICIALES;
  let level = 1;
  let tiempo = tiempoRonda(1);
  let gameState: EstadoFrogger = "playing";
  let paused = false;
  let destroyed = false;
  let last: SnapshotFrogger | null = null;
  function notify() {
    if (destroyed) return;
    if (
      last &&
      last.score === score &&
      last.lives === lives &&
      last.level === level &&
      last.status === gameState
    )
      return;
    last = { score, lives, level, status: gameState };
    onChange(last);
  }
  function initGame() {
    lanes = buildLanes(1);
    frog = nuevaRana();
    ocupadas = Array<boolean>(GOAL_COUNT).fill(false);
    pendingDir = null;
    filaMaxima = ROW_START;
    score = 0;
    lives = LIVES_INICIALES;
    level = 1;
    tiempo = tiempoRonda(1);
    gameState = "playing";
  }
  // ── Entrada ────────────────────────────────────────────────────────────────
  // Teclas cuyo `keydown` se consumió: su `keyup` también se cancela para que
  // las flechas no activen el botón que tenga el foco.
  const swallowed = new Set<string>();
  function tecla(e: KeyboardEvent) {
    return e.key.toLowerCase();
  }
  function onKeyDown(e: KeyboardEvent) {
    if (paused || gameState !== "playing" || esCampoEditable(e.target)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = tecla(e);
    const dir = DIRECCIONES[key];
    if (!dir) return;
    e.preventDefault();
    swallowed.add(key);
    // Un salto por pulsación: la repetición automática del teclado no cuenta.
    if (e.repeat) return;
    pendingDir = dir;
  }
  function onKeyUp(e: KeyboardEvent) {
    if (swallowed.delete(tecla(e))) e.preventDefault();
  }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  // ── Lógica ─────────────────────────────────────────────────────────────────
  function moverEntidades(dt: number) {
    for (const lane of lanes) {
      const delta = (lane.speed * lane.dir * dt) / 1000;
      for (const e of lane.entities) {
        e.col += delta;
        if (e.col >= COLS) e.col -= PERIODO;
        else if (e.col < LIMITE_IZQUIERDO) e.col += PERIODO;
        if (e.type === "turtle") {
          e.fase = ((e.fase ?? 0) + dt) % CICLO_TORTUGA_MS;
          e.submerged = e.fase >= TURTLE_VISIBLE_MS;
        }
      }
    }
  }
  // Calcula la casilla de destino; `null` si el salto saldría de la rejilla.
  function destinoDelSalto(dir: Direction) {
    const col = Math.round(frog.col);
    const row = frog.row;
    const destino = {
      up: { col, row: row - 1 },
      down: { col, row: row + 1 },
      left: { col: col - 1, row },
      right: { col: col + 1, row },
    }[dir];
    if (destino.col < 0 || destino.col >= COLS) return null;
    if (destino.row < 0 || destino.row > ROW_START) return null;
    return destino;
  }
  function iniciarSalto() {
    if (!pendingDir) return;
    const destino = destinoDelSalto(pendingDir);
    pendingDir = null;
    if (!destino) return;
    frog.col = Math.round(frog.col);
    frog.animating = true;
    frog.animT = 0;
    frog.targetCol = destino.col;
    frog.targetRow = destino.row;
  }
  function avanzarSalto(dt: number) {
    frog.animT += dt;
    if (frog.animT < JUMP_MS) return;
    frog.col = frog.targetCol;
    frog.row = frog.targetRow;
    frog.animating = false;
    frog.animT = 0;
    resolveLanding();
  }
  // Rana en la casilla de inicio, con el tiempo y el avance de la ronda a cero.
  function reaparecer() {
    frog = nuevaRana();
    pendingDir = null;
    tiempo = tiempoRonda(level);
    filaMaxima = ROW_START;
  }
  // Provisional hasta el Paso 7: devuelve la rana al inicio sin quitar vidas.
  function killFrog() {
    reaparecer();
  }
  // +50 y el bonus de tiempo al ocupar una boca. Completar la ronda llega en el Paso 6.
  function ocuparBoca(indice: number) {
    ocupadas[indice] = true;
    score += PUNTOS_BOCA + Math.floor(tiempo / 1000) * PUNTOS_POR_SEGUNDO;
    reaparecer();
  }
  // Se ejecuta al terminar cada salto: puntuación por avanzar y metas.
  function resolveLanding() {
    if (frog.row < filaMaxima) {
      score += PUNTOS_POR_FILA * (filaMaxima - frog.row);
      filaMaxima = frog.row;
    }
    const meta = checkGoal(frog, ocupadas);
    if (!meta) return;
    if (meta.tipo === "boca") ocuparBoca(meta.indice);
    else killFrog();
  }
  // Peligros de la casilla en la que reposa la rana: vehículos, agua y bordes.
  function comprobarPeligros(dt: number) {
    if (checkRoadCollision(frog, lanes)) {
      killFrog();
      return;
    }
    const lane = carrilDeLaRana(frog, lanes);
    if (!lane || !esCarrilRio(lane)) return;
    if (!getSupport(frog, lanes)) {
      killFrog();
      return;
    }
    // El tronco o las tortugas arrastran a la rana con ellos.
    frog.col += (lane.speed * lane.dir * dt) / 1000;
    if (frog.col < -0.5 || frog.col > COLS - 0.5) killFrog();
  }
  function update(dt: number) {
    if (gameState !== "playing") return;
    moverEntidades(dt);
    if (!frog.animating) iniciarSalto();
    if (frog.animating) avanzarSalto(dt);
    if (!frog.animating) comprobarPeligros(dt);
    tiempo -= dt;
    if (tiempo <= 0) killFrog();
  }
  // ── Dibujo ─────────────────────────────────────────────────────────────────
  function draw() {
    dibujar(ctx!, {
      lanes,
      frog,
      ocupadas,
      score,
      level,
      lives,
      tiempo,
      tiempoMax: tiempoRonda(level),
      status: gameState,
    });
  }
  // ── Bucle principal ────────────────────────────────────────────────────────
  let lastTime: number | null = null;
  let rafId: number | null = null;
  function loop(ts: number) {
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, MAX_DT);
    lastTime = ts;
    update(dt);
    draw();
    notify();
    if (gameState !== "playing") {
      rafId = null;
      return;
    }
    rafId = requestAnimationFrame(loop);
  }
  function startLoop() {
    if (rafId !== null || paused || destroyed || gameState !== "playing")
      return;
    lastTime = null; // evita un salto de dt tras la pausa
    rafId = requestAnimationFrame(loop);
  }
  function stopLoop() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }
  // ── Arranque ───────────────────────────────────────────────────────────────
  initGame();
  notify();
  draw();
  startLoop();
  return {
    pause() {
      if (destroyed || paused) return;
      paused = true;
      stopLoop();
    },
    resume() {
      if (destroyed || !paused) return;
      paused = false;
      startLoop();
    },
    restart() {
      if (destroyed) return;
      stopLoop();
      initGame();
      notify();
      draw();
      startLoop();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}
