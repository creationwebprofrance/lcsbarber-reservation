import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const email = claimsData.claims.email as string | undefined;
    if (!email) {
      return new Response(JSON.stringify({ error: "No email on account" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profile } = await admin
      .from("profiles")
      .select("id, full_name, welcome_email_sent")
      .eq("user_id", userId)
      .maybeSingle();

    if (profile?.welcome_email_sent) {
      return new Response(JSON.stringify({ sent: false, reason: "already_sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const name = escapeHtml((profile?.full_name || email.split("@")[0] || "").trim());

    const { data: tpl } = await admin
      .from("email_templates")
      .select("subject, html_content")
      .eq("template_type", "welcome_client")
      .maybeSingle();

    const fallbackHtml = `
      <div style="font-family: Helvetica, Arial, sans-serif; background:#0B0B0B; padding:32px; color:#F4F1EA;">
        <div style="max-width:560px; margin:0 auto; background:#141414; border:1px solid #262626; border-radius:16px; padding:32px;">
          <p style="letter-spacing:.25em; font-size:12px; color:#C58B52; margin:0 0 12px;">LCS BARBER — BARBER ATELIER</p>
          <h1 style="font-size:26px; margin:0 0 16px; color:#F4F1EA;">Bienvenue ${name} 👊</h1>
          <p style="line-height:1.6; color:#CFC9BE; margin:0 0 14px;">
            C'est Lucas, le responsable de LCS Barber. Merci d'avoir créé ton compte.
          </p>
          <p style="margin:26px 0;">
            <a href="https://lcsbarber.com/reservation"
               style="background:#C58B52; color:#0B0B0B; text-decoration:none; font-weight:700; padding:14px 26px; border-radius:10px; display:inline-block;">
              Prendre rendez-vous
            </a>
          </p>
          <p style="line-height:1.6; color:#8C877F; font-size:13px; margin:0;">— Lucas, LCS Barber</p>
        </div>
      </div>`;

    const render = (t: string) =>
      t.replace(/\{\{\s*clientName\s*\}\}/g, name)
       .replace(/\{\{\s*clientEmail\s*\}\}/g, escapeHtml(email));

    const html = tpl?.html_content ? render(tpl.html_content) : fallbackHtml;
    const subject = tpl?.subject ? render(tpl.subject) : "Bienvenue chez LCS Barber 👊";

    const { error: sendError } = await resend.emails.send({
      from: "LCS Barber <noreply@lookware.fr>",
      to: [email],
      subject,
      html,
    });

    if (sendError) {
      console.error("Resend error:", sendError);
      return new Response(JSON.stringify({ error: "Email sending failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Notification admin : nouveau compte créé
    const adminEmail = Deno.env.get("BARBER_EMAIL") || "lucas.chipan97@gmail.com";
    const { error: adminSendError } = await resend.emails.send({
      from: "LCS Barber <noreply@lookware.fr>",
      to: [adminEmail],
      subject: `🆕 Nouveau compte client : ${name}`,
      html: `
        <div style="font-family: Helvetica, Arial, sans-serif; background:#0B0B0B; padding:32px; color:#F4F1EA;">
          <div style="max-width:560px; margin:0 auto; background:#141414; border:1px solid #262626; border-radius:16px; padding:32px;">
            <p style="letter-spacing:.25em; font-size:12px; color:#C58B52; margin:0 0 12px;">LCS BARBER — NOTIFICATION ADMIN</p>
            <h1 style="font-size:22px; margin:0 0 16px; color:#F4F1EA;">Nouveau compte créé 🆕</h1>
            <table style="width:100%; border-collapse:collapse; color:#CFC9BE; font-size:14px;">
              <tr>
                <td style="padding:8px 0; color:#8C877F;">Nom</td>
                <td style="padding:8px 0; text-align:right; color:#F4F1EA; font-weight:600;">${name}</td>
              </tr>
              <tr>
                <td style="padding:8px 0; color:#8C877F; border-top:1px solid #262626;">Email</td>
                <td style="padding:8px 0; text-align:right; color:#F4F1EA; font-weight:600; border-top:1px solid #262626;">${escapeHtml(email)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0; color:#8C877F; border-top:1px solid #262626;">Date</td>
                <td style="padding:8px 0; text-align:right; color:#F4F1EA; border-top:1px solid #262626;">${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}</td>
              </tr>
            </table>
            <p style="margin:26px 0 0;">
              <a href="https://lcsbarber.com/admin"
                 style="background:#C58B52; color:#0B0B0B; text-decoration:none; font-weight:700; padding:14px 26px; border-radius:10px; display:inline-block;">
                Voir dans l'admin
              </a>
            </p>
          </div>
        </div>`,
    });
    if (adminSendError) {
      console.error("Admin notification error:", adminSendError);
    }

    await admin
      .from("profiles")
      .update({ welcome_email_sent: true })
      .eq("user_id", userId);

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-welcome-email error:", e);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
