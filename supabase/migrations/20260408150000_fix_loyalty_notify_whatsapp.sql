alter table if exists public.loyalty_programs
add column if not exists notify_whatsapp boolean not null default false;
