import type { SupabaseClient } from "@supabase/supabase-js";
export type GameStatus = {
  xp_today: number;
  xp_cap: number;
  resets_at: string | null;
  last_played: string | null;
};
export type Finish = GameStatus & {
  accepted: boolean;
  reason: string | null;
  xp_added: number;
};
export type Row = {
  rank: number;
  username: string;
  country: string;
  best_level: number;
  best_hits: number;
  best_score: number;
  achieved_on: string;
};
export type Board = { rows: Row[]; me: Row | null };
export type CountryRow = {
  country: string;
  best_level: number;
  best_score: number;
  fans: number;
  top_fan: string;
};
export async function call<T>(
  client: SupabaseClient | null,
  name: string,
  args = {},
): Promise<T | null> {
  if (!client) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const { data, error } = await client
      .rpc(name, args)
      .abortSignal(controller.signal);
    return error ? null : (data as T);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
