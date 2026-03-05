create table if not exists public.ifood_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid null references auth.users(id) on delete set null,
  merchant_id text null,
  event_type text null,
  payload jsonb not null default '{}'::jsonb,
  headers jsonb not null default '{}'::jsonb
);

create index if not exists ifood_events_user_id_idx on public.ifood_events(user_id);
create index if not exists ifood_events_merchant_id_idx on public.ifood_events(merchant_id);
create index if not exists ifood_events_created_at_idx on public.ifood_events(created_at desc);

alter table public.ifood_events enable row level security;

drop policy if exists "ifood_events_select_own" on public.ifood_events;
create policy "ifood_events_select_own"
on public.ifood_events
for select
to authenticated
using (user_id = auth.uid());

