update public.subscription_plans
set
  description = 'Plano premium com IA, fiscal e recursos avançados do ecossistema.',
  features = '["Tudo do Profissional","Importação de cardápio com IA","Agente e recursos inteligentes","Fiscal e NFC-e","App desktop","Impressoras e hardware avançado","Prioridade em novidades e suporte","Recursos premium de expansão"]'::jsonb
where id = 3 or lower(name) = 'elite';
