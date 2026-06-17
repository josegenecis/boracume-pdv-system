create table if not exists public.table_order_flow_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  table_order_mode text not null default 'marked_items',
  show_table_orders_in_manager boolean not null default true,
  auto_accept_table_orders boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint table_order_flow_mode_check
    check (table_order_mode in ('marked_items', 'all_items', 'account_only'))
);

alter table public.table_order_flow_settings enable row level security;

drop policy if exists table_order_flow_settings_owner_all on public.table_order_flow_settings;
create policy table_order_flow_settings_owner_all
  on public.table_order_flow_settings
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.touch_table_order_flow_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_table_order_flow_settings on public.table_order_flow_settings;
create trigger trg_touch_table_order_flow_settings
  before update on public.table_order_flow_settings
  for each row
  execute function public.touch_table_order_flow_settings_updated_at();
