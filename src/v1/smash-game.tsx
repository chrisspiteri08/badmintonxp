"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GameButton } from "./game-button";
import {
  armSmash,
  createGame,
  HIT,
  levelConfig,
  MISS,
  scoreOf,
  shareText,
  SMASH,
  STEP,
  step,
  type Game,
} from "./smash-engine";
import {
  call,
  type Board,
  type CountryRow,
  type Finish,
  type GameStatus,
} from "./smash-api";
import "./smash.css";
const url = "https://badmintonxp.com/play/smash-up";
const empty = {
  level: 1,
  hits: 0,
  levelHits: 0,
  score: 0,
  ready: false,
  armed: false,
  countdown: 0,
  wind: 0,
};
export default function SmashGame({
  client,
  userId,
  feedback,
  onBank,
}: {
  onBank: () => void;
  client: SupabaseClient | null;
  userId: string | null;
  feedback: (cue: "hit" | "smash" | "miss") => void;
}) {
  const feedbackRef = useRef(feedback);
  feedbackRef.current = feedback;
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<Game | null>(null);
  const run = useRef<{ id: string; started: number } | null>(null);
  const active = useRef(false),
    paused = useRef(false),
    resumeAt = useRef(0),
    target = useRef(180),
    keys = useRef(0);
  const [phase, setPhase] = useState<"ready" | "playing" | "over">("ready");
  const [isPaused, setPaused] = useState(false),
    [starting, setStarting] = useState(false);
  const [hud, setHud] = useState(empty),
    [best, setBest] = useState(0),
    [newBest, setNewBest] = useState(false);
  const [bestLevel, setBestLevel] = useState(1);
  const [status, setStatus] = useState<GameStatus | null>(null),
    [xp, setXP] = useState("");
  const [scope, setScope] = useState("today"),
    [board, setBoard] = useState<Board | null>(null),
    [countries, setCountries] = useState<CountryRow[] | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishRef = useRef<() => void>(() => {});
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("badmintonxp-smash-best") || "0",
      );
      setBest(typeof saved === "number" ? saved : Number(saved.score) || 0);
      setBestLevel(Number(saved.level) || 1);
    } catch {}
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);
  useEffect(() => {
    let live = true;
    if (userId)
      void call<GameStatus>(client, "v1_game_status").then((v) => {
        if (live) setStatus(v);
      });
    else setStatus(null);
    return () => {
      live = false;
    };
  }, [client, userId]);
  useEffect(() => {
    let live = true;
    setBoard(null);
    setCountries(null);
    if (scope === "countries")
      void call<CountryRow[]>(client, "v1_smash_country_board").then((v) => {
        if (live) setCountries(v);
      });
    else
      void call<Board>(client, "v1_smash_leaderboard", { p_scope: scope }).then(
        (v) => {
          if (live) setBoard(v);
        },
      );
    return () => {
      live = false;
    };
  }, [client, scope, phase]);
  finishRef.current = () => {
    const g = game.current!;
    active.current = false;
    setPhase("over");
    const score = scoreOf(g);
    setNewBest(score > best);
    setBest(Math.max(score, best));
    if (score > best) setBestLevel(g.level);
    setHud({
      level: g.level,
      hits: g.hits,
      levelHits: g.levelHits,
      score,
      ready: g.ready,
      armed: g.armed,
      countdown: 0,
      wind: g.gust,
    });
    try {
      localStorage.setItem(
        "badmintonxp-smash-best",
        JSON.stringify({
          score: Math.max(score, best),
          level: score > best ? g.level : bestLevel,
        }),
      );
    } catch {}
    const started = run.current;
    if (client && userId && started) {
      const args = {
        p_run_id: started.id,
        p_level: g.level,
        p_hits: g.hits,
        p_duration_ms: Math.round(performance.now() - started.started),
      };
      setXP("Saving XP…");
      void (async () => {
        let result = await call<Finish>(client, "v1_game_finish", args);
        if (!result)
          result = await call<Finish>(client, "v1_game_finish", args);
        setXP(
          result?.accepted
            ? `+${result.xp_added} XP · ${result.xp_today}/20 XP this window`
            : "Couldn't bank XP this time",
        );
        if (result?.accepted) {
          setStatus(result);
          onBank();
        }
        // Refresh public boards after the stored result, without uploading local best.
        if (scope === "countries")
          setCountries(
            await call<CountryRow[]>(client, "v1_smash_country_board"),
          );
        else
          setBoard(
            await call<Board>(client, "v1_smash_leaderboard", {
              p_scope: scope,
            }),
          );
      })();
    }
  };
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const ctx = node.getContext("2d");
    if (!ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const particles = Array.from({ length: 40 }, () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
    }));
    const burst = (x: number, y: number) => {
      if (reduced.matches) return;
      let count = 0;
      for (const particle of particles)
        if (particle.life <= 0 && count < 8) {
          particle.x = x;
          particle.y = y;
          particle.vx = Math.cos(count * 0.8) * 85;
          particle.vy = Math.sin(count * 0.8) * 85;
          particle.life = 0.3;
          count++;
        }
    };
    const input = { target: 180 };
    const dash = [4, 5],
      noDash: number[] = [];
    let renderWidth = 1,
      renderHeight = 1;
    const resize = () => {
      const ratio = Math.min(2, devicePixelRatio || 1);
      renderWidth = Math.round(node.clientWidth * ratio);
      renderHeight = Math.round(node.clientHeight * ratio);
      node.width = renderWidth;
      node.height = renderHeight;
    };
    const sizing = new ResizeObserver(resize);
    sizing.observe(node);
    resize();
    let frame = 0,
      last = 0,
      accumulator = 0,
      lastHud = 0;
    const pause = () => {
      if (active.current) {
        paused.current = true;
        keys.current = 0;
        setPaused(true);
      }
    };
    const hidden = () => {
      if (document.hidden) pause();
    };
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) pause();
    });
    observer.observe(node);
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("blur", pause);
    window.addEventListener("pagehide", pause);
    const down = (e: KeyboardEvent) => {
      if (
        !active.current ||
        (e.target instanceof HTMLElement &&
          /INPUT|TEXTAREA/.test(e.target.tagName))
      )
        return;
      if (["ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a")
        keys.current = -1;
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "d")
        keys.current = 1;
      if (e.key === " " || e.key === "Enter") {
        if (game.current) armSmash(game.current);
      }
      if (e.key.toLowerCase() === "p") pause();
    };
    const up = () => {
      keys.current = 0;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    const draw = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const g = game.current;
      if (g && active.current && !paused.current && now >= resumeAt.current) {
        accumulator += dt;
        while (accumulator >= STEP) {
          target.current = Math.max(
            0,
            Math.min(360, target.current + keys.current * 700 * STEP),
          );
          input.target = target.current;
          step(g, STEP, input);
          accumulator -= STEP;
          if (g.events & HIT) {
            feedbackRef.current(g.events & SMASH ? "smash" : "hit");
            burst(g.x, 550);
          }
          if (g.events & MISS) {
            feedbackRef.current("miss");
            burst(g.x, 600);
          }
          if (g.phase === "over") {
            finishRef.current();
            break;
          }
        }
      } else accumulator = 0;
      if (g && active.current && now - lastHud > 80) {
        lastHud = now;
        setHud({
          level: g.level,
          hits: g.hits,
          levelHits: g.levelHits,
          score: scoreOf(g),
          ready: g.ready,
          armed: g.armed,
          countdown:
            g.phase === "serve"
              ? Math.ceil(g.delay)
              : now < resumeAt.current
                ? 1
                : 0,
          wind: g.gust,
        });
      }
      const width = renderWidth,
        height = renderHeight;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#081b34";
      ctx.fillRect(0, 0, width, height);
      const scale = Math.min(width / 360, height / 640);
      ctx.setTransform(
        scale,
        0,
        0,
        scale,
        (width - 360 * scale) / 2,
        (height - 640 * scale) / 2,
      );
      if (g?.phase === "slam" && g.delay > 0.25 && !reduced.matches)
        ctx.translate(Math.sin(now) * 2, Math.cos(now) * 2);
      ctx.fillStyle = "#112a49";
      ctx.fillRect(18, 90, 324, 510);
      ctx.strokeStyle = "#8295aa";
      ctx.lineWidth = 1;
      ctx.strokeRect(25, 100, 310, 500);
      ctx.beginPath();
      ctx.moveTo(25, 350);
      ctx.lineTo(335, 350);
      ctx.moveTo(180, 100);
      ctx.lineTo(180, 600);
      ctx.stroke();
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(0, 320);
      ctx.lineTo(360, 320);
      ctx.stroke();
      ctx.setLineDash(noDash);
      if (g?.phase === "slam" && g.delay > 0.25 && !reduced.matches) {
        ctx.fillStyle = "#fff3";
        ctx.fillRect(0, 0, 360, 640);
      }
      const x = g?.x ?? 180,
        y = g?.y ?? 120,
        racket = g?.racket ?? 180,
        config = levelConfig(g?.level ?? 1);
      ctx.fillStyle = "#fff";
      ctx.fillRect(racket - 4, 568, 8, 30);
      ctx.fillStyle = "#ec3543";
      ctx.beginPath();
      ctx.ellipse(
        racket,
        560,
        config.width / 2,
        g?.squash ? 5 : 9,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((g?.vx ?? 0) * 0.003);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(-9, -18);
      ctx.lineTo(9, -18);
      ctx.lineTo(5, 1);
      ctx.lineTo(-5, 1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ff894c";
      ctx.beginPath();
      ctx.arc(0, 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (!reduced.matches)
        for (const p of particles)
          if (p.life > 0) {
            p.life -= dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            ctx.fillStyle = "#ffb278";
            ctx.fillRect(p.x, p.y, 3, 3);
          }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      active.current = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      sizing.disconnect();
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("blur", pause);
      window.removeEventListener("pagehide", pause);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);
  async function start() {
    if (starting) return;
    setStarting(true);
    setXP("");
    const started = performance.now();
    const result = userId
      ? await call<{ run_id: string; seed: number }>(client, "v1_game_start")
      : null;
    run.current = result ? { id: result.run_id, started } : null;
    game.current = createGame(
      result?.seed ?? crypto.getRandomValues(new Uint32Array(1))[0],
    );
    target.current = 180;
    paused.current = false;
    resumeAt.current = 0;
    active.current = true;
    setPaused(false);
    setHud(empty);
    setPhase("playing");
    setStarting(false);
  }
  async function share() {
    const text = shareText(hud.level, hud.hits);
    if (navigator.share)
      try {
        await navigator.share({ title: "Smash Up", text, url });
        return;
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
      }
    try {
      if (!navigator.clipboard?.writeText) throw Error();
      await navigator.clipboard.writeText(`${text} ${url}`);
    } catch {
      const area = document.createElement("textarea");
      area.value = `${text} ${url}`;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.append(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      if (!ok) return;
    }
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  }
  const guest = (
    <div className="smash-guest">
      <p>Create a free account to get on the Smash Up leaderboard</p>
      <Link className="game-button" href="/play/account?mode=signup">
        Create account
      </Link>
      <Link href="/play/account">Already a fan? Sign in</Link>
    </div>
  );
  return (
    <section className="smash-game" aria-label="Smash Up">
      <div className="smash-court">
        <canvas
          ref={canvas}
          role="img"
          aria-label={`Smash Up court. Level ${hud.level}, ${hud.hits} hits. Drag to move your racket.`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            e.currentTarget.dataset.dragX = String(e.clientX);
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              const previous = Number(e.currentTarget.dataset.dragX);
              const scale = Math.min(
                e.currentTarget.clientWidth / 360,
                e.currentTarget.clientHeight / 640,
              );
              target.current = Math.max(
                0,
                Math.min(360, target.current + (e.clientX - previous) / scale),
              );
              e.currentTarget.dataset.dragX = String(e.clientX);
            }
          }}
        />
        {phase === "playing" && (
          <>
            <div className="smash-hud">
              <strong>Level {hud.level}</strong>
              <span>
                {hud.levelHits} / {levelConfig(hud.level).target} hits
              </span>
              <span>Score {hud.score}</span>
              {hud.level >= 5 && (
                <span aria-label="Wind">
                  Wind{" "}
                  <span
                    style={{
                      display: "inline-block",
                      transform: `scaleX(${0.3 + Math.abs(hud.wind) * 1.7})`,
                    }}
                  >
                    {hud.wind < 0 ? "←" : "→"}
                  </span>{" "}
                  {Math.round(Math.abs(hud.wind) * 100)}%
                </span>
              )}
            </div>
            <GameButton
              tone="primary"
              className="smash-action"
              data-ready={hud.ready && !hud.armed}
              disabled={!hud.ready || isPaused}
              onClick={() => {
                if (game.current) armSmash(game.current);
              }}
            >
              {hud.armed ? "ARMED" : "SMASH"}
            </GameButton>
            <span className="sr-only" aria-live="polite">
              {hud.ready ? "Smash ready" : ""}
            </span>
            {hud.countdown > 0 && !isPaused && (
              <strong className="smash-countdown">{hud.countdown}</strong>
            )}
            {isPaused && (
              <div className="smash-overlay">
                <h2>Paused. Tap to resume.</h2>
                <GameButton
                  onClick={() => {
                    resumeAt.current = performance.now() + 1000;
                    paused.current = false;
                    setPaused(false);
                  }}
                >
                  Resume
                </GameButton>
              </div>
            )}
          </>
        )}
        {phase !== "playing" && (
          <div className="smash-overlay">
            <p className="eyebrow">KEEP THE RALLY ALIVE</p>
            <h1>Smash Up</h1>
            {phase === "ready" ? (
              <p>
                Drag to move your racket. Keep the shuttle up. Hit the target,
                then tap SMASH.
              </p>
            ) : (
              <>
                <h2>
                  Level {hud.level} · {hud.hits} hits · Score {hud.score}
                </h2>
                {newBest && <strong>New best!</strong>}
                <GameButton tone="primary" onClick={() => void share()}>
                  {copied ? "Copied!" : "Share score"}
                </GameButton>
                <span className="sr-only" aria-live="polite">
                  {copied ? "Copied!" : ""}
                </span>
              </>
            )}
            <GameButton
              tone="primary"
              disabled={starting}
              onClick={() => void start()}
            >
              {starting
                ? "Opening court…"
                : phase === "ready"
                  ? "Play"
                  : "Play again"}
            </GameButton>
            <p>
              Personal best · {best} · Level {bestLevel}
            </p>
            {userId ? (
              <>
                <p aria-live="polite">
                  {xp || (status ? `${status.xp_today}/20 XP this window` : "")}
                </p>
                {status && (
                  <small>
                    5 XP for 5 hits · 5 XP at Level 2 · 10 XP at Level 3.
                    {status.resets_at
                      ? ` More XP from ${new Date(status.resets_at).toLocaleString()}.`
                      : " Your 24 hours start with your first XP."}{" "}
                    Lifetime XP only.
                  </small>
                )}
              </>
            ) : (
              guest
            )}
          </div>
        )}
      </div>
      {phase !== "playing" && (board || countries) && (
        <section
          className="panel smash-board"
          aria-label="Smash Up leaderboard"
        >
          <h2>Smash Up leaderboard</h2>
          <div
            className="smash-tabs"
            role="tablist"
            aria-label="Leaderboard scope"
          >
            {[
              ["today", "Today"],
              ["all", "All-time"],
              ["countries", "Countries"],
            ].map(([value, label]) => (
              <button
                key={value}
                role="tab"
                aria-selected={scope === value}
                onClick={() => setScope(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <small>Today and Countries use the UTC day.</small>
          {scope === "countries" ? (
            countries?.length ? (
              countries.map((row) => (
                <div className="smash-row" key={row.country}>
                  <strong>{row.country}</strong>
                  <span>
                    {row.top_fan} · {row.fans} fans
                  </span>
                  <b>{row.best_score}</b>
                </div>
              ))
            ) : (
              <p>No runs yet. Start the rally.</p>
            )
          ) : (
            <>
              {board?.rows.length ? (
                board.rows.map((row) => (
                  <div
                    className={`smash-row ${board.me?.username === row.username ? "is-you" : ""}`}
                    key={row.username}
                  >
                    <b>#{row.rank}</b>
                    <span>
                      {row.username} · {row.country}
                      <small>
                        Level {row.best_level} · {row.best_hits} hits
                      </small>
                    </span>
                    <strong>{row.best_score}</strong>
                  </div>
                ))
              ) : (
                <p>No runs yet. Start the rally.</p>
              )}
              {board?.me && (
                <p className="smash-you">
                  You · #{board.me.rank} · {board.me.best_score} points
                </p>
              )}
            </>
          )}
          {!userId && guest}
        </section>
      )}
    </section>
  );
}
