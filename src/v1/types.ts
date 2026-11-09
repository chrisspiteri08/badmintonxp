export type Screen =
  | "arena"
  | "account"
  | "reset"
  | "quiz"
  | "predict"
  | "standings"
  | "profile"
  | "admin";
export type Team = { id: string; name: string };
export type Profile = {
  id: string;
  username: string;
  country: string;
  team_id: string | null;
};
export type Tournament = {
  id: string;
  name: string;
  season_id: string;
  starts_at: string;
  ends_at: string;
  published: boolean;
  active: boolean;
};
export type Quiz = {
  id: string;
  title: string;
  tournament_id?: string;
  published?: boolean;
  opens_at: string;
  closes_at: string;
  question_count: number;
  attempt: null | { complete: boolean; score: number };
};
export type Match = {
  id: string;
  tournament_id: string;
  athlete_a: string;
  athlete_b: string;
  closes_at: string;
  winner: string | null;
  entry: null | { pick: string };
};
export type Home = {
  server_now: string;
  profile: Profile | null;
  admin: boolean;
  teams: Team[];
  tournament: Tournament | null;
  quizzes: Quiz[];
  matches: Match[];
  lifetime_xp: number;
  event_xp: number;
};
export type Review = {
  position: number;
  prompt: string;
  options: string[];
  option: number | null;
  xp: number;
  correct_option: number;
  explanation: string;
};
export type Attempt = {
  id: string;
  quiz_id: string;
  deadline: string;
  server_now: string;
  complete: boolean;
  awaiting_next: boolean;
  score: number;
  question: null | { position: number; prompt: string; options: string[] };
  answers: Review[];
};
export type Rank = { id: string; name: string; xp: number; rank: number };
export type AdminData = {
  seasons: Team[];
  tournaments: Tournament[];
  matches: Match[];
  quizzes: Quiz[];
  questions: Array<Review & { id: string; quiz_id: string }>;
  players: Array<Profile & { email: string }>;
};
