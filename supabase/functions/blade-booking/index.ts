// BLADE client booking: slot list, price quote and booking creation for a signed-in client.
// Every price, slot and status is recomputed here; the browser only sends choices.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@4';
import { BLADE_SITE, detailRows, esc, frDate, layout, sendEmail } from '../_shared/blade-email.ts';
import { DEFAULT_PRICING, DOMICILE_ADDRESS, MODE_LABEL, PHONE_OK, bookableSlots, depositFor, initialStatus, quote, slotsForDate, type Mode, type Pricing } from '../_shared/blade-booking-rules.ts';

// Public Mapbox token already shipped to browsers (domain-restricted).
const MAPBOX = 'pk.eyJ1IjoibGNoaXBhbiIsImEiOiJjbWZtOHc1dG4wZDdzMmlzN3hmeDRldnhzIn0.lK1A8wh63mIkudWk8h7f6Q';
const LCS_ORIGIN = [2.6336, 49.0425];

const Iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Time = z.string().regex(/^\d{2}:\d{2}$/);
const ModeS = z.enum(['domicile', 'deplacement']);
const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('slots'), service_id: z.uuid(), mode: ModeS, date: Iso }),
  z.object({ action: z.literal('quote'), service_id: z.uuid(), mode: ModeS, date: Iso, time: Time, address: z.string().max(300).optional() }),
  z.object({ action: z.literal('create'), service_id: z.uuid(), mode: ModeS, date: Iso, time: Time, address: z.string().max(300).optional(),
    name: z.string().trim().min(2).max(100), phone: z.string().trim().max(25), notes: z.string().trim().max(500).optional() }),
]);
const res = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function parisNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(p => [p.type, p.value]));
  return { today: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}
function addDays(iso: string, n: number) { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

async function travelMinutes(address: string): Promise<number | null> {
  try {
    const g = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX}&country=FR&limit=1`).then(r => r.json());
    const c = g?.features?.[0]?.center; if (!c) return null;
    const d = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${LCS_ORIGIN[0]},${LCS_ORIGIN[1]};${c[0]},${c[1]}?access_token=${MAPBOX}`).then(r => r.json());
    const s = d?.routes?.[0]?.duration; return typeof s === 'number' ? Math.ceil(s / 60) : null;
  } catch { return null; }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return res({ error: 'Method not allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return res({ error: 'Service indisponible' }, 503);
  const db = createClient(url, key, { auth: { persistSession: false } });
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!token) return res({ error: 'Connecte-toi pour réserver' }, 401);
  const { data: { user } } = await db.auth.getUser(token);
  if (!user?.email) return res({ error: 'Connecte-toi pour réserver' }, 401);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return res({ error: 'Informations invalides' }, 400);
  const input = parsed.data;
  const mode = input.mode as Mode;

  try {
    const { data: service } = await db.from('services').select('id,name,price,duration_minutes,is_active,provider_id').eq('id', input.service_id).maybeSingle();
    if (!service?.is_active || !service.provider_id) return res({ error: 'Prestation indisponible' }, 404);
    const { data: provider } = await db.from('blade_providers').select('id,user_id,status,display_name,email,opt_auto_emails,opt_payment_links,revolut_url,stripe_link_url').eq('id', service.provider_id).maybeSingle();
    if (!provider || provider.status !== 'active') return res({ error: 'Ce professionnel ne prend pas de rendez-vous pour le moment' }, 409);
    // Opening hours live in the LCS Barber calendar; other providers have no online calendar yet.
    const { data: superadmins } = await db.from('user_roles').select('user_id').eq('role', 'superadmin');
    const hasCalendar = (superadmins ?? []).some(r => r.user_id === provider.user_id);

    const { today, minutes } = parisNow();
    if (input.date < today || input.date > addDays(today, 92)) return res({ error: 'Date hors des disponibilités' }, 400);
    const [{ data: rules }, { data: overrides }, { data: taken }] = await Promise.all([
      db.from('calendar_settings').select('day_of_week,start_time,end_time,is_available,mode'),
      db.from('date_overrides').select('date,start_time,end_time,is_available,mode').eq('date', input.date),
      db.from('bookings').select('appointment_time,client_email').eq('provider_id', provider.id).eq('appointment_date', input.date).in('status', ['pending', 'confirmed']),
    ]);
    const open = hasCalendar ? slotsForDate(rules ?? [], overrides ?? [], mode, input.date) : [];
    const takenByOthers = (taken ?? []).filter(b => String(b.client_email).toLowerCase() !== user.email!.toLowerCase()).map(b => String(b.appointment_time));
    const slots = bookableSlots(open, takenByOthers, input.date, today, minutes);
    if (input.action === 'slots') return res({ slots });

    if (!slots.includes(input.time)) return res({ error: 'Ce créneau n’est plus disponible. Choisis-en un autre.' }, 409);
    const { data: priceRows } = await db.from('pricing_settings').select('setting_key,setting_value').eq('provider_id', provider.id);
    const pricing: Pricing = { ...DEFAULT_PRICING };
    for (const r of priceRows ?? []) if (r.setting_key in pricing) (pricing as Record<string, number>)[r.setting_key] = Number(r.setting_value);

    const address = mode === 'domicile' ? DOMICILE_ADDRESS : (input.address ?? '').trim();
    let minutesAway = 0;
    if (mode === 'deplacement') {
      if (address.length < 8) return res({ error: 'Indique ton adresse complète' }, 400);
      const m = await travelMinutes(address);
      if (m === null) return res({ error: 'Adresse introuvable. Vérifie-la (numéro, rue, ville).' }, 400);
      minutesAway = m;
    }
    const q = quote(service, mode, input.date, input.time, today, pricing, minutesAway);
    if (!q) return res({ error: 'Cette prestation n’est pas proposée pour ce lieu' }, 400);
    const status = initialStatus(provider);
    const deposit = status === 'pending' ? depositFor(q.total) : 0;
    if (input.action === 'quote') return res({ quote: q, status, deposit, travel_minutes: minutesAway });

    if (!PHONE_OK(input.phone)) return res({ error: 'Numéro de téléphone invalide' }, 400);
    const since = (ms: number) => new Date(Date.now() - ms).toISOString();
    const [{ count: hour }, { count: day }] = await Promise.all([
      db.from('bookings').select('id', { count: 'exact', head: true }).ilike('client_email', user.email).gte('created_at', since(3600e3)),
      db.from('bookings').select('id', { count: 'exact', head: true }).ilike('client_email', user.email).gte('created_at', since(86400e3)),
    ]);
    if ((hour ?? 0) >= 3 || (day ?? 0) >= 5) return res({ error: 'Trop de réservations récentes. Réessaie plus tard.' }, 429);

    const notes = [`Réservé via BLADE · ${MODE_LABEL[mode]}`, deposit ? `Acompte attendu : ${deposit} €` : null, input.notes || null].filter(Boolean).join('\n');
    const { data: booking, error } = await db.from('bookings').insert({
      service_id: service.id, provider_id: provider.id, client_name: input.name, client_email: user.email, client_phone: input.phone,
      client_address: address, appointment_date: input.date, appointment_time: input.time, status, total_price: q.total,
      travel_fee: q.travel, deposit_paid: false, notes,
    }).select('id,status').single();
    if (error || !booking) { console.error('insert', error); return res({ error: 'La réservation n’a pas pu être enregistrée' }, 500); }

    const { data: existing } = await db.from('clients').select('id').ilike('email', user.email).limit(1);
    if (!existing?.length) await db.from('clients').insert({ email: user.email, name: input.name, phone: input.phone, address: mode === 'deplacement' ? address : null, provider_id: provider.id });

    let emailSent = false;
    if (provider.opt_auto_emails) {
      const proName = provider.display_name ?? 'ton professionnel';
      const rows = detailRows([['Professionnel', proName], ['Prestation', q.label], ['Lieu', `${MODE_LABEL[mode]} — ${address}`], ['Date', frDate(input.date)], ['Heure', input.time], ['Total', `${q.total} €`], ...(deposit ? [['Acompte', `${deposit} €`] as [string, string]] : [])]);
      const clientHtml = status === 'confirmed'
        ? layout('Rendez-vous confirmé', `<p>Bonjour ${esc(input.name)},</p><p>Ton rendez-vous avec ${esc(proName)} est confirmé.</p>${rows}`, { label: 'Mes rendez-vous', url: `${BLADE_SITE}/client/rendez-vous` })
        : layout('Réservation enregistrée — acompte à régler', `<p>Bonjour ${esc(input.name)},</p><p>Ta réservation est enregistrée. Elle sera confirmée dès que ${esc(proName)} aura reçu ton acompte de <strong>${deposit} €</strong>.</p>${rows}`, { label: 'Payer l’acompte', url: `${BLADE_SITE}/client/rendez-vous` });
      const a = await sendEmail([user.email], status === 'confirmed' ? 'BLADE — Rendez-vous confirmé' : 'BLADE — Acompte à régler pour ton rendez-vous', clientHtml, `blade-book-client-${booking.id}`);
      const b = await sendEmail([provider.email ?? ''], `BLADE — Nouveau rendez-vous : ${input.name}`,
        layout('Nouveau rendez-vous', `<p><strong>${esc(input.name)}</strong> (${esc(user.email)} · ${esc(input.phone)}) a réservé.</p>${rows}<p>${status === 'pending' ? 'Le rendez-vous reste en attente jusqu’à ce que tu confirmes la réception de l’acompte.' : 'Le rendez-vous est confirmé.'}</p>`, { label: 'Ouvrir mon agenda', url: `${BLADE_SITE}/pro/${status === 'pending' ? 'paiements' : 'agenda'}` }), `blade-book-provider-${booking.id}`);
      emailSent = a || b;
    }
    await db.from('blade_providers').update({ last_active_at: new Date().toISOString() }).eq('id', provider.id).then(() => null, () => null);
    return res({ booking_id: booking.id, status: booking.status, total: q.total, deposit, email_sent: emailSent });
  } catch (e) {
    console.error('blade-booking', e);
    return res({ error: 'Erreur serveur' }, 500);
  }
});
