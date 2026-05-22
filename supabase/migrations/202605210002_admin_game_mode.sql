alter table public.users
  add column if not exists admin_game_owner_id uuid references public.users(id) on delete cascade;

alter table public.users
  add constraint users_admin_game_owner_not_self
  check (admin_game_owner_id is null or admin_game_owner_id <> id);

create unique index if not exists users_one_game_shadow_per_admin_idx
  on public.users (admin_game_owner_id)
  where admin_game_owner_id is not null;
