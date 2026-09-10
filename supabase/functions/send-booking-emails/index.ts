import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
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
  clientAddress: z.string().trim().max(500).optional().default(""),
  clientPostalCode: z.string().trim().max(10).optional(),
  clientCity: z.string().trim().max(100).optional(),
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

// Échappe toute valeur interpolée dans le HTML des emails (anti-XSS / injection HTML)
const esc = (v: unknown): string =>
  String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );

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
    
    const raw = validationResult.data;
    // Toutes les valeurs interpolées sont échappées
    const booking = {
      ...raw,
      clientName: esc(raw.clientName),
      clientEmail: raw.clientEmail, // utilisé comme destinataire, validé par zod
      clientPhone: esc(raw.clientPhone),
      clientAddress: esc(raw.clientAddress),
      clientPostalCode: esc(raw.clientPostalCode),
      clientCity: esc(raw.clientCity),
      serviceName: esc(raw.serviceName),
      appointmentDate: esc(raw.appointmentDate),
      appointmentTime: esc(raw.appointmentTime),
      message: raw.message ? esc(raw.message) : raw.message,
    };

    // Anti-relais ouvert : l'email ne peut être envoyé que pour une réservation
    // réellement créée côté serveur pour cette adresse dans les dernières 30 minutes.
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { count: realBookingCount, error: lookupError } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("client_email", raw.clientEmail)
      .gte("created_at", thirtyMinAgo);

    if (lookupError) {
      console.error("Booking lookup error:", lookupError.message);
      return new Response(
        JSON.stringify({ error: "Unable to verify booking" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!realBookingCount) {
      console.warn("No recent booking found for requested email — refusing to send");
      return new Response(
        JSON.stringify({ error: "No matching booking found" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const hasAddress = !!(booking.clientAddress && booking.clientAddress.trim().length > 0);
    const fullAddress = hasAddress ? [booking.clientAddress, booking.clientPostalCode, booking.clientCity].filter(Boolean).join(', ') : '';
    const addressHtml = hasAddress
      ? (booking.clientPostalCode || booking.clientCity
        ? `${booking.clientAddress}<br/>${[booking.clientPostalCode, booking.clientCity].filter(Boolean).join(' ')}`
        : booking.clientAddress)
      : '';
    const addressRow = hasAddress ? `<div class="detail-row"><span class="label">📍 Adresse</span><span class="value">${addressHtml}</span></div>` : '';
    console.log("Booking data validated");


    // Rate limiting: max 3 emails per hour, 5 per day per client email
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { count: hourCount } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("client_email", booking.clientEmail)
      .gte("created_at", oneHourAgo);
    
    const { count: dayCount } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("client_email", booking.clientEmail)
      .gte("created_at", oneDayAgo);
    
    if ((hourCount ?? 0) >= 3 || (dayCount ?? 0) >= 5) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Detect if this is a Carnaval booking
    const isCarnaval = booking.serviceName.includes("Carnaval") || booking.serviceName.includes("🎭");

    let clientEmailHtml: string;
    let adminEmailHtml: string;
    let clientSubject: string;
    let adminSubject: string;

    if (isCarnaval) {
      // ========== EMAIL CARNAVAL ==========
      clientSubject = `🎭 RDV Carnaval confirmé — ${booking.appointmentDate} à ${booking.appointmentTime}`;
      adminSubject = `🎭 Nouveau RDV Carnaval: ${booking.clientName} — ${booking.appointmentDate} à ${booking.appointmentTime}`;

      clientEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #FF8C00, #DC143C); padding: 35px 30px; text-align: center; border-radius: 12px 12px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 26px; text-shadow: 0 2px 4px rgba(0,0,0,0.2); }
    .header .emoji { font-size: 40px; display: block; margin-bottom: 10px; }
    .content { background: #FFF8F0; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #FFE0C0; border-top: none; }
    .booking-details { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #FF8C00; box-shadow: 0 2px 8px rgba(255,140,0,0.1); }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #FFF0E0; }
    .detail-row:last-child { border-bottom: none; }
    .label { font-weight: bold; color: #8B4513; }
    .value { color: #333; }
    .total { font-size: 22px; color: #FF8C00; font-weight: bold; }
    .badge { display: inline-block; background: linear-gradient(135deg, #FF8C00, #DC143C); color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 15px; }
    .no-fees { background: #FFF3E0; padding: 10px 15px; border-radius: 8px; color: #E65100; font-size: 13px; text-align: center; margin-top: 10px; }
    .footer { text-align: center; padding: 20px; color: #B8860B; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="emoji">🎭</span>
      <h1>Rendez-vous Carnaval Confirmé !</h1>
    </div>
    <div class="content">
      <p>Bonjour <strong>${booking.clientName}</strong>,</p>
      <p>Ton rendez-vous pour le <strong>Carnaval de Bordeaux</strong> est confirmé ! 🎉</p>
      
      <div class="booking-details">
        <span class="badge">🎭 Carnaval de Bordeaux</span>
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
          <span class="value">${booking.serviceName.replace('🎭 Carnaval — ', '')}</span>
        </div>
        ${addressRow}
        <div class="detail-row">
          <span class="label">💰 Total</span>
          <span class="value total">${booking.totalPrice}€</span>
        </div>
        <div class="no-fees">✅ Aucun frais supplémentaire — Offre spéciale Carnaval</div>
      </div>
      
      ${booking.message ? `<p><strong>Message:</strong> ${booking.message}</p>` : ''}
      
      <p>Prépare-toi pour le Carnaval ! À très bientôt 🎉</p>
    </div>
    <div class="footer">
      <p>🎭 LCS Barber — Carnaval de Bordeaux 2026</p>
    </div>
  </div>
</body>
</html>`;

      adminEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #FF8C00, #DC143C); padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { background: #FFF8F0; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #FFE0C0; border-top: none; }
    .booking-details { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #DC143C; box-shadow: 0 2px 8px rgba(220,20,60,0.1); }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #FFF0E0; }
    .detail-row:last-child { border-bottom: none; }
    .label { font-weight: bold; color: #8B4513; }
    .value { color: #333; }
    .total { font-size: 20px; color: #DC143C; font-weight: bold; }
    .client-info { background: #FFF3E0; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #FFE0C0; }
    .badge { display: inline-block; background: linear-gradient(135deg, #FF8C00, #DC143C); color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎭 Nouveau RDV Carnaval</h1>
    </div>
    <div class="content">
      <p><span class="badge">🎭 Carnaval de Bordeaux</span></p>
      
      <div class="client-info">
        <p><strong>👤 Client:</strong> ${booking.clientName}</p>
        <p><strong>📧 Email:</strong> ${esc(booking.clientEmail)}</p>
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
        ${addressRow}
        <div class="detail-row">
          <span class="label">💰 Total</span>
          <span class="value total">${booking.totalPrice}€</span>
        </div>
      </div>
      
      ${booking.message ? `<p><strong>📝 Message:</strong> ${booking.message}</p>` : ''}
    </div>
  </div>
</body>
</html>`;

    } else {
      // ========== EMAIL STANDARD ==========
      clientSubject = `✅ Rendez-vous confirmé — ${booking.appointmentDate} à ${booking.appointmentTime}`;
      adminSubject = `🆕 Nouveau RDV — ${booking.clientName} — ${booking.appointmentDate} à ${booking.appointmentTime}`;

      const remainingAmount = booking.depositAmount !== undefined && booking.depositAmount > 0
        ? booking.totalPrice - booking.depositAmount
        : booking.totalPrice;
      const hasDeposit = booking.depositAmount !== undefined && booking.depositAmount > 0;

      const clientRow = (label: string, value: string, opts: { bronze?: boolean; big?: boolean } = {}) => `
              <tr>
                <td style="padding:10px 0; color:#8C877F; font-size:14px; border-top:1px solid #262626;">${label}</td>
                <td style="padding:10px 0; text-align:right; border-top:1px solid #262626; color:${opts.bronze ? '#C58B52' : '#F4F1EA'}; font-weight:${opts.big ? '700' : '600'}; font-size:${opts.big ? '18px' : '14px'};">${value}</td>
              </tr>`;

      clientEmailHtml = `
      <div style="font-family: Helvetica, Arial, sans-serif; background:#0B0B0B; padding:32px; color:#F4F1EA;">
        <div style="max-width:560px; margin:0 auto; background:#141414; border:1px solid #262626; border-radius:16px; padding:32px;">
          <p style="letter-spacing:.25em; font-size:12px; color:#C58B52; margin:0 0 12px;">LCS BARBER — BARBER ATELIER</p>
          <h1 style="font-size:26px; margin:0 0 8px; color:#F4F1EA;">Rendez-vous confirmé ✂️</h1>
          <p style="line-height:1.6; color:#CFC9BE; margin:0 0 24px;">
            Bonjour ${booking.clientName}, ton rendez-vous est bien enregistré. Voici les détails :
          </p>

          <table style="width:100%; border-collapse:collapse; color:#CFC9BE; font-size:14px;">
            ${clientRow('Prestation', booking.serviceName)}
            ${clientRow('Date', booking.appointmentDate)}
            ${clientRow('Heure', booking.appointmentTime)}
            ${hasAddress ? clientRow('Adresse', addressHtml) : ''}
            ${clientRow('Prix de la prestation', booking.servicePrice + '€')}
            ${booking.travelFee > 0 ? clientRow('Frais de déplacement', booking.travelFee + '€') : ''}
            ${clientRow('Total', booking.totalPrice + '€', { bronze: true, big: true })}
            ${hasDeposit ? clientRow('Acompte versé', booking.depositAmount + '€') : ''}
            ${hasDeposit ? clientRow('Reste à payer sur place', remainingAmount + '€', { bronze: true }) : ''}
          </table>

          ${booking.message ? `
          <div style="margin:24px 0 0; padding:16px; background:#1A1A1A; border-left:3px solid #C58B52; border-radius:0 10px 10px 0;">
            <p style="margin:0 0 6px; font-size:11px; letter-spacing:.15em; color:#C58B52; text-transform:uppercase;">Ton message</p>
            <p style="margin:0; color:#F4F1EA; font-size:14px; line-height:1.6;">${booking.message}</p>
          </div>` : ''}

          <div style="margin:24px 0 0; padding:16px; background:#1A1A1A; border-radius:10px;">
            <p style="margin:0 0 8px; font-size:11px; letter-spacing:.15em; color:#C58B52; text-transform:uppercase;">Informations importantes</p>
            <ul style="margin:0; padding-left:18px; color:#CFC9BE; font-size:13px; line-height:1.8;">
              <li>Merci d'être ponctuel à ton rendez-vous.</li>
              <li>En cas d'empêchement, préviens-moi au minimum 24h à l'avance.</li>
              ${hasDeposit ? `<li>Le solde de <strong style="color:#F4F1EA;">${remainingAmount}€</strong> sera à régler sur place.</li>` : '<li>Le règlement se fera sur place le jour du rendez-vous.</li>'}
            </ul>
          </div>

          <p style="margin:28px 0 0;">
            <a href="https://lcsbarber.com/mes-rendez-vous"
               style="background:#C58B52; color:#0B0B0B; text-decoration:none; font-weight:700; padding:14px 26px; border-radius:10px; display:inline-block;">
              Voir mes rendez-vous
            </a>
          </p>

          <p style="line-height:1.6; color:#8C877F; font-size:13px; margin:26px 0 0;">À très bientôt,<br>— Lucas, LCS Barber</p>
        </div>
        <p style="text-align:center; color:#666; font-size:12px; margin:16px 0 0;">LCS Barber — Coiffure à domicile · lcsbarber.com</p>
      </div>`;

      adminEmailHtml = `
      <div style="font-family: Helvetica, Arial, sans-serif; background:#0B0B0B; padding:32px; color:#F4F1EA;">
        <div style="max-width:560px; margin:0 auto; background:#141414; border:1px solid #262626; border-radius:16px; padding:32px;">
          <p style="letter-spacing:.25em; font-size:12px; color:#C58B52; margin:0 0 12px;">LCS BARBER — NOTIFICATION ADMIN</p>
          <h1 style="font-size:22px; margin:0 0 16px; color:#F4F1EA;">Nouveau rendez-vous 🆕</h1>

          <table style="width:100%; border-collapse:collapse; color:#CFC9BE; font-size:14px;">
            ${clientRow('Client', booking.clientName)}
            ${clientRow('Email', esc(booking.clientEmail))}
            ${clientRow('Téléphone', booking.clientPhone)}
            ${clientRow('Date', booking.appointmentDate)}
            ${clientRow('Heure', booking.appointmentTime)}
            ${clientRow('Prestation', `${booking.serviceName} (${booking.servicePrice}€)`)}
            ${hasAddress ? clientRow('Adresse', addressHtml) : ''}
            ${booking.travelFee > 0 ? clientRow('Frais de déplacement', booking.travelFee + '€') : ''}
            ${clientRow('Total', booking.totalPrice + '€', { bronze: true, big: true })}
          </table>

          ${booking.message ? `
          <div style="margin:24px 0 0; padding:16px; background:#1A1A1A; border-left:3px solid #C58B52; border-radius:0 10px 10px 0;">
            <p style="margin:0 0 6px; font-size:11px; letter-spacing:.15em; color:#C58B52; text-transform:uppercase;">Message du client</p>
            <p style="margin:0; color:#F4F1EA; font-size:14px; line-height:1.6;">${booking.message}</p>
          </div>` : ''}

          <p style="margin:26px 0 0;">
            <a href="https://lcsbarber.com/admin"
               style="background:#C58B52; color:#0B0B0B; text-decoration:none; font-weight:700; padding:14px 26px; border-radius:10px; display:inline-block;">
              Voir dans l'admin
            </a>
          </p>
        </div>
      </div>`;
    }

    // Send email to client
    console.log("Sending email to client:", booking.clientEmail);
    const clientEmailResponse = await resend.emails.send({
      from: "LCS Barber <noreply@lookware.fr>",
      to: [booking.clientEmail],
      subject: clientSubject,
      html: clientEmailHtml,
    });
    console.log("Client email sent:", clientEmailResponse);

    // Send email to admin
    if (barberEmail) {
      console.log("Sending email to admin:", barberEmail);
      const adminEmailResponse = await resend.emails.send({
        from: "LCS Barber <noreply@lookware.fr>",
        to: [barberEmail],
        subject: adminSubject,
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
