import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const barberEmail = Deno.env.get("BARBER_EMAIL") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const cancelSchema = z.object({
  clientName: z.string().trim().min(1).max(100),
  clientEmail: z.string().trim().email().max(255),
  clientPhone: z.string().trim().max(20).optional(),
  serviceName: z.string().trim().min(1).max(200),
  appointmentDate: z.string().trim().min(1),
  appointmentTime: z.string().trim().min(1).max(20),
  totalPrice: z.number().min(0).max(10000),
});

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawData = await req.json();
    const validationResult = cancelSchema.safeParse(rawData);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input data", details: validationResult.error.issues }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const booking = validationResult.data;
    console.log("Sending cancellation email for:", booking.clientName);

    const clientHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #DC2626, #991B1B); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { background: #FFF5F5; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #FEE2E2; border-top: none; }
    .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #DC2626; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #FEE2E2; }
    .detail-row:last-child { border-bottom: none; }
    .label { font-weight: bold; color: #991B1B; }
    .value { color: #333; }
    .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>❌ Rendez-vous Annulé</h1>
    </div>
    <div class="content">
      <p>Bonjour <strong>${booking.clientName}</strong>,</p>
      <p>Nous vous informons que votre rendez-vous a été <strong>annulé</strong>.</p>
      
      <div class="booking-details">
        <div class="detail-row">
          <span class="label">📅 Date</span>
          <span class="value">${booking.appointmentDate}</span>
        </div>
        <div class="detail-row">
          <span class="label">🕐 Heure</span>
          <span class="value">${booking.appointmentTime}</span>
        </div>
        <div class="detail-row">
          <span class="label">✂️ Prestation</span>
          <span class="value">${booking.serviceName}</span>
        </div>
      </div>
      
      <p>Si vous souhaitez reprendre un rendez-vous, n'hésitez pas à nous recontacter.</p>
      <p>À bientôt !</p>
    </div>
    <div class="footer">
      <p>LCS Barber - Coiffure à domicile</p>
    </div>
  </div>
</body>
</html>`;

    const adminHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #DC2626, #991B1B); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { background: #FFF5F5; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #FEE2E2; border-top: none; }
    .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #DC2626; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #FEE2E2; }
    .detail-row:last-child { border-bottom: none; }
    .label { font-weight: bold; color: #991B1B; }
    .value { color: #333; }
    .client-info { background: #FEE2E2; padding: 15px; border-radius: 8px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>❌ RDV Annulé</h1>
    </div>
    <div class="content">
      <p>Un rendez-vous a été annulé.</p>
      
      <div class="client-info">
        <p><strong>👤 Client:</strong> ${booking.clientName}</p>
        <p><strong>📧 Email:</strong> ${booking.clientEmail}</p>
        ${booking.clientPhone ? `<p><strong>📱 Téléphone:</strong> ${booking.clientPhone}</p>` : ''}
      </div>
      
      <div class="booking-details">
        <div class="detail-row">
          <span class="label">📅 Date</span>
          <span class="value">${booking.appointmentDate}</span>
        </div>
        <div class="detail-row">
          <span class="label">🕐 Heure</span>
          <span class="value">${booking.appointmentTime}</span>
        </div>
        <div class="detail-row">
          <span class="label">✂️ Prestation</span>
          <span class="value">${booking.serviceName}</span>
        </div>
        <div class="detail-row">
          <span class="label">💰 Total prévu</span>
          <span class="value">${booking.totalPrice}€</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

    // Send to client
    await resend.emails.send({
      from: "LCS Barber <noreply@lookware.fr>",
      to: [booking.clientEmail],
      subject: `❌ Rendez-vous annulé — ${booking.appointmentDate} à ${booking.appointmentTime}`,
      html: clientHtml,
    });

    // Send to admin
    if (barberEmail) {
      await resend.emails.send({
        from: "LCS Barber <noreply@lookware.fr>",
        to: [barberEmail],
        subject: `❌ RDV Annulé: ${booking.clientName} — ${booking.appointmentDate} à ${booking.appointmentTime}`,
        html: adminHtml,
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-cancellation-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
