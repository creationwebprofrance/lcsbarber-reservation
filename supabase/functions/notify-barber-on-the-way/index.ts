import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { requireAdmin, escapeHtml } from "../_shared/admin-auth.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const bodySchema = z.object({
  bookingId: z.string().uuid(),
  etaMinutes: z.number().int().min(0).max(600).optional(),
});

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { error: authError } = await requireAdmin(req);
    if (authError) return authError;

    const raw = await req.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parsed.error.issues }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const { bookingId, etaMinutes } = parsed.data;

    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("id, client_name, client_email, appointment_date, appointment_time, client_address, notes, service:services(name)")
      .eq("id", bookingId)
      .maybeSingle();

    if (fetchError || !booking) {
      return new Response(JSON.stringify({ error: "Réservation introuvable" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const service = booking.service as { name?: string } | null;
    const clientName = escapeHtml(booking.client_name);
    const serviceName = escapeHtml(service?.name ?? "Ta prestation");
    const dateStr = new Date(`${booking.appointment_date}T${booking.appointment_time}`);
    const formattedDate = dateStr.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const formattedTime = booking.appointment_time.slice(0, 5);

    const etaHtml =
      typeof etaMinutes === "number"
        ? `<p style="margin:0 0 16px;font-size:15px;color:#F4F1EA;">Arrivée estimée dans <strong style="color:#C58B52;">${etaMinutes} min</strong>.</p>`
        : "";

    const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0B0B0B;font-family:Manrope,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="background:#141414;border:1px solid #2a2a2a;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#C58B52,#8a5a2b);padding:24px;text-align:center;">
        <h1 style="margin:0;font-size:22px;color:#0B0B0B;font-weight:800;">LCS Barber est en route 🚗</h1>
      </div>
      <div style="padding:28px;">
        <p style="margin:0 0 16px;font-size:15px;color:#F4F1EA;">Salut ${clientName},</p>
        <p style="margin:0 0 16px;font-size:15px;color:#F4F1EA;">Lucas est en route pour ta prestation <strong>${serviceName}</strong>.</p>
        ${etaHtml}
        <div style="background:#0B0B0B;border:1px solid #2a2a2a;border-radius:12px;padding:16px;margin:8px 0 20px;">
          <p style="margin:0 0 6px;font-size:14px;color:#9a9a9a;">📅 ${escapeHtml(formattedDate)} à ${escapeHtml(formattedTime)}</p>
          ${booking.client_address ? `<p style="margin:0;font-size:14px;color:#9a9a9a;">📍 ${escapeHtml(booking.client_address)}</p>` : ""}
        </div>
        <p style="margin:0;font-size:13px;color:#9a9a9a;">Prépare-toi, j'arrive ! À tout de suite ✂️</p>
      </div>
    </div>
    <p style="text-align:center;font-size:11px;color:#666;margin-top:20px;">LCS Barber — lcsbarber.com</p>
  </div>
</body>
</html>`;

    const { error: sendError } = await resend.emails.send({
      from: "LCS Barber <noreply@lookware.fr>",
      to: [booking.client_email],
      subject: "LCS Barber est en route 🚗",
      html,
    });

    if (sendError) {
      console.error("Resend error:", sendError);
      return new Response(JSON.stringify({ error: "Échec de l'envoi de l'email" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("On-the-way notification sent for booking:", bookingId);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e) {
    console.error("notify-barber-on-the-way error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur interne" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
