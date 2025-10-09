import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const bookingEmailSchema = z.object({
  clientName: z.string().trim().min(1).max(100),
  clientEmail: z.string().trim().email().max(255),
  clientPhone: z.string().trim().min(1).max(20),
  clientAddress: z.string().trim().min(1).max(500),
  serviceName: z.string().trim().min(1).max(200),
  servicePrice: z.number().positive().max(10000),
  appointmentDate: z.string().trim().min(1).max(50),
  appointmentTime: z.string().trim().min(1).max(20),
  totalPrice: z.number().positive().max(10000),
  travelFee: z.number().min(0).max(1000),
  depositAmount: z.number().min(0).max(10000),
  message: z.string().trim().max(2000).optional(),
});

type BookingEmailRequest = z.infer<typeof bookingEmailSchema>;

// Template email pour le client
const getClientEmailTemplate = (booking: BookingEmailRequest, googleCalendarUrl: string, icsDataUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Confirmation de votre rendez-vous - LCS Style</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f8f9fa; padding: 30px 20px; border-radius: 0 0 10px 10px; }
    .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 10px; background: white; border-radius: 5px; }
    .total { background: #e3f2fd; font-weight: bold; font-size: 18px; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
    .calendar-buttons { margin: 20px 0; text-align: center; }
    .calendar-btn { display: inline-block; margin: 5px; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
    .calendar-btn:hover { background: #764ba2; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✂️ LCS Style</h1>
      <h2>Confirmation de votre rendez-vous</h2>
    </div>
    <div class="content">
      <p>Bonjour <strong>${booking.clientName}</strong>,</p>
      
      <p>Votre rendez-vous a été confirmé avec succès ! Voici les détails :</p>
      
      <div class="detail-row">
        <span>Service :</span>
        <span><strong>${booking.serviceName}</strong></span>
      </div>
      
      <div class="detail-row">
        <span>Date :</span>
        <span><strong>${booking.appointmentDate}</strong></span>
      </div>
      
      <div class="detail-row">
        <span>Heure :</span>
        <span><strong>${booking.appointmentTime}</strong></span>
      </div>
      
      <div class="detail-row">
        <span>Adresse :</span>
        <span><strong>${booking.clientAddress}</strong></span>
      </div>
      
      <div class="detail-row">
        <span>Prix du service :</span>
        <span><strong>${booking.servicePrice}€</strong></span>
      </div>
      
      ${booking.travelFee > 0 ? `
      <div class="detail-row">
        <span>Frais de déplacement :</span>
        <span><strong>${booking.travelFee}€</strong></span>
      </div>
      ` : ''}
      
      <div class="detail-row total">
        <span>Total :</span>
        <span><strong>${booking.totalPrice}€</strong></span>
      </div>
      
      <div class="detail-row">
        <span>Acompte versé :</span>
        <span><strong>${booking.depositAmount}€</strong></span>
      </div>
      
      <div class="detail-row">
        <span>Reste à payer :</span>
        <span><strong>${booking.totalPrice - booking.depositAmount}€</strong></span>
      </div>
      
      ${booking.message ? `
      <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 5px;">
        <strong>Votre message :</strong><br>
        ${booking.message}
      </div>
      ` : ''}

      <div style="margin-top: 30px; padding: 20px; background: #e8f4fd; border-radius: 5px;">
        <h3 style="text-align: center;">📅 Ajouter à votre calendrier</h3>
        <p style="text-align: center; margin-bottom: 15px;">N'oubliez pas votre rendez-vous !</p>
        <div class="calendar-buttons">
          <a href="${googleCalendarUrl}" class="calendar-btn" target="_blank">📅 Google Calendar</a>
          <a href="${icsDataUrl}" class="calendar-btn" download="rendez-vous-lcs-style.ics">📲 iPhone/Outlook</a>
        </div>
      </div>
      
      <div style="margin-top: 30px; padding: 20px; background: #d4edda; border-radius: 5px;">
        <h3>📝 Informations importantes :</h3>
        <ul>
          <li>Merci d'être ponctuel à votre rendez-vous</li>
          <li>En cas d'empêchement, merci de nous prévenir au minimum 24h à l'avance</li>
          <li>Le solde de <strong>${booking.totalPrice - booking.depositAmount}€</strong> sera à régler sur place</li>
        </ul>
      </div>
      
      <div class="footer">
        <p>Merci de votre confiance ! 🙏</p>
        <p><strong>LCS Style</strong><br>
        📞 Contactez-nous si vous avez des questions</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

// Template email pour le barbier
const getBarberEmailTemplate = (booking: BookingEmailRequest, googleCalendarUrl: string, icsDataUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Nouvelle réservation - LCS Style</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f8f9fa; padding: 30px 20px; border-radius: 0 0 10px 10px; }
    .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 10px; background: white; border-radius: 5px; }
    .client-info { background: #e8f4fd; padding: 20px; border-radius: 5px; margin: 20px 0; }
    .total { background: #d4edda; font-weight: bold; font-size: 18px; }
    .calendar-buttons { margin: 20px 0; text-align: center; }
    .calendar-btn { display: inline-block; margin: 5px; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
    .calendar-btn:hover { background: #20c997; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💼 LCS Style</h1>
      <h2>Nouvelle réservation</h2>
    </div>
    <div class="content">
      <p><strong>Une nouvelle réservation vient d'être effectuée !</strong></p>
      
      <div class="client-info">
        <h3>👤 Informations client :</h3>
        <div class="detail-row">
          <span>Nom :</span>
          <span><strong>${booking.clientName}</strong></span>
        </div>
        <div class="detail-row">
          <span>Email :</span>
          <span><strong>${booking.clientEmail}</strong></span>
        </div>
        <div class="detail-row">
          <span>Téléphone :</span>
          <span><strong>${booking.clientPhone}</strong></span>
        </div>
        <div class="detail-row">
          <span>Adresse :</span>
          <span><strong>${booking.clientAddress}</strong></span>
        </div>
      </div>
      
      <h3>📅 Détails du rendez-vous :</h3>
      
      <div class="detail-row">
        <span>Service :</span>
        <span><strong>${booking.serviceName}</strong></span>
      </div>
      
      <div class="detail-row">
        <span>Date :</span>
        <span><strong>${booking.appointmentDate}</strong></span>
      </div>
      
      <div class="detail-row">
        <span>Heure :</span>
        <span><strong>${booking.appointmentTime}</strong></span>
      </div>
      
      <h3>💰 Détails financiers :</h3>
      
      <div class="detail-row">
        <span>Prix du service :</span>
        <span><strong>${booking.servicePrice}€</strong></span>
      </div>
      
      ${booking.travelFee > 0 ? `
      <div class="detail-row">
        <span>Frais de déplacement :</span>
        <span><strong>${booking.travelFee}€</strong></span>
      </div>
      ` : ''}
      
      <div class="detail-row total">
        <span>Total :</span>
        <span><strong>${booking.totalPrice}€</strong></span>
      </div>
      
      <div class="detail-row">
        <span>Acompte reçu :</span>
        <span><strong>${booking.depositAmount}€</strong></span>
      </div>
      
      <div class="detail-row">
        <span>À encaisser sur place :</span>
        <span><strong>${booking.totalPrice - booking.depositAmount}€</strong></span>
      </div>
      
      ${booking.message ? `
      <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 5px;">
        <strong>Message du client :</strong><br>
        ${booking.message}
      </div>
      ` : ''}

      <div style="margin-top: 30px; padding: 20px; background: #e8f4fd; border-radius: 5px;">
        <h3 style="text-align: center;">📅 Ajouter à votre calendrier</h3>
        <div class="calendar-buttons">
          <a href="${googleCalendarUrl}" class="calendar-btn" target="_blank">📅 Google Calendar</a>
          <a href="${icsDataUrl}" class="calendar-btn" download="rendez-vous-lcs-style.ics">📲 iPhone/Outlook</a>
        </div>
      </div>
      
      <div style="margin-top: 30px; padding: 20px; background: #d1ecf1; border-radius: 5px;">
        <h3>📋 Actions à effectuer :</h3>
        <ul>
          <li>Confirmer la disponibilité dans votre agenda</li>
          <li>Préparer le matériel nécessaire</li>
          <li>Prévoir l'itinéraire vers l'adresse client</li>
        </ul>
      </div>
    </div>
  </div>
</body>
</html>
`;

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Received booking email request");
    
    const rawData = await req.json();
    
    // Validate and sanitize input
    const validationResult = bookingEmailSchema.safeParse(rawData);
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error);
      return new Response(
        JSON.stringify({ error: "Invalid input data", details: validationResult.error.issues }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const booking = validationResult.data;
    console.log("Booking data validated");

    // Initialize Supabase client to fetch service details
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch service details for calendar
    const { data: service } = await supabase
      .from('services')
      .select('duration_minutes')
      .eq('name', booking.serviceName)
      .single();

    const durationMinutes = service?.duration_minutes || 60;

    // Generate calendar links
    const startDateTime = new Date(`${booking.appointmentDate}T${booking.appointmentTime}`);
    const endDateTime = new Date(startDateTime.getTime() + (durationMinutes * 60000));

    const formatICalDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    // Google Calendar URL
    const googleCalendarUrl = new URL('https://calendar.google.com/calendar/render');
    googleCalendarUrl.searchParams.set('action', 'TEMPLATE');
    googleCalendarUrl.searchParams.set('text', `${booking.serviceName} - ${booking.clientName}`);
    googleCalendarUrl.searchParams.set('dates', `${formatICalDate(startDateTime)}/${formatICalDate(endDateTime)}`);
    googleCalendarUrl.searchParams.set('details', `Service: ${booking.serviceName}\nPrix: ${booking.totalPrice}€`);
    googleCalendarUrl.searchParams.set('location', booking.clientAddress || 'À domicile');

    // ICS content for download
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//LCS Style//Booking//FR',
      'BEGIN:VEVENT',
      `DTSTART:${formatICalDate(startDateTime)}`,
      `DTEND:${formatICalDate(endDateTime)}`,
      `SUMMARY:${booking.serviceName} - ${booking.clientName}`,
      `DESCRIPTION:Service: ${booking.serviceName}\\nPrix: ${booking.totalPrice}€`,
      `LOCATION:${booking.clientAddress || 'À domicile'}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const icsDataUrl = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;

    // Send email to client with calendar links
    const clientEmailResponse = await resend.emails.send({
      from: "LCS Style <onboarding@resend.dev>",
      to: [booking.clientEmail],
      subject: "✂️ Confirmation de votre rendez-vous - LCS Style",
      html: getClientEmailTemplate(booking, googleCalendarUrl.toString(), icsDataUrl),
    });

    console.log("Client email sent:", clientEmailResponse);

    // Send email to barber with calendar links
    const barberEmail = Deno.env.get("BARBER_EMAIL");
    if (!barberEmail) {
      console.error("BARBER_EMAIL not configured");
      throw new Error("BARBER_EMAIL secret is not configured");
    }

    const barberEmailResponse = await resend.emails.send({
      from: "LCS Style <onboarding@resend.dev>",
      to: [barberEmail],
      subject: "🔔 Nouvelle réservation - LCS Style",
      html: getBarberEmailTemplate(booking, googleCalendarUrl.toString(), icsDataUrl),
    });

    console.log("Barber email sent:", barberEmailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        clientEmailId: clientEmailResponse.data?.id,
        barberEmailId: barberEmailResponse.data?.id 
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-booking-emails function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);