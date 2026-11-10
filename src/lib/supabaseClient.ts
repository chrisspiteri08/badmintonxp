import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;
let initializationError: string | null = null;

const unavailableMessage =
  "The arena is taking a break. Please try again shortly.";
if (!supabaseUrl || !supabaseAnonKey) {
  initializationError = unavailableMessage;
} else {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch {
    initializationError = unavailableMessage;
    supabase = null;
  }
}

export { supabase, initializationError };
