alter table public.fiscal_settings
add column if not exists ncm_padrao text default '21069090',
add column if not exists cfop_padrao text default '5102',
add column if not exists csosn_padrao text default '102',
add column if not exists cst_pis_padrao text default '07',
add column if not exists cst_cofins_padrao text default '07';

create or replace function public.get_next_nfce_number(p_user_id uuid, p_serie text)
returns integer
language plpgsql
security definer
as $$
declare
  next_number integer;
begin
  update public.fiscal_settings
  set nfce_numero_atual = nfce_numero_atual + 1,
      updated_at = now()
  where user_id = p_user_id
    and nfce_serie = p_serie
  returning nfce_numero_atual - 1 into next_number;

  if next_number is null then
    raise exception 'Configuracao fiscal nao encontrada para o usuario';
  end if;

  return next_number;
end;
$$;
