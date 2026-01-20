import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

Deno.serve(async (req) => {
  try {
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      return new Response("SUPABASE_DB_URL not found", { status: 500 });
    }

    const client = new Client(dbUrl);
    await client.connect();

    const sql = `
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      -- 1. Tabela de Programas de Fidelidade (Regras)
      CREATE TABLE IF NOT EXISTS public.loyalty_programs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL, 
        type text NOT NULL, -- 'points', 'visits', 'spending'
        goal_value numeric NOT NULL, 
        reward_type text NOT NULL, -- 'percent', 'fixed_amount', 'free_product', 'free_shipping'
        reward_value numeric NOT NULL, 
        active boolean DEFAULT true,
        created_at timestamptz DEFAULT now()
      );

      -- 2. Tabela de Cupons
      CREATE TABLE IF NOT EXISTS public.coupons (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL, 
        code text NOT NULL, 
        description text,
        discount_type text NOT NULL, -- 'percent', 'fixed', 'shipping'
        discount_value numeric NOT NULL,
        min_purchase numeric DEFAULT 0, 
        max_uses integer, 
        uses_count integer DEFAULT 0,
        expiration_date timestamptz,
        active boolean DEFAULT true,
        created_at timestamptz DEFAULT now()
      );

      -- 3. Tabela de Recompensas do Cliente
      CREATE TABLE IF NOT EXISTS public.customer_rewards (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id uuid REFERENCES public.customers(id),
        program_id uuid REFERENCES public.loyalty_programs(id),
        code text, 
        discount_type text,
        discount_value numeric,
        status text DEFAULT 'available', 
        created_at timestamptz DEFAULT now(),
        expires_at timestamptz
      );

      -- 4. Função Mágica Atualizada
      CREATE OR REPLACE FUNCTION public.process_loyalty_rules()
      RETURNS TRIGGER AS $$
      DECLARE
        program RECORD;
        cust RECORD;
        new_visits integer;
        new_spent numeric;
      BEGIN
        IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
          
          SELECT * INTO cust FROM public.customers WHERE id = NEW.customer_id;
          
          IF cust IS NOT NULL THEN
            UPDATE public.customers
            SET 
              points = COALESCE(points, 0) + FLOOR(NEW.total),
              total_spent = COALESCE(total_spent, 0) + NEW.total,
              visits_count = COALESCE(visits_count, 0) + 1
            WHERE id = NEW.customer_id;

            new_visits := COALESCE(cust.visits_count, 0) + 1;
            new_spent := COALESCE(cust.total_spent, 0) + NEW.total;

            FOR program IN SELECT * FROM public.loyalty_programs WHERE user_id = NEW.user_id AND type = 'visits' AND active = true LOOP
              IF new_visits % CAST(program.goal_value AS integer) = 0 THEN
                INSERT INTO public.customer_rewards (customer_id, program_id, code, discount_type, discount_value)
                VALUES (
                  NEW.customer_id, 
                  program.id, 
                  'FID-' || substring(uuid_generate_v4()::text from 1 for 8), 
                  program.reward_type, 
                  program.reward_value
                );
              END IF;
            END LOOP;

            FOR program IN SELECT * FROM public.loyalty_programs WHERE user_id = NEW.user_id AND type = 'spending' AND active = true LOOP
              IF FLOOR(new_spent / program.goal_value) > FLOOR(COALESCE(cust.total_spent, 0) / program.goal_value) THEN
                INSERT INTO public.customer_rewards (customer_id, program_id, code, discount_type, discount_value)
                VALUES (
                  NEW.customer_id, 
                  program.id, 
                  'VIP-' || substring(uuid_generate_v4()::text from 1 for 8),
                  program.reward_type, 
                  program.reward_value
                );
              END IF;
            END LOOP;

          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      DROP TRIGGER IF EXISTS on_order_completed_loyalty ON public.orders;
      CREATE TRIGGER on_order_completed_loyalty
      AFTER UPDATE ON public.orders
      FOR EACH ROW
      EXECUTE FUNCTION public.process_loyalty_rules();
      
      -- Remove old trigger to avoid conflict
      DROP TRIGGER IF EXISTS on_order_completed ON public.orders;
    `;

    await client.queryArray(sql);
    await client.end();

    return new Response(JSON.stringify({ success: true, message: "Cleanup completed successfully" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
