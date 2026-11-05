-- Unique Student Cooperation: secure student records schema
-- Apply this migration in the Supabase SQL Editor.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'admin', 'staff')),
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  registration_no text not null unique,
  full_name text not null,
  father_name text not null default '',
  program text not null default '',
  department text not null default '',
  campus text not null default '',
  current_semester text not null default '',
  session text not null default '',
  cnic text not null default '',
  date_of_birth date,
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists students_registration_no_idx on public.students (registration_no);
create index if not exists students_full_name_idx on public.students (full_name);

-- A newly created Auth user is always a student. Never trust a client-supplied role.
create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, role, display_name)
  values (new.id, 'student', coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.create_profile_for_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();
drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at before update on public.students
for each row execute procedure public.set_updated_at();

-- SECURITY DEFINER avoids recursive RLS evaluation when checking the caller's role.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.students enable row level security;

-- Users can only read their own profile; only an admin can manage roles/profiles.
drop policy if exists profiles_read_self on public.profiles;
create policy profiles_read_self on public.profiles
for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists profiles_admin_manage on public.profiles;
create policy profiles_admin_manage on public.profiles
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Students can read only their own record. Admins can manage all student records.
drop policy if exists students_read_self on public.students;
create policy students_read_self on public.students
for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists students_admin_manage on public.students;
create policy students_admin_manage on public.students
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Do not expose student data to anonymous users.
revoke all on public.profiles, public.students from anon;
grant select on public.profiles to authenticated;
grant select on public.students to authenticated;
grant insert, update, delete on public.profiles, public.students to authenticated;
