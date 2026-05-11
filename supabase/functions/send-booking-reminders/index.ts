import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Booking {
  id: string;
  client_name: string;
  client_email: string;
  appointment_date: string;
  appointment_time: string;
  total_price: number;
  services: {
    name: string;
  };
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
        client_name,
        client_email,
        appointment_date,
        appointment_time,
        total_price,
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

    const remindersToSend: { booking: Booking; type: 'tomorrow' | '2hours' }[] = [];

    // Filtrer les rendez-vous qui nécessitent un rappel
    bookings?.forEach((booking: Booking) => {
      const appointmentDateTime = new Date(`${booking.appointment_date}T${booking.appointment_time}`);
      
      // Rappel la veille (entre 18h et 20h la veille)
      const oneDayBefore = new Date(appointmentDateTime);
      oneDayBefore.setDate(oneDayBefore.getDate() - 1);
      oneDayBefore.setHours(19, 0, 0, 0); // 19h la veille
      
      const isTimeTomorrowReminder = Math.abs(now.getTime() - oneDayBefore.getTime()) < 60 * 60 * 1000; // Dans l'heure
      
      // Rappel 2h avant
      const twoHoursBefore = new Date(appointmentDateTime.getTime() - 2 * 60 * 60 * 1000);
      const isTime2HoursReminder = Math.abs(now.getTime() - twoHoursBefore.getTime()) < 30 * 60 * 1000; // Dans les 30 min

      if (isTimeTomorrowReminder) {
        remindersToSend.push({ booking, type: 'tomorrow' });
      } else if (isTime2HoursReminder) {
        remindersToSend.push({ booking, type: '2hours' });
      }
    });

    console.log(`Sending ${remindersToSend.length} reminders`);

    // Envoyer les rappels
    const results = await Promise.all(
      remindersToSend.map(async ({ booking, type }) => {
        try {
          const appointmentDateTime = new Date(`${booking.appointment_date}T${booking.appointment_time}`);
          const formattedDate = appointmentDateTime.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          const formattedTime = booking.appointment_time;

          const subject = type === 'tomorrow' 
            ? '📅 Rappel : Votre rendez-vous demain chez LCS Style ⭐'
            : '⏰ Rappel : Votre rendez-vous dans 2 heures chez LCS Style ⭐';

          const message = type === 'tomorrow'
            ? `Bonjour ${booking.client_name},\n\nNous vous rappelons votre rendez-vous demain chez LCS Style ⭐`
            : `Bonjour ${booking.client_name},\n\nVotre rendez-vous approche ! Dans 2 heures chez LCS Style ⭐`;

          // Email au barbier (toujours envoyé)
          const barberEmail = Deno.env.get("BARBER_EMAIL");
          if (!barberEmail) {
            console.error("BARBER_EMAIL secret missing, skipping barber notification");
            continue;
          }
          await resend.emails.send({
            from: "LCS Style <onboarding@resend.dev>",
            to: [barberEmail],
            subject: `${type === 'tomorrow' ? 'Demain' : 'Dans 2h'} : RDV avec ${booking.client_name}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Rappel de rendez-vous</h2>
                <p><strong>${type === 'tomorrow' ? 'Demain' : 'Dans 2 heures'}</strong>, vous avez un rendez-vous :</p>
                
                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <p><strong>Client :</strong> ${booking.client_name}</p>
                  <p><strong>Email :</strong> ${booking.client_email}</p>
                  <p><strong>Date :</strong> ${formattedDate}</p>
                  <p><strong>Heure :</strong> ${formattedTime}</p>
                  <p><strong>Service :</strong> ${booking.services.name}</p>
                  <p><strong>Prix :</strong> ${booking.total_price}€</p>
                </div>
              </div>
            `,
          });

          // Tenter d'envoyer au client (peut échouer en mode test)
          try {
            await resend.emails.send({
              from: "LCS Style <onboarding@resend.dev>",
              to: [booking.client_email],
              subject: subject,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #333;">${subject}</h2>
                  <p>${message}</p>
                  
                  <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0;">Détails du rendez-vous</h3>
                    <p><strong>Date :</strong> ${formattedDate}</p>
                    <p><strong>Heure :</strong> ${formattedTime}</p>
                    <p><strong>Service :</strong> ${booking.services.name}</p>
                    <p><strong>Prix :</strong> ${booking.total_price}€</p>
                  </div>

                  <p>À très bientôt !</p>
                  <p style="color: #666; font-size: 14px;">LCS Style ⭐</p>
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
