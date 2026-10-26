// Staged only: never deployed from this shared-backend draft.
// Emails the offer author when someone else replies. Fails closed unless BLADE_EMAIL_ENABLED=true.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@4';
const input = z.object({ reply_id: z.uuid() });
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
const res = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return res({ error: 'Method not allowed' }, 405);
  if (Deno.env.get('BLADE_EMAIL_ENABLED') !== 'true') return res({ email_sent: false, reason: 'not_activated' });
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), apiKey = Deno.env.get('RESEND_API_KEY'), sender = Deno.env.get('BLADE_VERIFIED_SENDER');
  if (!url || !key || !apiKey || !sender) return res({ email_sent: false, reason: 'sender_not_configured' });
  const db = createClient(url, key);
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!token) return res({ error: 'Unauthorized' }, 401);
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return res({ error: 'Unauthorized' }, 401);
  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return res({ error: 'Invalid request' }, 400);
  const { data: reply } = await db.from('blade_offer_replies').select('*, blade_offers(id,title,author_id)').eq('id', parsed.data.reply_id).maybeSingle();
  if (!reply || reply.author_id !== user.id) return res({ error: 'Forbidden' }, 403);
  if (reply.notified_at) return res({ email_sent: true, duplicate: true });
  const offer = reply.blade_offers as { title: string; author_id: string } | null;
  if (!offer || offer.author_id === user.id) return res({ email_sent: false, reason: 'self' });
  const { data: author } = await db.auth.admin.getUserById(offer.author_id);
  const to = author?.user?.email;
  if (!to) return res({ email_sent: false, reason: 'no_email' });
  const html = `<div style="font-family:Arial,sans-serif;color:#171717"><h2 style="color:#4B342B">Nouvelle réponse à votre annonce</h2><p><strong>${esc(reply.author_name)}</strong> a répondu à « ${esc(offer.title)} » :</p><blockquote style="border-left:3px solid #4B342B;padding-left:12px">${esc(reply.body)}</blockquote><p>Répondez depuis votre espace professionnel BLADE.</p></div>`;
  const r = await fetch('https://connector-gateway.lovable.dev/resend/emails', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`, 'X-Connection-Api-Key': apiKey }, body: JSON.stringify({ from: sender, to: [to], subject: `BLADE — Nouvelle réponse : ${offer.title}`.slice(0, 150), html }) });
  if (!r.ok) { const t = await r.text(); console.error(`Resend failed [${r.status}]: ${t}`); return res({ email_sent: false, status: r.status, details: t }); }
  await db.from('blade_offer_replies').update({ notified_at: new Date().toISOString() }).eq('id', reply.id);
  return res({ email_sent: true });
});
