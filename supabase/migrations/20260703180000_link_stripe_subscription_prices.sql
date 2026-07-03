alter table public.subscription_plans
add column if not exists stripe_price_id text;

insert into public.subscription_plans (id, name, description, price, features, stripe_price_id)
values
  (
    1,
    'Essencial',
    'Operação enxuta para delivery, balcão e cardápio digital.',
    129.00,
    '["Cardápio digital com link e QR Code","Produtos, categorias e complementos","Pedidos online com acompanhamento","PDV frente de caixa","Delivery com áreas e taxa","PIX e formas de pagamento","Relatórios essenciais de vendas","1 usuário gestor"]'::jsonb,
    null
  ),
  (
    2,
    'Profissional',
    'Gestão completa com operação, marketing e automações.',
    159.00,
    '["Tudo do Essencial","Produtos ilimitados","KDS e tela de cozinha","Estoque, ingredientes e ficha técnica","Financeiro e inteligência de CMV","Entregadores e gestão de equipe","WhatsApp com automações","Marketing com banners, destaques e upsell","Integração iFood e recursos de atendimento"]'::jsonb,
    null
  ),
  (
    3,
    'Elite',
    'Plano premium com IA, fiscal e recursos avançados do ecossistema.',
    189.00,
    '["Tudo do Profissional","Importação de cardápio com IA","Agente e recursos inteligentes","Fiscal e NFC-e","App desktop","Impressoras e hardware avançado","Prioridade em novidades e suporte","Recursos premium de expansão"]'::jsonb,
    null
  )
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  features = excluded.features,
  stripe_price_id = excluded.stripe_price_id;
