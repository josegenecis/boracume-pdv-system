-- Completa a reorganização financeira sem duplicar entidades já existentes.
-- expenses continua sendo a obrigação; orders/staff_consumptions continuam sendo
-- a origem operacional dos recebíveis; smart_invoice_imports continua vinculando
-- nota, conta a pagar e estoque em uma única transação.

create table if not exists public.financial_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category_type text not null default 'payable' check (category_type in ('payable', 'receivable', 'both')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create unique index if not exists financial_categories_user_name_type_uidx
  on public.financial_categories(user_id, lower(name), category_type);
create index if not exists financial_categories_user_active_idx
  on public.financial_categories(user_id, is_active, name);

alter table public.financial_categories enable row level security;
drop policy if exists financial_categories_store_access on public.financial_categories;
create policy financial_categories_store_access on public.financial_categories
  for all to authenticated
  using (public.can_access_store(user_id))
  with check (public.can_access_store(user_id));
grant select, insert, update on public.financial_categories to authenticated;

create or replace function public.ensure_default_financial_categories(p_store_user_id uuid default null)
returns setof public.financial_categories
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id uuid := coalesce(p_store_user_id, auth.uid());
  v_name text;
begin
  if auth.uid() is null or not public.can_access_store(v_store_id) then
    raise exception 'Você não possui acesso às categorias desta loja.';
  end if;
  foreach v_name in array array[
    'Ingredientes','Bebidas','Embalagens','Aluguel','Energia','Água','Internet',
    'Funcionários','Marketing','Manutenção','Impostos','Taxas','Outros'
  ] loop
    insert into public.financial_categories(user_id, name, category_type, created_by, updated_by)
    values (v_store_id, v_name, 'payable', auth.uid(), auth.uid())
    on conflict (user_id, lower(name), category_type) do nothing;
  end loop;
  return query select category.* from public.financial_categories category
    where category.user_id = v_store_id and category.is_active = true
      and category.category_type in ('payable', 'both')
    order by category.name;
end;
$$;
revoke all on function public.ensure_default_financial_categories(uuid) from public;
grant execute on function public.ensure_default_financial_categories(uuid) to authenticated;

create or replace function public.rename_financial_category(
  p_category_id uuid,
  p_new_name text
)
returns public.financial_categories
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category public.financial_categories%rowtype;
  v_old_name text;
begin
  if nullif(trim(coalesce(p_new_name, '')), '') is null then raise exception 'Informe o novo nome da categoria.'; end if;
  select * into v_category from public.financial_categories
  where id = p_category_id and public.can_access_store(user_id) for update;
  if not found then raise exception 'Categoria financeira não encontrada.'; end if;
  v_old_name := v_category.name;
  update public.financial_categories
  set name = trim(p_new_name), updated_at = now(), updated_by = auth.uid()
  where id = v_category.id returning * into v_category;
  update public.expenses set category = v_category.name
  where user_id = v_category.user_id and lower(coalesce(category, '')) = lower(v_old_name);
  update public.smart_invoice_imports set expense_category = v_category.name
  where user_id = v_category.user_id and lower(coalesce(expense_category, '')) = lower(v_old_name) and status = 'draft';
  return v_category;
end;
$$;
revoke all on function public.rename_financial_category(uuid,text) from public;
grant execute on function public.rename_financial_category(uuid,text) to authenticated;

alter table public.expenses
  add column if not exists payment_method text,
  add column if not exists notes text,
  add column if not exists cost_center text,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

update public.expenses set created_by = coalesce(created_by, user_id), updated_by = coalesce(updated_by, user_id)
where created_by is null or updated_by is null;

create or replace function public.audit_financial_row()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid(), new.user_id);
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by, new.user_id);
  return new;
end;
$$;
drop trigger if exists expenses_audit_fields on public.expenses;
create trigger expenses_audit_fields before insert or update on public.expenses
for each row execute function public.audit_financial_row();

alter table public.smart_invoice_imports
  add column if not exists payment_method text,
  add column if not exists due_date date,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

update public.smart_invoice_imports set created_by = coalesce(created_by, user_id), updated_by = coalesce(updated_by, user_id)
where created_by is null or updated_by is null;

drop trigger if exists smart_invoice_imports_audit_fields on public.smart_invoice_imports;
create trigger smart_invoice_imports_audit_fields before insert or update on public.smart_invoice_imports
for each row execute function public.audit_financial_row();

alter table public.smart_invoice_import_items
  add column if not exists conversion_factor numeric(18,6) not null default 1 check (conversion_factor > 0),
  add column if not exists unit_source text not null default 'unknown'
    check (unit_source in ('xml', 'invoice', 'catalog', 'inferred', 'unknown', 'confirmed')),
  add column if not exists unit_confirmed boolean not null default false;

-- XMLs já trazem a unidade comercial de forma determinística. Itens antigos já
-- conferidos/lançados não podem ser bloqueados retroativamente.
update public.smart_invoice_import_items item
set unit_confirmed = true,
    unit_source = case when invoice.source_type = 'xml' then 'xml' else 'confirmed' end
from public.smart_invoice_imports invoice
where invoice.id = item.import_id
  and (invoice.status = 'committed' or invoice.source_type = 'xml');

alter table public.staff_consumptions drop constraint if exists staff_consumptions_status_check;
alter table public.staff_consumptions add constraint staff_consumptions_status_check
  check (status in ('open', 'partially_paid', 'paid', 'cancelled'));

create or replace function public.cancel_purchase_invoice_draft(p_import_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_import public.smart_invoice_imports%rowtype;
begin
  select * into v_import from public.smart_invoice_imports
  where id = p_import_id and public.can_access_store(user_id) for update;
  if not found then raise exception 'Nota de compra não encontrada.'; end if;
  if v_import.status <> 'draft' then raise exception 'Somente uma conferência ainda não lançada pode ser cancelada.'; end if;
  update public.smart_invoice_imports
  set status = 'cancelled', reversed_at = now(), reversal_reason = 'Operação cancelada antes da confirmação',
      reversed_by = auth.uid(), reversed_by_name = 'Usuário autenticado'
  where id = v_import.id;
  return jsonb_build_object('ok', true, 'import_id', v_import.id, 'status', 'cancelled');
end;
$$;
revoke all on function public.cancel_purchase_invoice_draft(uuid) from public;
grant execute on function public.cancel_purchase_invoice_draft(uuid) to authenticated;

create or replace function public.sync_cancelled_invoice_payable()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' and new.expense_id is not null then
    update public.expenses
    set status = 'cancelled', is_active = false, cancelled_at = coalesce(cancelled_at, now()),
        cancellation_reason = coalesce(nullif(new.reversal_reason, ''), 'Cancelamento da nota de compra'),
        cancelled_by = coalesce(new.reversed_by, auth.uid()),
        cancelled_by_waiter_id = new.reversed_by_waiter_id,
        cancelled_by_name = coalesce(new.reversed_by_name, 'Usuário autenticado')
    where id = new.expense_id and user_id = new.user_id and coalesce(paid_amount, 0) = 0;
  end if;
  return new;
end;
$$;
drop trigger if exists smart_invoice_cancel_payable on public.smart_invoice_imports;
create trigger smart_invoice_cancel_payable after update of status on public.smart_invoice_imports
for each row execute function public.sync_cancelled_invoice_payable();

notify pgrst, 'reload schema';
