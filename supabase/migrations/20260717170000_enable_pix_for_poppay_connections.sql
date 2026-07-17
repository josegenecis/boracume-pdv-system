insert into public.pix_settings (user_id, enabled, bank, updated_at)
select user_id, true, 'mercadopago', now()
from public.poppay_connections
where status = 'connected' and enabled = true
on conflict (user_id) do update
set enabled = true,
    bank = 'mercadopago',
    updated_at = now();

