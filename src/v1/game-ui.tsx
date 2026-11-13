"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, Flame, Medal, VolumeX } from "lucide-react";
import type { Review } from "./types";

export function levelFor(xp: number) {
  const level = Math.floor(xp / 250) + 1;
  return { level, title: level < 5 ? "Rookie" : level < 10 ? "Pro" : "Legend" };
}

export function deadlineLabel(seconds: number, verb = "Closes") {
  if (seconds >= 3600)
    return `${verb} in ${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  if (seconds >= 60)
    return `${verb} in ${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${verb} in ${seconds}s`;
}

export function ArenaSkeleton({
  compact = false,
  label,
}: {
  compact?: boolean;
  label?: string;
}) {
  return (
    <div
      className={compact ? "game-skeleton skeleton-compact" : "game-skeleton"}
      role="status"
      aria-label={label ?? (compact ? "Loading account" : "Loading arena")}
    >
      <span aria-hidden="true" />
      {!compact && <span aria-hidden="true" />}
    </div>
  );
}

export function XPMeter({ xp }: { xp: number }) {
  const { level, title } = levelFor(xp);
  return (
    <div className="game-meter">
      <span className="game-level">
        <Medal size={14} aria-hidden="true" /> {title} · L{level}
      </span>
      <strong className="game-xp" data-testid="v1-lifetime-xp">
        {xp} XP
      </strong>
      <XPProgress xp={xp} label="XP to next level" />
    </div>
  );
}

export function XPProgress({ xp, label }: { xp: number; label: string }) {
  const progress = xp % 250;
  return (
    <div
      className="game-xp-track"
      role="progressbar"
      aria-label={label}
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={250}
    >
      <span style={{ width: `${progress / 2.5}%` }} />
    </div>
  );
}

export function LevelCelebration({
  level,
  onClose,
}: {
  level: number;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const dismiss = () => {
    dialog.current?.close();
    onClose();
  };
  return (
    <dialog
      ref={dialog}
      className="game-level-dialog"
      aria-labelledby="game-level-title"
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
    >
      <div className="game-confetti" aria-hidden="true">
        {Array.from({ length: 24 }, (_, index) => (
          <i
            key={index}
            style={{
              left: `${(index * 37) % 100}%`,
              animationDelay: `${(index % 7) * 75}ms`,
            }}
          />
        ))}
      </div>
      <Medal size={48} aria-hidden="true" />
      <h2 id="game-level-title">Level up!</h2>
      <p>
        {levelFor((level - 1) * 250).title} · Level {level}
      </p>
      <button className="primary" onClick={dismiss}>
        Keep playing
      </button>
    </dialog>
  );
}

export function Streak({ count }: { count: number }) {
  return (
    <span className="game-streak">
      <Flame size={16} aria-hidden="true" /> {count} streak
    </span>
  );
}

export function QuizFeedback({
  answer,
  animate,
}: {
  answer: Review;
  animate: boolean;
}) {
  const result =
    answer.option === null ? "timeout" : answer.xp ? "correct" : "wrong";
  return (
    <div
      className={`game-quiz-feedback result-${result}${animate ? " game-feedback-fresh" : ""}`}
    >
      <div aria-hidden="true" className="game-result-icon">
        {result === "correct" ? "✓" : result === "timeout" ? "◷" : "×"}
      </div>
      <div>
        <h2>
          {result === "correct"
            ? "Clean winner."
            : result === "timeout"
              ? "Time’s up!"
              : "Not this rally."}
        </h2>
        <strong className="game-answer-xp">+{answer.xp} XP</strong>
      </div>
    </div>
  );
}

type Cue = "correct" | "wrong" | "timeout" | "locked" | "level";
const tones: Record<Cue, number[]> = {
  correct: [523, 784],
  wrong: [220, 165],
  timeout: [130, 130],
  locked: [440, 587],
  level: [523, 659, 784, 1047],
};
let audio: AudioContext | undefined;

function prepareAudio() {
  if (!window.AudioContext) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume().catch(() => {});
  } catch {
    // Audio is optional.
  }
}

export function useGameFeedback() {
  const [sound, setSound] = useState(false);
  useEffect(() => {
    try {
      setSound(localStorage.getItem("badmintonxp-v1-sound") === "on");
    } catch {
      /* Optional preference. */
    }
  }, []);

  function toggleSound() {
    const enabled = !sound;
    setSound(enabled);
    if (enabled) prepareAudio();
    try {
      localStorage.setItem("badmintonxp-v1-sound", enabled ? "on" : "off");
    } catch {
      /* Optional preference. */
    }
  }

  const feedback = useCallback(
    (cue: Cue) => {
      if (
        (navigator.userActivation?.hasBeenActive ?? true) &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        navigator.vibrate?.(
          cue === "wrong" || cue === "timeout" ? [18, 35, 18] : 16,
        );
      }
      if (!sound || audio?.state !== "running") return;
      const context = audio;
      tones[cue].forEach((frequency, index) => {
        const start = context.currentTime + index * 0.09;
        const tone = context.createOscillator();
        const gain = context.createGain();
        tone.frequency.value = frequency;
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.045, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.095);
        tone.connect(gain).connect(context.destination);
        tone.start(start);
        tone.stop(start + 0.1);
      });
    },
    [sound],
  );

  return {
    sound,
    toggleSound,
    feedback,
    activateAudio: sound ? prepareAudio : undefined,
  };
}

export function SoundToggle({
  sound,
  onToggle,
}: {
  sound: boolean;
  onToggle: () => void;
}) {
  const Icon = sound ? AudioLines : VolumeX;
  return (
    <button
      type="button"
      className="game-sound"
      aria-label="Game sound"
      aria-pressed={sound}
      title={sound ? "Mute game sound" : "Enable game sound"}
      onClick={onToggle}
    >
      <Icon size={19} aria-hidden="true" />
    </button>
  );
}
