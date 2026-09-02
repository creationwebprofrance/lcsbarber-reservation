import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const schema = z.object({
  amount: z.number().positive().max(2000),
  email: z.string().email().max(255).optional().nullable(),
  description: z.string().max(200).optional().nullable(),
  origin: z.string().url().max(300).optional().nullable(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { amount, email, description, origin } = parsed.data;

    const key = Deno.env.get("STRIPE_SECRET_KEY");
    if (!key) {
      return new Response(JSON.stringify({ error: "Stripe non configuré" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(key, { apiVersion: "2023-10-16" });
    const base = origin ?? req.headers.get("origin") ?? "https://lcsbarber.com";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Active tous les moyens de paiement disponibles sur le compte Stripe
      // (CB, Apple Pay, Google Pay, Link, etc.) — Stripe affiche automatiquement
      // ceux compatibles avec l'appareil du client.
      payment_method_types: ["card", "link"],
      payment_method_options: {
        card: { setup_future_usage: undefined },
      },
      phone_number_collection: { enabled: false },
      customer_email: email ?? undefined,
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: "Acompte rendez-vous LCS Barber",
              description: description ?? "Acompte pour confirmer ton rendez-vous",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${base}/reservation?deposit=success`,
      cancel_url: `${base}/reservation?deposit=cancelled`,
    });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("create-deposit-payment error:", error);
    return new Response(JSON.stringify({ error: "Erreur lors de la création du paiement" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
