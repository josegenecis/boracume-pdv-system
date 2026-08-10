-- Dados estruturados do destinatário para documentos fiscais, especialmente NF-e 55.

alter table public.customers
  add column if not exists cpf_cnpj text,
  add column if not exists state_registration text,
  add column if not exists state_registration_indicator smallint not null default 9,
  add column if not exists email text,
  add column if not exists address_number text,
  add column if not exists address_complement text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists postal_code text,
  add column if not exists city_code text,
  add column if not exists country_code text not null default '1058',
  add column if not exists country_name text not null default 'BRASIL',
  add column if not exists final_consumer_default boolean not null default true,
  add column if not exists fiscal_profile_enabled boolean not null default false;

alter table public.customers
  drop constraint if exists customers_state_registration_indicator_check,
  add constraint customers_state_registration_indicator_check
    check (state_registration_indicator in (1, 2, 9)),
  drop constraint if exists customers_cpf_cnpj_check,
  add constraint customers_cpf_cnpj_check
    check (cpf_cnpj is null or cpf_cnpj ~ '^([0-9]{11}|[0-9]{14})$'),
  drop constraint if exists customers_state_check,
  add constraint customers_state_check
    check (state is null or state ~ '^[A-Z]{2}$'),
  drop constraint if exists customers_postal_code_check,
  add constraint customers_postal_code_check
    check (postal_code is null or postal_code ~ '^[0-9]{8}$'),
  drop constraint if exists customers_city_code_check,
  add constraint customers_city_code_check
    check (city_code is null or city_code ~ '^[0-9]{7}$');

create unique index if not exists customers_user_cpf_cnpj_uidx
  on public.customers(user_id, cpf_cnpj)
  where cpf_cnpj is not null;

create index if not exists customers_fiscal_profiles_idx
  on public.customers(user_id, fiscal_profile_enabled, name);

comment on column public.customers.state_registration_indicator is
  'indIEDest: 1 contribuinte ICMS, 2 contribuinte isento, 9 não contribuinte.';
comment on column public.customers.fiscal_profile_enabled is
  'Indica que o cliente possui os dados estruturados necessários para ser selecionado como destinatário fiscal.';

notify pgrst, 'reload schema';
