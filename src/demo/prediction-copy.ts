/** Display-only helpers. The fixed simulated result and award rules are unchanged. */
export function closesIn(deadline: number, now: number): string {
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  if (seconds === 0) return "Entries closed";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `Closes in ${hours}h ${minutes}m`;
  if (minutes > 0) return `Closes in ${minutes}m ${seconds % 60}s`;
  return `Closes in ${seconds}s`;
}
export function predictionResult(
  pick: "Ember" | "Kite" | null,
  correctXP: number,
): string {
  if (pick === "Ember") return `Ember wins! You called it. +${correctXP} XP`;
  if (pick === "Kite") return "Ember wins. Better luck next time.";
  return "Ember wins. No entry · 0 XP";
}
