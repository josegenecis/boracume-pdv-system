-- Sincroniza pedido, oferta e rota do motoboy, independentemente do canal
-- que alterou o status do pedido.
create or replace function public.sync_delivery_order_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  calculated_payout numeric := 0;
  configured_mode text := 'delivery_fee';
  configured_fixed_payout numeric := 0;
  status_changed boolean := true;
begin
  if tg_op = 'UPDATE' then
    status_changed := old.status is distinct from new.status;
  end if;

  if new.order_type <> 'delivery' then
    return new;
  end if;

  if new.status = 'preparing'
     and status_changed
     and exists (
       select 1 from public.delivery_personnel driver
       where driver.user_id = new.user_id and driver.app_enabled = true
     )
     and not exists (
       select 1 from public.delivery_assignments assignment
       where assignment.order_id = new.id
     )
     and not exists (
       select 1 from public.delivery_offers offer
       where offer.order_id = new.id and offer.status = 'open'
     ) then
    select
      coalesce(settings.payout_mode, 'delivery_fee'),
      coalesce(settings.fixed_payout, 0)
    into configured_mode, configured_fixed_payout
    from public.delivery_settlement_settings settings
    where settings.user_id = new.user_id;

    calculated_payout := case
      when configured_mode = 'fixed' then greatest(0, configured_fixed_payout)
      else greatest(0, coalesce(new.delivery_fee, 0))
    end;

    insert into public.delivery_offers (
      restaurant_id, order_id, target_driver_id, payout_amount, status, expires_at
    ) values (
      new.user_id, new.id, null, calculated_payout, 'open', now() + interval '2 hours'
    )
    on conflict (order_id) where status = 'open' do nothing;
  end if;

  if new.status = 'cancelled'
     and status_changed then
    update public.delivery_offers
       set status = 'cancelled', updated_at = now()
     where order_id = new.id and status = 'open';

    insert into public.delivery_events (
      restaurant_id, assignment_id, order_id, delivery_personnel_id, event_type, metadata
    )
    select
      assignment.restaurant_id, assignment.id, assignment.order_id,
      assignment.delivery_personnel_id, 'cancelled',
      jsonb_build_object('source', 'order_status')
    from public.delivery_assignments assignment
    where assignment.order_id = new.id and assignment.status <> 'cancelled';

    update public.delivery_assignments
       set status = 'cancelled', updated_at = now()
     where order_id = new.id and status <> 'cancelled';
  end if;

  return new;
end;
$$;

drop trigger if exists sync_delivery_order_lifecycle_trigger on public.orders;
create trigger sync_delivery_order_lifecycle_trigger
after insert or update of status on public.orders
for each row execute function public.sync_delivery_order_lifecycle();

create or replace function public.accept_delivery_offer(p_offer_id uuid, p_driver_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_offer public.delivery_offers%rowtype;
  next_position integer;
  assignment_id uuid;
begin
  select * into selected_offer from public.delivery_offers
    where id = p_offer_id and status = 'open' and expires_at > now()
    for update;
  if not found then raise exception 'Esta entrega não está mais disponível'; end if;
  if exists (
    select 1 from public.orders orders
    where orders.id = selected_offer.order_id and orders.status = 'cancelled'
  ) then
    update public.delivery_offers set status = 'cancelled', updated_at = now()
      where id = selected_offer.id;
    raise exception 'Este pedido foi cancelado';
  end if;
  if selected_offer.target_driver_id is not null and selected_offer.target_driver_id <> p_driver_id then
    raise exception 'Oferta destinada a outro motoboy';
  end if;
  if not exists (
    select 1 from public.delivery_personnel driver
    where driver.id = p_driver_id
      and driver.user_id = selected_offer.restaurant_id
      and driver.app_enabled = true
  ) then raise exception 'Motoboy não autorizado para este restaurante'; end if;

  select coalesce(max(route_position), 0) + 1 into next_position
  from public.delivery_assignments
  where delivery_personnel_id = p_driver_id and status in ('accepted','arrived','picked_up');

  insert into public.delivery_assignments(
    restaurant_id, order_id, delivery_personnel_id, offer_id, route_position, payout_amount
  ) values (
    selected_offer.restaurant_id, selected_offer.order_id, p_driver_id, selected_offer.id,
    next_position, selected_offer.payout_amount
  ) returning id into assignment_id;

  update public.delivery_offers set status = 'accepted', accepted_by = p_driver_id,
    accepted_at = now(), updated_at = now() where id = p_offer_id;
  update public.orders set delivery_personnel_id = p_driver_id,
    delivery_assigned_at = now(), delivery_payout_amount = selected_offer.payout_amount
    where id = selected_offer.order_id;
  update public.delivery_personnel set status = 'busy', updated_at = now() where id = p_driver_id;
  insert into public.delivery_events(restaurant_id, assignment_id, order_id, delivery_personnel_id, event_type)
    values(selected_offer.restaurant_id, assignment_id, selected_offer.order_id, p_driver_id, 'accepted');
  return assignment_id;
end;
$$;

revoke all on function public.accept_delivery_offer(uuid, uuid) from public, anon, authenticated;
grant execute on function public.accept_delivery_offer(uuid, uuid) to service_role;
