create table if not exists public.whatsapp_notification_logs (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  event_type text not null,
  recipient_phone text,
  success boolean not null default false,
  skipped boolean not null default false,
  provider_status integer,
  provider_error text,
  provider_transport text,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_notification_logs_restaurant_created_idx
  on public.whatsapp_notification_logs(restaurant_id, created_at desc);
create index if not exists whatsapp_notification_logs_order_created_idx
  on public.whatsapp_notification_logs(order_id, created_at desc);

alter table public.whatsapp_notification_logs enable row level security;

drop policy if exists whatsapp_notification_logs_owner_select on public.whatsapp_notification_logs;
create policy whatsapp_notification_logs_owner_select on public.whatsapp_notification_logs
  for select to authenticated using (auth.uid() = restaurant_id);
