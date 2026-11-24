import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// Appelée uniquement par la tâche planifiée pg_cron, qui envoie l'en-tête x-cron-secret
// (lu dans Supabase Vault). Sans secret configuré, la fonction refuse tout appel.
const CRON_SECRET = Deno.env.get("REMINDERS_CRON_SECRET") ?? "";

const safeEqual = (a: string, b: string) => {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

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

          const appointmentDateTime = new Date(`${booking.appointment_date}T${booking.appointment_time}`);
          const formattedDate = appointmentDateTime.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          const formattedTime = booking.appointment_time;

          const subject = type === 'tomorrow' 
            ? '📅 Rappel : Votre rendez-vous demain chez LCS Barber ⭐'
            : '⏰ Rappel : Votre rendez-vous dans 2 heures chez LCS Barber ⭐';

          const message = type === 'tomorrow'
            ? `Bonjour ${booking.client_name},\n\nNous vous rappelons votre rendez-vous demain chez LCS Barber ⭐`
            : `Bonjour ${booking.client_name},\n\nVotre rendez-vous approche ! Dans 2 heures chez LCS Barber ⭐`;

          // Email au barbier (toujours envoyé)
          const barberEmail = Deno.env.get("BARBER_EMAIL");
          if (!barberEmail) {
            console.error("BARBER_EMAIL secret missing, skipping reminder");
            return { success: false, bookingId: booking.id, type, error: "BARBER_EMAIL missing" };
          }
          await resend.emails.send({
            from: "LCS Barber <noreply@blade-hairstyle.com>",
            to: [barberEmail],
            subject: `${type === 'tomorrow' ? 'Demain' : 'Dans 2h'} : RDV avec ${booking.client_name}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Rappel de rendez-vous</h2>
                <p><strong>${type === 'tomorrow' ? 'Demain' : 'Dans 2 heures'}</strong>, vous avez un rendez-vous :</p>
                
                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <p><strong>Client :</strong> ${esc(booking.client_name)}</p>
                  <p><strong>Email :</strong> ${esc(booking.client_email)}</p>
                  <p><strong>Date :</strong> ${formattedDate}</p>
                  <p><strong>Heure :</strong> ${esc(formattedTime)}</p>
                  <p><strong>Service :</strong> ${esc(booking.services.name)}</p>
                  <p><strong>Prix :</strong> ${esc(booking.total_price)}€</p>
                </div>
              </div>
            `,
          });

          // Tenter d'envoyer au client (peut échouer en mode test)
          try {
            await resend.emails.send({
              from: "LCS Barber <noreply@blade-hairstyle.com>",
              to: [booking.client_email],
              subject: subject,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #333;">${subject}</h2>
                  <p>${esc(message).replace(/\n/g, "<br>")}</p>
                  
                  <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0;">Détails du rendez-vous</h3>
                    <p><strong>Date :</strong> ${formattedDate}</p>
                    <p><strong>Heure :</strong> ${esc(formattedTime)}</p>
                    <p><strong>Service :</strong> ${esc(booking.services.name)}</p>
                    <p><strong>Prix :</strong> ${esc(booking.total_price)}€</p>
                  </div>

                  <p>À très bientôt !</p>
                  <p style="color: #666; font-size: 14px;">LCS Barber ⭐</p>
                </div>
              `,
            });
          } catch (clientError: any) {
            console.warn(`Client email failed for booking ${booking.id}:`, clientError.message);
          }

          console.log(`Reminder sent for booking ${booking.id} (${type})`);
          return { success: true, bookingId: booking.id, type };
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
