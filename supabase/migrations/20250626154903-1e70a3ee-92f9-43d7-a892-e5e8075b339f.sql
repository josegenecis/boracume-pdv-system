
-- ETAPA 1: LIMPAR TODAS AS POLÍTICAS RLS EXISTENTES
-- Remover políticas duplicadas e conflitantes

-- Limpar políticas da tabela profiles
DROP POLICY IF EXISTS "Public profiles viewable for menu" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable for digital menu" ON public.profiles;
DROP POLICY IF EXISTS "Users can view and edit their own profile" ON public.profiles;

-- Limpar políticas da tabela customers
DROP POLICY IF EXISTS "Allow customer creation for digital menu" ON public.customers;
DROP POLICY IF EXISTS "Allow customer read for digital menu" ON public.customers;
DROP POLICY IF EXISTS "Anonymous users can create customers" ON public.customers;
DROP POLICY IF EXISTS "Anonymous users can read customers" ON public.customers;
DROP POLICY IF EXISTS "Allow anonymous users to create customers" ON public.customers;
DROP POLICY IF EXISTS "Allow anonymous users to read customers for digital menu" ON public.customers;
DROP POLICY IF EXISTS "Allow all operations for customers" ON public.customers;

-- Limpar políticas da tabela orders
DROP POLICY IF EXISTS "Allow order creation for digital menu" ON public.orders;
DROP POLICY IF EXISTS "Users can view their orders" ON public.orders;
DROP POLICY IF EXISTS "Anonymous users can create orders" ON public.orders;
DROP POLICY IF EXISTS "Allow anonymous users to create orders for digital menu" ON public.orders;

-- Limpar políticas da tabela kitchen_orders
DROP POLICY IF EXISTS "Allow kitchen order creation" ON public.kitchen_orders;
DROP POLICY IF EXISTS "Users can view their kitchen orders" ON public.kitchen_orders;
DROP POLICY IF EXISTS "Anonymous users can create kitchen orders" ON public.kitchen_orders;
DROP POLICY IF EXISTS "Allow anonymous users to create kitchen orders via trigger" ON public.kitchen_orders;

-- ETAPA 2: CRIAR POLÍTICAS RLS CONSOLIDADAS E ESPECÍFICAS

-- PROFILES: Permitir leitura pública (necessário para cardápio digital) e gestão própria
CREATE POLICY "profiles_public_read" 
ON public.profiles 
FOR SELECT 
TO anon, authenticated
USING (true);

CREATE POLICY "profiles_user_manage" 
ON public.profiles 
FOR ALL 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- CUSTOMERS: Permitir criação e leitura para cardápio digital
CREATE POLICY "customers_digital_menu_access" 
ON public.customers 
FOR ALL 
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- ORDERS: Permitir criação anônima (cardápio digital) e visualização pelo dono
CREATE POLICY "orders_anonymous_create" 
ON public.orders 
FOR INSERT 
TO anon, authenticated
WITH CHECK (user_id IS NOT NULL);

CREATE POLICY "orders_owner_read" 
ON public.orders 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "orders_owner_update" 
ON public.orders 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- KITCHEN_ORDERS: Permitir criação via trigger e visualização pelo dono
CREATE POLICY "kitchen_orders_system_create" 
ON public.kitchen_orders 
FOR INSERT 
TO anon, authenticated
WITH CHECK (user_id IS NOT NULL);

CREATE POLICY "kitchen_orders_owner_manage" 
ON public.kitchen_orders 
FOR ALL 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ETAPA 3: CORRIGIR FUNÇÕES COM search_path PARA RESOLVER OS 11 AVISOS
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_marketing_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.marketing_settings (user_id, google_tag_id, facebook_pixel_id, banner_images)
  VALUES (NEW.id, '', '', '[]'::jsonb)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_loyalty_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  points_to_add INTEGER;
BEGIN
  points_to_add := FLOOR(NEW.total);
  
  INSERT INTO public.loyalty_customers (user_id, customer_phone, customer_name, points, total_spent, visits_count)
  VALUES (NEW.user_id, NEW.customer_phone, NEW.customer_name, points_to_add, NEW.total, 1)
  ON CONFLICT (user_id, customer_phone) 
  DO UPDATE SET 
    points = loyalty_customers.points + points_to_add,
    total_spent = loyalty_customers.total_spent + NEW.total,
    visits_count = loyalty_customers.visits_count + 1,
    updated_at = now();
    
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_order_to_kds()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM jsonb_array_elements(NEW.items) AS item
    JOIN products p ON p.id = (item->>'product_id')::uuid
    WHERE p.send_to_kds = true AND p.user_id = NEW.user_id
  ) THEN
    INSERT INTO kitchen_orders (
      user_id,
      order_number,
      customer_name,
      customer_phone,
      items,
      priority,
      status
    ) VALUES (
      NEW.user_id,
      NEW.order_number,
      NEW.customer_name,
      NEW.customer_phone,
      NEW.items,
      'normal',
      'pending'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_next_nfce_number(p_user_id uuid, p_serie text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number integer;
BEGIN
  UPDATE public.fiscal_settings 
  SET nfce_numero_atual = nfce_numero_atual + 1,
      updated_at = now()
  WHERE user_id = p_user_id 
  AND nfce_serie = p_serie
  RETURNING nfce_numero_atual INTO next_number;
  
  IF next_number IS NULL THEN
    RAISE EXCEPTION 'Configuração fiscal não encontrada para o usuário';
  END IF;
  
  RETURN next_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_nfce_access_key(p_uf text, p_aamm text, p_cnpj text, p_modelo text, p_serie text, p_numero text, p_tipo_emissao text, p_codigo_numerico text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chave_sem_dv text;
  digito_verificador integer;
  chave_completa text;
BEGIN
  chave_sem_dv := p_uf || p_aamm || p_cnpj || p_modelo || 
                   lpad(p_serie, 3, '0') || lpad(p_numero, 9, '0') || 
                   p_tipo_emissao || p_codigo_numerico;
  
  digito_verificador := public.calculate_dv_mod11(chave_sem_dv);
  chave_completa := chave_sem_dv || digito_verificador::text;
  
  RETURN chave_completa;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_dv_mod11(p_numero text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  soma integer := 0;
  peso integer := 2;
  i integer;
  digito integer;
  resto integer;
BEGIN
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

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_order_number INTEGER;
BEGIN
  UPDATE public.profiles 
  SET next_order_number = next_order_number + 1
  WHERE id = NEW.user_id
  RETURNING next_order_number - 1 INTO new_order_number;
  
  IF new_order_number IS NULL THEN
    new_order_number := 1;
    INSERT INTO public.profiles (id, next_order_number)
    VALUES (NEW.user_id, 2)
    ON CONFLICT (id) 
    DO UPDATE SET next_order_number = 2;
  END IF;
  
  NEW.order_number := LPAD(new_order_number::text, 3, '0');
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_table_accounts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;
  
  BEGIN
    INSERT INTO public.profiles (
      id, 
      created_at, 
      updated_at,
      restaurant_name,
      next_order_number
    )
    VALUES (
      NEW.id, 
      now(), 
      now(),
      COALESCE(NEW.raw_user_meta_data ->> 'restaurant_name', 'Novo Restaurante'),
      1
    );
  EXCEPTION
    WHEN OTHERS THEN
      NULL; -- Ignorar erros silenciosamente
  END;

  BEGIN
    INSERT INTO public.subscriptions (
      user_id,
      status,
      trial_start,
      trial_end,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      'trialing',
      now(),
      now() + interval '7 days',
      now(),
      now()
    );
  EXCEPTION
    WHEN OTHERS THEN
      NULL; -- Ignorar erros silenciosamente
  END;
  
  RETURN NEW;
END;
$$;
