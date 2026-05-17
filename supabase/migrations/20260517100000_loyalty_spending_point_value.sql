alter table if exists public.loyalty_programs
  add column if not exists point_value numeric(10,2);

comment on column public.loyalty_programs.point_value is
  'For spending loyalty rules: purchase amount required to earn one star/point. goal_value remains the total accumulated amount required to issue the reward.';
