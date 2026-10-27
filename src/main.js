import { supabase, supabaseConfigError } from "./lib/supabaseClient.js";

if (!supabase) {
  throw new Error(supabaseConfigError);
}

export { supabase };
