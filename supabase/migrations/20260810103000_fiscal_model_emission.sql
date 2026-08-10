alter table public.nfce_cupons
  add column if not exists model_code text not null default '65'
  check (model_code in ('55', '65'));

create index if not exists nfce_cupons_model_code_idx
  on public.nfce_cupons(user_id, model_code, data_hora_emissao desc);

create or replace function public.get_next_fiscal_document_number(p_user_id uuid, p_model_code text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare issued_number bigint;
begin
  if p_model_code not in ('55', '65') then
    raise exception 'Modelo fiscal inválido: %', p_model_code;
  end if;
  update public.fiscal_document_models
     set next_number = next_number + 1, updated_at = now()
   where user_id = p_user_id and model_code = p_model_code and enabled = true
  returning next_number - 1 into issued_number;
  if issued_number is null then
    raise exception 'Modelo fiscal % não está configurado ou habilitado', p_model_code;
  end if;
  return issued_number;
end;
$$;

revoke all on function public.get_next_fiscal_document_number(uuid, text) from public;
grant execute on function public.get_next_fiscal_document_number(uuid, text) to authenticated, service_role;
