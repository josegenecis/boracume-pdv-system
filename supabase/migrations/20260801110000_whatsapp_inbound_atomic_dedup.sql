create table if not exists public.whatsapp_inbound_dedup (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null,
  event_key text not null unique,
  fingerprint text not null,
  provider_message_id text,
  instance_name text,
  customer_phone text not null,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_inbound_dedup_fingerprint_idx
  on public.whatsapp_inbound_dedup (restaurant_id, fingerprint, created_at desc);

create index if not exists whatsapp_inbound_dedup_created_at_idx
  on public.whatsapp_inbound_dedup (created_at);

alter table public.whatsapp_inbound_dedup enable row level security;
revoke all on table public.whatsapp_inbound_dedup from anon, authenticated;

create or replace function public.claim_whatsapp_inbound_message(
  p_restaurant_id uuid,
  p_customer_phone text,
  p_content text,
  p_provider_message_id text default null,
  p_instance_name text default null,
  p_window_seconds integer default 30
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone text := regexp_replace(coalesce(p_customer_phone, ''), '\D', '', 'g');
  v_content text := lower(trim(regexp_replace(coalesce(p_content, ''), '\s+', ' ', 'g')));
  v_provider_id text := nullif(trim(coalesce(p_provider_message_id, '')), '');
  v_fingerprint text;
  v_event_key text;
begin
  if p_restaurant_id is null or v_phone = '' or v_content = '' then
    return false;
  end if;

  v_fingerprint := md5(p_restaurant_id::text || '|' || v_phone || '|' || v_content);

  -- Serialize simultaneous deliveries of the same logical inbound message.
  perform pg_advisory_xact_lock(hashtext(v_fingerprint));

  if v_provider_id is not null then
    v_event_key := md5(p_restaurant_id::text || '|provider|' || v_provider_id);
    if exists (
      select 1 from public.whatsapp_inbound_dedup where event_key = v_event_key
    ) then
      return false;
    end if;
  end if;

  if exists (
    select 1
      from public.whatsapp_inbound_dedup
     where restaurant_id = p_restaurant_id
       and fingerprint = v_fingerprint
       and created_at >= now() - make_interval(secs => greatest(coalesce(p_window_seconds, 30), 1))
  ) then
    return false;
  end if;

  if v_event_key is null then
    v_event_key := md5(v_fingerprint || '|' || clock_timestamp()::text || '|' || random()::text);
  end if;

  insert into public.whatsapp_inbound_dedup (
    restaurant_id,
    event_key,
    fingerprint,
    provider_message_id,
    instance_name,
    customer_phone
  ) values (
    p_restaurant_id,
    v_event_key,
    v_fingerprint,
    v_provider_id,
    nullif(trim(coalesce(p_instance_name, '')), ''),
    v_phone
  );

  return true;
exception
  when unique_violation then
    return false;
end;
$$;

revoke all on function public.claim_whatsapp_inbound_message(uuid, text, text, text, text, integer) from public;
grant execute on function public.claim_whatsapp_inbound_message(uuid, text, text, text, text, integer) to service_role;

comment on function public.claim_whatsapp_inbound_message(uuid, text, text, text, text, integer)
  is 'Atomically reserves an inbound WhatsApp message and rejects duplicate provider deliveries.';
