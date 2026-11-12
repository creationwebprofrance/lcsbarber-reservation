// BLADE automatic emails triggered by a signed-in user action. Every event re-checks
// ownership and the provider's "emails automatiques" option server-side.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@4';
import { BLADE_SITE, detailRows, esc, frDate, layout, sendEmail, superadminEmails } from '../_shared/blade-email.ts';

const Body = z.discriminatedUnion('event', [
  z.object({ event: z.literal('provider_registered') }),
  z.object({ event: z.literal('provider_status'), provider_id: z.uuid() }),
  z.object({ event: z.literal('booking_confirmed'), booking_id: z.uuid() }),
  z.object({ event: z.literal('booking_cancelled'), booking_id: z.uuid() }),
  z.object({ event: z.literal('offer_reply'), reply_id: z.uuid() }),
]);
const res = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

type Provider = { id: string; user_id: string; status: string; display_name: string | null; email: string | null; opt_auto_emails: boolean };

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return res({ error: 'Method not allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return res({ error: 'Service indisponible' }, 503);
  const db = createClient(url, key, { auth: { persistSession: false } });
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!token) return res({ error: 'Unauthorized' }, 401);
  const { data: { user }, error: authError } = await db.auth.getUser(token);
  if (authError || !user) return res({ error: 'Unauthorized' }, 401);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return res({ error: 'Requête invalide' }, 400);
  const input = parsed.data;

  const providerOf = async (filter: { id?: string; user_id?: string }) => {
    let q = db.from('blade_providers').select('id,user_id,status,display_name,email,opt_auto_emails');
    if (filter.id) q = q.eq('id', filter.id); if (filter.user_id) q = q.eq('user_id', filter.user_id);
    const { data } = await q.maybeSingle(); return data as Provider | null;
  };
  const isSuperadmin = async () => { const { data } = await db.from('user_roles').select('id').eq('user_id', user.id).eq('role', 'superadmin'); return !!data?.length; };

  try {
    if (input.event === 'provider_registered') {
      const p = await providerOf({ user_id: user.id });
      if (!p || p.status !== 'pending') return res({ email_sent: false, reason: 'not_pending' });
      const admins = await superadminEmails(db);
      const name = p.display_name ?? p.email ?? 'Nouveau prestataire';
      const a = await sendEmail(admins, `BLADE — Nouveau prestataire à valider : ${name}`,
        layout('Nouveau prestataire à valider', `<p><strong>${esc(name)}</strong> (${esc(p.email)}) vient de créer un compte prestataire.</p><p>Ouvre ton espace superadmin pour valider son compte et choisir ses options.</p>`, { label: 'Ouvrir le superadmin', url: `${BLADE_SITE}/pro/superadmin` }), `blade-reg-admin-${p.id}`);
      const b = await sendEmail([p.email ?? user.email ?? ''], 'BLADE — Inscription reçue',
        layout('Inscription reçue', `<p>Bonjour ${esc(name)},</p><p>Ton compte prestataire est en attente de validation par LCS Barber. Tu recevras un email dès qu'il sera activé.</p>`), `blade-reg-provider-${p.id}`);
      return res({ email_sent: a || b });
    }

    if (input.event === 'provider_status') {
      if (!(await isSuperadmin())) return res({ error: 'Forbidden' }, 403);
      const p = await providerOf({ id: input.provider_id });
      if (!p?.email) return res({ email_sent: false, reason: 'no_email' });
      if (p.status === 'pending') return res({ email_sent: false, reason: 'pending' });
      const active = p.status === 'active';
      const sent = await sendEmail([p.email], active ? 'BLADE — Ton compte prestataire est actif' : 'BLADE — Ton compte prestataire est suspendu',
        layout(active ? 'Ton compte est actif' : 'Ton compte est suspendu', active
          ? `<p>Bonjour ${esc(p.display_name)},</p><p>LCS Barber a validé ton compte. Tu peux gérer ton profil, tes prestations, tes prix et tes rendez-vous depuis ton espace professionnel.</p>`
          : `<p>Bonjour ${esc(p.display_name)},</p><p>Ton compte prestataire BLADE a été suspendu par LCS Barber. Ton profil n'apparaît plus dans la recherche. Contacte LCS Barber pour en savoir plus.</p>`,
          active ? { label: 'Ouvrir mon espace', url: `${BLADE_SITE}/pro` } : undefined));
      return res({ email_sent: sent });
    }

    if (input.event === 'booking_confirmed' || input.event === 'booking_cancelled') {
      const { data: b } = await db.from('bookings').select('id,provider_id,client_name,client_email,appointment_date,appointment_time,status,total_price,deposit_received_at,services(name)').eq('id', input.booking_id).maybeSingle();
      if (!b?.provider_id) return res({ error: 'Rendez-vous introuvable' }, 404);
      const p = await providerOf({ id: b.provider_id });
      if (!p) return res({ error: 'Rendez-vous introuvable' }, 404);
      const isOwner = p.user_id === user.id && p.status === 'active';
      const isClient = (user.email ?? '').toLowerCase() === String(b.client_email).toLowerCase();
      if (!isOwner && !(input.event === 'booking_cancelled' && isClient)) return res({ error: 'Forbidden' }, 403);
      if (input.event === 'booking_confirmed' && b.status !== 'confirmed') return res({ email_sent: false, reason: 'not_confirmed' });
      if (input.event === 'booking_cancelled' && b.status !== 'cancelled') return res({ email_sent: false, reason: 'not_cancelled' });
      if (!p.opt_auto_emails) return res({ email_sent: false, reason: 'emails_disabled' });
      const service = (b.services as { name?: string } | null)?.name ?? 'Prestation';
      const rows = detailRows([['Professionnel', p.display_name ?? 'BLADE'], ['Prestation', service], ['Date', frDate(b.appointment_date)], ['Heure', String(b.appointment_time).slice(0, 5)], ['Total', `${Number(b.total_price)} €`]]);
      const confirmed = input.event === 'booking_confirmed';
      const clientSent = await sendEmail([b.client_email], confirmed ? 'BLADE — Ton rendez-vous est confirmé' : 'BLADE — Ton rendez-vous est annulé',
        layout(confirmed ? 'Rendez-vous confirmé' : 'Rendez-vous annulé', `<p>Bonjour ${esc(b.client_name)},</p><p>${confirmed ? (b.deposit_received_at ? 'Ton acompte a bien été reçu. ' : '') + 'Ton rendez-vous est confirmé.' : 'Ton rendez-vous a été annulé.'}</p>${rows}`,
          { label: 'Mes rendez-vous', url: `${BLADE_SITE}/client/rendez-vous` }), `blade-${input.event}-client-${b.id}`, p.email ?? undefined);
      const providerSent = await sendEmail([p.email ?? ''], confirmed ? `BLADE — Rendez-vous confirmé : ${b.client_name}` : `BLADE — Rendez-vous annulé : ${b.client_name}`,
        layout(confirmed ? 'Rendez-vous confirmé' : 'Rendez-vous annulé', `<p>${confirmed ? 'Le rendez-vous suivant est confirmé.' : 'Le rendez-vous suivant a été annulé.'}</p>${detailRows([['Client', b.client_name], ['Email', b.client_email], ['Prestation', service], ['Date', frDate(b.appointment_date)], ['Heure', String(b.appointment_time).slice(0, 5)]])}`,
          { label: 'Ouvrir mon espace', url: `${BLADE_SITE}/pro` }), `blade-${input.event}-provider-${b.id}`);
      return res({ email_sent: clientSent || providerSent, client: clientSent, provider: providerSent });
    }

    // offer_reply
    const { data: reply } = await db.from('blade_offer_replies').select('id,author_id,author_name,body,notified_at,blade_offers(id,title,author_id)').eq('id', input.reply_id).maybeSingle();
    if (!reply || reply.author_id !== user.id) return res({ error: 'Forbidden' }, 403);
    if (reply.notified_at) return res({ email_sent: true, duplicate: true });
    const offer = reply.blade_offers as unknown as { title: string; author_id: string } | null;
    if (!offer || offer.author_id === user.id) return res({ email_sent: false, reason: 'self' });
    const author = await providerOf({ user_id: offer.author_id });
    if (!author?.email || author.status !== 'active') return res({ email_sent: false, reason: 'no_recipient' });
    if (!author.opt_auto_emails) return res({ email_sent: false, reason: 'emails_disabled' });
    const sent = await sendEmail([author.email], `BLADE — Nouveau message : ${offer.title}`,
      layout('Nouveau message sur ton annonce', `<p><strong>${esc(reply.author_name)}</strong> a répondu à « ${esc(offer.title)} » :</p><blockquote style="border-left:3px solid #0a0a0a;margin:12px 0;padding-left:12px">${esc(reply.body)}</blockquote>`,
        { label: 'Répondre', url: `${BLADE_SITE}/pro/chat` }), `blade-reply-${reply.id}`);
    if (sent) await db.from('blade_offer_replies').update({ notified_at: new Date().toISOString() }).eq('id', reply.id);
    return res({ email_sent: sent });
  } catch (e) {
    console.error('blade-notify error', e);
    return res({ error: 'Service indisponible' }, 500);
  }
});
