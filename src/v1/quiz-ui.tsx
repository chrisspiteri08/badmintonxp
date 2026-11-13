"use client";

export function QuizTimer({ remaining }: { remaining: number }) {
  return (
    <strong
      className={`timer ${remaining < 5 ? "urgent" : ""}`}
      role="timer"
      aria-label={`${remaining} seconds remaining`}
    >
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle className="countdown-track" cx="40" cy="40" r="34" />
        <circle
          className="countdown-arc"
          cx="40"
          cy="40"
          r="34"
          pathLength="100"
          strokeDasharray="100"
          strokeDashoffset={100 - (remaining / 15) * 100}
        />
      </svg>
      <span>{remaining}s</span>
    </strong>
  );
}

export function QuizAnswers({
  options,
  disabled,
  onAnswer,
}: {
  options: string[];
  disabled?: boolean;
  onAnswer?: (index: number) => void;
}) {
  return (
    <div className="answer-grid">
      {options.map((option, index) => {
        const label = String.fromCharCode(65 + index);
        return onAnswer ? (
          <button
            key={index}
            disabled={disabled}
            onClick={() => onAnswer(index)}
          >
            <span>{label}</span>
            {option}
          </button>
        ) : (
          <div className="launch-answer" key={index}>
            <span>{label}</span>
            {option}
          </div>
        );
      })}
    </div>
  );
}
