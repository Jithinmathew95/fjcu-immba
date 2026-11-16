import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "public/js/data.js"), "utf8");
const sandbox = { window: {} };
const fn = new Function("window", source + "\nreturn window.IMMBA.faculty;");
const faculty = fn(sandbox.window);

function slug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function sqlStr(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

const rows = faculty.map((person, index) => {
  const isTu = person.name === "Yi-Ning Tu";
  const title = isTu
    ? "Associate Professor and Director, MBA in International Management (imMBA)"
    : person.roleEn;
  const education = isTu
    ? "Ph.D. in Management Information Systems, National Chengchi University"
    : person.eduEn;
  const category = /part-time|兼任/i.test(`${person.roleEn} ${person.roleZh}`)
    ? "part-time"
    : "full-time";

  return `(
    ${sqlStr(slug(person.name))},
    ${sqlStr(person.name)},
    ${sqlStr(person.nameZh)},
    ${sqlStr(title)},
    ${sqlStr(person.roleZh)},
    'College of Management',
    '管理學院',
    ${sqlStr(education)},
    ${sqlStr(person.eduZh)},
    ${sqlStr(person.specEn)},
    ${sqlStr(person.specZh)},
    ${sqlStr(person.email)},
    ${sqlStr(person.tel)},
    ${sqlStr(person.web)},
    ${sqlStr(person.photo || "")},
    ${sqlStr(category)},
    ${index + 1}
  )`;
});

const sql = `-- Seed the faculty cabinet from the current teaching-demo roster.
insert into public.faculty (
  id, name, name_zh, title, title_zh, department, department_zh,
  education, education_zh, research_fields, research_fields_zh,
  email, phone, website, image_url, category, sort_order
) values
${rows.join(",\n")}
on conflict (id) do update set
  name = excluded.name,
  name_zh = excluded.name_zh,
  title = excluded.title,
  title_zh = excluded.title_zh,
  department = excluded.department,
  department_zh = excluded.department_zh,
  education = excluded.education,
  education_zh = excluded.education_zh,
  research_fields = excluded.research_fields,
  research_fields_zh = excluded.research_fields_zh,
  email = excluded.email,
  phone = excluded.phone,
  website = excluded.website,
  image_url = excluded.image_url,
  category = excluded.category,
  sort_order = excluded.sort_order;

insert into public.profiles (id, email, role)
select id, coalesce(email, ''), 'pending'
from auth.users
on conflict (id) do nothing;

update public.profiles
set role = 'super_admin'
where lower(email) = 'jithinmathewpalackal@gmail.com';
`;

writeFileSync(join(root, "supabase/seed.sql"), sql);
console.log(`Wrote ${faculty.length} faculty rows to supabase/seed.sql`);
