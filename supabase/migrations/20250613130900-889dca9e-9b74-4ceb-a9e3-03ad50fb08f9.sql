-- Adicionar políticas RLS para a tabela products se não existirem
DO $$
BEGIN
    -- Verifica se a política já existe antes de criar
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'products' 
        AND policyname = 'Users can view their own products'
    ) THEN
        CREATE POLICY "Users can view their own products" 
        ON public.products 
        FOR SELECT 
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'products' 
        AND policyname = 'Users can create their own products'
    ) THEN
        CREATE POLICY "Users can create their own products" 
        ON public.products 
        FOR INSERT 
        WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'products' 
        AND policyname = 'Users can update their own products'
    ) THEN
        CREATE POLICY "Users can update their own products" 
        ON public.products 
        FOR UPDATE 
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'products' 
        AND policyname = 'Users can delete their own products'
    ) THEN
        CREATE POLICY "Users can delete their own products" 
        ON public.products 
        FOR DELETE 
        USING (auth.uid() = user_id);
    END IF;
END
$$;

-- Habilitar RLS na tabela products se não estiver habilitado
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;