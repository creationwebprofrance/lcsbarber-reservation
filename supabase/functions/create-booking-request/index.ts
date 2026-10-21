import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { Resend } from "npm:resend@2.0.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const schema = z.object({
  client_name: z.string().trim().min(2).max(100),
  client_email: z.string().trim().email().max(255),
  client_phone: z.string().trim().max(20).optional().nullable(),
  mode: z.enum(["domicile", "deplacement"]).optional().nullable(),
  preferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  preferred_time: z.string().max(20).optional().nullable(),
  message: z.string().trim().max(1000).optional().nullable(),
});

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Données invalides" }, 400);
    const d = parsed.data;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let userId: string | null = null;
    const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (auth) {
      const { data } = await supabase.auth.getUser(auth);
      userId = data.user?.id ?? null;
    }

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase.from("booking_requests").select("id", { count: "exact", head: true })
      .eq("client_email", d.client_email).gte("created_at", since);
    if ((count ?? 0) >= 3) return json({ error: "Trop de demandes récentes, réessaie plus tard." }, 429);

    const { data: row, error } = await supabase.from("booking_requests")
      .insert({ ...d, user_id: userId }).select("id").single();
    if (error) { console.error(error); return json({ error: "Erreur d'enregistrement" }, 500); }

    try {
      const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
      const modeLabel = d.mode === "domicile" ? "Le client se déplace" : d.mode === "deplacement" ? "LCS Barber se déplace" : "—";
      await resend.emails.send({
        from: "LCS Barber <noreply@lookware.fr>",
        to: ["lucas.chipan97@gmail.com"],
        reply_to: d.client_email,
        subject: `Nouvelle demande de réservation — ${d.client_name}`,
        html: `<div style="font-family:Arial,sans-serif;background:#0B0B0B;color:#F4F1EA;padding:24px;border-radius:12px">
          <h2 style="color:#C58B52;margin-top:0">Nouvelle demande de réservation</h2>
          <p><b>Nom :</b> ${esc(d.client_name)}<br/><b>Email :</b> ${esc(d.client_email)}<br/>
          <b>Téléphone :</b> ${esc(d.client_phone || "—")}<br/><b>Mode :</b> ${esc(modeLabel)}<br/>
          <b>Date souhaitée :</b> ${esc(d.preferred_date || "—")} ${esc(d.preferred_time || "")}</p>
          <p><b>Message :</b><br/>${esc(d.message || "—").replace(/\n/g, "<br/>")}</p></div>`,
      });
    } catch (e) { console.error("email error", e); }

    return json({ success: true, id: row.id });
  } catch (e) {
    console.error(e);
    return json({ error: "Erreur serveur" }, 500);
  }
});
