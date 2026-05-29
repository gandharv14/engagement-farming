-- Allow reviewers to revise a completed decision (pass <-> fail) from the
-- reviewed queue, reversing or re-applying gamification side effects.

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
      -- Reviewers can revise any already-decided row from the reviewed queue.
      or status in ('accepted_clean', 'rejected')
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

-- Permit terminal -> terminal transitions for reviewers (revisions) while still
-- requiring an active reservation for the first decision on a pending row.
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
      if old.status = 'pending_review' then
        if old.reserved_by is distinct from public.current_app_user_id()
          or old.reserved_until is null
          or old.reserved_until <= now() then
          raise exception 'review reservation is required before completing a row';
        end if;
      elsif old.status not in ('accepted_clean', 'rejected') then
        raise exception 'invalid review status transition';
      end if;

      new.reviewer_id = public.current_app_user_id();
      new.reviewed_at = now();
      new.reserved_by = null;
      new.reserved_until = null;
    end if;
  end if;

  return new;
end;
$$;

-- Reverse the acceptance side effects when a passing row is flipped to failed.
create or replace function public.revoke_acceptance_gamification(
  p_user_id uuid,
  p_row_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  accepted_count int;
begin
  delete from public.earnings
  where reference_id = p_row_id
    and source in ('quality_bonus', 'finale_bounty');

  -- Recompute streaks and streak bonuses from the remaining accepted rows.
  perform public.recompute_user_streak(p_user_id);

  select count(*) into accepted_count
  from public.rows
  where tasker_id = p_user_id
    and status = 'accepted_clean';

  -- Revoke milestone achievements that are no longer earned. Fulfilled goodies
  -- are left untouched so already-shipped rewards are never clawed back.
  delete from public.milestone_achievements
  where user_id = p_user_id
    and fulfilled_at is null
    and milestone_id in (
      select id from public.milestones where threshold_rows > accepted_count
    );
end;
$$;

-- Extend the status transition handler to cover revisions of completed rows.
create or replace function public.handle_row_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if new.status in ('accepted_clean', 'rejected')
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
    elsif old.status = 'accepted_clean' and new.status = 'rejected' then
      perform public.revoke_acceptance_gamification(new.tasker_id, new.id);
    elsif old.status = 'rejected' and new.status = 'accepted_clean' then
      perform public.apply_acceptance_gamification(
        new.tasker_id,
        new.id,
        new.status,
        new.submitted_at::date
      );
    end if;
  end if;

  return new;
end;
$$;
