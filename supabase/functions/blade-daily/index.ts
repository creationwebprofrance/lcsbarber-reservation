// Daily BLADE job (scheduled once a day): reminders for tomorrow's appointments and
// one-month inactivity alerts. Idempotent: every email is recorded so repeat calls send nothing new.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { BLADE_SITE, detailRows, esc, frDate, layout, sendEmail, superadminEmails } from '../_shared/blade-email.ts';

const res = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const parisDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return res({ error: 'Method not allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return res({ error: 'Service indisponible' }, 503);
  const db = createClient(url, key, { auth: { persistSession: false } });
  let reminders = 0, inactivity = 0;

  // 1. Reminders for tomorrow (Paris time), only for providers with automatic emails on.
  const tomorrow = parisDate(new Date(Date.now() + 24 * 3600 * 1000));
  const { data: providers } = await db.from('blade_providers').select('id,user_id,status,display_name,email,opt_auto_emails,last_active_at,inactivity_notified_at');
  const emailing = new Map((providers ?? []).filter(p => p.status === 'active' && p.opt_auto_emails).map(p => [p.id, p]));
  if (emailing.size) {
    const { data: bookings } = await db.from('bookings').select('id,provider_id,client_name,client_email,appointment_date,appointment_time,services(name)')
      .eq('appointment_date', tomorrow).eq('status', 'confirmed').is('blade_reminder_sent_at', null).in('provider_id', [...emailing.keys()]).limit(500);
    for (const b of bookings ?? []) {
      const p = emailing.get(b.provider_id)!;
      const service = (b.services as { name?: string } | null)?.name ?? 'Prestation';
      const ok = await sendEmail([b.client_email], 'BLADE — Rappel : ton rendez-vous est demain',
        layout('Rappel : rendez-vous demain', `<p>Bonjour ${esc(b.client_name)},</p><p>Petit rappel pour ton rendez-vous de demain.</p>${detailRows([['Professionnel', p.display_name ?? 'BLADE'], ['Prestation', service], ['Date', frDate(b.appointment_date)], ['Heure', String(b.appointment_time).slice(0, 5)]])}<p>En cas d'empêchement, préviens ton professionnel au moins 1 heure avant.</p>`,
          { label: 'Mes rendez-vous', url: `${BLADE_SITE}/client/rendez-vous` }), `blade-reminder-${b.id}`, p.email ?? undefined);
      if (ok) { reminders++; await db.from('bookings').update({ blade_reminder_sent_at: new Date().toISOString() }).eq('id', b.id); }
    }
  }

  // 2. Inactivity: active providers with no activity for 30 days, alerted once per inactive period.
  const limit = Date.now() - 30 * 24 * 3600 * 1000;
  const inactive = (providers ?? []).filter(p => p.status === 'active' && new Date(p.last_active_at).getTime() < limit
    && (!p.inactivity_notified_at || new Date(p.inactivity_notified_at).getTime() < new Date(p.last_active_at).getTime()));
  const admins = inactive.length ? await superadminEmails(db) : [];
  for (const p of inactive) {
    const since = new Date(p.last_active_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
    const name = p.display_name ?? p.email ?? 'Prestataire';
    const toProvider = await sendEmail([p.email ?? ''], 'BLADE — On ne t’a pas vu depuis un mois',
      layout('Ton espace BLADE t’attend', `<p>Bonjour ${esc(name)},</p><p>Tu ne t'es pas connecté à ton espace professionnel depuis le ${esc(since)}.</p><p>Pense à mettre à jour tes disponibilités et tes prestations pour que tes clients puissent continuer à réserver.</p>`,
        { label: 'Ouvrir mon espace', url: `${BLADE_SITE}/pro` }), `blade-inactive-provider-${p.id}-${p.last_active_at}`);
    const toAdmin = await sendEmail(admins, `BLADE — Prestataire inactif depuis un mois : ${name}`,
      layout('Prestataire inactif', `<p><strong>${esc(name)}</strong> (${esc(p.email)}) n'est plus actif depuis le ${esc(since)}.</p><p>Un email de relance lui a ${toProvider ? 'été envoyé' : "<strong>pas</strong> pu être envoyé"}.</p>`,
        { label: 'Ouvrir le superadmin', url: `${BLADE_SITE}/pro/superadmin` }), `blade-inactive-admin-${p.id}-${p.last_active_at}`);
    if (toProvider || toAdmin) { inactivity++; await db.from('blade_providers').update({ inactivity_notified_at: new Date().toISOString() }).eq('id', p.id); }
  }
  return res({ reminders, inactivity });
});
