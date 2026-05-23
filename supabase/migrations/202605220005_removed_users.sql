create table if not exists public.removed_users (
  auth0_sub text primary key,
  email text,
  display_name text,
  role text not null check (role in ('tasker', 'reviewer', 'admin')),
  removed_at timestamptz not null default now()
);

alter table public.removed_users enable row level security;

drop policy if exists removed_users_admin_read on public.removed_users;
create policy removed_users_admin_read on public.removed_users
  for select using (auth.role() = 'admin');

drop policy if exists removed_users_admin_write on public.removed_users;
create policy removed_users_admin_write on public.removed_users
  for all using (auth.role() = 'admin') with check (auth.role() = 'admin');
