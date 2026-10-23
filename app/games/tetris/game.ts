// Motor de Tetris, portado de references/started-games/03-tetris/game.js.
// Avisa a React de su estado con `onChange`, solo cuando cambia algún valor.
import {
  LINE_SCORES,
  WALL_KICKS,
  clearLines,
  collide,
  createBoard,
  ghostY,
  merge,
  COLS,
  type Tablero,
} from "./board";
import { drawGame } from "./draw";
import { randomPiece, rotateCW, type Pieza } from "./pieces";
import type {
  EstadoTetris,
  JuegoTetris,
  SnapshotTetris,
  TemaTetris,
} from "./types";
const CONTROL_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "KeyX",
  "Space",
]);
const MAX_SCORE = 1_000_000; // CHECK de `scores`
function esCampoEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}
export function createTetrisGame(
  canvas: HTMLCanvasElement,
  onChange: (snapshot: SnapshotTetris) => void,
): JuegoTetris {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo obtener el contexto 2D del lienzo.");
  // ── Estado del juego ───────────────────────────────────────────────────────
  let board: Tablero;
  let current: Pieza;
  let next: Pieza;
  let score: number;
  let lines: number;
  let level: number;
  let dropInterval: number;
  let dropAccum: number;
  let gameOver: boolean;
  let paused = false;
  let destroyed = false;
  let tema: TemaTetris = "dark";
  let last: SnapshotTetris | null = null;
  function notify() {
    const status: EstadoTetris = gameOver ? "gameover" : "playing";
    const snapshotScore = Math.min(score, MAX_SCORE);
    const lives = gameOver ? 0 : 1;
    if (
      last &&
      last.score === snapshotScore &&
      last.lives === lives &&
      last.level === level &&
      last.status === status
    )
      return;
    last = { score: snapshotScore, lives, level, status };
    onChange(last);
  }
  function draw() {
    drawGame(ctx!, tema, {
      board,
      current,
      next,
      score,
      lines,
      level,
      gameOver,
    });
  }
  function spawn() {
    current = next;
    next = randomPiece(COLS);
    if (collide(board, current.shape, current.x, current.y)) gameOver = true;
  }
  function lockPiece() {
    merge(board, current);
    const cleared = clearLines(board);
    if (cleared) {
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    }
    spawn();
  }
  function initGame() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    gameOver = false;
    dropInterval = 1000;
    dropAccum = 0;
    next = randomPiece(COLS);
    spawn();
  }
  function tryRotate() {
    const rotated = rotateCW(current.shape);
    for (const kick of WALL_KICKS) {
      if (!collide(board, rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }
  function hardDrop() {
    const gy = ghostY(board, current);
    score += (gy - current.y) * 2;
    current.y = gy;
    lockPiece();
  }
  function softDrop() {
    if (!collide(board, current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
    } else {
      lockPiece();
    }
  }
  // ── Entrada ────────────────────────────────────────────────────────────────
  // Teclas cuyo `keydown` se consumió: su `keyup` también se cancela para que
  // `Espacio` no active el botón que tenga el foco.
  const swallowed = new Set<string>();
  function onKeyDown(e: KeyboardEvent) {
    if (paused || gameOver || esCampoEditable(e.target)) return;
    if (!CONTROL_KEYS.has(e.code)) return;
    e.preventDefault();
    swallowed.add(e.code);
    switch (e.code) {
      case "ArrowLeft":
        if (!collide(board, current.shape, current.x - 1, current.y))
          current.x--;
        break;
      case "ArrowRight":
        if (!collide(board, current.shape, current.x + 1, current.y))
          current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
    }
    notify();
  }
  function onKeyUp(e: KeyboardEvent) {
    if (swallowed.delete(e.code)) e.preventDefault();
  }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  // ── Bucle principal ────────────────────────────────────────────────────────
  let lastTime: number | null = null;
  let rafId: number | null = null;
  function loop(ts: number) {
    const dt = lastTime === null ? 0 : ts - lastTime;
    lastTime = ts;
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(board, current.shape, current.x, current.y + 1)) current.y++;
      else lockPiece();
    }
    draw();
    notify();
    if (gameOver) {
      rafId = null;
      return;
    }
    rafId = requestAnimationFrame(loop);
  }
  function startLoop() {
    if (rafId !== null || paused || gameOver || destroyed) return;
    lastTime = null; // evita un salto de dt tras la pausa
    rafId = requestAnimationFrame(loop);
  }
  function stopLoop() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }
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
    setTheme(nuevo) {
      if (destroyed || nuevo === tema) return;
      tema = nuevo;
      draw();
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
