// Motor de Asteroides: estado, input, loop, colisiones y dibujo.
// Todo el estado vive en el closure de createAsteroids; nada toca window/document al importar.
import type { GameEngine, GameEngineFactory, GameEvents, HudState } from "../types";
import {
  Asteroid,
  Bullet,
  COLORS,
  H,
  POINTS,
  POWERUP_DROP_CHANCE,
  POWERUP_DURATION,
  POWERUP_GUARANTEED_KILLS,
  Particle,
  PowerUp,
  Ship,
  W,
  dist,
  rand,
} from "./entities";
type PlayState = "playing" | "dead" | "gameover";
/** Teclas de juego que no deben hacer scroll mientras la partida está activa. */
const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"]);
const PAUSE_KEYS = new Set(["KeyP", "Escape"]);
const START_LIVES = 3;
const START_ASTEROIDS = 4;
const RESPAWN_DELAY = 2;
const SAFE_DIST = 130;
const MAX_DT = 0.05;
/** El usuario está escribiendo en un campo: el juego no debe leer esa tecla. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA";
}
export const createAsteroids: GameEngineFactory = (
  canvas: HTMLCanvasElement,
  events: GameEvents,
): GameEngine => {
  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) throw new Error("Canvas 2D no disponible");
  const ctx: CanvasRenderingContext2D = maybeCtx;
  // ── Estado ────────────────────────────────────────────────────────────────
  let ship = new Ship();
  let bullets: Bullet[] = [];
  let asteroids: Asteroid[] = [];
  let particles: Particle[] = [];
  let powerUps: PowerUp[] = [];
  let score = 0;
  let lives = START_LIVES;
  let level = 1;
  let state: PlayState = "playing";
  let deadTimer = 0;
  let powerUpSpawned = false;
  let killsSinceSpawn = 0;
  let paused = false;
  let gameOverEmitted = false;
  let lastHud: HudState | null = null;
  let lastTime: number | null = null;
  let rafId = 0;
  let destroyed = false;
  const keys: Record<string, boolean> = {};
  const justPressed: Record<string, boolean> = {};
  function pressed(code: string): boolean {
    const val = !!justPressed[code];
    justPressed[code] = false;
    return val;
  }
  function clearInput() {
    for (const k of Object.keys(keys)) keys[k] = false;
    for (const k of Object.keys(justPressed)) justPressed[k] = false;
  }
  // ── Notificaciones a React ────────────────────────────────────────────────
  function emitHud(force = false) {
    const hud: HudState = {
      score,
      lives,
      level,
      // Hacia arriba: arranca en 5.0 y solo llega a 0 cuando termina de verdad.
      tripleShot: Math.ceil(ship.tripleShot * 10) / 10,
    };
    if (
      !force &&
      lastHud &&
      lastHud.score === hud.score &&
      lastHud.lives === hud.lives &&
      lastHud.level === hud.level &&
      lastHud.tripleShot === hud.tripleShot
    )
      return;
    lastHud = hud;
    events.onHud(hud);
  }
  function setPaused(value: boolean) {
    if (paused === value) return;
    paused = value;
    if (paused) clearInput();
    else lastTime = null; // sin salto de dt al reanudar
    events.onPause(paused);
  }
  function gameOver() {
    state = "gameover";
    setPaused(false);
    clearInput();
    if (gameOverEmitted) return;
    gameOverEmitted = true;
    emitHud();
    events.onGameOver(score);
  }
  // ── Partida ───────────────────────────────────────────────────────────────
  function spawnAsteroids(count: number) {
    for (let i = 0; i < count; i++) {
      let x: number, y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }
  function initGame() {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    score = 0;
    lives = START_LIVES;
    level = 1;
    state = "playing";
    gameOverEmitted = false;
    clearInput();
    spawnAsteroids(START_ASTEROIDS);
    emitHud(true);
  }
  function nextLevel() {
    level++;
    bullets = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    ship.reset();
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
      gameOver();
    } else {
      state = "dead";
      deadTimer = RESPAWN_DELAY;
    }
  }
  // ── Update ────────────────────────────────────────────────────────────────
  function updateParticles(dt: number) {
    particles.forEach((p) => p.update(dt));
    particles = particles.filter((p) => !p.dead);
  }
  function update(dt: number) {
    if (state === "gameover") {
      updateParticles(dt);
      asteroids.forEach((a) => a.update(dt));
      return;
    }
    if (state === "dead") {
      deadTimer -= dt;
      updateParticles(dt);
      asteroids.forEach((a) => a.update(dt));
      if (deadTimer <= 0) {
        state = "playing";
        ship.reset();
      }
      return;
    }
    // Disparar
    if (pressed("Space")) bullets.push(...ship.tryShoot());
    ship.update(dt, {
      left: !!keys["ArrowLeft"],
      right: !!keys["ArrowRight"],
      thrust: !!keys["ArrowUp"],
    });
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    powerUps.forEach((p) => p.update(dt));
    updateParticles(dt);
    bullets = bullets.filter((b) => !b.dead);
    powerUps = powerUps.filter((p) => !p.dead);
    // Nave vs power-up
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
            const guaranteed = killsSinceSpawn >= POWERUP_GUARANTEED_KILLS;
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
    if (state === "playing" && asteroids.length === 0) nextLevel();
  }
  // ── Draw (sin HUD: lo pinta React) ────────────────────────────────────────
  function draw() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    particles.forEach((p) => p.draw(ctx));
    asteroids.forEach((a) => a.draw(ctx));
    powerUps.forEach((p) => p.draw(ctx));
    bullets.forEach((b) => b.draw(ctx));
    ship.draw(ctx);
  }
  // ── Loop ──────────────────────────────────────────────────────────────────
  function loop(ts: number) {
    if (destroyed) return;
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, MAX_DT);
    lastTime = ts;
    if (!paused) {
      update(dt);
      emitHud();
    }
    draw();
    rafId = requestAnimationFrame(loop);
  }
  // ── Input ─────────────────────────────────────────────────────────────────
  function onKeyDown(e: KeyboardEvent) {
    if (isTypingTarget(e.target)) return;
    if (PAUSE_KEYS.has(e.code)) {
      if (state === "gameover") return;
      e.preventDefault();
      if (!e.repeat) setPaused(!paused);
      return;
    }
    if (paused || state === "gameover") return;
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
  }
  function onKeyUp(e: KeyboardEvent) {
    keys[e.code] = false;
  }
  function onVisibilityChange() {
    if (document.hidden && state !== "gameover") setPaused(true);
  }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  document.addEventListener("visibilitychange", onVisibilityChange);
  initGame();
  rafId = requestAnimationFrame(loop);
  // ── API pública ───────────────────────────────────────────────────────────
  return {
    pause() {
      if (state !== "gameover") setPaused(true);
    },
    resume() {
      setPaused(false);
    },
    end() {
      if (state !== "gameover") gameOver();
    },
    restart() {
      setPaused(false);
      initGame();
      lastTime = null;
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    },
  };
};
