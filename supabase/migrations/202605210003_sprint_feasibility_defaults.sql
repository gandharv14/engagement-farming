update public.milestones
set threshold_rows = 24
where id = 3
  and tier_label = 'Tier 3'
  and threshold_rows > 24;
