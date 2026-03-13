
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("stripe-signature");
    const body = await req.text();
    
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      throw new Error("Webhook secret not configured");
    }

    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(body, signature!, webhookSecret);
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log(`Processing webhook event: ${event.type}`);

    const getUserIdFromCustomer = async (customerId: string): Promise<string | null> => {
      try {
        const customer = await stripe.customers.retrieve(customerId);
        if (customer && !('deleted' in customer) && (customer as any).metadata?.user_id) {
          return String((customer as any).metadata.user_id);
        }
      } catch {}
      return null;
    };

    const upsertSubscriptionByUserId = async (userId: string, patch: any) => {
      const { error } = await supabase
        .from('subscriptions')
        .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' });
      if (error) throw error;
    };

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') break;
        const userId = String((session.metadata as any)?.user_id || '');
        const planId = String((session.metadata as any)?.plan_id || '');
        const subscriptionId = String((session.subscription as any) || '');
        const customerId = String((session.customer as any) || '');
        if (!userId || !subscriptionId) break;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await upsertSubscriptionByUserId(userId, {
          status: subscription.status === 'active' ? 'active' : subscription.status,
          plan_id: planId || null,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString()
        });
        if (customerId) {
          try {
            await stripe.customers.update(customerId, { metadata: { user_id: userId } });
          } catch {}
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const userIdFromSub = String((subscription.metadata as any)?.user_id || '');
        const planId = String((subscription.metadata as any)?.plan_id || '');
        const userId = userIdFromSub || (await getUserIdFromCustomer(customerId)) || '';
        if (!userId) break;

        await upsertSubscriptionByUserId(userId, {
          status: subscription.status === 'active' ? 'active' : subscription.status,
          plan_id: planId || null,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString()
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const userIdFromSub = String((subscription.metadata as any)?.user_id || '');
        const userId = userIdFromSub || (await getUserIdFromCustomer(customerId)) || '';
        if (!userId) break;
        await upsertSubscriptionByUserId(userId, { status: 'canceled', updated_at: new Date().toISOString() });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const userId = (await getUserIdFromCustomer(customerId)) || '';
        if (!userId) break;
        await upsertSubscriptionByUserId(userId, { status: 'past_due', updated_at: new Date().toISOString() });
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
