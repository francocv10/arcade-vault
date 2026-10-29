// Motor de Snake, diseñado desde cero (no hay juego de referencia) con el
// aspecto del Snake de Google. Avisa a React de su estado con `onChange`,
// solo cuando cambia algún valor.
import {
  CELL,
  COLS,
  ROWS,
  celdaLibre,
  chocaConCuerpo,
  chocaConPared,
  nextHead,
  nivelPorFrutas,
} from "./board";
import type { Celda } from "./board";
import { PALETAS } from "./paletas";
import { NOMBRES_FRUTA, drawFruit } from "./sprites";
import type { NombreFruta } from "./sprites";
import type {
  EstadoSnake,
  JuegoSnake,
  SkinSnake,
  SnapshotSnake,
} from "./types";
const FRUITS_URL = "/games/snake/fruits.png";
const START_SPEED = 8; // pasos por segundo en el nivel 1
const SPEED_PER_LEVEL = 0.5;
const MAX_SPEED = 16;
const MAX_DT = 0.05; // s: un salto de tiempo no debe hacer avanzar varios pasos
const MAX_TURNS = 2;
const POINTS_PER_FRUIT = 10;
const FRUIT_BOX = 36;
// Forma de fruta de `retro`: cuadrado centrado en la casilla y tallo encima.
const FORMA_LADO = 24;
const TALLO_ANCHO = 4;
const TALLO_ALTO = 8;
const DIRS: Record<string, Celda> = {
  arrowleft: { x: -1, y: 0 },
  a: { x: -1, y: 0 },
  arrowright: { x: 1, y: 0 },
  d: { x: 1, y: 0 },
  arrowup: { x: 0, y: -1 },
  w: { x: 0, y: -1 },
  arrowdown: { x: 0, y: 1 },
  s: { x: 0, y: 1 },
};
interface Fruta extends Celda {
  kind: NombreFruta;
}
function esCampoEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}
function velocidad(level: number) {
  return Math.min(MAX_SPEED, START_SPEED + SPEED_PER_LEVEL * (level - 1));
}
function frutaAleatoria(): NombreFruta {
  return NOMBRES_FRUTA[Math.floor(Math.random() * NOMBRES_FRUTA.length)];
}
export function createSnakeGame(
  canvas: HTMLCanvasElement,
  onChange: (snapshot: SnapshotSnake) => void,
): JuegoSnake {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo obtener el contexto 2D del lienzo.");
  let skin: SkinSnake = "clasico";
  // ── Estado del juego ───────────────────────────────────────────────────────
  let snake: Celda[] = [];
  let dir: Celda = { x: 1, y: 0 };
  let dirQueue: Celda[] = [];
  let fruit: Fruta | null = null;
  let eaten = 0;
  let score = 0;
  let level = 1;
  let gameState: EstadoSnake = "playing";
  let started = false; // la serpiente espera la primera tecla de dirección
  let paused = false;
  let destroyed = false;
  let ready = false; // fruits.png ya está cargado
  let last: SnapshotSnake | null = null;
  function notify() {
    if (destroyed) return;
    const lives = gameState === "playing" ? 1 : 0;
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
  function placeFruit() {
    const cell = celdaLibre(snake);
    if (!cell) {
      fruit = null;
      gameState = "gameover"; // tablero lleno
      return;
    }
    fruit = { ...cell, kind: frutaAleatoria() };
  }
  function initGame() {
    snake = [
      { x: 6, y: 7 },
      { x: 5, y: 7 },
      { x: 4, y: 7 },
    ];
    dir = { x: 1, y: 0 };
    dirQueue = [];
    eaten = 0;
    score = 0;
    level = 1;
    gameState = "playing";
    started = false;
    placeFruit();
  }
  // ── Entrada ────────────────────────────────────────────────────────────────
  // Teclas cuyo `keydown` se consumió: su `keyup` también se cancela para que
  // las flechas y Espacio no activen el botón que tenga el foco.
  const swallowed = new Set<string>();
  function tecla(e: KeyboardEvent) {
    return e.key.toLowerCase();
  }
  function onKeyDown(e: KeyboardEvent) {
    if (paused || gameState !== "playing" || esCampoEditable(e.target)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = tecla(e);
    if (key === " ") {
      e.preventDefault();
      swallowed.add(key);
      return;
    }
    const nueva = DIRS[key];
    if (!nueva) return;
    e.preventDefault();
    swallowed.add(key);
    // Los giros se comparan contra el último giro encolado.
    const ref = dirQueue.length ? dirQueue[dirQueue.length - 1] : dir;
    if (nueva.x === -ref.x && nueva.y === -ref.y) return;
    if (!started) started = true;
    if (nueva.x === ref.x && nueva.y === ref.y) return;
    if (dirQueue.length < MAX_TURNS) dirQueue.push(nueva);
  }
  function onKeyUp(e: KeyboardEvent) {
    if (swallowed.delete(tecla(e))) e.preventDefault();
  }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  // ── Lógica ─────────────────────────────────────────────────────────────────
  function step() {
    const giro = dirQueue.shift();
    if (giro) dir = giro;
    const head = nextHead(snake[0], dir);
    if (chocaConPared(head)) {
      gameState = "gameover";
      return;
    }
    const come = fruit !== null && fruit.x === head.x && fruit.y === head.y;
    if (chocaConCuerpo(snake, head, come)) {
      gameState = "gameover";
      return;
    }
    snake.unshift(head);
    if (!come) {
      snake.pop();
      return;
    }
    eaten++;
    score += POINTS_PER_FRUIT;
    level = nivelPorFrutas(eaten);
    placeFruit();
  }
  let acc = 0; // s acumulados hacia el siguiente paso
  function update(dt: number) {
    if (gameState !== "playing" || !started) return;
    acc += dt;
    const periodo = 1 / velocidad(level);
    while (acc >= periodo && gameState === "playing") {
      acc -= periodo;
      step();
    }
  }
  // ── Dibujo ─────────────────────────────────────────────────────────────────
  function centro(c: Celda) {
    return { x: c.x * CELL + CELL / 2, y: c.y * CELL + CELL / 2 };
  }
  function drawBoard(c: CanvasRenderingContext2D) {
    const p = PALETAS[skin];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        c.fillStyle = (x + y) % 2 === 0 ? p.casillaClara : p.casillaOscura;
        c.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
  }
  function drawSnake(c: CanvasRenderingContext2D) {
    const p = PALETAS[skin];
    // El brillo solo envuelve el cuerpo y la cabeza, no los ojos.
    c.save();
    if (p.brilloSerpiente > 0) {
      c.shadowColor = p.serpiente;
      c.shadowBlur = p.brilloSerpiente;
    }
    c.strokeStyle = p.serpiente;
    c.fillStyle = p.serpiente;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.lineWidth = 30;
    c.beginPath();
    snake.forEach((seg, i) => {
      const p = centro(seg);
      if (i === 0) c.moveTo(p.x, p.y);
      else c.lineTo(p.x, p.y);
    });
    c.stroke();
    const h = centro(snake[0]);
    c.beginPath();
    c.arc(h.x, h.y, 18, 0, Math.PI * 2);
    c.fill();
    c.restore();
    // Ojos orientados según la dirección (perpendicular = (-dy, dx))
    for (const lado of [-1, 1]) {
      const ex = h.x + dir.x * 6 + -dir.y * 8 * lado;
      const ey = h.y + dir.y * 6 + dir.x * 8 * lado;
      c.fillStyle = p.ojoBlanco;
      c.beginPath();
      c.arc(ex, ey, 6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = p.ojoPupila;
      c.beginPath();
      c.arc(ex + dir.x * 2, ey + dir.y * 2, 3, 0, Math.PI * 2);
      c.fill();
    }
  }
  function drawText(
    c: CanvasRenderingContext2D,
    text: string,
    y: number,
    fuente: string,
  ) {
    c.fillStyle = PALETAS[skin].texto;
    c.font = fuente;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, canvas.width / 2, y, 760);
  }
  function drawFruta(c: CanvasRenderingContext2D, f: Fruta) {
    const pal = PALETAS[skin];
    const p = centro(f);
    if (pal.frutaModo === "forma") {
      const lado = FORMA_LADO;
      const x = p.x - lado / 2;
      const y = p.y - lado / 2;
      c.fillStyle = pal.frutaForma;
      c.fillRect(x, y, lado, lado);
      c.fillStyle = pal.frutaTallo;
      c.fillRect(
        p.x - TALLO_ANCHO / 2,
        y - TALLO_ALTO,
        TALLO_ANCHO,
        TALLO_ALTO,
      );
      return;
    }
    c.imageSmoothingEnabled = false;
    c.save();
    if (pal.frutaBrillo > 0) {
      c.shadowColor = pal.frutaBrilloColor;
      c.shadowBlur = pal.frutaBrillo;
    }
    drawFruit(c, fruits, f.kind, p.x, p.y, FRUIT_BOX);
    c.restore();
  }
  function draw() {
    const c = ctx!;
    const p = PALETAS[skin];
    drawBoard(c);
    if (fruit) drawFruta(c, fruit);
    drawSnake(c);
    if (gameState === "playing" && !started) {
      c.fillStyle = p.velo;
      c.fillRect(0, 480, canvas.width, 56);
      drawText(c, "PULSA UNA FLECHA PARA EMPEZAR", 508, p.fuenteLeyenda);
    }
    if (gameState === "gameover") {
      c.fillStyle = p.veloGameOver;
      c.fillRect(0, 0, canvas.width, canvas.height);
      drawText(c, "GAME OVER", canvas.height / 2 - 24, p.fuenteTitulo);
      drawText(c, "Puntuación: " + score, canvas.height / 2 + 36, p.fuenteSub);
    }
  }
  // ── Bucle principal ────────────────────────────────────────────────────────
  let lastTime: number | null = null;
  let rafId: number | null = null;
  function loop(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, MAX_DT);
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
    if (rafId !== null || !ready || paused || gameState !== "playing") return;
    if (destroyed) return;
    lastTime = null; // evita un salto de dt tras la pausa
    rafId = requestAnimationFrame(loop);
  }
  function stopLoop() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }
  // ── Arranque: el bucle empieza cuando fruits.png está cargado ─────────────
  const fruits = new Image();
  fruits.onload = () => {
    if (destroyed) return;
    ready = true;
    notify();
    draw();
    startLoop();
  };
  fruits.onerror = () => {
    if (destroyed) return;
    console.error("No se pudo cargar fruits.png de Snake.");
  };
  initGame();
  fruits.src = FRUITS_URL;
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
      acc = 0;
      if (!ready) return;
      notify();
      draw();
      startLoop();
    },
    setSkin(nueva) {
      if (destroyed || nueva === skin) return;
      skin = nueva;
      // Redibuja ya (pausa, gameover o corriendo). Antes de cargar fruits.png solo
      // se guarda la skin: `fruits.onload` ya dibuja con ella.
      if (ready) draw();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      fruits.onload = null;
      fruits.onerror = null;
    },
  };
}
