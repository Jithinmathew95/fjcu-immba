import { readFileSync, writeFileSync } from "fs";
import vm from "vm";

const ctx = { window: {} };
vm.runInNewContext(readFileSync("public/js/data.js", "utf8"), ctx);
const esc = (value) => String(value || "").replace(/'/g, "''");
const rows = ctx.window.IMMBA.news.map((item) =>
  `('${esc(item.id)}','${esc(item.date)}','${esc(item.link)}','${esc(item.photo)}',${Number.isFinite(Number(item.order)) ? Number(item.order) : 1},'${esc(item.status || "published")}','${esc(item.tagEn)}','${esc(item.tagZh)}','${esc(item.titleEn)}','${esc(item.titleZh)}','${esc(item.bodyEn)}','${esc(item.bodyZh)}')`
).join(",\n");

writeFileSync(
  "supabase/announcements-seed.sql",
  `insert into public.announcements (id, date, link, photo, sort_order, status, tag_en, tag_zh, title_en, title_zh, body_en, body_zh) values\n${rows}\non conflict (id) do update set date = excluded.date, link = excluded.link, photo = excluded.photo, sort_order = excluded.sort_order, status = excluded.status, tag_en = excluded.tag_en, tag_zh = excluded.tag_zh, title_en = excluded.title_en, title_zh = excluded.title_zh, body_en = excluded.body_en, body_zh = excluded.body_zh;\n`
);
console.log(ctx.window.IMMBA.news.length);
