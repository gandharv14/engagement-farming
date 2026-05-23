alter table public.rows
  add column if not exists reserved_by uuid references public.users(id) on delete set null,
  add column if not exists reserved_until timestamptz;

update public.rows
set status = 'accepted_clean'
where status = 'accepted_with_edits';

alter table public.rows
  drop constraint if exists rows_status_check,
  add constraint rows_status_check check (status in ('pending_review', 'accepted_clean', 'rejected'));

drop index if exists public.rows_review_queue_idx;

create index if not exists rows_review_queue_idx
  on public.rows (status, reserved_until, submitted_at)
  where status = 'pending_review';

create index if not exists rows_reserved_by_idx
  on public.rows (reserved_by, reserved_until)
  where reserved_by is not null;

drop policy if exists rows_read_by_role on public.rows;
create policy rows_read_by_role on public.rows
  for select using (
    auth.role() = 'admin'
    or (auth.role() = 'tasker' and tasker_id = public.current_app_user_id())
    or (
      auth.role() = 'reviewer'
      and (
        status = 'pending_review'
        or reviewer_id = public.current_app_user_id()
        or reserved_by = public.current_app_user_id()
      )
    )
  );

drop policy if exists rows_tasker_insert_own on public.rows;
create policy rows_tasker_insert_own on public.rows
  for insert with check (
    auth.role() = 'tasker'
    and tasker_id = public.current_app_user_id()
    and status = 'pending_review'
    and reviewer_id is null
    and reviewed_at is null
    and reserved_by is null
    and reserved_until is null
  );

drop policy if exists rows_reviewer_update_queue on public.rows;
create policy rows_reviewer_update_queue on public.rows
  for update using (
    auth.role() = 'reviewer'
    and (
      (
        status = 'pending_review'
        and (
          reserved_by is null
          or reserved_by = public.current_app_user_id()
          or reserved_until <= now()
        )
      )
      or reviewer_id = public.current_app_user_id()
    )
  ) with check (
    auth.role() = 'reviewer'
    and status in ('pending_review', 'accepted_clean', 'rejected')
    and (
      (
        status = 'pending_review'
        and reviewer_id is null
        and reviewed_at is null
        and (
          reserved_by is null
          or reserved_by = public.current_app_user_id()
        )
      )
      or (
        status in ('accepted_clean', 'rejected')
        and reviewer_id = public.current_app_user_id()
        and reserved_by is null
        and reserved_until is null
      )
    )
  );

create or replace function public.protect_reviewer_row_update()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'reviewer' then
    if new.tasker_id is distinct from old.tasker_id
      or new.submitted_at is distinct from old.submitted_at
      or new.metadata is distinct from old.metadata
      or new.review_score is distinct from old.review_score then
      raise exception 'reviewers may only update review workflow fields';
    end if;

    if new.status = 'pending_review' then
      if new.reviewer_id is not null or new.reviewed_at is not null then
        raise exception 'pending rows cannot have completed review fields';
      end if;

      if new.reserved_by is not null and new.reserved_by is distinct from public.current_app_user_id() then
        raise exception 'reviewers may only reserve rows for themselves';
      end if;
    end if;

    if new.status in ('accepted_clean', 'rejected') then
      if old.status <> 'pending_review'
        or old.reserved_by is distinct from public.current_app_user_id()
        or old.reserved_until is null
        or old.reserved_until <= now() then
        raise exception 'review reservation is required before completing a row';
      end if;

      new.reviewer_id = public.current_app_user_id();
      new.reviewed_at = coalesce(new.reviewed_at, now());
      new.reserved_by = null;
      new.reserved_until = null;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.calculate_streak_snapshot(
  p_user_id uuid,
  p_include_pending boolean default false
)
returns table (
  current_streak_days int,
  longest_streak_days int,
  last_active_date date,
  streak_started_on date
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  active_day date;
  previous_day date;
  run_length int := 0;
  best_run int := 0;
  run_started_on date;
  run_last_active date;
  active_week int;
  available_freezes int;
  used_freezes int;
  used_freeze_weeks int[] := '{}';
begin
  if auth.role() not in ('admin', 'service_role')
    and p_user_id is distinct from public.current_app_user_id()
    and not (
      auth.role() = 'reviewer'
      and exists (
        select 1
        from public.rows r
        where r.tasker_id = p_user_id
          and (r.status = 'pending_review' or r.reviewer_id = public.current_app_user_id())
      )
    ) then
    raise exception 'not allowed to view streak snapshot';
  end if;

  for active_day in
    select distinct r.submitted_at::date
    from public.rows r
    where r.tasker_id = p_user_id
      and (
        r.status = 'accepted_clean'
        or (p_include_pending and r.status = 'pending_review')
      )
    order by 1
  loop
    if previous_day is null then
      run_length := 1;
      run_started_on := active_day;
    elsif previous_day = active_day - 1 then
      run_length := run_length + 1;
    else
      active_week := extract(week from active_day)::int;

      select count(*) into available_freezes
      from public.freeze_tokens
      where user_id = p_user_id
        and week_number = active_week;

      select count(*) into used_freezes
      from unnest(used_freeze_weeks) as used_week(week_number)
      where used_week.week_number = active_week;

      if available_freezes > used_freezes then
        used_freeze_weeks := array_append(used_freeze_weeks, active_week);
        run_length := run_length + 1;
      else
        run_length := 1;
        run_started_on := active_day;
      end if;
    end if;

    previous_day := active_day;
    run_last_active := active_day;
    best_run := greatest(best_run, run_length);
  end loop;

  return query select run_length, best_run, run_last_active, run_started_on;
end;
$$;

create or replace function public.recompute_user_streak(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.sprint_config%rowtype;
  active_day date;
  previous_day date;
  run_length int := 0;
  best_run int := 0;
  run_started_on date;
  run_last_active date;
  active_week int;
  freeze_id uuid;
  threshold int;
begin
  select * into cfg from public.sprint_config where id = 1;

  delete from public.earnings e
  using public.streak_bonus_awards sba
  where e.source = 'streak_bonus'
    and e.reference_id = sba.id
    and sba.user_id = p_user_id;

  delete from public.streak_bonus_awards
  where user_id = p_user_id;

  update public.freeze_tokens
  set used_at = null
  where user_id = p_user_id;

  for active_day in
    select distinct r.submitted_at::date
    from public.rows r
    where r.tasker_id = p_user_id
      and r.status = 'accepted_clean'
    order by 1
  loop
    if previous_day is null then
      run_length := 1;
      run_started_on := active_day;
    elsif previous_day = active_day - 1 then
      run_length := run_length + 1;
    else
      active_week := extract(week from active_day)::int;

      select id into freeze_id
      from public.freeze_tokens
      where user_id = p_user_id
        and week_number = active_week
        and used_at is null
      order by id
      limit 1
      for update;

      if freeze_id is not null then
        update public.freeze_tokens set used_at = now() where id = freeze_id;
        run_length := run_length + 1;
      else
        run_length := 1;
        run_started_on := active_day;
      end if;
    end if;

    previous_day := active_day;
    run_last_active := active_day;
    best_run := greatest(best_run, run_length);
    freeze_id := null;

    foreach threshold in array array[3, 5, 7] loop
      if run_length >= threshold then
        insert into public.streak_bonus_awards (user_id, threshold_days, streak_run_started_on)
        values (p_user_id, threshold, run_started_on)
        on conflict do nothing;

        insert into public.earnings (user_id, source, amount_cents, reference_id)
        select p_user_id, 'streak_bonus', public.streak_bonus_amount(threshold, cfg), sba.id
        from public.streak_bonus_awards sba
        where sba.user_id = p_user_id
          and sba.threshold_days = threshold
          and sba.streak_run_started_on = run_started_on
          and not exists (
            select 1 from public.earnings e
            where e.source = 'streak_bonus' and e.reference_id = sba.id
          );
      end if;
    end loop;
  end loop;

  if run_last_active is null then
    delete from public.streaks where user_id = p_user_id;
    return;
  end if;

  insert into public.streaks (user_id, current_streak_days, longest_streak_days, last_active_date, streak_started_on)
  values (p_user_id, run_length, best_run, run_last_active, run_started_on)
  on conflict (user_id) do update
  set current_streak_days = excluded.current_streak_days,
      longest_streak_days = excluded.longest_streak_days,
      last_active_date = excluded.last_active_date,
      streak_started_on = excluded.streak_started_on;
end;
$$;

create or replace function public.apply_acceptance_gamification(
  p_user_id uuid,
  p_row_id uuid,
  p_status text,
  p_submission_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.sprint_config%rowtype;
  accepted_count int;
  milestone_row public.milestones%rowtype;
  total_accepted int;
begin
  select * into cfg from public.sprint_config where id = 1;

  if p_status <> 'accepted_clean' then
    return;
  end if;

  insert into public.earnings (user_id, source, amount_cents, reference_id)
  values (p_user_id, 'quality_bonus', round(cfg.quality_base_clean_cents * cfg.quality_multiplier)::int, p_row_id)
  on conflict do nothing;

  perform public.recompute_user_streak(p_user_id);

  select count(*) into accepted_count
  from public.rows
  where tasker_id = p_user_id
    and status = 'accepted_clean';

  for milestone_row in
    select * from public.milestones where threshold_rows <= accepted_count
  loop
    insert into public.milestone_achievements (user_id, milestone_id)
    values (p_user_id, milestone_row.id)
    on conflict do nothing;
  end loop;

  if cfg.endgame_bounty_active
    and cfg.current_phase = 'finale'
    and p_submission_date between cfg.sprint_start_date and cfg.sprint_end_date then
    insert into public.earnings (user_id, source, amount_cents, reference_id)
    values (p_user_id, 'finale_bounty', cfg.endgame_bounty_amount_cents, p_row_id)
    on conflict do nothing;
  end if;

  select count(*) into total_accepted
  from public.rows
  where status = 'accepted_clean';

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
    and new.status in ('accepted_clean', 'rejected')
    and old.status not in ('accepted_clean', 'rejected') then
    if new.reviewed_at is null then
      update public.rows set reviewed_at = now() where id = new.id;
    end if;

    perform public.apply_acceptance_gamification(
      new.tasker_id,
      new.id,
      new.status,
      new.submitted_at::date
    );
  end if;

  return new;
end;
$$;

create or replace view public.leaderboard_volume_top5 as
select *
from (
  select
    rank() over (order by count(r.id) desc, min(u.created_at), u.id) as rank,
    u.id as user_id,
    coalesce(u.display_name, split_part(coalesce(u.email, 'Tasker'), '@', 1)) as display_name,
    count(r.id)::int as accepted_rows
  from public.users u
  join public.rows r on r.tasker_id = u.id and r.status = 'accepted_clean'
  where u.role = 'tasker'
  group by u.id, u.display_name, u.email
) ranked
where rank <= 5
order by rank;

drop view if exists public.leaderboard_quality_top5;

create or replace view public.leaderboard_quality_top5 as
select *
from (
  select
    rank() over (order by count(r.id) desc, min(u.created_at), u.id) as rank,
    u.id as user_id,
    coalesce(u.display_name, split_part(coalesce(u.email, 'Tasker'), '@', 1)) as display_name,
    count(r.id)::int as accepted_rows
  from public.users u
  join public.rows r on r.tasker_id = u.id and r.status = 'accepted_clean'
  where u.role = 'tasker'
  group by u.id, u.display_name, u.email
  having count(r.id) >= 5
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
  and r.status = 'accepted_clean'
group by g.id, g.name
order by rank;

do $$
declare
  affected_tasker uuid;
begin
  for affected_tasker in
    select distinct tasker_id
    from public.rows
    where status = 'accepted_clean'
  loop
    perform public.recompute_user_streak(affected_tasker);
  end loop;
end $$;

grant select on
  public.leaderboard_volume_top5,
  public.leaderboard_quality_top5,
  public.guild_standings_public
to authenticated;
