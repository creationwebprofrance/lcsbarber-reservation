import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const barberEmail = Deno.env.get("BARBER_EMAIL") ?? "";
const supabase = createClient(supabaseUrl, supabaseKey);

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
  appointmentDate: z.string().trim().min(1),
  appointmentTime: z.string().trim().min(1).max(20),
  totalPrice: z.number().positive().max(10000),
  travelFee: z.number().min(0).max(1000),
  depositAmount: z.number().min(0).max(10000).optional(),
  message: z.string().trim().max(2000).optional(),
});

type BookingEmailRequest = z.infer<typeof bookingEmailSchema>;

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
    console.log("Booking data validated for:", booking.clientName);

    // Email HTML pour le client
    const clientEmailHtml = `
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
    .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0099FF; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .detail-row:last-child { border-bottom: none; }
    .label { font-weight: bold; color: #555; }
    .value { color: #333; }
    .total { font-size: 20px; color: #0099FF; font-weight: bold; }
    .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Rendez-vous Confirmé</h1>
    </div>
    <div class="content">
      <p>Bonjour <strong>${booking.clientName}</strong>,</p>
      <p>Votre rendez-vous a été confirmé avec succès !</p>
      
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
          <span class="label">📍 Adresse</span>
          <span class="value">${booking.clientAddress}</span>
        </div>
        ${booking.travelFee > 0 ? `
        <div class="detail-row">
          <span class="label">🚗 Frais déplacement</span>
          <span class="value">${booking.travelFee}€</span>
        </div>
        ` : ''}
        <div class="detail-row">
          <span class="label">💰 Total</span>
          <span class="value total">${booking.totalPrice}€</span>
        </div>
      </div>
      
      ${booking.message ? `<p><strong>Message:</strong> ${booking.message}</p>` : ''}
      
      <p>À très bientôt !</p>
    </div>
    <div class="footer">
      <p>LCS Style - Coiffure à domicile</p>
    </div>
  </div>
</body>
</html>
    `;

    // Email HTML pour l'admin
    const adminEmailHtml = `
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
    .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #FF4433; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .detail-row:last-child { border-bottom: none; }
    .label { font-weight: bold; color: #555; }
    .value { color: #333; }
    .total { font-size: 20px; color: #FF4433; font-weight: bold; }
    .client-info { background: #e8f4ff; padding: 15px; border-radius: 8px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🆕 Nouveau Rendez-vous</h1>
    </div>
    <div class="content">
      <p>Un nouveau rendez-vous vient d'être confirmé !</p>
      
      <div class="client-info">
        <p><strong>👤 Client:</strong> ${booking.clientName}</p>
        <p><strong>📧 Email:</strong> ${booking.clientEmail}</p>
        <p><strong>📱 Téléphone:</strong> ${booking.clientPhone}</p>
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
          <span class="value">${booking.serviceName} (${booking.servicePrice}€)</span>
        </div>
        <div class="detail-row">
          <span class="label">📍 Adresse</span>
          <span class="value">${booking.clientAddress}</span>
        </div>
        ${booking.travelFee > 0 ? `
        <div class="detail-row">
          <span class="label">🚗 Frais déplacement</span>
          <span class="value">${booking.travelFee}€</span>
        </div>
        ` : ''}
        <div class="detail-row">
          <span class="label">💰 Total</span>
          <span class="value total">${booking.totalPrice}€</span>
        </div>
      </div>
      
      ${booking.message ? `<p><strong>📝 Message du client:</strong> ${booking.message}</p>` : ''}
    </div>
  </div>
</body>
</html>
    `;

    // Send email to client
    console.log("Sending email to client:", booking.clientEmail);
    const clientEmailResponse = await resend.emails.send({
      from: "LCS Style <noreply@lookware.fr>",
      to: [booking.clientEmail],
      subject: `✅ Rendez-vous confirmé - ${booking.appointmentDate} à ${booking.appointmentTime}`,
      html: clientEmailHtml,
    });
    console.log("Client email sent:", clientEmailResponse);

    // Send email to admin
    if (barberEmail) {
      console.log("Sending email to admin:", barberEmail);
      const adminEmailResponse = await resend.emails.send({
        from: "LCS Style <noreply@lookware.fr>",
        to: [barberEmail],
        subject: `🆕 Nouveau RDV: ${booking.clientName} - ${booking.appointmentDate} à ${booking.appointmentTime}`,
        html: adminEmailHtml,
      });
      console.log("Admin email sent:", adminEmailResponse);
    } else {
      console.log("No BARBER_EMAIL configured, skipping admin notification");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        clientEmailId: clientEmailResponse.data?.id
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
