import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { BLADE_SITE, detailRows, esc, frDate, layout, sendEmail } from "../_shared/blade-email.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// Appelée uniquement par la tâche planifiée pg_cron, qui envoie l'en-tête x-cron-secret
// (lu dans Supabase Vault). Sans secret configuré, la fonction refuse tout appel.
// Compte prestataire de LCS Barber (même valeur que create-slot-request).
const LCS_PROVIDER_USER = 'da0b2f45-1ee1-441e-a06d-3bd046615ca8';
const CRON_SECRET = Deno.env.get("REMINDERS_CRON_SECRET") ?? "";

const safeEqual = (a: string, b: string) => {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};


interface Booking {
  id: string;
  provider_id: string | null;
  client_name: string;
  client_email: string;
  appointment_date: string;
  appointment_time: string;
  total_price: number;
  reminder_day_sent_at: string | null;
  reminder_2h_sent_at: string | null;
  services: {
    name: string;
  };
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!CRON_SECRET) {
    console.error("REMINDERS_CRON_SECRET missing: reminders disabled");
    return new Response(JSON.stringify({ error: "Service indisponible" }), { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
  if (req.method !== "POST" || !safeEqual(req.headers.get("x-cron-secret") ?? "", CRON_SECRET)) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Calculer les dates cibles
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    console.log("Checking for reminders...", { now, tomorrow, twoHoursLater });

    // Ces rappels (et la copie à BARBER_EMAIL) ne concernent que LCS Barber : jamais les clients d'un autre prestataire.
    const { data: lcs } = await supabase.from('blade_providers').select('id').eq('user_id', LCS_PROVIDER_USER).maybeSingle();
    const providerFilter = lcs?.id ? `provider_id.is.null,provider_id.eq.${lcs.id}` : 'provider_id.is.null';

    // Récupérer les rendez-vous qui nécessitent un rappel
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        id,
        provider_id,
        client_name,
        client_email,
        appointment_date,
        appointment_time,
        total_price,
        reminder_day_sent_at,
        reminder_2h_sent_at,
        services (name)
      `)
      .eq('status', 'pending')
      .or(providerFilter)
      .gte('appointment_date', now.toISOString().split('T')[0])
      .order('appointment_date')
      .order('appointment_time');

    if (error) {
      console.error("Error fetching bookings:", error);
      throw error;
    }

    console.log(`Found ${bookings?.length || 0} pending bookings`);

    // Automatic reminders are a Pro/Premium feature: skip BLADE providers on the free plan.
    const providerIds = [...new Set((bookings ?? []).map((b: Booking) => b.provider_id).filter((id): id is string => Boolean(id)))];
    const freeProviders = new Set<string>();
    for (const id of providerIds) {
      const { data: plan, error: planError } = await supabase.rpc('blade_effective_plan', { p_provider: id });
      if (planError || plan === 'free') freeProviders.add(id);
    }

    const remindersToSend: { booking: Booking; type: 'tomorrow' | '2hours' }[] = [];

    // Filtrer les rendez-vous qui nécessitent un rappel
    bookings?.forEach((booking: Booking) => {
      if (booking.provider_id && freeProviders.has(booking.provider_id)) return;
      const appointmentDateTime = new Date(`${booking.appointment_date}T${booking.appointment_time}`);
      
      // Rappel la veille (entre 18h et 20h la veille)
      const oneDayBefore = new Date(appointmentDateTime);
      oneDayBefore.setDate(oneDayBefore.getDate() - 1);
      oneDayBefore.setHours(19, 0, 0, 0); // 19h la veille
      
      const isTimeTomorrowReminder = Math.abs(now.getTime() - oneDayBefore.getTime()) < 60 * 60 * 1000; // Dans l'heure
      
      // Rappel 2h avant
      const twoHoursBefore = new Date(appointmentDateTime.getTime() - 2 * 60 * 60 * 1000);
      const isTime2HoursReminder = Math.abs(now.getTime() - twoHoursBefore.getTime()) < 30 * 60 * 1000; // Dans les 30 min

      if (isTimeTomorrowReminder && !booking.reminder_day_sent_at) {
        remindersToSend.push({ booking, type: 'tomorrow' });
      } else if (isTime2HoursReminder && !booking.reminder_2h_sent_at) {
        remindersToSend.push({ booking, type: '2hours' });
      }
    });

    console.log(`Sending ${remindersToSend.length} reminders`);

    // Envoyer les rappels
    const results = await Promise.all(
      remindersToSend.map(async ({ booking, type }) => {
        try {
          // Réserve l'envoi de façon atomique : un rappel donné part une seule fois par réservation.
          const column = type === 'tomorrow' ? 'reminder_day_sent_at' : 'reminder_2h_sent_at';
          const { data: claimed, error: claimError } = await supabase
            .from('bookings')
            .update({ [column]: new Date().toISOString() })
            .eq('id', booking.id)
            .is(column, null)
            .select('id');
          if (claimError || !claimed?.length) {
            return { success: false, bookingId: booking.id, type, error: claimError ? 'claim failed' : 'already sent' };
          }

          // Même modèle que les autres emails BLADE (layout partagé, expéditeur BLADE, version texte).
          const when = type === 'tomorrow' ? 'demain' : 'dans 2 heures';
          const time = String(booking.appointment_time).slice(0, 5);
          const service = booking.services?.name ?? 'Prestation';
          const price = booking.total_price != null ? `${booking.total_price} €` : '';
          const rows: [string, string][] = [['Prestation', service], ['Date', frDate(booking.appointment_date)], ['Heure', time], ...(price ? [['Prix', price] as [string, string]] : [])];

          // Email au barbier (toujours envoyé)
          const barberEmail = Deno.env.get("BARBER_EMAIL");
          if (!barberEmail) {
            console.error("BARBER_EMAIL secret missing, skipping reminder");
            return { success: false, bookingId: booking.id, type, error: "BARBER_EMAIL missing" };
          }
          const barberOk = await sendEmail([barberEmail], `BLADE — Rendez-vous ${when} avec ${String(booking.client_name).replace(/[\r\n\t]+/g, ' ')}`,
            layout(`Rendez-vous ${when}`, `<p>Tu as un rendez-vous ${when}.</p>${detailRows([['Client', booking.client_name], ['Email', booking.client_email], ...rows])}`,
              { label: 'Mon agenda', url: `${BLADE_SITE}/pro/agenda` }), `lcs-reminder-${type}-pro-${booking.id}`);
          if (!barberOk) console.warn(`Barber reminder failed for booking ${booking.id}`);

          const clientOk = await sendEmail([booking.client_email], `BLADE — Rappel : ton rendez-vous ${when === 'demain' ? 'est demain' : 'approche'}`,
            layout(type === 'tomorrow' ? 'Rappel : rendez-vous demain' : 'Rappel : rendez-vous dans 2 heures',
              `<p>Bonjour ${esc(booking.client_name)},</p><p>Petit rappel pour ton rendez-vous ${when} chez LCS Barber.</p>${detailRows([['Professionnel', 'LCS Barber'], ...rows])}<p>En cas d'empêchement, préviens ton professionnel au moins 1 heure avant.</p>`,
              { label: 'Mes rendez-vous', url: `${BLADE_SITE}/client/rendez-vous` }), `lcs-reminder-${type}-client-${booking.id}`);
          if (!clientOk) console.warn(`Client reminder failed for booking ${booking.id}`);

          console.log(`Reminder processed for booking ${booking.id} (${type})`);
          return { success: barberOk || clientOk, bookingId: booking.id, type };
        } catch (error) {
          console.error(`Error sending reminder for booking ${booking.id}:`, error);
          return { success: false, bookingId: booking.id, type, error };
        }
      })
    );

    return new Response(
      JSON.stringify({
        message: "Reminders processed",
        total: remindersToSend.length,
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-booking-reminders:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
