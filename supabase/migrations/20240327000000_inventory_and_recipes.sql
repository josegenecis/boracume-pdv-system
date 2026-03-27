
-- Tabela de Insumos (Ingredients)
CREATE TABLE IF NOT EXISTS public.ingredients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    unit TEXT NOT NULL CHECK (unit IN ('g', 'kg', 'un', 'ml', 'l')),
    current_stock NUMERIC(10, 3) DEFAULT 0,
    min_stock NUMERIC(10, 3) DEFAULT 0,
    cost_price NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Tabela de Ficha Técnica (Product Recipes)
CREATE TABLE IF NOT EXISTS public.product_recipes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
    quantity NUMERIC(10, 3) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Tabela de Movimentações de Estoque (Stock Movements)
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'loss', 'sale')),
    quantity NUMERIC(10, 3) NOT NULL,
    unit_cost NUMERIC(10, 2),
    reason TEXT,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS (Segurança)
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Políticas (Policies)
CREATE POLICY "Permitir leitura/escrita de insumos ao dono" ON public.ingredients FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Permitir leitura/escrita de receitas ao dono" ON public.product_recipes FOR ALL USING (
    EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.user_id = auth.uid())
);
CREATE POLICY "Permitir leitura/escrita de movimentacoes ao dono" ON public.stock_movements FOR ALL USING (auth.uid() = user_id);

