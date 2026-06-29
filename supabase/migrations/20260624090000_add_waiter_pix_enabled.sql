alter table public.pix_settings
add column if not exists mp_waiter_enabled boolean not null default false;
