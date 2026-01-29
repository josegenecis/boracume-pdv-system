alter table public.pix_settings add column if not exists enabled boolean not null default false;
alter table public.pix_settings add column if not exists merchant_name text;
alter table public.pix_settings add column if not exists merchant_city text;
alter table public.pix_settings add column if not exists webhook_secret text;

-- Remove legacy column if present
alter table public.pix_settings drop column if exists webhook_url;
