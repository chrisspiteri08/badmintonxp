// Pure, deterministic physics. Browser scores remain forgeable; the server checks
// plausibility and caps lifetime XP. It cannot replay player inputs.
export const WORLD = {
  width: 360,
  height: 640,
  floorY: 600,
  racketY: 560,
  apexY: 120,
  radius: 9,
};
export const STEP = 1 / 120;
export const LEVELS = [
  { target: 10, gravity: 640, width: 96, wind: 0, vxMax: 90 },
  { target: 12, gravity: 700, width: 92, wind: 0, vxMax: 100 },
  { target: 15, gravity: 760, width: 88, wind: 0, vxMax: 110 },
  { target: 18, gravity: 820, width: 84, wind: 0, vxMax: 120 },
  { target: 20, gravity: 880, width: 80, wind: 25, vxMax: 130 },
  { target: 22, gravity: 940, width: 76, wind: 45, vxMax: 140 },
  { target: 25, gravity: 1000, width: 72, wind: 65, vxMax: 150 },
  { target: 25, gravity: 1060, width: 70, wind: 85, vxMax: 160 },
  { target: 28, gravity: 1120, width: 68, wind: 105, vxMax: 170 },
  { target: 30, gravity: 1180, width: 66, wind: 125, vxMax: 180 },
  { target: 30, gravity: 1240, width: 64, wind: 145, vxMax: 190 },
  { target: 30, gravity: 1300, width: 62, wind: 165, vxMax: 200 },
] as const;
const configs = Array.from({ length: 99 }, (_, index) =>
  index < 12
    ? LEVELS[index]
    : {
        target: 30,
        gravity: Math.min(1600, 1300 + (index - 11) * 50),
        width: Math.max(56, 62 - (index - 11) * 2),
        wind: Math.min(200, 165 + (index - 11) * 20),
        vxMax: 200,
      },
);
export function levelConfig(level: number) {
  return configs[Math.max(0, Math.min(98, Math.floor(level) - 1))];
}
export function createRng(seed: number) {
  let value = seed | 0;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let x = Math.imul(value ^ (value >>> 15), 1 | value);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
export function hitsRequiredForLevel(level: number) {
  let hits = 0;
  for (let k = 1; k < level; k++) hits += levelConfig(k).target;
  return hits;
}
export function shareText(level: number, hits: number) {
  return `I smashed my way to level ${level} with ${hits} ${hits === 1 ? "hit" : "hits"} on Smash Up 🏸 Can you beat me?`;
}
export type Game = {
  rng: () => number;
  level: number;
  hits: number;
  levelHits: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  racket: number;
  target: number;
  phase: "serve" | "playing" | "slam" | "missed" | "over";
  delay: number;
  elapsed: number;
  gust: number;
  gustFrom: number;
  gustTo: number;
  gustAge: number;
  gustNext: number;
  armed: boolean;
  ready: boolean;
  events: number;
  squash: number;
};
export const HIT = 1,
  SMASH_READY = 2,
  LEVEL_UP = 4,
  MISS = 8,
  SMASH = 16;
export function createGame(seed: number): Game {
  return {
    rng: createRng(seed),
    level: 1,
    hits: 0,
    levelHits: 0,
    x: 180,
    y: 120,
    vx: 0,
    vy: 0,
    racket: 180,
    target: 180,
    phase: "serve",
    delay: 3,
    elapsed: 0,
    gust: 0,
    gustFrom: 0,
    gustTo: 0,
    gustAge: 0,
    gustNext: 1.5,
    armed: false,
    ready: false,
    events: 0,
    squash: 0,
  };
}
export function scoreOf(game: Pick<Game, "hits" | "level">) {
  return game.hits + 10 * (game.level - 1);
}
export function armSmash(game: Game) {
  if (game.ready && game.phase === "playing") game.armed = true;
}
const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
export function step(game: Game, dt: number, input: { target: number }) {
  game.events = 0;
  if (game.phase === "over" || dt <= 0) return;
  const config = levelConfig(game.level);
  game.elapsed += dt;
  game.squash = Math.max(0, game.squash - dt);
  game.target = clamp(input.target, config.width / 2, 360 - config.width / 2);
  const eased = (game.target - game.racket) * (1 - Math.exp(-dt * 22));
  game.racket += clamp(eased, -2200 * dt, 2200 * dt);
  if (
    game.phase === "serve" ||
    game.phase === "slam" ||
    game.phase === "missed"
  ) {
    game.delay -= dt;
    if (game.phase === "slam" && game.delay < 0.25) {
      game.y += game.vy * dt;
      game.x += game.vx * dt;
    }
    if (game.delay > 0) return;
    if (game.phase === "missed") {
      game.phase = "over";
      return;
    }
    if (game.phase === "slam") {
      game.level = Math.min(99, game.level + 1);
      game.levelHits = 0;
      game.ready = false;
      game.armed = false;
      game.phase = "serve";
      game.delay = 1.2;
      game.x = 60 + game.rng() * 240;
      game.y = 120;
      game.vx = 0;
      game.vy = 0;
      game.events = LEVEL_UP;
      return;
    }
    game.phase = "playing";
  }
  if (config.wind) {
    game.gustAge += dt;
    game.gustNext -= dt;
    if (game.gustNext <= 0) {
      game.gustFrom = game.gust;
      game.gustTo = game.rng() * 2 - 1;
      game.gustAge = 0;
      game.gustNext = 1.5 + game.rng() * 1.5;
    }
    const t = Math.min(1, game.gustAge / 0.6);
    game.gust =
      game.gustFrom + (game.gustTo - game.gustFrom) * t * t * (3 - 2 * t);
  } else game.gust = 0;
  const oldX = game.x,
    oldY = game.y;
  game.vx += config.wind * game.gust * dt;
  game.vy += config.gravity * dt;
  game.x += game.vx * dt;
  game.y += game.vy * dt - 0.5 * config.gravity * dt * dt;
  if (game.x < WORLD.radius) {
    game.x = WORLD.radius;
    game.vx = Math.abs(game.vx) * 0.9;
  }
  if (game.x > 360 - WORLD.radius) {
    game.x = 360 - WORLD.radius;
    game.vx = -Math.abs(game.vx) * 0.9;
  }
  if (
    game.vy > 0 &&
    oldY + WORLD.radius <= WORLD.racketY &&
    game.y + WORLD.radius >= WORLD.racketY
  ) {
    const fraction = (WORLD.racketY - WORLD.radius - oldY) / (game.y - oldY);
    const contactX = oldX + (game.x - oldX) * fraction;
    if (Math.abs(contactX - game.racket) <= config.width / 2 + WORLD.radius) {
      const offset = clamp(
        (contactX - game.racket) / (config.width / 2),
        -1,
        1,
      );
      game.hits++;
      game.levelHits++;
      game.squash = 0.06;
      game.y = WORLD.racketY;
      game.events = HIT;
      if (game.armed) {
        game.vy = 900;
        game.vx = offset * 120;
        game.phase = "slam";
        game.delay = 0.34;
        game.events |= SMASH;
      } else {
        game.vy = -Math.sqrt(
          2 * config.gravity * (WORLD.racketY - WORLD.apexY),
        );
        game.vx = offset * config.vxMax + game.rng() * 20 - 10;
        if (!game.ready && game.levelHits >= config.target) {
          game.ready = true;
          game.events |= SMASH_READY;
        }
      }
    }
  }
  if (game.phase === "playing" && game.y >= WORLD.floorY) {
    game.phase = "missed";
    game.delay = 0.4;
    game.events |= MISS;
  }
}
