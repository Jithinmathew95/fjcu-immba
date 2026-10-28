create table if not exists public.announcements (
  id text primary key,
  date date not null,
  link text not null default '',
  photo text not null default '',
  sort_order integer not null default 1,
  status text not null default 'published',
  tag_en text not null default 'News',
  tag_zh text not null default '消息',
  title_en text not null default '',
  title_zh text not null default '',
  body_en text not null default '',
  body_zh text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

grant select on table public.announcements to anon, authenticated;
grant insert, update, delete on table public.announcements to authenticated;

drop policy if exists "Public can read published announcements" on public.announcements;
create policy "Public can read published announcements"
  on public.announcements
  for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "Staff can read all announcements" on public.announcements;
create policy "Staff can read all announcements"
  on public.announcements
  for select
  to authenticated
  using (true);

drop policy if exists "Staff can insert announcements" on public.announcements;
create policy "Staff can insert announcements"
  on public.announcements
  for insert
  to authenticated
  with check (true);

drop policy if exists "Staff can update announcements" on public.announcements;
create policy "Staff can update announcements"
  on public.announcements
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Staff can delete announcements" on public.announcements;
create policy "Staff can delete announcements"
  on public.announcements
  for delete
  to authenticated
  using (true);
