
-- Criar tabela para configurações fiscais específicas de NFC-e
CREATE TABLE public.fiscal_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  cnpj text NOT NULL,
  inscricao_estadual text,
  razao_social text NOT NULL,
  nome_fantasia text,
  endereco_logradouro text NOT NULL,
  endereco_numero text NOT NULL,
  endereco_complemento text,
  endereco_bairro text NOT NULL,
  endereco_municipio text NOT NULL,
  endereco_uf text NOT NULL,
  endereco_cep text NOT NULL,
  codigo_municipio text NOT NULL,
  nfce_serie text NOT NULL DEFAULT '1',
  nfce_numero_atual integer NOT NULL DEFAULT 1,
  certificado_a1_base64 text,
  certificado_senha text,
  ambiente text NOT NULL DEFAULT 'homologacao', -- 'homologacao' ou 'producao'
  regime_tributario integer NOT NULL DEFAULT 1, -- 1=Simples Nacional, 3=Regime Normal
  csc_id text, -- Código de Segurança do Contribuinte - Identificador
  csc_token text, -- Código de Segurança do Contribuinte - Token
  ativo boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Criar tabela para cupons fiscais (NFC-e) emitidos
CREATE TABLE public.nfce_cupons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  order_id uuid REFERENCES orders(id),
  numero integer NOT NULL,
  serie text NOT NULL,
  chave_acesso text UNIQUE,
  xml_content text,
  xml_autorizado text,
  protocolo_autorizacao text,
  data_hora_emissao timestamp with time zone NOT NULL DEFAULT now(),
  data_hora_autorizacao timestamp with time zone,
  valor_total numeric(10,2) NOT NULL,
  valor_desconto numeric(10,2) DEFAULT 0,
  valor_tributos numeric(10,2) DEFAULT 0,
  consumidor_cpf_cnpj text,
  consumidor_nome text,
  status text NOT NULL DEFAULT 'pendente', -- 'pendente', 'autorizado', 'rejeitado', 'cancelado'
  motivo_rejeicao text,
  qr_code_url text,
  contingencia boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Criar tabela para itens dos cupons fiscais
CREATE TABLE public.nfce_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cupom_id uuid REFERENCES nfce_cupons(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES products(id),
  codigo_produto text NOT NULL,
  descricao text NOT NULL,
  ncm text DEFAULT '00000000',
  cfop text DEFAULT '5102',
  unidade text DEFAULT 'UN',
  quantidade numeric(10,4) NOT NULL,
  valor_unitario numeric(10,4) NOT NULL,
  valor_total numeric(10,2) NOT NULL,
  valor_desconto numeric(10,2) DEFAULT 0,
  cst_icms text DEFAULT '102',
  aliquota_icms numeric(5,4) DEFAULT 0,
  valor_icms numeric(10,2) DEFAULT 0,
  cst_pis text DEFAULT '07',
  aliquota_pis numeric(5,4) DEFAULT 0,
  valor_pis numeric(10,2) DEFAULT 0,
  cst_cofins text DEFAULT '07',
  aliquota_cofins numeric(5,4) DEFAULT 0,
  valor_cofins numeric(10,2) DEFAULT 0,
  informacoes_adicionais text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Criar tabela para logs de transmissão com a Sefaz
CREATE TABLE public.nfce_transmissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cupom_id uuid REFERENCES nfce_cupons(id) ON DELETE CASCADE NOT NULL,
  tipo_operacao text NOT NULL, -- 'emissao', 'cancelamento', 'consulta'
  xml_enviado text,
  xml_retorno text,
  codigo_status text,
  motivo text,
  protocolo text,
  data_hora timestamp with time zone NOT NULL DEFAULT now(),
  sucesso boolean NOT NULL DEFAULT false
);

-- Criar tabela para controle de contingência
CREATE TABLE public.nfce_contingency (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  cupom_id uuid REFERENCES nfce_cupons(id) ON DELETE CASCADE NOT NULL,
  motivo_contingencia text NOT NULL,
  data_hora_contingencia timestamp with time zone NOT NULL DEFAULT now(),
  data_hora_transmissao timestamp with time zone,
  transmitido boolean DEFAULT false
);

-- Habilitar RLS nas tabelas
ALTER TABLE public.fiscal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfce_cupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfce_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfce_transmissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfce_contingency ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para fiscal_settings
CREATE POLICY "Users can view their own fiscal settings" 
  ON public.fiscal_settings 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own fiscal settings" 
  ON public.fiscal_settings 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own fiscal settings" 
  ON public.fiscal_settings 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Políticas RLS para nfce_cupons
CREATE POLICY "Users can view their own cupons" 
  ON public.nfce_cupons 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own cupons" 
  ON public.nfce_cupons 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cupons" 
  ON public.nfce_cupons 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Políticas RLS para nfce_items
CREATE POLICY "Users can view items from their cupons" 
  ON public.nfce_items 
  FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.nfce_cupons 
    WHERE nfce_cupons.id = nfce_items.cupom_id 
    AND nfce_cupons.user_id = auth.uid()
  ));

CREATE POLICY "Users can create items for their cupons" 
  ON public.nfce_items 
  FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.nfce_cupons 
    WHERE nfce_cupons.id = nfce_items.cupom_id 
    AND nfce_cupons.user_id = auth.uid()
  ));

-- Políticas RLS para nfce_transmissions
CREATE POLICY "Users can view transmissions from their cupons" 
  ON public.nfce_transmissions 
  FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.nfce_cupons 
    WHERE nfce_cupons.id = nfce_transmissions.cupom_id 
    AND nfce_cupons.user_id = auth.uid()
  ));

CREATE POLICY "Users can create transmissions for their cupons" 
  ON public.nfce_transmissions 
  FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.nfce_cupons 
    WHERE nfce_cupons.id = nfce_transmissions.cupom_id 
    AND nfce_cupons.user_id = auth.uid()
  ));

-- Políticas RLS para nfce_contingency
CREATE POLICY "Users can view their own contingency records" 
  ON public.nfce_contingency 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own contingency records" 
  ON public.nfce_contingency 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contingency records" 
  ON public.nfce_contingency 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Criar índices para performance
CREATE INDEX idx_fiscal_settings_user_id ON public.fiscal_settings(user_id);
CREATE INDEX idx_nfce_cupons_user_id ON public.nfce_cupons(user_id);
CREATE INDEX idx_nfce_cupons_order_id ON public.nfce_cupons(order_id);
CREATE INDEX idx_nfce_cupons_chave_acesso ON public.nfce_cupons(chave_acesso);
CREATE INDEX idx_nfce_cupons_status ON public.nfce_cupons(status);
CREATE INDEX idx_nfce_items_cupom_id ON public.nfce_items(cupom_id);
CREATE INDEX idx_nfce_transmissions_cupom_id ON public.nfce_transmissions(cupom_id);
CREATE INDEX idx_nfce_contingency_user_id ON public.nfce_contingency(user_id);

-- Função para gerar próximo número de NFC-e
CREATE OR REPLACE FUNCTION public.get_next_nfce_number(p_user_id uuid, p_serie text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_number integer;
BEGIN
  -- Atualizar e retornar o próximo número
  UPDATE public.fiscal_settings 
  SET nfce_numero_atual = nfce_numero_atual + 1,
      updated_at = now()
  WHERE user_id = p_user_id 
  AND nfce_serie = p_serie
  RETURNING nfce_numero_atual INTO next_number;
  
  -- Se não encontrou configuração, retornar erro
  IF next_number IS NULL THEN
    RAISE EXCEPTION 'Configuração fiscal não encontrada para o usuário';
  END IF;
  
  RETURN next_number;
END;
$$;

-- Função para gerar chave de acesso da NFC-e
CREATE OR REPLACE FUNCTION public.generate_nfce_access_key(
  p_uf text,
  p_aamm text,
  p_cnpj text,
  p_modelo text,
  p_serie text,
  p_numero text,
  p_tipo_emissao text,
  p_codigo_numerico text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  chave_sem_dv text;
  digito_verificador integer;
  chave_completa text;
BEGIN
  -- Montar chave sem dígito verificador (43 dígitos)
  chave_sem_dv := p_uf || p_aamm || p_cnpj || p_modelo || 
                   lpad(p_serie, 3, '0') || lpad(p_numero, 9, '0') || 
                   p_tipo_emissao || p_codigo_numerico;
  
  -- Calcular dígito verificador usando módulo 11
  digito_verificador := public.calculate_dv_mod11(chave_sem_dv);
  
  -- Montar chave completa (44 dígitos)
  chave_completa := chave_sem_dv || digito_verificador::text;
  
  RETURN chave_completa;
END;
$$;

-- Função auxiliar para calcular dígito verificador módulo 11
CREATE OR REPLACE FUNCTION public.calculate_dv_mod11(p_numero text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  soma integer := 0;
  peso integer := 2;
  i integer;
  digito integer;
  resto integer;
BEGIN
  -- Percorrer dígitos da direita para esquerda
  FOR i IN REVERSE length(p_numero)..1 LOOP
    soma := soma + (substring(p_numero, i, 1)::integer * peso);
    peso := peso + 1;
    IF peso > 9 THEN
      peso := 2;
    END IF;
  END LOOP;
  
  resto := soma % 11;
  
  IF resto < 2 THEN
    digito := 0;
  ELSE
    digito := 11 - resto;
  END IF;
  
  RETURN digito;
END;
$$;
