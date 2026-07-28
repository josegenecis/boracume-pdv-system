-- Protege tabelas internas expostas pela Data API sem interromper Edge Functions.

alter table public.notification_queue enable row level security;
alter table public.asaas_webhook_events enable row level security;
alter table public.push_subscriptions enable row level security;

revoke all on table public.notification_queue from public, anon, authenticated;
revoke all on table public.asaas_webhook_events from public, anon, authenticated;
revoke all on table public.push_subscriptions from public, anon, authenticated;

grant select, insert, update, delete on table public.notification_queue to service_role;
grant select, insert, update, delete on table public.asaas_webhook_events to service_role;
grant select, insert, update, delete on table public.push_subscriptions to service_role;

drop policy if exists "Users can insert their own subscriptions" on public.push_subscriptions;
drop policy if exists "Users can view their own subscriptions" on public.push_subscriptions;
drop policy if exists "Users can update their own subscriptions" on public.push_subscriptions;
drop policy if exists "Users can delete their own subscriptions" on public.push_subscriptions;
drop policy if exists "Service role can do everything" on public.push_subscriptions;
drop policy if exists push_subscriptions_insert on public.push_subscriptions;
drop policy if exists push_subscriptions_select on public.push_subscriptions;

create policy push_subscriptions_owner_select
  on public.push_subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy push_subscriptions_owner_insert
  on public.push_subscriptions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy push_subscriptions_owner_update
  on public.push_subscriptions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy push_subscriptions_owner_delete
  on public.push_subscriptions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on table public.push_subscriptions to authenticated;

alter view public.restaurant_tables set (security_invoker = true);
revoke all on table public.restaurant_tables from public, anon, authenticated;
grant select on table public.restaurant_tables to authenticated, service_role;
