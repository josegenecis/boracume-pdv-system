
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    
    if (!user?.email) throw new Error("Usuário não autenticado.");

    const { planId } = await req.json();
    const normalizedPlanId = Number(planId);
    if (!Number.isInteger(normalizedPlanId) || normalizedPlanId < 1) {
      throw new Error("Plano inválido.");
    }
    
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id }
      });
      customerId = customer.id;
    }

    // Get plan details
    const { data: plan, error: planError } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('id', normalizedPlanId)
      .single();

    if (planError) {
      console.error("Plan lookup error:", planError);
    }
    if (!plan) throw new Error("Plano não encontrado no banco.");

    // Create subscription session
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      line_items: [{
        quantity: 1,
      }],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/subscription?success=true`,
      cancel_url: `${req.headers.get("origin")}/subscription?canceled=true`,
      metadata: {
        user_id: user.id,
        plan_id: normalizedPlanId.toString()
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_id: normalizedPlanId.toString()
        }
      }
    };

    // Use stripe_price_id if available, otherwise fallback to dynamic price
    if (plan.stripe_price_id) {
      sessionConfig.line_items[0].price = plan.stripe_price_id;
    } else {
      sessionConfig.line_items[0].price_data = {
        currency: "brl",
        product_data: { 
          name: `BoraCumê ${plan.name}`,
          description: plan.description
        },
        unit_amount: Math.round(plan.price * 100),
        recurring: { interval: "month" }
      };
    }

    let session;
    try {
      session = await stripe.checkout.sessions.create(sessionConfig);
    } catch (stripeError) {
      console.error("Stripe checkout error:", stripeError);
      throw new Error((stripeError as Error)?.message || "Erro ao criar checkout na Stripe.");
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({
      error: "checkout_failed",
      message: (error as Error)?.message || "Erro ao processar pagamento.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
