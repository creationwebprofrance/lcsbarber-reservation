import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Récupérer les infos de la réservation
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        *,
        services (name, duration_minutes)
      `)
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      throw new Error('Booking not found');
    }

    // Créer le fichier .ics
    const startDateTime = new Date(`${booking.appointment_date}T${booking.appointment_time}`);
    const endDateTime = new Date(startDateTime.getTime() + (booking.services.duration_minutes * 60000));

    const formatICalDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//LCS Style//Booking//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${booking.id}@lcsstyle.com`,
      `DTSTAMP:${formatICalDate(new Date())}`,
      `DTSTART:${formatICalDate(startDateTime)}`,
      `DTEND:${formatICalDate(endDateTime)}`,
      `SUMMARY:${booking.services.name} - ${booking.client_name}`,
      `DESCRIPTION:Client: ${booking.client_name}\\nTéléphone: ${booking.client_phone}\\nEmail: ${booking.client_email}\\nService: ${booking.services.name}\\nPrix: ${booking.total_price}€`,
      `LOCATION:${booking.client_address || 'À domicile'}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT2H',
      'ACTION:DISPLAY',
      'DESCRIPTION:Rappel: Rendez-vous dans 2 heures',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    // Créer le lien Google Calendar
    const googleCalendarUrl = new URL('https://calendar.google.com/calendar/render');
    googleCalendarUrl.searchParams.set('action', 'TEMPLATE');
    googleCalendarUrl.searchParams.set('text', `${booking.services.name} - ${booking.client_name}`);
    googleCalendarUrl.searchParams.set('dates', `${formatICalDate(startDateTime)}/${formatICalDate(endDateTime)}`);
    googleCalendarUrl.searchParams.set('details', `Client: ${booking.client_name}\nTéléphone: ${booking.client_phone}\nEmail: ${booking.client_email}\nService: ${booking.services.name}\nPrix: ${booking.total_price}€`);
    googleCalendarUrl.searchParams.set('location', booking.client_address || 'À domicile');

    return new Response(
      JSON.stringify({
        icsContent,
        googleCalendarUrl: googleCalendarUrl.toString(),
        icsDownloadUrl: `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error generating calendar event:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
