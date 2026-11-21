import { HIT, SMASH, MISS, levelConfig, type Game } from "./smash-engine";
import {
  headHalfWidth,
  popForHits,
  racketTilt,
  sceneY,
  floorProximity,
  shuttleAngle,
  worldTransform,
} from "./smash-visuals";
const TAU = Math.PI * 2;
export function createSmashRenderer(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  const background = document.createElement("canvas"),
    bg = background.getContext("2d")!;
  const shuttle = document.createElement("canvas");
  shuttle.width = 80;
  shuttle.height = 100;
  const sc = shuttle.getContext("2d")!;
  sc.translate(40, 60);
  sc.scale(1.5, 1.5);
  sc.fillStyle = "#fff";
  sc.beginPath();
  sc.moveTo(-5, -5);
  sc.lineTo(-13, -29);
  for (let i = 0; i < 8; i++)
    sc.quadraticCurveTo(-13 + i * 3.25, -34, -9.75 + i * 3.25, -29);
  sc.lineTo(5, -5);
  sc.closePath();
  sc.fill();
  sc.strokeStyle = "#9db5c9";
  sc.lineWidth = 0.6;
  for (let i = 0; i < 8; i++) {
    sc.beginPath();
    sc.moveTo(-12 + i * 3.4, -28);
    sc.lineTo(-4 + i * 1.15, -5);
    sc.stroke();
  }
  sc.fillStyle = "#d9e6ee";
  sc.fillRect(-6, -7, 12, 3);
  const cork = sc.createRadialGradient(-3, -2, 1, 0, 0, 9);
  cork.addColorStop(0, "#fff");
  cork.addColorStop(0.65, "#ffbc8a");
  cork.addColorStop(1, "#ff894c");
  sc.fillStyle = cork;
  sc.beginPath();
  sc.arc(0, 0, 9, 0, TAU);
  sc.fill();
  const headCache = new Map<number, HTMLCanvasElement>();
  const halo = document.createElement("canvas"),
    shadow = document.createElement("canvas");
  halo.width = halo.height = 80;
  shadow.width = 80;
  shadow.height = 32;
  const hc = halo.getContext("2d")!,
    sh = shadow.getContext("2d")!;
  const light = hc.createRadialGradient(40, 40, 4, 40, 40, 40);
  light.addColorStop(0, "#fff8");
  light.addColorStop(0.35, "#ffb27835");
  light.addColorStop(1, "#ff894c00");
  hc.fillStyle = light;
  hc.fillRect(0, 0, 80, 80);
  sh.translate(40, 16);
  sh.scale(1, 0.4);
  const shade = sh.createRadialGradient(0, 0, 1, 0, 0, 38);
  shade.addColorStop(0, "#020d26a0");
  shade.addColorStop(1, "#020d2600");
  sh.fillStyle = shade;
  sh.fillRect(-40, -40, 80, 80);
  const heads = Array.from({ length: 99 }, (_, i) => {
    const width = levelConfig(i + 1).width,
      rx = headHalfWidth(width),
      ry = rx * 0.42;
    const cached = headCache.get(width);
    if (cached) return cached;
    const sprite = document.createElement("canvas");
    sprite.width = 220;
    sprite.height = 100;
    const c = sprite.getContext("2d")!;
    c.translate(110, 50);
    c.scale(2, 2);
    c.fillStyle = "#09243c";
    c.beginPath();
    c.ellipse(0, 0, rx - 2, ry - 2, 0, 0, TAU);
    c.fill();
    c.save();
    c.clip();
    c.strokeStyle = "#ffffff8c";
    c.lineWidth = 0.55;
    for (let k = -3; k <= 3; k++) {
      c.beginPath();
      c.moveTo((k * rx) / 4, -ry);
      c.lineTo((k * rx) / 4, ry);
      c.stroke();
    }
    for (let k = -4; k <= 4; k++) {
      c.beginPath();
      c.moveTo(-rx, (k * ry) / 5);
      c.lineTo(rx, (k * ry) / 5);
      c.stroke();
    }
    c.restore();
    c.strokeStyle = "#ec3543";
    c.lineWidth = 4;
    c.beginPath();
    c.ellipse(0, 0, rx - 2, ry - 2, 0, 0, TAU);
    c.stroke();
    c.strokeStyle = "#fff";
    c.lineWidth = 0.8;
    c.beginPath();
    c.ellipse(0, 0, rx - 4.5, ry - 4.5, 0, 0, TAU);
    c.stroke();
    headCache.set(width, sprite);
    return sprite;
  });
  const particles = Array.from({ length: 40 }, () => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    max: 1,
    white: false,
  }));
  const trailAngles = new Float32Array(6);
  const trailX = new Float32Array(6),
    trailY = new Float32Array(6);
  const streaks = Array.from({ length: 8 }, (_, i) => ({
    x: i * 47,
    y: 180 + i * 42,
  }));
  const transform = { scale: 1, x: 0, y: 0 };
  let width = 0,
    height = 0,
    ratio = 0,
    trailIndex = 0,
    trailCount = 0,
    trailAge = 0;
  let dropAge = 9,
    dropX = 180;
  let hitX = 180;
  let hitAge = 9,
    smashAge = 9,
    popAge = 9,
    pop = "",
    popX = 180,
    tilt = 0,
    angle = 0,
    oldRacket = 180,
    velocity = 0,
    spin = 0;
  function resize() {
    const nextRatio = Math.min(2, devicePixelRatio || 1),
      w = Math.round(canvas.clientWidth * nextRatio),
      h = Math.round(canvas.clientHeight * nextRatio);
    if (w === width && h === height && ratio === nextRatio) return;
    width = w;
    height = h;
    ratio = nextRatio;
    canvas.width = w;
    canvas.height = h;
    background.width = w;
    background.height = h;
    worldTransform(w, h, transform, ratio);
    const gradient = bg.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, "#081b34");
    gradient.addColorStop(1, "#0d2747");
    bg.fillStyle = gradient;
    bg.fillRect(0, 0, w, h);
    for (let side = 0; side < 2; side++) {
      const glow = bg.createRadialGradient(
        side * w,
        h,
        0,
        side * w,
        h,
        w * 0.8,
      );
      glow.addColorStop(0, side ? "#ff894c25" : "#ec35432b");
      glow.addColorStop(1, "#081b3400");
      bg.fillStyle = glow;
      bg.fillRect(0, 0, w, h);
    }
    for (let k = 0; k < 5; k++) {
      const x = (w * (k + 1)) / 6;
      const flare = bg.createRadialGradient(
        x,
        h * 0.05,
        0,
        x,
        h * 0.05,
        w * 0.13,
      );
      flare.addColorStop(0, "#ffffff2d");
      flare.addColorStop(1, "#ffffff00");
      bg.fillStyle = flare;
      bg.fillRect(0, 0, w, h);
    }
    bg.save();
    bg.setTransform(
      transform.scale,
      0,
      0,
      transform.scale,
      transform.x,
      transform.y,
    );
    // Flat practice-wall panels, no court markings or perspective.
    bg.strokeStyle = "#93b2cd10";
    bg.lineWidth = 1;
    for (
      let y = Math.floor(-transform.y / transform.scale / 68) * 68;
      y < 600;
      y += 68
    ) {
      bg.beginPath();
      bg.moveTo(-1000, y);
      bg.lineTo(1360, y);
      bg.stroke();
      const offset = (Math.floor(y / 68) % 2) * 75;
      for (let x = -1000 + offset; x < 1360; x += 150) {
        bg.beginPath();
        bg.moveTo(x, y);
        bg.lineTo(x, y + 68);
        bg.stroke();
      }
    }
    bg.textAlign = "center";
    bg.fillStyle = "#d5e6f117";
    bg.font = "italic 900 40px sans-serif";
    bg.fillText("SMASH UP", 180, 280);
    bg.font = "700 11px sans-serif";
    bg.fillStyle = "#b4cee41c";
    bg.fillText("SOLO PRACTICE", 180, 305);
    const floor = bg.createLinearGradient(0, 600, 0, 628);
    floor.addColorStop(0, "#19384b");
    floor.addColorStop(1, "#071522");
    bg.fillStyle = floor;
    bg.fillRect(-1000, 600, 2360, 1000);
    bg.fillStyle = "#ff894c";
    bg.fillRect(-1000, 598, 2360, 3);
    bg.fillStyle = "#ec3543";
    for (let x = -1000; x < 1360; x += 48) {
      bg.beginPath();
      bg.moveTo(x, 604);
      bg.lineTo(x + 20, 604);
      bg.lineTo(x + 12, 614);
      bg.lineTo(x - 8, 614);
      bg.closePath();
      bg.fill();
    }
    bg.restore();
  }
  function emit(x: number, y: number, count: number) {
    let n = 0;
    for (const p of particles)
      if (p.life <= 0 && n < count) {
        p.x = x;
        p.y = y;
        p.vx = Math.cos(n * 2.4) * (80 + n * 4);
        p.vy = -60 - Math.sin(n * 1.6) * 100;
        p.life = p.max = 0.4 + n * 0.008;
        p.white = n % 2 === 0;
        n++;
      }
  }
  function event(g: Game, reduced: boolean) {
    if (g.events & HIT) {
      hitAge = 0;
      hitX = g.x;
      tilt = racketTilt((g.x - g.racket) / (levelConfig(g.level).width / 2));
      spin = 0.4;
      pop = popForHits(g.hits);
      if (pop) {
        popAge = 0;
        popX = g.racket;
      }
      if (!reduced) emit(g.x, 550, g.events & SMASH ? 18 : 10);
    }
    if (g.events & SMASH) smashAge = 0;
    if (g.events & MISS) {
      dropAge = 0;
      dropX = g.x;
      if (!reduced) emit(g.x, 600, 10);
    }
  }
  function reset() {
    trailCount = 0;
    trailAge = 0;
    hitAge = smashAge = popAge = 9;
    dropAge = 9;
    oldRacket = 180;
    tilt = velocity = angle = spin = 0;
  }
  let previousGame: Game | null = null;
  function draw(g: Game | null, dt: number, reduced: boolean) {
    if (g !== previousGame) {
      reset();
      previousGame = g;
    }
    resize();
    dropAge += dt;
    hitAge += dt;
    smashAge += dt;
    popAge += dt;
    spin = Math.max(0, spin - dt);
    tilt *= Math.exp(-dt * 9);
    const x = g?.x ?? 180,
      y = g?.y ?? 190,
      racket = g?.racket ?? 180,
      config = levelConfig(g?.level ?? 1);
    velocity = (racket - oldRacket) / Math.max(dt, 0.001);
    oldRacket = racket;
    let targetAngle =
      g && g.phase !== "serve" ? shuttleAngle(g.vx, g.vy) : 0.25;
    let delta = targetAngle - angle;
    while (delta > Math.PI) delta -= TAU;
    while (delta < -Math.PI) delta += TAU;
    angle += delta * (1 - Math.exp(-dt * 20));
    if (!reduced && g) {
      trailAge += dt;
      if (trailAge > 0.015) {
        trailAge = 0;
        trailX[trailIndex] = x;
        trailY[trailIndex] = y;
        trailAngles[trailIndex] = angle;
        trailIndex = (trailIndex + 1) % 6;
        trailCount = Math.min(6, trailCount + 1);
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const strength = reduced ? 0 : smashAge < 0.18 ? 6 : hitAge < 0.08 ? 2 : 0;
    const shakeX = Math.sin(hitAge * 170) * strength,
      shakeY = Math.cos(hitAge * 140) * strength;
    ctx.drawImage(background, 0, 0);
    if (strength)
      ctx.drawImage(
        background,
        shakeX * transform.scale,
        shakeY * transform.scale,
      );
    ctx.save();
    ctx.setTransform(
      transform.scale,
      0,
      0,
      transform.scale,
      transform.x,
      transform.y,
    );
    if (!reduced) {
      ctx.translate(shakeX, shakeY);
    }
    if (g && g.level >= 5 && !reduced) {
      ctx.strokeStyle = "#d3eaff30";
      ctx.lineWidth = 1;
      for (const s of streaks) {
        s.x += g.gust * 100 * dt;
        if (s.x < 0) s.x = 360;
        if (s.x > 360) s.x = 0;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + g.gust * 28, s.y);
        ctx.stroke();
      }
    }
    if (!reduced)
      for (let i = 0; i < trailCount; i++) {
        const k = (trailIndex - 1 - i + 6) % 6;
        ctx.globalAlpha = (1 - i / 6) * 0.14;
        ctx.save();
        ctx.translate(trailX[k], sceneY(trailY[k]));
        ctx.rotate(trailAngles[k]);
        ctx.drawImage(shuttle, -26.666, -40, 53.333, 66.666);
        ctx.restore();
      }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(racket, sceneY(558));
    ctx.rotate(
      tilt + (Math.max(-1, Math.min(1, velocity / 2200)) * Math.PI) / 30,
    );
    ctx.translate(0, 37);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(0, -22);
    ctx.moveTo(0, -22);
    ctx.lineTo(-8, -31);
    ctx.moveTo(0, -22);
    ctx.lineTo(8, -31);
    ctx.stroke();
    ctx.fillStyle = "#ec3543";
    ctx.fillRect(-3, -12, 6, 14);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    for (let i = -10; i < 2; i += 4) {
      ctx.beginPath();
      ctx.moveTo(-3, i);
      ctx.lineTo(3, i + 3);
      ctx.stroke();
    }
    ctx.fillStyle = "#ff894c";
    ctx.fillRect(-4, 1, 8, 3);
    const flick = Math.sin(Math.min(1, hitAge / 0.12) * Math.PI);
    ctx.translate(0, -37 - flick * 6);
    ctx.scale(1, 1 - flick * 0.15);
    ctx.drawImage(heads[Math.min(98, (g?.level ?? 1) - 1)], -55, -25, 110, 50);
    if (reduced && hitAge < 0.12) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(
        0,
        0,
        headHalfWidth(config.width) - 2,
        config.width * 0.21 - 2,
        0,
        0,
        TAU,
      );
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    const nearFloor = floorProximity(y),
      shadowWidth = 20 + nearFloor * 40;
    ctx.globalAlpha = 0.25 + nearFloor * 0.45;
    ctx.drawImage(
      shadow,
      x - shadowWidth / 2,
      603,
      shadowWidth,
      6 + nearFloor * 8,
    );
    ctx.globalAlpha = 1;
    ctx.translate(x, sceneY(y));
    ctx.drawImage(halo, -28, -28, 56, 56);
    ctx.rotate(angle);
    ctx.drawImage(shuttle, -26.666, -40, 53.333, 66.666); // cork centre is the simulation position
    if (spin > 0 && !reduced) {
      ctx.strokeStyle = "#ffffff80";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(Math.sin(spin * 55) * 8, -20);
      ctx.lineTo(0, -6);
      ctx.stroke();
    }
    ctx.restore();
    if (!reduced) {
      for (const p of particles)
        if (p.life > 0) {
          p.life -= dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 260 * dt;
          ctx.globalAlpha = Math.max(0, p.life / p.max);
          ctx.fillStyle = p.white ? "#fff" : "#ff894c";
          ctx.save();
          ctx.translate(p.x, sceneY(p.y));
          ctx.rotate(p.life * 8);
          ctx.fillRect(-1, -4, 2, 8);
          ctx.restore();
        }
      ctx.globalAlpha = 1;
      if (hitAge < 0.07) {
        ctx.fillStyle = "#ffffff80";
        ctx.beginPath();
        ctx.arc(hitX, sceneY(550), 22 * (hitAge / 0.07), 0, TAU);
        ctx.fill();
      }
      if (smashAge < 0.09) {
        ctx.fillStyle = "#ffffff44";
        ctx.fillRect(0, 96, 360, 504);
      }
    }
    if (pop && popAge < 0.6) {
      ctx.save();
      ctx.globalAlpha = 1 - Math.pow(popAge / 0.6, 2);
      ctx.translate(popX, sceneY(520) - (reduced ? 0 : popAge * 50));
      if (!reduced) {
        const scale = 0.75 + 0.25 * Math.min(1, popAge / 0.1);
        ctx.scale(scale, scale);
      }
      ctx.font = "900 36px sans-serif";
      ctx.textAlign = "center";
      ctx.lineJoin = "round";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#f28c28";
      ctx.strokeText(pop, 0, 0);
      ctx.fillStyle = "#fff";
      ctx.fillText(pop, 0, 0);
      ctx.restore();
    }
    if (dropAge < 0.4) {
      ctx.save();
      ctx.globalAlpha = reduced ? 1 : 1 - dropAge / 0.4;
      ctx.fillStyle = "#ff4355";
      ctx.fillRect(-1000, 595, 2360, 7);
      ctx.restore();
      ctx.save();
      ctx.font = "900 30px sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 5;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#9b253d";
      ctx.fillStyle = "#fff";
      const labelX = Math.max(78, Math.min(282, dropX));
      ctx.strokeText("Dropped!", labelX, 543);
      ctx.fillText("Dropped!", labelX, 543);
      ctx.restore();
    }
    if (g?.phase === "slam") {
      ctx.save();
      ctx.translate(180, 300);
      if (!reduced) {
        const t = Math.min(1, smashAge / 0.25);
        const scale = t < 0.5 ? 0.6 + t * 1.1 : 1.3 - t * 0.3;
        ctx.scale(scale, scale);
        ctx.strokeStyle = "#ff894c88";
        ctx.lineWidth = 3;
        for (let i = 0; i < 16; i++) {
          const a = (i * TAU) / 16;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 90, Math.sin(a) * 65);
          ctx.lineTo(Math.cos(a) * 160, Math.sin(a) * 120);
          ctx.stroke();
        }
      }
      ctx.font = "italic 900 48px sans-serif";
      ctx.textAlign = "center";
      ctx.lineJoin = "round";
      ctx.lineWidth = 10;
      ctx.strokeStyle = "#ec3543";
      ctx.strokeText("SMASH!", 0, 0);
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#ff894c";
      ctx.strokeText("SMASH!", 0, 0);
      ctx.fillStyle = "#fff";
      ctx.fillText("SMASH!", 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }
  return { draw, event, reset };
}
