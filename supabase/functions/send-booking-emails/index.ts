import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BookingEmailRequest {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  serviceName: string;
  servicePrice: number;
  appointmentDate: string;
  appointmentTime: string;
  totalPrice: number;
  travelFee: number;
  depositAmount: number;
  message?: string;
}

// Template email pour le client
const getClientEmailTemplate = (booking: BookingEmailRequest) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Confirmation de votre rendez-vous - Barbier Pro</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f8f9fa; padding: 30px 20px; border-radius: 0 0 10px 10px; }
    .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 10px; background: white; border-radius: 5px; }
    .total { background: #e3f2fd; font-weight: bold; font-size: 18px; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✂️ Barbier Pro</h1>
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
        <p><strong>Barbier Pro</strong><br>
        📞 Contactez-nous si vous avez des questions</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

// Template email pour le barbier
const getBarberEmailTemplate = (booking: BookingEmailRequest) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Nouvelle réservation - Barbier Pro</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f8f9fa; padding: 30px 20px; border-radius: 0 0 10px 10px; }
    .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 10px; background: white; border-radius: 5px; }
    .client-info { background: #e8f4fd; padding: 20px; border-radius: 5px; margin: 20px 0; }
    .total { background: #d4edda; font-weight: bold; font-size: 18px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💼 Barbier Pro</h1>
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
    
    const booking: BookingEmailRequest = await req.json();
    console.log("Booking data:", booking);

    // Envoyer l'email au client
    const clientEmailResponse = await resend.emails.send({
      from: "Barbier Pro <onboarding@resend.dev>",
      to: [booking.clientEmail],
      subject: "✂️ Confirmation de votre rendez-vous - Barbier Pro",
      html: getClientEmailTemplate(booking),
    });

    console.log("Client email sent:", clientEmailResponse);

    // Envoyer l'email au barbier (remplacez par votre email)
    const barberEmailResponse = await resend.emails.send({
      from: "Barbier Pro <onboarding@resend.dev>",
      to: ["lucas.chipan97@gmail.com"], // Remplacez par votre email
      subject: "🔔 Nouvelle réservation - Barbier Pro",
      html: getBarberEmailTemplate(booking),
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