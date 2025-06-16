
-- Corrigir políticas RLS para a tabela customers
-- O erro estava acontecendo porque não havia políticas adequadas para criação de clientes

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Users can view their own customers" ON public.customers;
DROP POLICY IF EXISTS "Users can create customers" ON public.customers;
DROP POLICY IF EXISTS "Users can update their own customers" ON public.customers;
DROP POLICY IF EXISTS "Users can delete their own customers" ON public.customers;
DROP POLICY IF EXISTS "Anonymous users can create customers" ON public.customers;

-- Habilitar RLS na tabela customers se não estiver habilitado
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Política para usuários autenticados verem seus próprios clientes
CREATE POLICY "Users can view their own customers" 
ON public.customers 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Política para usuários autenticados criarem clientes
CREATE POLICY "Users can create customers" 
ON public.customers 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Política para usuários anônimos criarem clientes (cardápio digital)
CREATE POLICY "Anonymous users can create customers" 
ON public.customers 
FOR INSERT 
TO anon
WITH CHECK (user_id IS NOT NULL);

-- Política para usuários autenticados atualizarem seus clientes
CREATE POLICY "Users can update their own customers" 
ON public.customers 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Política para usuários autenticados deletarem seus clientes
CREATE POLICY "Users can delete their own customers" 
ON public.customers 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Verificar se existem campos obrigatórios sem valores padrão
-- e corrigir se necessário
ALTER TABLE public.customers 
ALTER COLUMN created_at SET DEFAULT now(),
ALTER COLUMN updated_at SET DEFAULT now();

-- Adicionar trigger para atualizar updated_at automaticamente
DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
