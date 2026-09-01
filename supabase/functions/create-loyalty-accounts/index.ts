import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );

const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

const buildHtml = (name: string, link: string) => `
  <div style="font-family: Helvetica, Arial, sans-serif; background:#0B0B0B; padding:32px; color:#F4F1EA;">
    <div style="max-width:560px; margin:0 auto; background:#141414; border:1px solid #262626; border-radius:16px; padding:32px;">
      <p style="letter-spacing:.25em; font-size:12px; color:#C58B52; margin:0 0 12px;">LCS STYLE — BARBER ATELIER</p>
      <h1 style="font-size:26px; margin:0 0 16px; color:#F4F1EA;">Ton compte fidélité est créé ${name ? "— " + name : ""} 👊</h1>
      <p style="line-height:1.6; color:#CFC9BE; margin:0 0 14px;">
        C'est Lucas, de LCS Barber. Je viens de créer ton <strong>compte de fidélité client</strong> :
        tu retrouves l'historique de tes coupes, tes rendez-vous à venir et tu réserves en quelques secondes.
      </p>
      <p style="line-height:1.6; color:#CFC9BE; margin:0 0 14px;">
        Il te suffit de définir ton mot de passe pour y accéder :
      </p>
      <p style="margin:26px 0;">
        <a href="${link}"
           style="background:#C58B52; color:#0B0B0B; text-decoration:none; font-weight:700; padding:14px 26px; border-radius:10px; display:inline-block;">
          Activer mon compte
        </a>
      </p>
      <p style="line-height:1.6; color:#8C877F; font-size:13px; margin:0;">
        À très vite pour ta prochaine coupe.<br/>— Lucas, LCS Barber
      </p>
    </div>
  </div>`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const onlyEmails: string[] | null = Array.isArray(body?.emails)
      ? body.emails.map((e: string) => String(e).trim().toLowerCase()).filter(isEmail)
      : null;

    // Collect all known client emails
    const names = new Map<string, string>();
    const emails = new Set<string>();

    const { data: bookings } = await admin
      .from("bookings")
      .select("client_email, client_name")
      .limit(5000);
    for (const b of bookings ?? []) {
      const e = (b.client_email || "").trim().toLowerCase();
      if (!isEmail(e)) continue;
      emails.add(e);
      if (b.client_name && !names.has(e)) names.set(e, b.client_name);
    }

    const { data: clients } = await admin
      .from("clients")
      .select("email, name")
      .limit(5000);
    for (const c of clients ?? []) {
      const e = (c.email || "").trim().toLowerCase();
      if (!isEmail(e)) continue;
      emails.add(e);
      if (c.name && !names.has(e)) names.set(e, c.name);
    }

    let targets = [...emails];
    if (onlyEmails?.length) targets = targets.filter((e) => onlyEmails.includes(e));

    // Existing accounts
    const existing = new Set<string>();
    for (let page = 1; page <= 20; page++) {
      const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      const users = list?.users ?? [];
      users.forEach((u) => u.email && existing.add(u.email.toLowerCase()));
      if (users.length < 1000) break;
    }

    const results = { created: 0, emailed: 0, skipped: 0, failed: [] as string[] };
    const redirectTo = "https://lcsbarber.com/reset-password";

    for (const email of targets) {
      try {
        if (!existing.has(email)) {
          const { error: createErr } = await admin.auth.admin.createUser({
            email,
            email_confirm: true,
            password: crypto.randomUUID() + crypto.randomUUID(),
            user_metadata: { full_name: names.get(email) ?? email.split("@")[0] },
          });
          if (createErr && !`${createErr.message}`.toLowerCase().includes("already")) {
            results.failed.push(email);
            continue;
          }
          results.created++;
        } else {
          results.skipped++;
        }

        const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo },
        });
        const link = linkData?.properties?.action_link;
        if (linkErr || !link) {
          results.failed.push(email);
          continue;
        }

        const name = escapeHtml((names.get(email) || "").trim());
        const { error: sendErr } = await resend.emails.send({
          from: "LCS Style <noreply@lookware.fr>",
          to: [email],
          subject: "Ton compte fidélité LCS Barber est créé 👊",
          html: buildHtml(name, link),
        });
        if (sendErr) {
          results.failed.push(email);
          continue;
        }
        results.emailed++;
        await new Promise((r) => setTimeout(r, 600));
      } catch (_e) {
        results.failed.push(email);
      }
    }

    return new Response(JSON.stringify({ total: targets.length, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-loyalty-accounts error:", e);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
