-- Link monthly Stripe prices and set the default trial to 14 days.

alter table public.subscription_plans
add column if not exists stripe_price_id text;

insert into public.subscription_plans (id, name, description, price, features, stripe_price_id)
values
  (
    1,
    'Essencial',
    'Para comecar a vender com cardapio digital, PDV e organizacao basica.',
    97,
    '["Cardapio digital", "PDV e frente de caixa", "Pedidos", "Mesas", "Relatorios essenciais", "PIX e pagamentos"]'::jsonb,
    'price_1TJuYXAOHdVi3wt5bNi5P3gH'
  ),
  (
    2,
    'Profissional',
    'Para restaurantes que precisam de gestao operacional, estoque e marketing.',
    147,
    '["Tudo do Essencial", "KDS / cozinha", "Estoque e insumos", "Financeiro", "CMV e curva ABC", "Marketing", "WhatsApp", "Equipe"]'::jsonb,
    'price_1TRzn5AOHdVi3wt5lXOJOcsl'
  ),
  (
    3,
    'Elite',
    'Para operacoes que precisam de automacao avancada, app desktop e recursos premium.',
    197,
    '["Tudo do Profissional", "Assistente inteligente", "App desktop", "Hardware avancado", "Seguranca e auditoria", "Recursos fiscais quando liberados"]'::jsonb,
    'price_1TRzqAAOHdVi3wt5Be82uYT4'
  )
on conflict (id) do update
set name = excluded.name,
    description = excluded.description,
    price = excluded.price,
    features = excluded.features,
    stripe_price_id = excluded.stripe_price_id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, created_at, updated_at)
  values (new.id, now(), now())
  on conflict (id) do nothing;

  insert into public.subscriptions (
    user_id,
    status,
    trial_start,
    trial_end,
    created_at,
    updated_at
  )
  values (
    new.id,
    'trialing',
    now(),
    now() + interval '14 days',
    now(),
    now()
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

update public.subscriptions
set trial_end = trial_start + interval '14 days',
    updated_at = now()
where status in ('trial', 'trialing')
  and trial_start is not null
  and trial_end is not null
  and trial_end < trial_start + interval '14 days';
