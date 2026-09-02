import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { z } from "https://esm.sh/zod@3.22.4";
import { requireAdmin } from "../_shared/admin-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const schema = z.object({
  booking_id: z.string().uuid(),
  cancel_booking: z.boolean().optional().default(true),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { error: authError } = await requireAdmin(req);
    if (authError) return authError;

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Requête invalide" }), { status: 400, headers: corsHeaders });
    }
    const { booking_id, cancel_booking } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("id, notes, deposit_paid, client_name, client_email")
      .eq("id", booking_id)
      .maybeSingle();

    if (bErr || !booking) {
      return new Response(JSON.stringify({ error: "Réservation introuvable" }), { status: 404, headers: corsHeaders });
    }
    if (!booking.deposit_paid) {
      return new Response(JSON.stringify({ error: "Aucun acompte payé pour cette réservation" }), { status: 400, headers: corsHeaders });
    }
    if (/Acompte remboursé/i.test(booking.notes ?? "")) {
      return new Response(JSON.stringify({ error: "Cet acompte a déjà été remboursé" }), { status: 400, headers: corsHeaders });
    }

    const sessionId = booking.notes?.match(/cs_[A-Za-z0-9_]+/)?.[0];
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Aucun paiement Stripe associé à cette réservation" }), { status: 400, headers: corsHeaders });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe non configuré" }), { status: 500, headers: corsHeaders });
    }

    const sessionRes = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { headers: { Authorization: `Bearer ${stripeKey}` } },
    );
    const session = await sessionRes.json();
    if (!sessionRes.ok || session.payment_status !== "paid" || !session.payment_intent) {
      return new Response(JSON.stringify({ error: "Paiement Stripe introuvable ou non réglé" }), { status: 400, headers: corsHeaders });
    }

    const body = new URLSearchParams({
      payment_intent: String(session.payment_intent),
      reason: "requested_by_customer",
    });
    const refundRes = await fetch("https://api.stripe.com/v1/refunds", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const refund = await refundRes.json();
    if (!refundRes.ok) {
      console.error("stripe refund error", refund);
      return new Response(JSON.stringify({ error: refund?.error?.message ?? "Remboursement Stripe refusé" }), { status: 400, headers: corsHeaders });
    }

    const amount = (refund.amount ?? 0) / 100;
    const note = `Acompte remboursé: ${amount}€ (${refund.id}) le ${new Date().toISOString().slice(0, 10)}`;
    const newNotes = [booking.notes, note].filter(Boolean).join("\n");

    const { error: updErr } = await supabase
      .from("bookings")
      .update({
        deposit_paid: false,
        notes: newNotes,
        ...(cancel_booking ? { status: "cancelled" } : {}),
      })
      .eq("id", booking_id);

    if (updErr) {
      console.error("booking update error", updErr);
    }

    // Email d'information au client (best effort)
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey && booking.client_email) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "LCS Barber <onboarding@resend.dev>",
            to: [booking.client_email],
            subject: "Remboursement de ton acompte",
            html: `<div style="font-family:Manrope,Arial,sans-serif;background:#0B0B0B;color:#F4F1EA;padding:24px;border-radius:12px">
              <h2 style="color:#C58B52;margin:0 0 12px">Acompte remboursé</h2>
              <p>Salut, je ne peux malheureusement pas assurer ton rendez-vous.</p>
              <p>Ton acompte de <strong>${amount}€</strong> vient d'être remboursé sur ton moyen de paiement (délai bancaire : 5 à 10 jours).</p>
              <p>Désolé pour la gêne — on se reprogramme quand tu veux.</p>
              <p style="color:#C58B52;margin-top:20px">LCS Barber</p>
            </div>`,
          }),
        });
      } catch (e) {
        console.error("refund email error", e);
      }
    }

    return new Response(JSON.stringify({ success: true, amount, refund_id: refund.id }), { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("refund-deposit error:", error);
    return new Response(JSON.stringify({ error: "Erreur lors du remboursement" }), { status: 500, headers: corsHeaders });
  }
});
