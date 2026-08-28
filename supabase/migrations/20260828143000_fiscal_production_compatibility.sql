-- Implantacao progressiva da matriz fiscal em producao.
--
-- A estrutura e as novas operacoes ficam disponiveis imediatamente, mas o
-- bloqueio por ausencia de regra aprovada permanece opt-in por loja. Assim,
-- emissores existentes continuam operando com a configuracao fiscal atual ate
-- concluirem a transicao assistida para a matriz de operacoes.

alter table public.fiscal_settings
  alter column require_approved_fiscal_rules set default false;

comment on column public.fiscal_settings.require_approved_fiscal_rules is
  'Quando ativado pela loja, bloqueia a emissao se algum item nao encontrar exatamente uma regra fiscal vigente e aprovada.';

notify pgrst, 'reload schema';
