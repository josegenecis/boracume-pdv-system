-- Políticas RLS para a tabela profiles para permitir acesso público ao cardápio digital
DO $$
BEGIN
    -- Política para visualização pública de perfis (necessário para o cardápio digital)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND policyname = 'Public profiles are viewable for digital menu'
    ) THEN
        CREATE POLICY "Public profiles are viewable for digital menu" 
        ON public.profiles 
        FOR SELECT 
        USING (true);
    END IF;

    -- Política para usuários verem/editarem seus próprios perfis
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND policyname = 'Users can view and edit their own profile'
    ) THEN
        CREATE POLICY "Users can view and edit their own profile" 
        ON public.profiles 
        FOR ALL 
        USING (auth.uid() = id);
    END IF;
END
$$;

-- Políticas RLS para a tabela products para permitir acesso público aos produtos do cardápio
DO $$
BEGIN
    -- Política para visualização pública de produtos (necessário para o cardápio digital)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'products' 
        AND policyname = 'Public products are viewable for digital menu'
    ) THEN
        CREATE POLICY "Public products are viewable for digital menu" 
        ON public.products 
        FOR SELECT 
        USING (show_in_delivery = true AND available = true);
    END IF;
END
$$;

-- Políticas RLS para product_variations para permitir acesso público
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'product_variations' 
        AND policyname = 'Public product variations are viewable'
    ) THEN
        CREATE POLICY "Public product variations are viewable" 
        ON public.product_variations 
        FOR SELECT 
        USING (true);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'product_variations' 
        AND policyname = 'Users can manage their product variations'
    ) THEN
        CREATE POLICY "Users can manage their product variations" 
        ON public.product_variations 
        FOR ALL 
        USING (auth.uid() = user_id);
    END IF;
END
$$;

-- Políticas RLS para delivery_zones para permitir acesso público
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'delivery_zones' 
        AND policyname = 'Public delivery zones are viewable'
    ) THEN
        CREATE POLICY "Public delivery zones are viewable" 
        ON public.delivery_zones 
        FOR SELECT 
        USING (active = true);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'delivery_zones' 
        AND policyname = 'Users can manage their delivery zones'
    ) THEN
        CREATE POLICY "Users can manage their delivery zones" 
        ON public.delivery_zones 
        FOR ALL 
        USING (auth.uid() = user_id);
    END IF;
END
$$;

-- Habilitar RLS nas tabelas se não estiver habilitado
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;