create table if not exists public.print_agent_pairings (
  id uuid primary key default gen_random_uuid(),
  pairing_code text not null unique,
  restaurant_user_id uuid references auth.users(id) on delete set null,
  token_plain text,
  claimed_at timestamptz,
  delivered_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists print_agent_pairings_expires_idx
  on public.print_agent_pairings (expires_at desc);

alter table public.print_agent_pairings enable row level security;
