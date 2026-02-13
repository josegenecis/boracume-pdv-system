alter table public.waiters
add column if not exists email text,
add column if not exists password text;
