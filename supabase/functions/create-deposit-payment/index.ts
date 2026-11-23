import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { z } from "https://esm.sh/zod@3.22.4";
import { allowRequest } from "../_shared/rate-limit.ts";

// Origines autorisées pour les URL de retour Stripe (le reste retombe sur le site officiel).
const ALLOWED_ORIGINS = [
  /^https:\/\/(www\.)?lcsbarber\.com$/,
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/,
  /^http:\/\/localhost(:\d+)?$/,
];
const DEFAULT_ORIGIN = "https://lcsbarber.com";
const safeOrigin = (o: string | null | undefined) => (o && ALLOWED_ORIGINS.some((r) => r.test(o)) ? o : DEFAULT_ORIGIN);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const schema = z.object({
  // Acompte LCS : la moitié de la prestation, 10 € minimum (voir src/lib/deposit.ts).
  amount: z.number().min(10).max(500),
  email: z.string().email().max(255).optional().nullable(),
  description: z.string().max(200).optional().nullable(),
  origin: z.string().url().max(300).optional().nullable(),
  embedded: z.boolean().optional(),
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
    // Le libellé n'est plus fourni par le navigateur : il est fixe côté serveur.
    const { email, origin, embedded } = parsed.data;
    const amount = Math.round(parsed.data.amount * 100) / 100;

    // Limite : 10 sessions de paiement par heure et par adresse IP.
    if (!(await allowRequest(req, "deposit", 10, 3600))) {
      return new Response(JSON.stringify({ error: "Trop de tentatives. Réessaie dans un moment." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const key = Deno.env.get("STRIPE_SECRET_KEY");
    if (!key) {
      return new Response(JSON.stringify({ error: "Stripe non configuré" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(key, { apiVersion: "2023-10-16" });
    const base = safeOrigin(origin ?? req.headers.get("origin"));

    const common = {
      mode: "payment" as const,
      // Carte + Link — Apple Pay / Google Pay s'affichent automatiquement avec "card"
      payment_method_types: ["card", "link"],
      customer_email: email ?? undefined,
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: "Acompte rendez-vous LCS Barber",
              description: `Acompte de ${amount.toFixed(2).replace(".", ",")} € pour confirmer ton rendez-vous`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: { source: "lcs-deposit" },
    };

    // Checkout intégré (Payment Element dans la page) — Apple Pay / Google Pay / CB / Link
    if (embedded !== false) {
      const session = await stripe.checkout.sessions.create({
        ...common,
        ui_mode: "embedded",
        redirect_on_completion: "never",
      });

      return new Response(
        JSON.stringify({ clientSecret: session.client_secret, sessionId: session.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const session = await stripe.checkout.sessions.create({
      ...common,
      payment_method_types: ["card", "link"],
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
