import { supabase, supabaseConfigError } from "./lib/supabaseClient.js";
import { fetchPublishedAnnouncements } from "./lib/newsApi.js";

if (!supabase) {
  throw new Error(supabaseConfigError);
}

try {
  const published = await fetchPublishedAnnouncements(supabase);
  if (window.IMMBANews) {
    window.IMMBANews.hydratePublished(published);
    window.refreshImmbaNews?.();
  }
} catch {
  window.refreshImmbaNews?.();
}

export { supabase };
