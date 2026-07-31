-- Centraliza o cadastro de contas a receber no banco e permite operar a loja
-- ativa em redes multiloja sem expor acesso a outras unidades.

drop policy if exists "Users manage own receivable contacts" on public.receivable_contacts;
drop policy if exists "Users manage accessible receivable contacts" on public.receivable_contacts;
create policy "Users manage accessible receivable contacts"
  on public.receivable_contacts
  for all
  to authenticated
  using (public.can_access_store(user_id))
  with check (public.can_access_store(user_id));

drop policy if exists "Users manage accessible staff consumptions" on public.staff_consumptions;
create policy "Users manage accessible staff consumptions"
  on public.staff_consumptions
  for all
  to authenticated
  using (public.can_access_store(user_id))
  with check (public.can_access_store(user_id));

create or replace function public.create_receivable_contact(
  p_user_id uuid,
  p_name text,
  p_contact_type text default 'customer',
  p_document text default null,
  p_phone text default null,
  p_notes text default null
)
returns table (
  id uuid,
  name text,
  contact_type text,
  document text,
  phone text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact public.receivable_contacts%rowtype;
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_type text := lower(trim(coalesce(p_contact_type, 'customer')));
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Entre novamente para continuar.';
  end if;

  if not public.can_access_store(p_user_id) then
    raise exception using errcode = '42501', message = 'Sem permissão para cadastrar nesta loja.';
  end if;

  if v_name is null then
    raise exception using errcode = '22023', message = 'Informe o nome de quem pagará depois.';
  end if;

  if v_type not in ('employee', 'customer', 'supplier', 'other') then
    raise exception using errcode = '22023', message = 'Tipo de cadastro inválido.';
  end if;

  insert into public.receivable_contacts (
    user_id,
    name,
    contact_type,
    document,
    phone,
    notes
  ) values (
    p_user_id,
    v_name,
    v_type,
    nullif(regexp_replace(coalesce(p_document, ''), '\D', '', 'g'), ''),
    nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''),
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning * into v_contact;

  return query
  select
    v_contact.id,
    v_contact.name,
    v_contact.contact_type,
    v_contact.document,
    v_contact.phone;
end;
$$;

revoke all on function public.create_receivable_contact(uuid, text, text, text, text, text) from public;
grant execute on function public.create_receivable_contact(uuid, text, text, text, text, text) to authenticated;

create or replace function public.register_pdv_receivable(
  p_order_id uuid,
  p_contact_id uuid,
  p_due_date date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
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
     and public.can_access_store(user_id)
   for update;

  if not found then
    raise exception 'Venda não encontrada para registrar a conta a receber.';
  end if;

  select *
    into v_contact
    from public.receivable_contacts
   where id = p_contact_id
     and user_id = v_order.user_id
     and public.can_access_store(user_id)
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

revoke all on function public.register_pdv_receivable(uuid, uuid, date, text) from public;
grant execute on function public.register_pdv_receivable(uuid, uuid, date, text) to authenticated;

notify pgrst, 'reload schema';
