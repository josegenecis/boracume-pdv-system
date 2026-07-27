-- Configuracao visual e campanhas exclusivas do Totem.
-- O cardapio digital continua usando promotional_banners e theme_config.

create table if not exists public.totem_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  primary_color text not null default '#EF6C20',
  secondary_color text not null default '#073A2D',
  accent_color text not null default '#85C441',
  background_color text not null default '#FBF7EF',
  surface_color text not null default '#FFFFFF',
  text_color text not null default '#1C1917',
  button_text_color text not null default '#FFFFFF',
  idle_overlay_color text not null default '#05271F',
  cta_text text not null default 'Toque para pedir',
  banner_interval_seconds integer not null default 7
    check (banner_interval_seconds between 4 and 30),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.totem_banners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  description text,
  media_url text not null,
  orientation text not null default 'both'
    check (orientation in ('both', 'portrait', 'landscape')),
  active boolean not null default true,
  display_order integer not null default 0,
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists totem_banners_user_active_order_idx
  on public.totem_banners (user_id, active, display_order);

alter table public.totem_settings enable row level security;
alter table public.totem_banners enable row level security;

drop policy if exists "Public can read totem settings" on public.totem_settings;
create policy "Public can read totem settings"
  on public.totem_settings for select
  to public
  using (true);

drop policy if exists "Users can manage own totem settings" on public.totem_settings;
create policy "Users can manage own totem settings"
  on public.totem_settings for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Public can read active totem banners" on public.totem_banners;
create policy "Public can read active totem banners"
  on public.totem_banners for select
  to public
  using (
    active = true
    and (start_date is null or start_date <= now())
    and (end_date is null or end_date >= now())
  );

drop policy if exists "Users can read own totem banners" on public.totem_banners;
create policy "Users can read own totem banners"
  on public.totem_banners for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can manage own totem banners" on public.totem_banners;
create policy "Users can manage own totem banners"
  on public.totem_banners for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_totem_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_totem_settings_updated_at on public.totem_settings;
create trigger set_totem_settings_updated_at
before update on public.totem_settings
for each row execute function public.set_totem_updated_at();

drop trigger if exists set_totem_banners_updated_at on public.totem_banners;
create trigger set_totem_banners_updated_at
before update on public.totem_banners
for each row execute function public.set_totem_updated_at();

