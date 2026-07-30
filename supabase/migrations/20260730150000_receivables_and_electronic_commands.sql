-- Contas a receber gerais e comandas eletrônicas reutilizáveis.
-- Mantém staff_consumptions por compatibilidade, mas permite registrar qualquer
-- pessoa/empresa que pagará depois e vendas originadas no PDV.

create table if not exists public.receivable_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  contact_type text not null default 'customer'
    check (contact_type in ('employee', 'customer', 'supplier', 'other')),
  document text,
  phone text,
  notes text,
  waiter_id uuid references public.waiters(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_receivable_contacts_user_active_name
  on public.receivable_contacts(user_id, active, name);

alter table public.receivable_contacts enable row level security;

drop policy if exists "Users manage own receivable contacts" on public.receivable_contacts;
create policy "Users manage own receivable contacts"
  on public.receivable_contacts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.receivable_contacts to authenticated;

alter table public.staff_consumptions
  add column if not exists contact_id uuid references public.receivable_contacts(id) on delete set null,
  add column if not exists debtor_type text not null default 'employee',
  add column if not exists source_order_id uuid references public.orders(id) on delete set null,
  add column if not exists source_type text not null default 'table';

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'staff_consumptions_debtor_type_check'
  ) then
    alter table public.staff_consumptions
      add constraint staff_consumptions_debtor_type_check
      check (debtor_type in ('employee', 'customer', 'supplier', 'other'));
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conname = 'staff_consumptions_source_type_check'
  ) then
    alter table public.staff_consumptions
      add constraint staff_consumptions_source_type_check
      check (source_type in ('table', 'pdv', 'manual'));
  end if;
end
$$;

create unique index if not exists idx_staff_consumptions_source_order
  on public.staff_consumptions(source_order_id)
  where source_order_id is not null and status <> 'cancelled';

create or replace function public.register_pdv_receivable(
  p_order_id uuid,
  p_contact_id uuid,
  p_due_date date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_contact public.receivable_contacts%rowtype;
  v_receivable_id uuid;
begin
  select *
    into v_order
    from public.orders
   where id = p_order_id
     and user_id = auth.uid()
   for update;

  if not found then
    raise exception 'Venda não encontrada para registrar a conta a receber.';
  end if;

  select *
    into v_contact
    from public.receivable_contacts
   where id = p_contact_id
     and user_id = auth.uid()
     and active = true;

  if not found then
    raise exception 'Selecione um cadastro ativo para pagar depois.';
  end if;

  insert into public.staff_consumptions (
    user_id,
    employee_name,
    contact_id,
    debtor_type,
    source_order_id,
    source_type,
    items,
    amount,
    due_date,
    notes,
    created_by
  ) values (
    v_order.user_id,
    v_contact.name,
    v_contact.id,
    v_contact.contact_type,
    v_order.id,
    'pdv',
    coalesce(v_order.items, '[]'::jsonb),
    coalesce(v_order.total, 0),
    p_due_date,
    nullif(trim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  returning id into v_receivable_id;

  return v_receivable_id;
end;
$$;

grant execute on function public.register_pdv_receivable(uuid, uuid, date, text) to authenticated;

-- Uma comanda física é permanente e reutilizável. O vínculo com a conta atual
-- muda a cada atendimento, sem apagar os atendimentos anteriores.
create table if not exists public.electronic_commands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  label text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, code)
);

create index if not exists idx_electronic_commands_user_active
  on public.electronic_commands(user_id, active, code);

alter table public.electronic_commands enable row level security;

drop policy if exists "Users manage own electronic commands" on public.electronic_commands;
create policy "Users manage own electronic commands"
  on public.electronic_commands
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.electronic_commands to authenticated;

alter table public.table_accounts
  add column if not exists electronic_command_id uuid
    references public.electronic_commands(id) on delete set null;

create index if not exists idx_table_accounts_electronic_command
  on public.table_accounts(electronic_command_id, status, opened_at desc)
  where electronic_command_id is not null;

create unique index if not exists idx_table_accounts_one_open_electronic_command
  on public.table_accounts(electronic_command_id)
  where electronic_command_id is not null
    and closed_at is null
    and status in ('open', 'payment_pending');

create or replace function public.lookup_electronic_command(p_code text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_code text;
  v_command public.electronic_commands%rowtype;
  v_account public.table_accounts%rowtype;
  v_session public.table_sessions%rowtype;
  v_table public.tables%rowtype;
  v_paid numeric(12,2);
  v_items jsonb;
begin
  v_code := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9_-]', '', 'g'));
  if v_code = '' then
    raise exception 'Leia ou informe o código da comanda.';
  end if;

  select *
    into v_command
    from public.electronic_commands
   where user_id = auth.uid()
     and upper(regexp_replace(code, '[^A-Za-z0-9_-]', '', 'g')) = v_code
     and active = true;

  if not found then
    return jsonb_build_object('found', false, 'code', v_code);
  end if;

  select *
    into v_account
    from public.table_accounts
   where user_id = auth.uid()
     and electronic_command_id = v_command.id
     and closed_at is null
     and status in ('open', 'payment_pending')
   order by opened_at desc
   limit 1;

  if not found then
    return jsonb_build_object(
      'found', true,
      'occupied', false,
      'commandId', v_command.id,
      'code', v_command.code,
      'label', v_command.label
    );
  end if;

  select * into v_session from public.table_sessions where id = v_account.session_id;
  select * into v_table from public.tables where id = v_session.table_id;

  select coalesce(sum(amount), 0)
    into v_paid
    from public.payments
   where account_id = v_account.id
     and coalesce(status, 'completed') not in ('cancelled', 'refunded', 'failed');

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', oi.id,
      'name', oi.product_name,
      'quantity', oi.quantity,
      'unitPrice', oi.unit_price,
      'total', (oi.quantity * oi.unit_price),
      'status', oi.status,
      'notes', oi.notes,
      'options', coalesce((
        select jsonb_agg(jsonb_build_object(
          'name', oio.option_name,
          'quantity', oio.quantity,
          'price', oio.price
        ) order by oio.created_at)
        from public.order_item_options oio
        where oio.order_item_id = oi.id
      ), '[]'::jsonb)
    ) order by oi.created_at
  ), '[]'::jsonb)
    into v_items
    from public.order_items oi
   where oi.account_id = v_account.id
     and oi.status <> 'cancelled';

  return jsonb_build_object(
    'found', true,
    'occupied', true,
    'commandId', v_command.id,
    'code', v_command.code,
    'label', v_command.label,
    'accountId', v_account.id,
    'accountName', v_account.name,
    'accountNumber', v_account.account_number,
    'sessionId', v_session.id,
    'tableId', v_table.id,
    'tableNumber', v_table.table_number,
    'total', coalesce(v_account.total, 0),
    'paidTotal', coalesce(v_paid, 0),
    'dueAmount', greatest(coalesce(v_account.total, 0) - coalesce(v_paid, 0), 0),
    'items', v_items
  );
end;
$$;

grant execute on function public.lookup_electronic_command(text) to authenticated;
