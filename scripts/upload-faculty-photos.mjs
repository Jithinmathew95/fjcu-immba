import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";

const envFile = readFileSync(join(process.cwd(), ".env"), "utf8");
for (const line of envFile.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

const supabase = createClient(url, key);
const dir = join(process.cwd(), "public/assets/faculty");
const mime = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

const files = readdirSync(dir).filter((name) => mime[extname(name).toLowerCase()]);
const updates = [];

for (const file of files) {
  const id = file.replace(/\.[^.]+$/, "");
  const type = mime[extname(file).toLowerCase()];
  const path = `${id}/portrait${extname(file).toLowerCase()}`;
  const body = readFileSync(join(dir, file));
  const { error } = await supabase.storage.from("faculty-photos").upload(path, body, {
    contentType: type,
    upsert: true,
  });
  if (error) throw new Error(`${file}: ${error.message}`);
  const { data } = supabase.storage.from("faculty-photos").getPublicUrl(path);
  updates.push({ id, image_url: data.publicUrl });
  console.log(`uploaded ${file}`);
}

console.log(JSON.stringify(updates));
