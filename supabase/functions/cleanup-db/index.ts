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
      -- Tabela de Configurações de Impressão
      CREATE TABLE IF NOT EXISTS public.printer_settings (
        user_id uuid PRIMARY KEY REFERENCES auth.users(id),
        paper_width text DEFAULT '80mm', -- '58mm' ou '80mm'
        font_size text DEFAULT 'normal', -- 'small', 'normal', 'large'
        print_header text, -- Nome da loja ou CNPJ no topo
        print_footer text DEFAULT 'Obrigado pela preferência!',
        auto_print boolean DEFAULT false, -- Imprimir automático ao aceitar pedido
        print_kitchen_ticket boolean DEFAULT false, -- Imprime uma comanda enxuta da cozinha junto do cupom
        copies integer DEFAULT 1,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );

      -- Policy (Permissões) - Simples para permitir leitura/escrita pelo dono
      ALTER TABLE public.printer_settings ENABLE ROW LEVEL SECURITY;
      
      DROP POLICY IF EXISTS "Users can manage their own printer settings" ON public.printer_settings;
      CREATE POLICY "Users can manage their own printer settings"
      ON public.printer_settings
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
      
      -- Atualizar a função de fidelidade
      CREATE OR REPLACE FUNCTION public.process_loyalty_rules()
      RETURNS TRIGGER AS $$
      DECLARE
        program RECORD;
        cust RECORD;
        new_visits integer;
        new_spent numeric;
        points_earned numeric;
        msg text;
      BEGIN
        IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
          
          SELECT * INTO cust FROM public.customers WHERE id = NEW.customer_id;
          
          IF cust IS NOT NULL THEN
            points_earned := FLOOR(NEW.total);
            
            UPDATE public.customers
            SET 
              points = COALESCE(points, 0) + points_earned,
              total_spent = COALESCE(total_spent, 0) + NEW.total,
              visits_count = COALESCE(visits_count, 0) + 1
            WHERE id = NEW.customer_id;

            IF cust.phone IS NOT NULL THEN
              msg := 'Olá ' || cust.name || '! Seu pedido foi concluído. Você ganhou ' || points_earned || ' pontos! Saldo atual: ' || (COALESCE(cust.points, 0) + points_earned);
              
              INSERT INTO public.notification_queue (user_id, customer_id, phone, message)
              VALUES (NEW.user_id, NEW.customer_id, cust.phone, msg);
            END IF;

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
                
                IF cust.phone IS NOT NULL THEN
                  msg := 'PARABÉNS! Você completou ' || program.goal_value || ' pedidos e ganhou um prêmio!';
                  INSERT INTO public.notification_queue (user_id, customer_id, phone, message)
                  VALUES (NEW.user_id, NEW.customer_id, cust.phone, msg);
                END IF;
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
                 
                 IF cust.phone IS NOT NULL THEN
                  msg := 'PARABÉNS VIP! Você atingiu R$ ' || program.goal_value || ' em compras e ganhou um prêmio!';
                  INSERT INTO public.notification_queue (user_id, customer_id, phone, message)
                  VALUES (NEW.user_id, NEW.customer_id, cust.phone, msg);
                 END IF;
              END IF;
            END LOOP;

          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      CREATE TABLE IF NOT EXISTS public.waiter_service_charge_settings (
        user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        enabled boolean NOT NULL DEFAULT true,
        percentage numeric(6, 2) NOT NULL DEFAULT 10,
        tax_withhold_percent numeric(6, 2) NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.waiter_service_charges (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        session_id uuid NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
        account_id uuid REFERENCES public.table_accounts(id) ON DELETE SET NULL,
        waiter_id uuid REFERENCES public.waiters(id) ON DELETE SET NULL,
        base_amount numeric(12, 2) NOT NULL DEFAULT 0,
        percentage numeric(6, 2) NOT NULL DEFAULT 10,
        gross_amount numeric(12, 2) NOT NULL DEFAULT 0,
        tax_withhold_percent numeric(6, 2) NOT NULL DEFAULT 0,
        tax_amount numeric(12, 2) NOT NULL DEFAULT 0,
        net_waiter_amount numeric(12, 2) NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      ALTER TABLE public.waiter_service_charge_settings ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.waiter_service_charges ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS service_charge_settings_owner_all ON public.waiter_service_charge_settings;
      CREATE POLICY service_charge_settings_owner_all
        ON public.waiter_service_charge_settings
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);

      DROP POLICY IF EXISTS service_charges_owner_all ON public.waiter_service_charges;
      CREATE POLICY service_charges_owner_all
        ON public.waiter_service_charges
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);

      CREATE INDEX IF NOT EXISTS idx_waiter_service_charges_user_id ON public.waiter_service_charges(user_id);
      CREATE INDEX IF NOT EXISTS idx_waiter_service_charges_session_id ON public.waiter_service_charges(session_id);
      CREATE INDEX IF NOT EXISTS idx_waiter_service_charges_waiter_id ON public.waiter_service_charges(waiter_id);
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
