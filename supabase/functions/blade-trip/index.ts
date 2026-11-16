// BLADE estimated trip for home-service bookings: the route is computed once at departure
// (no continuous GPS). The client follows an estimated animation through a public token link.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@4';
import { BLADE_SITE, esc, layout, sendEmail } from '../_shared/blade-email.ts';
import { publicRoute, resolveSite } from './route.ts';

// Public Mapbox token already shipped to browsers (same fallback as blade-booking).
const MAPBOX_PUBLIC = 'pk.eyJ1IjoibGNoaXBhbiIsImEiOiJjbWZtOHc1dG4wZDdzMmlzN3hmeDRldnhzIn0.lK1A8wh63mIkudWk8h7f6Q';
const PLAN_ERROR = { error: 'Le trajet estimé est inclus dans le plan Premium.', code: 'plan_required' };

const Body = z.object({
  action: z.enum(['start', 'delay', 'arrived', 'cancel']),
  booking_id: z.uuid(),
  origin: z.object({ lng: z.number().min(-180).max(180), lat: z.number().min(-90).max(90) }).optional(),
  minutes: z.number().int().optional(),
  site: z.string().max(200).optional(),
});

const res = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const parisToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const parisHHMM = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');

type Trip = { id: string; booking_id: string; token: string; status: string; started_at: string; duration_s: number; distance_m: number; delay_min: number; arrived_at: string | null };
const TRIP_COLS = 'id,booking_id,token,status,started_at,duration_s,distance_m,delay_min,arrived_at';
const tripJson = (t: Trip) => ({
  booking_id: t.booking_id, token: t.token, status: t.status, started_at: t.started_at,
  duration_s: t.duration_s, distance_m: t.distance_m, delay_min: t.delay_min, arrived_at: t.arrived_at,
  eta: new Date(new Date(t.started_at).getTime() + (t.duration_s + t.delay_min * 60) * 1000).toISOString(),
});

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return res({ error: 'Méthode non autorisée' }, 405);
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return res({ error: 'Service indisponible' }, 503);
  const db = createClient(url, key, { auth: { persistSession: false } });

  const jwt = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!jwt) return res({ error: 'Connecte-toi pour continuer' }, 401);
  const { data: { user } } = await db.auth.getUser(jwt);
  if (!user) return res({ error: 'Connecte-toi pour continuer' }, 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return res({ error: 'Informations invalides' }, 400);
  const input = parsed.data;

  try {
    const { data: booking } = await db.from('bookings')
      .select('id,provider_id,appointment_date,status,client_address,client_email').eq('id', input.booking_id).maybeSingle();
    if (!booking?.provider_id) return res({ error: 'Réservation introuvable' }, 404);
    const { data: provider } = await db.from('blade_providers')
      .select('id,user_id,display_name,opt_auto_emails').eq('id', booking.provider_id).maybeSingle();
    if (!provider || provider.user_id !== user.id) return res({ error: 'Cette réservation ne t’appartient pas' }, 403);
    const proName = provider.display_name?.trim() || 'Ton barber';

    if (input.action === 'start') {
      const { data: plan, error: planError } = await db.rpc('blade_effective_plan', { p_provider: provider.id });
      if (planError) throw planError;
      if (plan !== 'premium') return res(PLAN_ERROR, 403);
      if (booking.status === 'cancelled') return res({ error: 'Cette réservation est annulée' }, 400);
      if (booking.appointment_date !== parisToday()) return res({ error: 'Le trajet ne peut démarrer que le jour du rendez-vous' }, 400);
      const address = (booking.client_address ?? '').trim();
      if (!address) return res({ error: 'Cette réservation n’est pas à domicile' }, 400);
      if (!input.origin) return res({ error: 'Ta position de départ est nécessaire' }, 400);

      const mapbox = Deno.env.get('MAPBOX_ACCESS_TOKEN') || MAPBOX_PUBLIC;
      const geo = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapbox}&country=FR&limit=1`).then(r => r.ok ? r.json() : null).catch(() => null);
      const dest = geo?.features?.[0]?.center as [number, number] | undefined;
      if (!dest) return res({ error: 'Adresse du client introuvable' }, 422);
      const o = input.origin;
      const dir = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${o.lng},${o.lat};${dest[0]},${dest[1]}?geometries=geojson&overview=full&access_token=${mapbox}`).then(r => r.ok ? r.json() : null).catch(() => null);
      const r0 = dir?.routes?.[0];
      const coords = r0?.geometry?.coordinates as [number, number][] | undefined;
      if (!r0 || !coords?.length || typeof r0.duration !== 'number' || typeof r0.distance !== 'number') return res({ error: 'Itinéraire indisponible pour le moment' }, 502);

      const route = publicRoute(coords, 500, 400);
      const { data: existing } = await db.from('blade_trips').select('token').eq('booking_id', booking.id).maybeSingle();
      const startedAt = new Date();
      const { data: trip, error } = await db.from('blade_trips').upsert({
        booking_id: booking.id, provider_id: provider.id, token: existing?.token ?? randomToken(), status: 'en_route',
        started_at: startedAt.toISOString(), duration_s: Math.round(r0.duration), distance_m: Math.round(r0.distance),
        delay_min: 0, arrived_at: null, route, dest: [Number(dest[0].toFixed(6)), Number(dest[1].toFixed(6))],
      }, { onConflict: 'booking_id' }).select(TRIP_COLS).single();
      if (error || !trip) throw error ?? new Error('upsert failed');

      const eta = new Date(startedAt.getTime() + trip.duration_s * 1000);
      if (provider.opt_auto_emails && booking.client_email) {
        const link = `${resolveSite(input.site, BLADE_SITE.replace(/\/blade$/, ''))}/blade/trajet/${trip.token}`;
        await sendEmail([booking.client_email], 'Ton barber est en route',
          layout('Ton barber est en route', `<p>${esc(proName)} est parti. Arrivée estimée vers <strong>${parisHHMM(eta)}</strong> (heure de Paris).</p><p>Suis son trajet estimé en direct.</p>`, { label: 'Suivre le trajet estimé', url: link }),
          `blade-trip-start-${trip.id}-${startedAt.getTime()}`);
      }
      return res({ token: trip.token, eta: eta.toISOString(), duration_s: trip.duration_s, distance_m: trip.distance_m });
    }

    const { data: trip } = await db.from('blade_trips').select(TRIP_COLS).eq('booking_id', booking.id).maybeSingle();
    if (!trip) return res({ error: 'Aucun trajet en cours pour cette réservation' }, 404);

    if (input.action === 'delay') {
      if (trip.status !== 'en_route') return res({ error: 'Le trajet n’est plus en cours' }, 409);
      if (input.minutes === undefined || input.minutes < 5 || input.minutes > 60) return res({ error: 'Le retard doit être compris entre 5 et 60 minutes' }, 400);
      const { data: updated, error } = await db.from('blade_trips').update({ delay_min: trip.delay_min + input.minutes })
        .eq('id', trip.id).eq('status', 'en_route').select(TRIP_COLS).single();
      if (error || !updated) throw error ?? new Error('update failed');
      return res(tripJson(updated));
    }

    if (input.action === 'arrived') {
      if (trip.status === 'cancelled') return res({ error: 'Ce trajet a été annulé' }, 409);
      if (trip.status === 'arrived') return res(tripJson(trip));
      const { data: updated, error } = await db.from('blade_trips').update({ status: 'arrived', arrived_at: new Date().toISOString() })
        .eq('id', trip.id).select(TRIP_COLS).single();
      if (error || !updated) throw error ?? new Error('update failed');
      if (provider.opt_auto_emails && booking.client_email) {
        await sendEmail([booking.client_email], 'Ton barber est arrivé',
          layout('Ton barber est arrivé', `<p>${esc(proName)} est arrivé à ton adresse.</p>`),
          `blade-trip-arrived-${trip.id}-${new Date(trip.started_at).getTime()}`);
      }
      return res(tripJson(updated));
    }

    // cancel
    const { data: updated, error } = await db.from('blade_trips').update({ status: 'cancelled' }).eq('id', trip.id).select(TRIP_COLS).single();
    if (error || !updated) throw error ?? new Error('update failed');
    return res(tripJson(updated));
  } catch (e) {
    console.error('blade-trip failed', input.action, e instanceof Error ? e.message : e);
    return res({ error: 'Une erreur est survenue. Réessaie dans un instant.' }, 500);
  }
});
