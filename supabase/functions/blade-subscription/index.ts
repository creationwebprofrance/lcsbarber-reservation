import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { z } from "https://esm.sh/zod@3.22.4";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLANS = {
  pro: { amount: 1490, name: "BLADE Pro" },
  premium: { amount: 2990, name: "BLADE Premium" },
} as const;
type PaidPlan = keyof typeof PLANS;

const LIVE_STATUSES = ["trialing", "active", "past_due"];
const KNOWN_STATUSES = [
  "trialing", "active", "past_due", "canceled", "incomplete",
  "incomplete_expired", "unpaid", "paused",
];
const TRIAL_DAYS = 30;
const RETURN_PATH = "/blade/pro/abonnement";

const EXACT_ORIGINS = new Set([
  "https://lcsbarber-reservation.lovable.app",
  "https://lcsbarber.com",
  "https://www.lcsbarber.com",
]);
const ORIGIN_PATTERNS = [
  /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.lovable\.app$/,
  /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.lovableproject\.com$/,
  /^http:\/\/localhost:\d{1,5}$/,
];

function isAllowedOrigin(origin: string): boolean {
  if (EXACT_ORIGINS.has(origin)) return true;
  return ORIGIN_PATTERNS.some((re) => re.test(origin));
}

const schema = z.object({
  action: z.enum(["checkout", "sync", "portal"]),
  plan: z.enum(["pro", "premium"]).optional(),
  session_id: z.string().min(5).max(255).optional(),
  origin: z.string().max(300),
});

const log = (step: string, details?: unknown) =>
  console.log(`[BLADE-SUBSCRIPTION] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type SubRow = {
  provider_id: string;
  plan: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  had_trial: boolean;
  updated_at: string;
};

function effectivePlan(row: Pick<SubRow, "plan" | "status">) {
  return LIVE_STATUSES.includes(row.status) ? row.plan : "free";
}

function toIso(seconds: number | null | undefined) {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

function planFromSubscription(sub: Stripe.Subscription, fallback: string): string {
  const meta = sub.metadata?.plan;
  if (meta === "pro" || meta === "premium") return meta;
  const amount = sub.items?.data?.[0]?.price?.unit_amount;
  if (amount === PLANS.pro.amount) return "pro";
  if (amount === PLANS.premium.amount) return "premium";
  return fallback;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  try {
    // --- Authentification de l'appelant ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Connexion requise" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "Stripe non configuré" }, 500);
    if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "Serveur mal configuré" }, 500);

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return json({ error: "Session invalide, reconnecte-toi" }, 401);

    // --- Validation du corps ---
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return json({ error: "Requête invalide" }, 400);
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return json({ error: "Paramètres invalides" }, 400);
    const { action, plan, session_id } = parsed.data;
    const origin = parsed.data.origin.replace(/\/+$/, "");
    if (!isAllowedOrigin(origin)) return json({ error: "Origine non autorisée" }, 400);

    // --- Prestataire de l'appelant ---
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: provider, error: providerError } = await admin
      .from("blade_providers")
      .select("id, email, display_name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (providerError) throw providerError;
    if (!provider) return json({ error: "Aucun compte prestataire associé à cet utilisateur" }, 403);

    const { data: existing, error: rowError } = await admin
      .from("blade_subscriptions")
      .select("*")
      .eq("provider_id", provider.id)
      .maybeSingle();
    if (rowError) throw rowError;
    let row: SubRow | null = existing as SubRow | null;

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    log("Request", { action, provider: provider.id });

    const save = async (values: Partial<SubRow>) => {
      const { data, error } = await admin
        .from("blade_subscriptions")
        .upsert({ provider_id: provider.id, ...values }, { onConflict: "provider_id" })
        .select("*")
        .single();
      if (error) throw error;
      row = data as SubRow;
      return row;
    };

    const applySubscription = (sub: Stripe.Subscription) =>
      save({
        plan: planFromSubscription(sub, row?.plan ?? "free"),
        status: KNOWN_STATUSES.includes(sub.status) ? sub.status : "none",
        stripe_subscription_id: sub.id,
        current_period_end: toIso(sub.current_period_end),
        trial_end: toIso(sub.trial_end),
        cancel_at_period_end: Boolean(sub.cancel_at_period_end),
        had_trial: Boolean(row?.had_trial) || Boolean(sub.trial_start || sub.trial_end),
      });

    const portalUrl = async (customer: string) => {
      const portal = await stripe.billingPortal.sessions.create({
        customer,
        return_url: `${origin}${RETURN_PATH}`,
        locale: "fr",
      });
      return portal.url;
    };

    // ================= CHECKOUT =================
    if (action === "checkout") {
      if (!plan) return json({ error: "Choisis un plan (pro ou premium)" }, 400);
      const email = user.email ?? provider.email ?? undefined;

      let customerId = row?.stripe_customer_id ?? null;
      if (customerId) {
        try {
          const c = await stripe.customers.retrieve(customerId);
          if ((c as Stripe.DeletedCustomer).deleted) customerId = null;
        } catch {
          customerId = null;
        }
      }
      if (!customerId) {
        const customer = await stripe.customers.create({
          email,
          name: provider.display_name ?? undefined,
          metadata: { provider_id: provider.id },
        });
        customerId = customer.id;
        log("Customer created", { customerId });
      }
      if (customerId !== row?.stripe_customer_id) await save({ stripe_customer_id: customerId });

      const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 });
      const live = subs.data.find((s) => LIVE_STATUSES.includes(s.status));
      if (live) {
        await applySubscription(live);
        log("Live subscription exists, returning portal", { sub: live.id });
        return json({ url: await portalUrl(customerId), portal: true });
      }

      const p = PLANS[plan as PaidPlan];
      const withTrial = plan === "pro" && !row?.had_trial;
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        locale: "fr",
        allow_promotion_codes: true,
        line_items: [
          {
            price_data: {
              currency: "eur",
              unit_amount: p.amount,
              recurring: { interval: "month" },
              product_data: { name: p.name },
            },
            quantity: 1,
          },
        ],
        subscription_data: {
          metadata: { provider_id: provider.id, plan },
          ...(withTrial ? { trial_period_days: TRIAL_DAYS } : {}),
        },
        metadata: { provider_id: provider.id, plan },
        success_url: `${origin}${RETURN_PATH}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}${RETURN_PATH}?annule=1`,
      });
      log("Checkout session created", { session: session.id, plan, withTrial });
      return json({ url: session.url });
    }

    // ================= PORTAL =================
    if (action === "portal") {
      if (!row?.stripe_customer_id) return json({ error: "Aucun abonnement à gérer" }, 400);
      return json({ url: await portalUrl(row.stripe_customer_id) });
    }

    // ================= SYNC =================
    let sub: Stripe.Subscription | null = null;
    if (session_id) {
      if (!row?.stripe_customer_id) return json({ error: "Cette session ne t'appartient pas" }, 403);
      let session: Stripe.Checkout.Session;
      try {
        session = await stripe.checkout.sessions.retrieve(session_id, { expand: ["subscription"] });
      } catch {
        return json({ error: "Session de paiement introuvable" }, 400);
      }
      const sessionCustomer = typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (sessionCustomer !== row.stripe_customer_id) {
        return json({ error: "Cette session ne t'appartient pas" }, 403);
      }
      if (session.subscription) {
        sub = typeof session.subscription === "string"
          ? await stripe.subscriptions.retrieve(session.subscription)
          : session.subscription;
      }
    } else if (row?.stripe_subscription_id) {
      try {
        sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
      } catch (e) {
        if ((e as { code?: string })?.code === "resource_missing") {
          await save({ status: "canceled", cancel_at_period_end: false });
        } else throw e;
      }
    } else if (row?.stripe_customer_id) {
      // Rattrapage : abonnement créé mais retour Stripe jamais reçu
      const subs = await stripe.subscriptions.list({ customer: row.stripe_customer_id, status: "all", limit: 1 });
      sub = subs.data[0] ?? null;
    }

    if (sub) await applySubscription(sub);

    const current: SubRow = row ?? {
      provider_id: provider.id,
      plan: "free",
      status: "none",
      stripe_customer_id: null,
      stripe_subscription_id: null,
      current_period_end: null,
      trial_end: null,
      cancel_at_period_end: false,
      had_trial: false,
      updated_at: new Date().toISOString(),
    };
    return json({ ...current, effective_plan: effectivePlan(current) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message });
    return json({ error: "Erreur lors de la gestion de l'abonnement" }, 500);
  }
});
