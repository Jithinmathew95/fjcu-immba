import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const envFile = readFileSync(join(process.cwd(), ".env"), "utf8");
for (const line of envFile.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD for this run only.");

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: { emailRedirectTo: "http://localhost:5173/admin-login.html" },
});
if (error) {
  console.error(error.message);
  process.exit(1);
}
console.log(JSON.stringify({ userId: data.user?.id || null, hasSession: Boolean(data.session) }));
