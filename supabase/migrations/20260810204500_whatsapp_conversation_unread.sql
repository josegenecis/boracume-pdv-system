alter table public.whatsapp_conversations
  add column if not exists unread_count integer not null default 0,
  add column if not exists last_read_at timestamptz;

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
           updated_at = greatest(coalesce(updated_at, new.sent_at), new.sent_at)
     where id = new.conversation_id;
  end if;
  return new;
end;
$$;

drop trigger if exists whatsapp_message_increment_unread on public.whatsapp_messages;
create trigger whatsapp_message_increment_unread
after insert on public.whatsapp_messages
for each row execute function public.increment_whatsapp_conversation_unread();

comment on column public.whatsapp_conversations.unread_count is
  'Quantidade de mensagens do cliente ainda não abertas por um operador.';

