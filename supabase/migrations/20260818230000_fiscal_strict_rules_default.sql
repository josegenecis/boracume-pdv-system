-- A matriz fiscal entra em producao de forma progressiva. A estrutura fica
-- disponivel para cadastro e aprovacao, sem alterar automaticamente a emissao
-- das lojas existentes.

alter table public.fiscal_settings
  alter column require_approved_fiscal_rules set default false;

comment on column public.fiscal_settings.require_approved_fiscal_rules is
  'Quando ativado pela loja, bloqueia a emissao se algum item nao encontrar exatamente uma regra fiscal vigente e aprovada.';
