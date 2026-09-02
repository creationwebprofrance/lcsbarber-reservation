import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { requireAdmin, escapeHtml } from "../_shared/admin-auth.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientName, clientEmail, serviceName, oldTime, newTime, appointmentDate, type } = await req.json();
    const isDateChange = type === 'date';
    const changeLabel = isDateChange ? "Changement de date" : "Changement d'horaire";

    if (!clientEmail || !clientName || !oldTime || !newTime) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    let emailsSent = 0;

    const cssClass = isDateChange ? "date-change" : "time-change";
    const clientHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #0099FF, #FF4433); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .time-change { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0099FF; text-align: center; }
    .old-time { font-size: 18px; color: #999; text-decoration: line-through; }
    .new-time { font-size: 28px; color: #0099FF; font-weight: bold; }
    .arrow { font-size: 24px; margin: 10px 0; }
    .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💈 ${changeLabel}</h1>
    </div>
    <div class="content">
      <p>Bonjour <strong>${clientName}</strong>,</p>
      <p>${isDateChange ? 'La date' : "L'horaire"} de votre réservation <strong>${serviceName || 'prestation'}</strong>${appointmentDate ? ` du <strong>${appointmentDate}</strong>` : ''} a été modifié${isDateChange ? 'e' : ''}.</p>
      
      <div class="time-change">
        <div class="old-time">${oldTime}</div>
        <div class="arrow">⬇️</div>
        <div class="new-time">${newTime}</div>
      </div>
      
      <p>N'hésitez pas à me contacter pour toute question.</p>
      <p>À très bientôt !</p>
    </div>
    <div class="footer">
      <p>LCS Barber - Coiffure à domicile</p>
    </div>
  </div>
</body>
</html>`;

    // Send to client
    try {
      await resend.emails.send({
        from: "LCS Barber <noreply@lookware.fr>",
        to: [clientEmail],
        subject: `💈 ${changeLabel} - ${serviceName || 'Votre réservation'}`,
        html: clientHtml,
      });
      emailsSent++;
      console.log(`Email sent to client: ${clientEmail}`);
    } catch (err) {
      console.error(`Failed to send email to client ${clientEmail}:`, err);
    }

    // Send copy to admin
    const barberEmail = Deno.env.get("BARBER_EMAIL");
    if (barberEmail) {
      try {
        await resend.emails.send({
          from: "LCS Barber <noreply@lookware.fr>",
          to: [barberEmail],
          subject: `💈 ${isDateChange ? 'Date modifiée' : 'Horaire modifié'} - ${clientName} (${oldTime} → ${newTime})`,
          html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: linear-gradient(135deg, #0099FF, #FF4433); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
  .header h1 { color: white; margin: 0; font-size: 24px; }
  .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
  .time-change { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0099FF; text-align: center; }
  .old-time { font-size: 18px; color: #999; text-decoration: line-through; }
  .new-time { font-size: 28px; color: #0099FF; font-weight: bold; }
</style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>💈 ${changeLabel} (Admin)</h1></div>
    <div class="content">
      <p>${isDateChange ? 'La date' : "L'horaire"} de la réservation de <strong>${clientName}</strong> (${serviceName || 'prestation'}) a été modifié${isDateChange ? 'e' : ''}.</p>
      ${appointmentDate ? `<p>📅 ${appointmentDate}</p>` : ''}
      <div class="time-change">
        <div class="old-time">${oldTime}</div>
        <div style="font-size:24px;margin:10px 0;">⬇️</div>
        <div class="new-time">${newTime}</div>
      </div>
      <p>Le client <strong>${clientName}</strong> (${clientEmail}) a été notifié.</p>
    </div>
  </div>
</body>
</html>`,
        });
        emailsSent++;
        console.log(`Admin email sent to: ${barberEmail}`);
      } catch (err) {
        console.error("Failed to send admin notification:", err);
      }
    }

    console.log(`Booking time change: ${emailsSent} emails sent for ${clientName}`);

    return new Response(
      JSON.stringify({ success: true, emailsSent }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in notify-booking-time-change:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
