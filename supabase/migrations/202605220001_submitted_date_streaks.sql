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
        r.status in ('accepted_clean', 'accepted_with_edits')
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
      and r.status in ('accepted_clean', 'accepted_with_edits')
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

drop function if exists public.apply_acceptance_gamification(uuid, uuid, text, date);

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

  perform public.recompute_user_streak(p_user_id);

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
    and p_submission_date between cfg.sprint_start_date and cfg.sprint_end_date then
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
      new.submitted_at::date
    );
  end if;

  return new;
end;
$$;

do $$
declare
  affected_tasker uuid;
begin
  for affected_tasker in
    select distinct tasker_id
    from public.rows
    where status in ('accepted_clean', 'accepted_with_edits')
  loop
    perform public.recompute_user_streak(affected_tasker);
  end loop;
end $$;
