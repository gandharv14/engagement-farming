alter table public.sprint_config
  drop constraint if exists sprint_config_current_phase_check;

alter table public.sprint_config
  add constraint sprint_config_current_phase_check
  check (current_phase in ('warmup', 'steady', 'finale', 'ended'));

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
  least(
    greatest(1, (current_date - sprint_start_date + 1)),
    greatest(1, (sprint_end_date - sprint_start_date + 1))
  )::int as current_sprint_day,
  greatest(1, (sprint_end_date - sprint_start_date + 1))::int as total_sprint_days,
  (current_phase = 'ended' or current_date > sprint_end_date) as sprint_has_ended,
  (current_phase <> 'ended' and current_date <= sprint_end_date) as accepting_submissions
from public.sprint_config
where id = 1;

update public.sprint_config
set sprint_start_date = least(sprint_start_date, date '2026-06-05'),
    sprint_end_date = date '2026-06-05',
    current_phase = case when current_phase = 'ended' then 'ended' else 'finale' end
where id = 1;

grant select on public.sprint_public_config to anon, authenticated;
