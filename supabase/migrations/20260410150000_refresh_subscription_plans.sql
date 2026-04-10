update public.subscription_plans
set
  name = 'Essencial',
  description = 'Operação enxuta para delivery, balcão e cardápio digital.',
  price = 129.00,
  features = '["Cardápio digital com link e QR Code","Produtos, categorias e complementos","Pedidos online com acompanhamento","PDV frente de caixa","Delivery com áreas e taxa","PIX e formas de pagamento","Relatórios essenciais de vendas","1 usuário gestor"]'::jsonb,
  stripe_price_id = null
where id = 1 or lower(name) in ('essencial', 'basic');

update public.subscription_plans
set
  name = 'Profissional',
  description = 'Gestão completa com operação, marketing e automações.',
  price = 159.00,
  features = '["Tudo do Essencial","Produtos ilimitados","KDS e tela de cozinha","Estoque, ingredientes e ficha técnica","Financeiro e inteligência de CMV","Entregadores e gestão de equipe","WhatsApp com automações","Marketing com banners, destaques e upsell","Integração iFood e recursos de atendimento"]'::jsonb,
  stripe_price_id = null
where id = 2 or lower(name) in ('profissional', 'pro');

update public.subscription_plans
set
  name = 'Elite',
  description = 'Plano premium com IA, fiscal e recursos avançados do ecossistema.',
  price = 189.00,
  features = '["Tudo do Profissional","Importação de cardápio com IA","Agente e recursos inteligentes","Fiscal e NFC-e","App desktop","Impressoras e hardware avançado","Prioridade em novidades e suporte","Recursos premium de expansão"]'::jsonb,
  stripe_price_id = null
where id = 3 or lower(name) in ('enterprise', 'elite');
