-- POP AI - Atendente Virtual Inteligente

create table if not exists public.ai_settings (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  assistant_name text not null default 'POP AI',
  tone text not null default 'simples',
  welcome_message text,
  out_of_hours_message text,
  human_transfer_message text not null default 'Vou chamar alguém da equipe para te ajudar.',
  upsell_enabled boolean not null default true,
  max_history_messages integer not null default 30 check (max_history_messages between 10 and 80),
  forbidden_responses text[] not null default '{}',
  specific_rules text,
  ai_hours jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id)
);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  phone text not null,
  status text not null default 'ai_active' check (status in (
    'ai_active',
    'human_required',
    'human_active',
    'waiting_customer',
    'waiting_payment',
    'order_confirmed',
    'closed'
  )),
  assigned_to uuid references auth.users(id) on delete set null,
  ai_enabled boolean not null default true,
  last_message_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, phone)
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  message text not null,
  channel text not null default 'whatsapp',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  action text not null,
  input jsonb,
  output jsonb,
  error text,
  created_at timestamptz not null default now()
);

alter table if exists public.customers
  add column if not exists last_interaction_at timestamptz,
  add column if not exists total_orders integer not null default 0,
  add column if not exists average_ticket numeric(12,2) not null default 0,
  add column if not exists last_order_at timestamptz,
  add column if not exists last_order_id uuid,
  add column if not exists preferences jsonb not null default '{}'::jsonb,
  add column if not exists tags text[] not null default '{}';

alter table if exists public.whatsapp_conversations
  add column if not exists ai_conversation_id uuid references public.ai_conversations(id) on delete set null,
  add column if not exists ai_status text not null default 'ai_active',
  add column if not exists human_required boolean not null default false,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists ai_conversations_restaurant_status_idx
  on public.ai_conversations (restaurant_id, status, last_message_at desc);

create index if not exists ai_messages_conversation_created_idx
  on public.ai_messages (conversation_id, created_at desc);

create index if not exists ai_logs_restaurant_created_idx
  on public.ai_logs (restaurant_id, created_at desc);

create index if not exists customers_last_interaction_idx
  on public.customers (user_id, last_interaction_at desc);

alter table public.ai_settings enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_logs enable row level security;

drop policy if exists "Restaurant can manage ai settings" on public.ai_settings;
create policy "Restaurant can manage ai settings"
  on public.ai_settings
  for all
  using (auth.uid() = restaurant_id)
  with check (auth.uid() = restaurant_id);

drop policy if exists "Restaurant can manage ai conversations" on public.ai_conversations;
create policy "Restaurant can manage ai conversations"
  on public.ai_conversations
  for all
  using (auth.uid() = restaurant_id)
  with check (auth.uid() = restaurant_id);

drop policy if exists "Restaurant can manage ai messages" on public.ai_messages;
create policy "Restaurant can manage ai messages"
  on public.ai_messages
  for all
  using (auth.uid() = restaurant_id)
  with check (auth.uid() = restaurant_id);

drop policy if exists "Restaurant can read ai logs" on public.ai_logs;
create policy "Restaurant can read ai logs"
  on public.ai_logs
  for select
  using (auth.uid() = restaurant_id);

drop policy if exists "Restaurant can insert ai logs" on public.ai_logs;
create policy "Restaurant can insert ai logs"
  on public.ai_logs
  for insert
  with check (auth.uid() = restaurant_id);

drop trigger if exists update_ai_settings_updated_at on public.ai_settings;
create trigger update_ai_settings_updated_at
  before update on public.ai_settings
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_ai_conversations_updated_at on public.ai_conversations;
create trigger update_ai_conversations_updated_at
  before update on public.ai_conversations
  for each row execute function public.update_updated_at_column();
