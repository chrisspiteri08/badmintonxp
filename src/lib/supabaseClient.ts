import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;
let initializationError: string | null = null;

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMessage = "Supabase URL or Anon Key is missing. Please check your .env.local file and ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set correctly. You must restart the server after making changes.";
  initializationError = errorMessage;
  console.error(`CRITICAL CONFIG ERROR: ${errorMessage}`);
} else {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    const errorMessage = `Failed to create Supabase client: ${(error as Error).message}. Please check if the URL is valid.`;
    initializationError = errorMessage;
    console.error(`CRITICAL CONFIG ERROR: ${errorMessage}`);
    supabase = null;
  }
}

export { supabase, initializationError };
