
-- Habilitar RLS nas tabelas que ainda não têm
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

-- Criar políticas apenas se não existirem
DO $$ BEGIN
    -- Política para produtos
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'products' AND policyname = 'Allow public read access to products'
    ) THEN
        CREATE POLICY "Allow public read access to products" 
        ON public.products 
        FOR SELECT 
        TO public 
        USING (true);
    END IF;

    -- Política para variações de produtos
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'product_variations' AND policyname = 'Allow public read access to product_variations'
    ) THEN
        CREATE POLICY "Allow public read access to product_variations" 
        ON public.product_variations 
        FOR SELECT 
        TO public 
        USING (true);
    END IF;

    -- Política para perfis
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Allow public read access to profiles'
    ) THEN
        CREATE POLICY "Allow public read access to profiles" 
        ON public.profiles 
        FOR SELECT 
        TO public 
        USING (true);
    END IF;

    -- Política para zonas de entrega
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'delivery_zones' AND policyname = 'Allow public read access to delivery_zones'
    ) THEN
        CREATE POLICY "Allow public read access to delivery_zones" 
        ON public.delivery_zones 
        FOR SELECT 
        TO public 
        USING (true);
    END IF;

    -- Política para criação de pedidos por usuários anônimos
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' AND policyname = 'Allow anonymous users to create orders'
    ) THEN
        CREATE POLICY "Allow anonymous users to create orders" 
        ON public.orders 
        FOR INSERT 
        TO public 
        WITH CHECK (true);
    END IF;

END $$;
