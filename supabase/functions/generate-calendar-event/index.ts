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
    const { bookingId, clientEmail } = await req.json();

    if (!bookingId || !clientEmail) {
      return new Response(
        JSON.stringify({ error: "bookingId and clientEmail are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authentification requise : l'appelant doit être connecté
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentification requise" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Session invalide" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // L'appelant doit être admin ou le client du rendez-vous
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!adminRole;
    const isOwner = (user.email ?? "").toLowerCase() === String(clientEmail).toLowerCase();

    if (!isAdmin && !isOwner) {
      return new Response(
        JSON.stringify({ error: "Accès refusé" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch booking and verify ownership by matching clientEmail
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        *,
        services (name, duration_minutes)
      `)
      .eq('id', bookingId)
      .eq('client_email', clientEmail)
      .single();

    if (error || !booking) {
      return new Response(
        JSON.stringify({ error: 'Booking not found' }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
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
      'PRODID:-//LCS Barber//Booking//FR',
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
      JSON.stringify({ error: "Server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
