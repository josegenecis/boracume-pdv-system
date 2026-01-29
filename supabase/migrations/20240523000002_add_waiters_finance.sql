-- Table: waiters
create table if not exists public.waiters (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users on delete cascade not null,
    name text not null,
    pin text not null, -- Simple 4-6 digit PIN for quick login
    active boolean default true,
    created_at timestamp with time zone default now()
);

alter table public.waiters enable row level security;

create policy "Users can manage their own waiters"
    on public.waiters for all
    using (auth.uid() = user_id);

-- Table: expenses
create table if not exists public.expenses (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users on delete cascade not null,
    description text not null,
    amount decimal(10,2) not null,
    category text,
    date date default current_date,
    created_at timestamp with time zone default now()
);

alter table public.expenses enable row level security;

create policy "Users can manage their own expenses"
    on public.expenses for all
    using (auth.uid() = user_id);

-- Table: cash_register_sessions
create table if not exists public.cash_register_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users on delete cascade not null,
    opened_at timestamp with time zone default now(),
    closed_at timestamp with time zone,
    initial_amount decimal(10,2) not null default 0,
    final_amount decimal(10,2),
    expected_amount decimal(10,2), -- Calculated from system sales
    status text default 'open', -- 'open', 'closed'
    notes text
);

alter table public.cash_register_sessions enable row level security;

create policy "Users can manage their own cash sessions"
    on public.cash_register_sessions for all
    using (auth.uid() = user_id);

-- Table: cash_movements
create table if not exists public.cash_movements (
    id uuid primary key default gen_random_uuid(),
    session_id uuid references public.cash_register_sessions on delete cascade not null,
    user_id uuid references auth.users on delete cascade not null,
    type text not null, -- 'in' (suprimento), 'out' (sangria)
    amount decimal(10,2) not null,
    description text,
    created_at timestamp with time zone default now()
);

alter table public.cash_movements enable row level security;

create policy "Users can manage their own cash movements"
    on public.cash_movements for all
    using (auth.uid() = user_id);
