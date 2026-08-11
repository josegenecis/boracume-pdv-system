alter table public.whatsapp_conversations
  add column if not exists queue_status text not null default 'new',
  add column if not exists assigned_operator_id text,
  add column if not exists assigned_operator_name text,
  add column if not exists assigned_at timestamptz,
  add column if not exists first_response_at timestamptz,
  add column if not exists resolved_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'whatsapp_conversations_queue_status_check'
      and conrelid = 'public.whatsapp_conversations'::regclass
  ) then
    alter table public.whatsapp_conversations
      add constraint whatsapp_conversations_queue_status_check
      check (queue_status in ('new', 'assigned', 'waiting_customer', 'resolved'));
  end if;
end $$;

update public.whatsapp_conversations
set queue_status = case when unread_count > 0 then 'new' else 'resolved' end
where queue_status = 'new' and assigned_at is null;

create index if not exists whatsapp_conversations_service_queue_idx
  on public.whatsapp_conversations (user_id, queue_status, last_customer_message_at desc);

create or replace function public.increment_whatsapp_conversation_unread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sender = 'customer' and coalesce(new.message_type, 'text') <> 'order_draft' then
    update public.whatsapp_conversations
       set unread_count = coalesce(unread_count, 0) + 1,
           last_customer_message_at = new.sent_at,
           queue_status = case when assigned_operator_id is null then 'new' else 'assigned' end,
           resolved_at = null,
           updated_at = greatest(coalesce(updated_at, new.sent_at), new.sent_at)
     where id = new.conversation_id;
  elsif new.sender = 'agent' then
    update public.whatsapp_conversations
       set unread_count = 0,
           first_response_at = coalesce(first_response_at, new.sent_at),
           queue_status = 'waiting_customer',
           updated_at = greatest(coalesce(updated_at, new.sent_at), new.sent_at)
     where id = new.conversation_id;
  end if;
  return new;
end;
$$;

comment on column public.whatsapp_conversations.queue_status is
  'Fila operacional: new, assigned, waiting_customer ou resolved.';
