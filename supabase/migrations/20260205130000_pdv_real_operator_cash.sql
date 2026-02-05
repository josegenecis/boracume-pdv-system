alter table public.cash_register_sessions
  add column if not exists opened_by_waiter_id uuid references public.waiters(id),
  add column if not exists closed_by_waiter_id uuid references public.waiters(id);

alter table public.orders
  add column if not exists waiter_id uuid references public.waiters(id),
  add column if not exists cash_register_session_id uuid references public.cash_register_sessions(id);

create index if not exists orders_user_cash_session_idx
  on public.orders (user_id, cash_register_session_id);

create index if not exists orders_user_waiter_idx
  on public.orders (user_id, waiter_id);

with ranked as (
  select id,
         row_number() over (partition by user_id order by opened_at desc) as rn
  from public.cash_register_sessions
  where status = 'open'
)
update public.cash_register_sessions s
set status = 'closed',
    closed_at = coalesce(s.closed_at, now())
from ranked r
where s.id = r.id
  and r.rn > 1;

create unique index if not exists cash_register_sessions_one_open_per_user
  on public.cash_register_sessions (user_id)
  where status = 'open';
