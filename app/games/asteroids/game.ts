// Motor del juego Asteroids, portado de references/started-games/02-asteroids/game.js.
// Avisa a React de su estado con `onChange`, solo cuando cambia algún valor.
import {
  Asteroid,
  Bullet,
  Particle,
  POINTS,
  POWERUP_DROP_CHANCE,
  POWERUP_DURATION,
  PowerUp,
  Ship,
  dist,
  rand,
  type Teclas,
} from "./entities";
import type {
  EstadoAsteroides,
  JuegoAsteroides,
  SnapshotAsteroides,
} from "./types";
const CONTROL_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Space",
]);
function esCampoEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}
export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  onChange: (snapshot: SnapshotAsteroides) => void,
): JuegoAsteroides {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo obtener el contexto 2D del lienzo.");
  const size = { w: canvas.width, h: canvas.height };
  const { w: W, h: H } = size;
  // ── Entrada ────────────────────────────────────────────────────────────────
  const keys: Teclas = {};
  const justPressed: Teclas = {};
  let paused = false;
  let destroyed = false;
  function pressed(code: string) {
    const val = justPressed[code];
    justPressed[code] = false;
    return !!val;
  }
  function clearInput() {
    for (const code of Object.keys(keys)) keys[code] = false;
    for (const code of Object.keys(justPressed)) justPressed[code] = false;
  }
  function onKeyDown(e: KeyboardEvent) {
    if (paused || esCampoEditable(e.target)) return;
    if (CONTROL_KEYS.has(e.code)) e.preventDefault();
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
  }
  function onKeyUp(e: KeyboardEvent) {
    // Siempre se libera la tecla para que no quede pulsada; solo se bloquea
    // la acción por defecto (p. ej. activar un botón con el foco) al jugar.
    keys[e.code] = false;
    if (!paused && !esCampoEditable(e.target) && CONTROL_KEYS.has(e.code))
      e.preventDefault();
  }
  function onBlur() {
    clearInput();
  }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  // ── Estado del juego ───────────────────────────────────────────────────────
  let ship: Ship;
  let bullets: Bullet[];
  let asteroids: Asteroid[];
  let particles: Particle[];
  let powerUps: PowerUp[];
  let score: number;
  let lives: number;
  let level: number;
  let state: EstadoAsteroides;
  let deadTimer = 0;
  let powerUpSpawned: boolean;
  let killsSinceSpawn: number;
  let last: SnapshotAsteroides | null = null;
  function notify() {
    if (
      last &&
      last.score === score &&
      last.lives === lives &&
      last.level === level &&
      last.status === state
    )
      return;
    last = { score, lives, level, status: state };
    onChange(last);
  }
  function spawnAsteroids(count: number) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number;
      let y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }
  function initGame() {
    ship = new Ship(size);
    bullets = [];
    asteroids = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    score = 0;
    lives = 3;
    level = 1;
    state = "playing";
    spawnAsteroids(4);
  }
  function nextLevel() {
    level++;
    bullets = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    ship.reset(size);
    spawnAsteroids(3 + level);
  }
  function explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  }
  function killShip() {
    explode(ship.x, ship.y, 14);
    ship.dead = true;
    lives--;
    if (lives <= 0) {
      state = "gameover";
    } else {
      state = "dead";
      deadTimer = 2;
    }
  }
  // ── Update ─────────────────────────────────────────────────────────────────
  function update(dt: number) {
    if (state === "gameover") {
      if (pressed("Space")) initGame();
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      return;
    }
    if (state === "dead") {
      deadTimer -= dt;
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      asteroids.forEach((a) => a.update(dt, size));
      if (deadTimer <= 0) {
        state = "playing";
        ship.reset(size);
      }
      return;
    }
    // Disparar
    if (pressed("Space")) {
      bullets.push(...ship.tryShoot());
    }
    ship.update(dt, size, keys);
    bullets.forEach((b) => b.update(dt, size));
    asteroids.forEach((a) => a.update(dt, size));
    particles.forEach((p) => p.update(dt));
    powerUps.forEach((p) => p.update(dt, size));
    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);
    powerUps = powerUps.filter((p) => !p.dead);
    for (const p of powerUps) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        ship.tripleShot = POWERUP_DURATION;
      }
    }
    // Bala vs asteroide
    const newAsteroids: Asteroid[] = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          score += POINTS[a.size];
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          if (!powerUpSpawned) {
            killsSinceSpawn++;
            const guaranteed = killsSinceSpawn >= 5;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              powerUps.push(new PowerUp(a.x, a.y));
              powerUpSpawned = true;
            }
          }
        }
      }
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);
    // Nave vs asteroide
    if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * 0.82) {
          killShip();
          break;
        }
      }
    }
    // Nivel completado
    if (asteroids.length === 0) nextLevel();
  }
  // ── Draw ───────────────────────────────────────────────────────────────────
  function drawLifeIcon(x: number, y: number) {
    ctx!.save();
    ctx!.translate(x, y);
    ctx!.rotate(-Math.PI / 2);
    ctx!.strokeStyle = "#fff";
    ctx!.lineWidth = 1.2;
    ctx!.lineJoin = "round";
    ctx!.beginPath();
    ctx!.moveTo(9, 0);
    ctx!.lineTo(-6, -5);
    ctx!.lineTo(-3, 0);
    ctx!.lineTo(-6, 5);
    ctx!.closePath();
    ctx!.stroke();
    ctx!.restore();
  }
  function drawHUD(c: CanvasRenderingContext2D) {
    c.fillStyle = "#fff";
    c.font = "15px monospace";
    c.textAlign = "left";
    c.fillText(`SCORE  ${score}`, 14, 26);
    c.textAlign = "center";
    c.fillText(`NIVEL ${level}`, W / 2, 26);
    for (let i = 0; i < lives; i++) drawLifeIcon(W - 16 - i * 22, 18);
    if (ship.tripleShot > 0) {
      c.textAlign = "left";
      c.fillStyle = "#0ff";
      c.fillText(`3x  ${ship.tripleShot.toFixed(1)}s`, 14, 46);
    }
  }
  function drawOverlay(
    c: CanvasRenderingContext2D,
    title: string,
    sub: string,
  ) {
    c.textAlign = "center";
    c.fillStyle = "#fff";
    c.font = "bold 46px monospace";
    c.fillText(title, W / 2, H / 2 - 18);
    c.font = "18px monospace";
    c.fillStyle = "rgba(255,255,255,0.65)";
    c.fillText(sub, W / 2, H / 2 + 22);
  }
  function draw() {
    const c = ctx!;
    c.fillStyle = "#000";
    c.fillRect(0, 0, W, H);
    particles.forEach((p) => p.draw(c));
    asteroids.forEach((a) => a.draw(c));
    powerUps.forEach((p) => p.draw(c));
    bullets.forEach((b) => b.draw(c));
    ship.draw(c);
    drawHUD(c);
    if (state === "gameover")
      drawOverlay(
        c,
        "GAME OVER",
        `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`,
      );
  }
  // ── Bucle principal ────────────────────────────────────────────────────────
  let lastTime: number | null = null;
  let rafId: number | null = null;
  function loop(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    draw();
    notify();
    rafId = requestAnimationFrame(loop);
  }
  function stopLoop() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }
  initGame();
  notify();
  draw();
  rafId = requestAnimationFrame(loop);
  return {
    pause() {
      if (destroyed || paused) return;
      paused = true;
      stopLoop();
      clearInput();
    },
    resume() {
      if (destroyed || !paused) return;
      paused = false;
      lastTime = null; // evita un salto de dt tras la pausa
      rafId = requestAnimationFrame(loop);
    },
    restart() {
      if (destroyed) return;
      clearInput();
      initGame();
      notify();
      draw();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    },
  };
}
