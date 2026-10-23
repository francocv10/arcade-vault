// Motor de Arkanoid, portado de references/started-games/04-arkanoid/game.js.
// Avisa a React de su estado con `onChange`, solo cuando cambia algún valor.
import { LEVELS } from "./levels";
import type { ColorBloque } from "./levels";
import {
  EXPLOSION_DURATION,
  EXPLOSION_FRAMES,
  drawFrame,
  drawSprite,
} from "./sprites";
import type { EstadoArkanoid, JuegoArkanoid, SnapshotArkanoid } from "./types";
const SPRITESHEET_URL = "/games/arkanoid/spritesheet-breakout.png";
const BOUNCE_SOUND_URL = "/games/arkanoid/ball-bounce.mp3";
const BREAK_SOUND_URL = "/games/arkanoid/break-sound.mp3";
const PADDLE_SPEED = 400;
const BLOCK_COLS = 10;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (800 - BLOCK_COLS * BLOCK_W) / 2;
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;
const MAX_DT = 0.05; // s: un salto de tiempo no debe atravesar bloques ni la paleta
const LAST_LEVEL = LEVELS.length;
const ARROWS = new Set(["ArrowLeft", "ArrowRight"]);
interface Bloque {
  x: number;
  y: number;
  w: number;
  h: number;
  color: ColorBloque;
  alive: boolean;
}
interface Explosion {
  x: number;
  y: number;
  w: number;
  h: number;
  color: ColorBloque;
  elapsed: number; // ms
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
export function createArkanoidGame(
  canvas: HTMLCanvasElement,
  onChange: (snapshot: SnapshotArkanoid) => void,
): JuegoArkanoid {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo obtener el contexto 2D del lienzo.");
  const paddle = { x: 0, y: 560, w: 81, h: 14 };
  const ball = { x: 0, y: 0, w: 16, h: 16, vx: BASE_BALL_VX, vy: BASE_BALL_VY };
  const bounceSound = new Audio(BOUNCE_SOUND_URL);
  const breakSound = new Audio(BREAK_SOUND_URL);
  // Un clon por reproducción para permitir solapes; el navegador puede
  // rechazar la reproducción y ese error se ignora.
  function play(sound: HTMLAudioElement) {
    const clon = sound.cloneNode() as HTMLAudioElement;
    clon.play().catch(() => {});
  }
  // ── Estado del juego ───────────────────────────────────────────────────────
  let blocks: Bloque[] = [];
  let explosions: Explosion[] = [];
  let lives = 3;
  let score = 0;
  let currentLevel = 1;
  let gameState: EstadoArkanoid = "playing";
  let paused = false;
  let destroyed = false;
  let ready = false; // el spritesheet ya está cargado
  let last: SnapshotArkanoid | null = null;
  function notify() {
    if (
      last &&
      last.score === score &&
      last.lives === lives &&
      last.level === currentLevel &&
      last.status === gameState
    )
      return;
    last = { score, lives, level: currentLevel, status: gameState };
    onChange(last);
  }
  function placeBall() {
    const speed = LEVELS[currentLevel - 1].speed;
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  }
  function loadLevel(n: number) {
    currentLevel = n;
    blocks = LEVELS[n - 1].blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    explosions = [];
    placeBall();
  }
  function initGame() {
    paddle.x = (canvas.width - paddle.w) / 2;
    lives = 3;
    score = 0;
    gameState = "playing";
    loadLevel(1);
  }
  function collideAABB(block: Bloque) {
    return (
      ball.x < block.x + block.w &&
      ball.x + ball.w > block.x &&
      ball.y < block.y + block.h &&
      ball.y + ball.h > block.y
    );
  }
  // ── Entrada ────────────────────────────────────────────────────────────────
  const keys = { ArrowLeft: false, ArrowRight: false };
  // Teclas cuyo `keydown` se consumió: su `keyup` también se cancela para que
  // las flechas no activen el botón que tenga el foco.
  const swallowed = new Set<string>();
  function onKeyDown(e: KeyboardEvent) {
    if (paused || gameState !== "playing" || esCampoEditable(e.target)) return;
    if (!ARROWS.has(e.code)) return;
    e.preventDefault();
    swallowed.add(e.code);
    keys[e.code as keyof typeof keys] = true;
  }
  function onKeyUp(e: KeyboardEvent) {
    if (ARROWS.has(e.code)) keys[e.code as keyof typeof keys] = false;
    if (swallowed.delete(e.code)) e.preventDefault();
  }
  function onBlur() {
    keys.ArrowLeft = false;
    keys.ArrowRight = false;
  }
  function onMouseMove(e: MouseEvent) {
    if (paused || gameState !== "playing") return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    paddle.x = Math.max(
      0,
      Math.min(canvas.width - paddle.w, mouseX - paddle.w / 2),
    );
  }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  canvas.addEventListener("mousemove", onMouseMove);
  // ── Lógica ─────────────────────────────────────────────────────────────────
  function update(dt: number) {
    if (gameState !== "playing") return;
    // Paleta
    if (keys.ArrowLeft) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (keys.ArrowRight)
      paddle.x = Math.min(
        canvas.width - paddle.w,
        paddle.x + PADDLE_SPEED * dt,
      );
    // Pelota
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    // Rebotes en paredes (izquierda, derecha y arriba)
    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
      play(bounceSound);
    }
    if (ball.x + ball.w >= canvas.width) {
      ball.x = canvas.width - ball.w;
      ball.vx = -Math.abs(ball.vx);
      play(bounceSound);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
      play(bounceSound);
    }
    // Rebote en la paleta
    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
      play(bounceSound);
    }
    // Colisión con bloques: solo se procesa uno por fotograma
    for (const block of blocks) {
      if (!block.alive) continue;
      if (collideAABB(block)) {
        block.alive = false;
        explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        score += 10;
        ball.vy = -ball.vy;
        play(breakSound);
        if (blocks.every((b) => !b.alive)) {
          if (currentLevel < LAST_LEVEL) loadLevel(currentLevel + 1);
          else gameState = "win";
        }
        break;
      }
    }
    // Explosiones
    for (const exp of explosions) exp.elapsed += dt * 1000;
    explosions = explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);
    // Pelota perdida
    if (ball.y > canvas.height) {
      lives--;
      if (lives <= 0) {
        lives = 0;
        gameState = "gameover";
      } else {
        placeBall();
      }
    }
  }
  // ── Dibujo ─────────────────────────────────────────────────────────────────
  function drawOverlay(message: string) {
    ctx!.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx!.fillRect(0, 0, canvas.width, canvas.height);
    ctx!.fillStyle = "#fff";
    ctx!.font = "bold 64px monospace";
    ctx!.textAlign = "center";
    ctx!.textBaseline = "middle";
    // `maxWidth` evita que «¡Completaste el juego!» se recorte por los lados.
    ctx!.fillText(message, canvas.width / 2, canvas.height / 2, 760);
  }
  function draw() {
    const c = ctx!;
    c.fillStyle = "#000";
    c.fillRect(0, 0, canvas.width, canvas.height);
    for (const block of blocks) {
      if (block.alive)
        drawSprite(
          c,
          sheet,
          `block_${block.color}`,
          block.x,
          block.y,
          block.w,
          block.h,
        );
    }
    for (const exp of explosions) {
      const frameIndex = Math.min(
        Math.floor((exp.elapsed / EXPLOSION_DURATION) * 4),
        3,
      );
      drawFrame(
        c,
        sheet,
        EXPLOSION_FRAMES[exp.color][frameIndex],
        exp.x,
        exp.y,
        exp.w,
        exp.h,
      );
    }
    drawSprite(c, sheet, "paddle", paddle.x, paddle.y, paddle.w, paddle.h);
    drawSprite(c, sheet, "ball", ball.x, ball.y, ball.w, ball.h);
    if (gameState === "playing") {
      c.fillStyle = "#fff";
      c.font = "bold 18px monospace";
      c.textAlign = "left";
      c.textBaseline = "top";
      c.fillText("Score: " + score, 10, 10);
      c.textAlign = "center";
      c.fillText("Nivel: " + currentLevel, canvas.width / 2, 10);
      const ballSize = 16;
      const ballSpacing = 4;
      for (let i = 0; i < lives; i++) {
        const bx = canvas.width - 10 - (lives - i) * (ballSize + ballSpacing);
        drawSprite(c, sheet, "ball", bx, 10, ballSize, ballSize);
      }
    }
    if (gameState === "gameover") drawOverlay("GAME OVER");
    if (gameState === "win") drawOverlay("¡Completaste el juego!");
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
  // ── Arranque: el bucle empieza cuando el spritesheet está cargado ─────────
  const sheet = new Image();
  sheet.onload = () => {
    if (destroyed) return;
    ready = true;
    notify();
    draw();
    startLoop();
  };
  sheet.onerror = () => {
    if (destroyed) return;
    console.error("No se pudo cargar el spritesheet de Arkanoid.");
  };
  initGame();
  sheet.src = SPRITESHEET_URL;
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
      if (!ready) return;
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
      window.removeEventListener("blur", onBlur);
      canvas.removeEventListener("mousemove", onMouseMove);
      sheet.onload = null;
      sheet.onerror = null;
    },
  };
}
