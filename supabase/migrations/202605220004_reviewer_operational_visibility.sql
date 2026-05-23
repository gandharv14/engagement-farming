drop policy if exists users_self_or_admin_read on public.users;
create policy users_self_or_admin_read on public.users
  for select using (
    auth0_sub = auth.jwt() ->> 'sub'
    or auth.role() in ('admin', 'reviewer')
  );

drop policy if exists rows_read_by_role on public.rows;
create policy rows_read_by_role on public.rows
  for select using (
    auth.role() = 'admin'
    or (auth.role() = 'tasker' and tasker_id = public.current_app_user_id())
    or (
      auth.role() = 'reviewer'
      and (
        status = 'pending_review'
        or status in ('accepted_clean', 'rejected')
        or reserved_by = public.current_app_user_id()
      )
    )
  );

drop policy if exists row_reviews_reviewer_or_admin_read on public.row_reviews;
create policy row_reviews_reviewer_or_admin_read on public.row_reviews
  for select using (auth.role() in ('admin', 'reviewer'));
