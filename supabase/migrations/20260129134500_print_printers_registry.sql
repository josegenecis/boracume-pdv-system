alter table public.print_agent_tokens
  add column if not exists last_seen timestamptz;

create table if not exists public.print_agent_printers (
  agent_id uuid not null references public.print_agent_tokens(id) on delete cascade,
  restaurant_user_id uuid not null references auth.users(id) on delete cascade,
  printer_id text not null,
  name text not null,
  transport text not null,
  address text,
  meta jsonb,
  updated_at timestamptz not null default now(),
  primary key (agent_id, printer_id)
);

create index if not exists print_agent_printers_restaurant_updated_idx
  on public.print_agent_printers (restaurant_user_id, updated_at desc);

alter table public.print_agent_printers enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'print_agent_printers'
      and policyname = 'Users can view their print agent printers'
  ) then
    create policy "Users can view their print agent printers"
      on public.print_agent_printers
      for select
      using (auth.uid() = restaurant_user_id);
  end if;
end $$;
