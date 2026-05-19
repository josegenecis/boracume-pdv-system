alter table if exists public.whatsapp_conversations
  add column if not exists bot_paused boolean not null default false,
  add column if not exists bot_paused_at timestamp with time zone,
  add column if not exists bot_paused_by uuid references auth.users(id) on delete set null;

comment on column public.whatsapp_conversations.bot_paused is
  'When true, incoming customer messages are stored but the automatic WhatsApp bot does not reply.';
