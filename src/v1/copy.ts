export function rankingsCaption(
  eventName: string | null | undefined,
  scope: string,
  league: string,
) {
  const group =
    league === "players"
      ? "Individual rankings"
      : league === "teams"
        ? "Team rankings"
        : "Country rankings";
  const period = scope === "season" ? "Season" : eventName?.trim();
  return [period, group].filter(Boolean).join(" · ");
}
