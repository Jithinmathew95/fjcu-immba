-- Faculty cabinet, admin roles, and photo album for the imMBA site.

create schema if not exists private;

create table if not exists public.faculty (
  id text primary key,
  name text not null,
  name_zh text not null default '',
  title text not null default '',
  title_zh text not null default '',
  department text not null default '',
  department_zh text not null default '',
  education text not null default '',
  education_zh text not null default '',
  research_fields text not null default '',
  research_fields_zh text not null default '',
  email text not null default '',
  phone text not null default '',
  website text not null default '',
  image_url text not null default '',
  category text not null default 'full-time' check (category in ('full-time', 'part-time')),
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'pending' check (role in ('pending', 'admin', 'super_admin', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists faculty_set_updated_at on public.faculty;
create trigger faculty_set_updated_at
  before update on public.faculty
  for each row execute function private.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, coalesce(new.email, ''), 'pending')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(private.current_role(), '') in ('admin', 'super_admin')
$$;

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(private.current_role(), '') = 'super_admin'
$$;

revoke all on schema private from public;
grant usage on schema private to postgres, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function private.current_role() to anon, authenticated, service_role;
grant execute on function private.is_staff() to anon, authenticated, service_role;
grant execute on function private.is_super_admin() to anon, authenticated, service_role;
grant execute on function private.handle_new_user() to supabase_auth_admin;
revoke execute on function private.handle_new_user() from public, anon, authenticated;

alter table public.faculty enable row level security;
alter table public.profiles enable row level security;

grant select on table public.faculty to anon, authenticated;
grant insert, update, delete on table public.faculty to authenticated;
grant select, update on table public.profiles to authenticated;

drop policy if exists "Anyone can read faculty" on public.faculty;
create policy "Anyone can read faculty"
  on public.faculty for select
  to anon, authenticated
  using (true);

drop policy if exists "Staff can insert faculty" on public.faculty;
create policy "Staff can insert faculty"
  on public.faculty for insert
  to authenticated
  with check (private.is_staff());

drop policy if exists "Staff can update faculty" on public.faculty;
create policy "Staff can update faculty"
  on public.faculty for update
  to authenticated
  using (private.is_staff())
  with check (private.is_staff());

drop policy if exists "Staff can delete faculty" on public.faculty;
create policy "Staff can delete faculty"
  on public.faculty for delete
  to authenticated
  using (private.is_staff());

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or private.is_super_admin());

drop policy if exists "Super admin can update roles" on public.profiles;
create policy "Super admin can update roles"
  on public.profiles for update
  to authenticated
  using (private.is_super_admin() and id <> auth.uid())
  with check (private.is_super_admin() and id <> auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'faculty-photos',
  'faculty-photos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view faculty photos" on storage.objects;
create policy "Public can view faculty photos"
  on storage.objects for select
  to public
  using (bucket_id = 'faculty-photos');

drop policy if exists "Staff can upload faculty photos" on storage.objects;
create policy "Staff can upload faculty photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'faculty-photos' and private.is_staff());

drop policy if exists "Staff can update faculty photos" on storage.objects;
create policy "Staff can update faculty photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'faculty-photos' and private.is_staff())
  with check (bucket_id = 'faculty-photos' and private.is_staff());

drop policy if exists "Staff can delete faculty photos" on storage.objects;
create policy "Staff can delete faculty photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'faculty-photos' and private.is_staff());
