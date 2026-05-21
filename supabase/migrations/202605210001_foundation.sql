create extension if not exists pgcrypto;

create schema if not exists auth;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'https://app/role', 'anonymous');
$$;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth0_sub text unique not null,
  email text,
  display_name text,
  role text not null check (role in ('tasker', 'reviewer', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.users
  where auth0_sub = auth.jwt() ->> 'sub'
  limit 1;
$$;

create table public.rows (
  id uuid primary key default gen_random_uuid(),
  tasker_id uuid not null references public.users(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  status text not null default 'pending_review' check (status in ('pending_review', 'accepted_clean', 'accepted_with_edits', 'rejected')),
  reviewer_id uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  review_score int check (review_score between 1 and 5),
  metadata jsonb not null default '{}'::jsonb
);

create table public.row_reviews (
  row_id uuid primary key references public.rows(id) on delete cascade,
  reviewer_id uuid not null references public.users(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.streaks (
  user_id uuid primary key references public.users(id) on delete cascade,
  current_streak_days int not null default 0,
  longest_streak_days int not null default 0,
  last_active_date date,
  streak_started_on date
);

create table public.streak_bonus_awards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  threshold_days int not null check (threshold_days in (3, 5, 7)),
  streak_run_started_on date not null,
  awarded_at timestamptz not null default now(),
  unique (user_id, threshold_days, streak_run_started_on)
);

create table public.milestones (
  id int primary key,
  threshold_rows int not null unique,
  tier_label text not null check (tier_label in ('Tier 1', 'Tier 2', 'Tier 3'))
);

create table public.goodies (
  id uuid primary key default gen_random_uuid(),
  tier_label text not null check (tier_label in ('Tier 1', 'Tier 2', 'Tier 3')),
  name text not null,
  description text,
  image_url text,
  available boolean not null default true
);

create table public.milestone_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  milestone_id int not null references public.milestones(id) on delete restrict,
  achieved_at timestamptz not null default now(),
  goodie_id uuid references public.goodies(id) on delete set null,
  fulfilled_at timestamptz,
  unique (user_id, milestone_id)
);

create table public.goodies_internal (
  goodie_id uuid primary key references public.goodies(id) on delete cascade,
  unit_cost_cents int not null check (unit_cost_cents >= 0),
  vendor text,
  notes text
);

create table public.guilds (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table public.guild_memberships (
  user_id uuid not null references public.users(id) on delete cascade,
  guild_id uuid not null references public.guilds(id) on delete cascade,
  primary key (user_id, guild_id)
);

create table public.freeze_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  week_number int not null check (week_number between 1 and 53),
  used_at timestamptz,
  unique (user_id, week_number, id)
);

create table public.earnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  source text not null check (source in ('quality_bonus', 'streak_bonus', 'milestone', 'finale_bounty', 'pot_share', 'guild_dinner')),
  amount_cents int not null check (amount_cents >= 0),
  awarded_at timestamptz not null default now(),
  reference_id uuid
);

create unique index earnings_quality_once_per_row
  on public.earnings (reference_id)
  where source = 'quality_bonus' and reference_id is not null;

create unique index earnings_finale_once_per_row
  on public.earnings (reference_id)
  where source = 'finale_bounty' and reference_id is not null;

create table public.sprint_config (
  id int primary key default 1 check (id = 1),
  sprint_start_date date not null,
  sprint_end_date date not null,
  current_phase text not null check (current_phase in ('warmup', 'steady', 'finale')),
  quality_multiplier numeric not null default 1.0 check (quality_multiplier >= 0),
  quality_base_clean_cents int not null default 2000 check (quality_base_clean_cents >= 0),
  quality_base_edits_cents int not null default 1000 check (quality_base_edits_cents >= 0),
  streak_bonus_3_cents int not null default 1500 check (streak_bonus_3_cents >= 0),
  streak_bonus_5_cents int not null default 3000 check (streak_bonus_5_cents >= 0),
  streak_bonus_7_cents int not null default 5000 check (streak_bonus_7_cents >= 0),
  endgame_bounty_active boolean not null default false,
  endgame_bounty_amount_cents int not null default 0 check (endgame_bounty_amount_cents >= 0),
  collective_goal_rows int not null default 1000 check (collective_goal_rows > 0),
  collective_stretch_rows int not null default 2000 check (collective_stretch_rows >= collective_goal_rows)
);

create table public.program_economics (
  id int primary key default 1 check (id = 1),
  budget_cents bigint not null check (budget_cents >= 0),
  revenue_cents bigint not null check (revenue_cents >= 0),
  notes text,
  updated_at timestamptz not null default now()
);

create table public.pot_share_events (
  id uuid primary key default gen_random_uuid(),
  goal_rows int not null,
  queued_at timestamptz not null default now(),
  triggered_by_row_id uuid references public.rows(id) on delete set null,
  processed_at timestamptz
);

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id) on delete set null,
  action text not null,
  target_table text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index rows_tasker_status_idx on public.rows (tasker_id, status);
create index rows_review_queue_idx on public.rows (status, submitted_at) where status = 'pending_review';
create index earnings_user_awarded_idx on public.earnings (user_id, awarded_at desc);
create index guild_memberships_guild_idx on public.guild_memberships (guild_id);

alter table public.users enable row level security;
alter table public.rows enable row level security;
alter table public.row_reviews enable row level security;
alter table public.streaks enable row level security;
alter table public.streak_bonus_awards enable row level security;
alter table public.milestones enable row level security;
alter table public.milestone_achievements enable row level security;
alter table public.goodies enable row level security;
alter table public.goodies_internal enable row level security;
alter table public.guilds enable row level security;
alter table public.guild_memberships enable row level security;
alter table public.freeze_tokens enable row level security;
alter table public.earnings enable row level security;
alter table public.sprint_config enable row level security;
alter table public.program_economics enable row level security;
alter table public.pot_share_events enable row level security;
alter table public.admin_audit_log enable row level security;

create policy users_self_or_admin_read on public.users
  for select using (auth0_sub = auth.jwt() ->> 'sub' or auth.role() = 'admin');

create policy users_self_insert on public.users
  for insert with check (
    auth0_sub = auth.jwt() ->> 'sub'
    and role = auth.role()
    and auth.role() in ('tasker', 'reviewer', 'admin')
  );

create policy users_admin_write on public.users
  for all using (auth.role() = 'admin') with check (auth.role() = 'admin');

create policy rows_read_by_role on public.rows
  for select using (
    auth.role() = 'admin'
    or (auth.role() = 'tasker' and tasker_id = public.current_app_user_id())
    or (auth.role() = 'reviewer' and (status = 'pending_review' or reviewer_id = public.current_app_user_id()))
  );

create policy rows_tasker_insert_own on public.rows
  for insert with check (
    auth.role() = 'tasker'
    and tasker_id = public.current_app_user_id()
    and status = 'pending_review'
    and reviewer_id is null
    and reviewed_at is null
  );

create policy rows_reviewer_update_queue on public.rows
  for update using (
    auth.role() = 'reviewer'
    and (status = 'pending_review' or reviewer_id = public.current_app_user_id())
  ) with check (
    auth.role() = 'reviewer'
    and reviewer_id = public.current_app_user_id()
    and status in ('pending_review', 'accepted_clean', 'accepted_with_edits', 'rejected')
  );

create policy rows_admin_write on public.rows
  for all using (auth.role() = 'admin') with check (auth.role() = 'admin');

create policy row_reviews_reviewer_or_admin_read on public.row_reviews
  for select using (auth.role() = 'admin' or (auth.role() = 'reviewer' and reviewer_id = public.current_app_user_id()));

create policy row_reviews_reviewer_write on public.row_reviews
  for all using (auth.role() = 'reviewer' and reviewer_id = public.current_app_user_id())
  with check (auth.role() = 'reviewer' and reviewer_id = public.current_app_user_id());

create policy row_reviews_admin_write on public.row_reviews
  for all using (auth.role() = 'admin') with check (auth.role() = 'admin');

create policy streaks_self_or_admin_read on public.streaks
  for select using (auth.role() = 'admin' or user_id = public.current_app_user_id());

create policy streaks_admin_write on public.streaks
  for all using (auth.role() = 'admin') with check (auth.role() = 'admin');

create policy streak_awards_self_or_admin_read on public.streak_bonus_awards
  for select using (auth.role() = 'admin' or user_id = public.current_app_user_id());

create policy streak_awards_admin_write on public.streak_bonus_awards
  for all using (auth.role() = 'admin') with check (auth.role() = 'admin');

create policy milestones_read_all_roles on public.milestones
  for select using (auth.role() in ('tasker', 'reviewer', 'admin'));

create policy milestones_admin_write on public.milestones
  for all using (auth.role() = 'admin') with check (auth.role() = 'admin');

create policy milestone_achievements_self_or_admin_read on public.milestone_achievements
  for select using (auth.role() = 'admin' or user_id = public.current_app_user_id());

create policy milestone_achievements_tasker_select_goodie on public.milestone_achievements
  for update using (auth.role() = 'tasker' and user_id = public.current_app_user_id() and fulfilled_at is null)
  with check (auth.role() = 'tasker' and user_id = public.current_app_user_id());

create policy milestone_achievements_admin_write on public.milestone_achievements
  for all using (auth.role() = 'admin') with check (auth.role() = 'admin');

create policy goodies_catalog_read on public.goodies
  for select using (available = true or auth.role() = 'admin');

create policy goodies_admin_write on public.goodies
  for all using (auth.role() = 'admin') with check (auth.role() = 'admin');

create policy goodies_internal_admin_only on public.goodies_internal
  for all using (auth.role() = 'admin') with check (auth.role() = 'admin');

create policy guilds_read_all_roles on public.guilds
  for select using (auth.role() in ('tasker', 'reviewer', 'admin'));

create policy guilds_admin_write on public.guilds
  for all using (auth.role() = 'admin') with check (auth.role() = 'admin');

create policy guild_memberships_read_all_roles on public.guild_memberships
  for select using (auth.role() in ('tasker', 'reviewer', 'admin'));

create policy guild_memberships_admin_write on public.guild_memberships
  for all using (auth.role() = 'admin') with check (auth.role() = 'admin');

create policy freeze_tokens_self_or_admin_read on public.freeze_tokens
  for select using (auth.role() = 'admin' or user_id = public.current_app_user_id());

create policy freeze_tokens_admin_write on public.freeze_tokens
  for all using (auth.role() = 'admin') with check (auth.role() = 'admin');

create policy earnings_self_or_admin_read on public.earnings
  for select using (auth.role() = 'admin' or user_id = public.current_app_user_id());

create policy earnings_admin_write on public.earnings
  for all using (auth.role() = 'admin') with check (auth.role() = 'admin');

create policy sprint_config_admin_only on public.sprint_config
  for all using (auth.role() = 'admin') with check (auth.role() = 'admin');

create policy program_economics_admin_only on public.program_economics
  for all using (auth.role() = 'admin') with check (auth.role() = 'admin');

create policy pot_share_events_admin_only on public.pot_share_events
  for all using (auth.role() = 'admin') with check (auth.role() = 'admin');

create policy admin_audit_log_admin_only on public.admin_audit_log
  for all using (auth.role() = 'admin') with check (auth.role() = 'admin');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger row_reviews_set_updated_at
before update on public.row_reviews
for each row execute function public.set_updated_at();

create trigger program_economics_set_updated_at
before update on public.program_economics
for each row execute function public.set_updated_at();

create or replace function public.protect_reviewer_row_update()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'reviewer' then
    if new.tasker_id is distinct from old.tasker_id
      or new.submitted_at is distinct from old.submitted_at
      or new.metadata is distinct from old.metadata then
      raise exception 'reviewers may only update review fields';
    end if;

    if new.status in ('accepted_clean', 'accepted_with_edits', 'rejected') then
      new.reviewer_id = public.current_app_user_id();
      new.reviewed_at = coalesce(new.reviewed_at, now());
      new.review_score = coalesce(
        new.review_score,
        case new.status
          when 'accepted_clean' then 5
          when 'accepted_with_edits' then 3
          else 1
        end
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger protect_reviewer_row_update
before update on public.rows
for each row execute function public.protect_reviewer_row_update();

create or replace function public.validate_goodie_selection()
returns trigger
language plpgsql
as $$
declare
  achievement_tier text;
  goodie_tier text;
begin
  if auth.role() = 'tasker' then
    if new.user_id is distinct from old.user_id
      or new.milestone_id is distinct from old.milestone_id
      or new.achieved_at is distinct from old.achieved_at
      or new.fulfilled_at is distinct from old.fulfilled_at then
      raise exception 'taskers may only select an unfulfilled goodie';
    end if;
  end if;

  if new.goodie_id is not null and new.goodie_id is distinct from old.goodie_id then
    select tier_label into achievement_tier
    from public.milestones
    where id = new.milestone_id;

    select tier_label into goodie_tier
    from public.goodies
    where id = new.goodie_id and available = true;

    if goodie_tier is null or goodie_tier <> achievement_tier then
      raise exception 'selected goodie must be available and match milestone tier';
    end if;
  end if;

  return new;
end;
$$;

create trigger validate_goodie_selection
before update on public.milestone_achievements
for each row execute function public.validate_goodie_selection();

create or replace function public.streak_bonus_amount(threshold_days int, cfg public.sprint_config)
returns int
language sql
immutable
as $$
  select case threshold_days
    when 3 then (cfg).streak_bonus_3_cents
    when 5 then (cfg).streak_bonus_5_cents
    when 7 then (cfg).streak_bonus_7_cents
    else 0
  end;
$$;

create or replace function public.apply_acceptance_gamification(
  p_user_id uuid,
  p_row_id uuid,
  p_status text,
  p_acceptance_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.sprint_config%rowtype;
  streak public.streaks%rowtype;
  new_current int;
  new_longest int;
  new_started_on date;
  freeze_id uuid;
  threshold int;
  accepted_count int;
  milestone_row public.milestones%rowtype;
  total_accepted int;
begin
  select * into cfg from public.sprint_config where id = 1;

  if p_status = 'accepted_clean' then
    insert into public.earnings (user_id, source, amount_cents, reference_id)
    values (p_user_id, 'quality_bonus', round(cfg.quality_base_clean_cents * cfg.quality_multiplier)::int, p_row_id)
    on conflict do nothing;
  elsif p_status = 'accepted_with_edits' then
    insert into public.earnings (user_id, source, amount_cents, reference_id)
    values (p_user_id, 'quality_bonus', round(cfg.quality_base_edits_cents * cfg.quality_multiplier)::int, p_row_id)
    on conflict do nothing;
  else
    return;
  end if;

  select * into streak
  from public.streaks
  where user_id = p_user_id
  for update;

  if not found then
    new_current := 1;
    new_longest := 1;
    new_started_on := p_acceptance_date;
    insert into public.streaks (user_id, current_streak_days, longest_streak_days, last_active_date, streak_started_on)
    values (p_user_id, new_current, new_longest, p_acceptance_date, new_started_on);
  elsif streak.last_active_date = p_acceptance_date then
    new_current := streak.current_streak_days;
    new_longest := streak.longest_streak_days;
    new_started_on := coalesce(streak.streak_started_on, p_acceptance_date);
  elsif streak.last_active_date = p_acceptance_date - 1 then
    new_current := streak.current_streak_days + 1;
    new_longest := greatest(streak.longest_streak_days, new_current);
    new_started_on := coalesce(streak.streak_started_on, p_acceptance_date);
    update public.streaks
    set current_streak_days = new_current,
        longest_streak_days = new_longest,
        last_active_date = p_acceptance_date,
        streak_started_on = new_started_on
    where user_id = p_user_id;
  else
    select id into freeze_id
    from public.freeze_tokens
    where user_id = p_user_id
      and week_number = extract(week from p_acceptance_date)::int
      and used_at is null
    order by id
    limit 1
    for update;

    if freeze_id is not null then
      update public.freeze_tokens set used_at = now() where id = freeze_id;
      new_current := streak.current_streak_days + 1;
      new_longest := greatest(streak.longest_streak_days, new_current);
      new_started_on := coalesce(streak.streak_started_on, p_acceptance_date);
    else
      new_current := 1;
      new_longest := greatest(streak.longest_streak_days, 1);
      new_started_on := p_acceptance_date;
    end if;

    update public.streaks
    set current_streak_days = new_current,
        longest_streak_days = new_longest,
        last_active_date = p_acceptance_date,
        streak_started_on = new_started_on
    where user_id = p_user_id;
  end if;

  foreach threshold in array array[3, 5, 7] loop
    if new_current >= threshold then
      insert into public.streak_bonus_awards (user_id, threshold_days, streak_run_started_on)
      values (p_user_id, threshold, new_started_on)
      on conflict do nothing;

      insert into public.earnings (user_id, source, amount_cents, reference_id)
      select p_user_id, 'streak_bonus', public.streak_bonus_amount(threshold, cfg), sba.id
      from public.streak_bonus_awards sba
      where sba.user_id = p_user_id
        and sba.threshold_days = threshold
        and sba.streak_run_started_on = new_started_on
        and not exists (
          select 1 from public.earnings e
          where e.source = 'streak_bonus' and e.reference_id = sba.id
        );
    end if;
  end loop;

  select count(*) into accepted_count
  from public.rows
  where tasker_id = p_user_id
    and status in ('accepted_clean', 'accepted_with_edits');

  for milestone_row in
    select * from public.milestones where threshold_rows <= accepted_count
  loop
    insert into public.milestone_achievements (user_id, milestone_id)
    values (p_user_id, milestone_row.id)
    on conflict do nothing;
  end loop;

  if cfg.endgame_bounty_active
    and cfg.current_phase = 'finale'
    and p_acceptance_date between cfg.sprint_start_date and cfg.sprint_end_date then
    insert into public.earnings (user_id, source, amount_cents, reference_id)
    values (p_user_id, 'finale_bounty', cfg.endgame_bounty_amount_cents, p_row_id)
    on conflict do nothing;
  end if;

  select count(*) into total_accepted
  from public.rows
  where status in ('accepted_clean', 'accepted_with_edits');

  if total_accepted >= cfg.collective_goal_rows then
    insert into public.pot_share_events (goal_rows, triggered_by_row_id)
    select cfg.collective_goal_rows, p_row_id
    where not exists (
      select 1 from public.pot_share_events where goal_rows = cfg.collective_goal_rows
    );
  end if;
end;
$$;

create or replace function public.handle_row_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
    and new.status in ('accepted_clean', 'accepted_with_edits', 'rejected')
    and old.status not in ('accepted_clean', 'accepted_with_edits', 'rejected') then
    if new.reviewed_at is null then
      update public.rows set reviewed_at = now() where id = new.id;
    end if;

    perform public.apply_acceptance_gamification(
      new.tasker_id,
      new.id,
      new.status,
      coalesce(new.reviewed_at, now())::date
    );
  end if;

  return new;
end;
$$;

create trigger rows_apply_gamification
after update on public.rows
for each row execute function public.handle_row_status_transition();

create or replace view public.sprint_public_config as
select
  id,
  sprint_start_date,
  sprint_end_date,
  current_phase,
  quality_multiplier,
  endgame_bounty_active,
  collective_goal_rows,
  collective_stretch_rows,
  greatest(1, (current_date - sprint_start_date + 1))::int as current_sprint_day,
  greatest(1, (sprint_end_date - sprint_start_date + 1))::int as total_sprint_days
from public.sprint_config
where id = 1;

create or replace view public.leaderboard_volume_top5 as
select *
from (
  select
    rank() over (order by count(r.id) desc, min(u.created_at), u.id) as rank,
    u.id as user_id,
    coalesce(u.display_name, split_part(coalesce(u.email, 'Tasker'), '@', 1)) as display_name,
    count(r.id)::int as accepted_rows
  from public.users u
  join public.rows r on r.tasker_id = u.id and r.status in ('accepted_clean', 'accepted_with_edits')
  where u.role = 'tasker'
  group by u.id, u.display_name, u.email
) ranked
where rank <= 5
order by rank;

create or replace view public.leaderboard_quality_top5 as
select *
from (
  select
    rank() over (order by avg(r.review_score) desc, count(r.id) desc, u.id) as rank,
    u.id as user_id,
    coalesce(u.display_name, split_part(coalesce(u.email, 'Tasker'), '@', 1)) as display_name,
    round(avg(r.review_score)::numeric, 2) as average_score,
    count(r.id)::int as accepted_rows
  from public.users u
  join public.rows r on r.tasker_id = u.id and r.status in ('accepted_clean', 'accepted_with_edits')
  where u.role = 'tasker' and r.review_score is not null
  group by u.id, u.display_name, u.email
  having count(r.id) >= 5
) ranked
where rank <= 5
order by rank;

create or replace view public.leaderboard_consistency_top5 as
select *
from (
  select
    rank() over (order by s.current_streak_days desc, s.longest_streak_days desc, u.id) as rank,
    u.id as user_id,
    coalesce(u.display_name, split_part(coalesce(u.email, 'Tasker'), '@', 1)) as display_name,
    s.current_streak_days,
    s.longest_streak_days
  from public.users u
  join public.streaks s on s.user_id = u.id
  where u.role = 'tasker'
) ranked
where rank <= 5
order by rank;

create or replace view public.guild_standings_public as
select
  rank() over (order by count(r.id) desc, g.name) as rank,
  g.id as guild_id,
  g.name,
  count(r.id)::int as accepted_rows
from public.guilds g
left join public.guild_memberships gm on gm.guild_id = g.id
left join public.rows r
  on r.tasker_id = gm.user_id
  and r.status in ('accepted_clean', 'accepted_with_edits')
group by g.id, g.name
order by rank;

insert into public.milestones (id, threshold_rows, tier_label) values
  (1, 5, 'Tier 1'),
  (2, 10, 'Tier 2'),
  (3, 25, 'Tier 3')
on conflict (id) do update
set threshold_rows = excluded.threshold_rows,
    tier_label = excluded.tier_label;

insert into public.sprint_config (
  id,
  sprint_start_date,
  sprint_end_date,
  current_phase,
  collective_goal_rows,
  collective_stretch_rows
) values (
  1,
  current_date,
  current_date + 11,
  'warmup',
  1000,
  2000
) on conflict (id) do nothing;

insert into public.users (auth0_sub, email, display_name, role)
values ('auth0|test-admin', 'admin@example.com', 'Test Admin', 'admin')
on conflict (auth0_sub) do nothing;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
grant select on
  public.sprint_public_config,
  public.leaderboard_volume_top5,
  public.leaderboard_quality_top5,
  public.leaderboard_consistency_top5,
  public.guild_standings_public
to authenticated;
