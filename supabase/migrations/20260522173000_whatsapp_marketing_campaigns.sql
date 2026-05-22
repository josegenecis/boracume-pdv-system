create table if not exists public.whatsapp_marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled')),
  risk_acknowledged boolean not null default false,
  active_conversations_only boolean not null default true,
  opt_out_text text not null default 'Responder SAIR para não receber novas ofertas.',
  audience_type text not null default 'active_conversations',
  daily_limit integer not null default 40 check (daily_limit between 1 and 200),
  min_delay_seconds integer not null default 180 check (min_delay_seconds between 60 and 86400),
  max_delay_seconds integer not null default 720 check (max_delay_seconds between 60 and 86400),
  quiet_hours_start time not null default '21:00',
  quiet_hours_end time not null default '09:00',
  timezone text not null default 'America/Fortaleza',
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  target_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_marketing_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.whatsapp_marketing_campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.whatsapp_conversations(id) on delete set null,
  customer_phone text not null,
  customer_name text,
  message_text text not null,
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'skipped', 'cancelled', 'opted_out')),
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  last_error text,
  attempt_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, conversation_id)
);

create table if not exists public.whatsapp_marketing_optouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_phone text not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (user_id, customer_phone)
);

create table if not exists public.whatsapp_marketing_safety_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid references public.whatsapp_marketing_campaigns(id) on delete set null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_marketing_campaigns_user_status_idx
  on public.whatsapp_marketing_campaigns(user_id, status, scheduled_at desc);

create index if not exists whatsapp_marketing_recipients_due_idx
  on public.whatsapp_marketing_recipients(user_id, status, scheduled_at);

create index if not exists whatsapp_marketing_recipients_phone_idx
  on public.whatsapp_marketing_recipients(user_id, customer_phone, sent_at desc);

create index if not exists whatsapp_marketing_optouts_phone_idx
  on public.whatsapp_marketing_optouts(user_id, customer_phone);

alter table public.whatsapp_marketing_campaigns enable row level security;
alter table public.whatsapp_marketing_recipients enable row level security;
alter table public.whatsapp_marketing_optouts enable row level security;
alter table public.whatsapp_marketing_safety_events enable row level security;

create policy "Users can manage their own whatsapp marketing campaigns"
  on public.whatsapp_marketing_campaigns
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their own whatsapp marketing recipients"
  on public.whatsapp_marketing_recipients
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their own whatsapp marketing optouts"
  on public.whatsapp_marketing_optouts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can view their own whatsapp marketing safety events"
  on public.whatsapp_marketing_safety_events
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own whatsapp marketing safety events"
  on public.whatsapp_marketing_safety_events
  for insert
  with check (auth.uid() = user_id);

drop trigger if exists update_whatsapp_marketing_campaigns_updated_at on public.whatsapp_marketing_campaigns;
create trigger update_whatsapp_marketing_campaigns_updated_at
  before update on public.whatsapp_marketing_campaigns
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_whatsapp_marketing_recipients_updated_at on public.whatsapp_marketing_recipients;
create trigger update_whatsapp_marketing_recipients_updated_at
  before update on public.whatsapp_marketing_recipients
  for each row execute function public.update_updated_at_column();
