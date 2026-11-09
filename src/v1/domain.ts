export function emailReturnUrl(origin: string, flow: "account" | "reset") {
  const url = new URL(origin);
  if (["badmintonxp.com", "www.badmintonxp.com"].includes(url.hostname)) {
    return `https://badmintonxp.com/play/${flow}`;
  }
  // Local development keeps PKCE verification on the same origin.
  return new URL(`/play/${flow}`, url.origin).toString();
}
export function tournamentPublicationHeld(name: string) {
  return (
    name.trim().replace(/\s+/g, " ").toLowerCase() === "world tour finals 2026"
  );
}
