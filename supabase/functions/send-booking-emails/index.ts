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
    const hasAddress = !!(booking.clientAddress && booking.clientAddress.trim().length > 0);
    const fullAddress = hasAddress ? [booking.clientAddress, booking.clientPostalCode, booking.clientCity].filter(Boolean).join(', ') : '';
    const addressHtml = hasAddress
      ? (booking.clientPostalCode || booking.clientCity
        ? `${booking.clientAddress}<br/>${[booking.clientPostalCode, booking.clientCity].filter(Boolean).join(' ')}`
        : booking.clientAddress)
      : '';
    const addressRow = hasAddress ? `<div class="detail-row"><span class="label">📍 Adresse</span><span class="value">${addressHtml}</span></div>` : '';
    console.log("Booking data validated for:", booking.clientName);

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
      <p>🎭 LCS Style — Carnaval de Bordeaux 2026</p>
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
      const depositRow = booking.depositAmount !== undefined && booking.depositAmount > 0
        ? `<tr><td style="padding:10px 0;border-bottom:1px solid #2A2A2A;"><span style="color:#A1A1A1;font-size:13px;">Acompte versé</span></td><td style="padding:10px 0;border-bottom:1px solid #2A2A2A;text-align:right;"><span style="color:#F4F1EA;font-weight:600;">${booking.depositAmount}€</span></td></tr><tr><td style="padding:10px 0;"><span style="color:#A1A1A1;font-size:13px;">Reste à payer</span></td><td style="padding:10px 0;text-align:right;"><span style="color:#C58B52;font-weight:700;">${remainingAmount}€</span></td></tr>`
        : '';

      clientEmailHtml = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmation de votre rendez-vous — LCS Style</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700&family=Manrope:wght@400;500;600;700&display=swap');
    body { margin:0; padding:0; background-color:#0B0B0B; color:#F4F1EA; font-family:'Manrope',Arial,Helvetica,sans-serif; line-height:1.6; -webkit-font-smoothing:antialiased; }
    .wrapper { width:100%; max-width:600px; margin:0 auto; background-color:#0B0B0B; }
    .header { background:linear-gradient(135deg,#0B0B0B 0%,#1A1A1A 100%); padding:48px 32px 40px; text-align:center; border-bottom:2px solid #C58B52; }
    .brand { font-family:'Syne',Arial,Helvetica,sans-serif; font-size:28px; font-weight:700; color:#F4F1EA; letter-spacing:2px; margin:0 0 8px; }
    .brand span { color:#C58B52; }
    .tagline { color:#A1A1A1; font-size:12px; letter-spacing:3px; text-transform:uppercase; margin:0; }
    .hero-title { font-family:'Syne',Arial,Helvetica,sans-serif; font-size:22px; font-weight:600; color:#F4F1EA; margin:24px 0 0; }
    .content { padding:40px 32px; background-color:#111111; }
    .greeting { font-size:18px; font-weight:600; margin:0 0 8px; color:#F4F1EA; }
    .intro { color:#A1A1A1; margin:0 0 28px; font-size:15px; }
    .card { background-color:#0B0B0B; border:1px solid #2A2A2A; border-radius:12px; padding:24px; margin:0 0 24px; }
    .card-title { font-family:'Syne',Arial,Helvetica,sans-serif; font-size:14px; color:#C58B52; letter-spacing:2px; text-transform:uppercase; margin:0 0 20px; }
    .detail-row { width:100%; }
    .detail-row td { padding:12px 0; border-bottom:1px solid #1F1F1F; vertical-align:top; }
    .detail-row:last-child td { border-bottom:none; }
    .label { color:#A1A1A1; font-size:13px; font-weight:500; }
    .value { color:#F4F1EA; font-size:14px; font-weight:600; text-align:right; }
    .total-row td { padding-top:16px; border-top:2px solid #C58B52; border-bottom:none; }
    .total-label { color:#C58B52; font-family:'Syne',Arial,Helvetica,sans-serif; font-size:14px; font-weight:700; text-transform:uppercase; letter-spacing:1px; }
    .total-value { color:#C58B52; font-family:'Syne',Arial,Helvetica,sans-serif; font-size:24px; font-weight:700; text-align:right; }
    .info-box { background-color:#1A1A1A; border-left:3px solid #C58B52; border-radius:0 8px 8px 0; padding:20px; margin:24px 0; }
    .info-box h3 { font-family:'Syne',Arial,Helvetica,sans-serif; font-size:14px; color:#C58B52; margin:0 0 12px; }
    .info-box ul { margin:0; padding-left:18px; color:#A1A1A1; font-size:14px; }
    .info-box li { margin-bottom:6px; }
    .message-box { background-color:#1A1A1A; border-radius:8px; padding:16px; margin:24px 0; }
    .message-box strong { color:#C58B52; font-size:12px; text-transform:uppercase; letter-spacing:1px; }
    .message-box p { color:#F4F1EA; margin:8px 0 0; font-size:14px; }
    .footer { background-color:#0B0B0B; padding:32px; text-align:center; border-top:1px solid #1F1F1F; }
    .footer-brand { font-family:'Syne',Arial,Helvetica,sans-serif; font-size:16px; font-weight:700; color:#F4F1EA; margin:0 0 8px; }
    .footer-brand span { color:#C58B52; }
    .footer-text { color:#666; font-size:12px; margin:0; line-height:1.8; }
    .signature { color:#F4F1EA; font-size:15px; margin:0 0 4px; }
    .signature-name { color:#C58B52; font-weight:700; }
    @media only screen and (max-width: 480px) {
      .header { padding:36px 24px 32px; }
      .content { padding:28px 20px; }
      .card { padding:18px; }
      .brand { font-size:24px; }
    }
  </style>
</head>
<body>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#0B0B0B;">
    <tr><td align="center" style="padding:24px 12px;">
      <div class="wrapper">
        <div class="header">
          <p class="brand">LCS <span>STYLE</span></p>
          <p class="tagline">Barber Atelier — À domicile</p>
          <p class="hero-title">Rendez-vous confirmé</p>
        </div>

        <div class="content">
          <p class="greeting">Bonjour ${booking.clientName},</p>
          <p class="intro">Ton rendez-vous est bien enregistré. Retrouve tous les détails ci-dessous.</p>

          <div class="card">
            <p class="card-title">Détails du rendez-vous</p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr class="detail-row"><td class="label">Prestation</td><td class="value">${booking.serviceName}</td></tr>
              <tr class="detail-row"><td class="label">Date</td><td class="value">${booking.appointmentDate}</td></tr>
              <tr class="detail-row"><td class="label">Heure</td><td class="value">${booking.appointmentTime}</td></tr>
              ${addressRow ? `<tr class="detail-row"><td class="label">Adresse</td><td class="value">${addressHtml}</td></tr>` : ''}
              <tr class="detail-row"><td class="label">Prix de la prestation</td><td class="value">${booking.servicePrice}€</td></tr>
              ${booking.travelFee > 0 ? `<tr class="detail-row"><td class="label">Frais de déplacement</td><td class="value">${booking.travelFee}€</td></tr>` : ''}
              <tr class="total-row"><td class="total-label">Total</td><td class="total-value">${booking.totalPrice}€</td></tr>
              ${depositRow}
            </table>
          </div>

          <div class="info-box">
            <h3>Informations importantes</h3>
            <ul>
              <li>Merci d'être ponctuel à ton rendez-vous.</li>
              <li>En cas d'empêchement, préviens-moi au minimum 24h à l'avance.</li>
              ${booking.depositAmount !== undefined && booking.depositAmount > 0 ? `<li>Le solde de <strong style="color:#F4F1EA;">${remainingAmount}€</strong> sera à régler sur place.</li>` : '<li>Le règlement se fera sur place le jour du rendez-vous.</li>'}
            </ul>
          </div>

          ${booking.message ? `<div class="message-box"><strong>Ton message</strong><p>${booking.message}</p></div>` : ''}

          <p class="signature">À très bientôt,<br><span class="signature-name">Lucas — LCS Style</span></p>
        </div>

        <div class="footer">
          <p class="footer-brand">LCS <span>STYLE</span></p>
          <p class="footer-text">Coiffure à domicile — Prestations sur mesure<br>lcsbarber.com</p>
        </div>
      </div>
    </td></tr>
  </table>
</body>
</html>`;

      adminEmailHtml = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nouveau rendez-vous — LCS Style</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700&family=Manrope:wght@400;500;600;700&display=swap');
    body { margin:0; padding:0; background-color:#0B0B0B; color:#F4F1EA; font-family:'Manrope',Arial,Helvetica,sans-serif; line-height:1.6; -webkit-font-smoothing:antialiased; }
    .wrapper { width:100%; max-width:600px; margin:0 auto; background-color:#0B0B0B; }
    .header { background:linear-gradient(135deg,#0B0B0B 0%,#1A1A1A 100%); padding:40px 32px; text-align:center; border-bottom:2px solid #C58B52; }
    .brand { font-family:'Syne',Arial,Helvetica,sans-serif; font-size:26px; font-weight:700; color:#F4F1EA; letter-spacing:2px; margin:0 0 6px; }
    .brand span { color:#C58B52; }
    .hero-title { font-family:'Syne',Arial,Helvetica,sans-serif; font-size:20px; font-weight:600; color:#F4F1EA; margin:18px 0 0; }
    .content { padding:36px 32px; background-color:#111111; }
    .card { background-color:#0B0B0B; border:1px solid #2A2A2A; border-radius:12px; padding:22px; margin:0 0 20px; }
    .card-title { font-family:'Syne',Arial,Helvetica,sans-serif; font-size:13px; color:#C58B52; letter-spacing:2px; text-transform:uppercase; margin:0 0 16px; }
    .client-row { margin-bottom:10px; color:#F4F1EA; font-size:14px; }
    .client-row strong { color:#A1A1A1; font-weight:500; }
    .detail-row { width:100%; }
    .detail-row td { padding:10px 0; border-bottom:1px solid #1F1F1F; vertical-align:top; }
    .detail-row:last-child td { border-bottom:none; }
    .label { color:#A1A1A1; font-size:13px; font-weight:500; }
    .value { color:#F4F1EA; font-size:14px; font-weight:600; text-align:right; }
    .total-row td { padding-top:14px; border-top:2px solid #C58B52; border-bottom:none; }
    .total-label { color:#C58B52; font-family:'Syne',Arial,Helvetica,sans-serif; font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:1px; }
    .total-value { color:#C58B52; font-family:'Syne',Arial,Helvetica,sans-serif; font-size:22px; font-weight:700; text-align:right; }
    .message-box { background-color:#1A1A1A; border-radius:8px; padding:16px; margin:20px 0 0; }
    .message-box strong { color:#C58B52; font-size:12px; text-transform:uppercase; letter-spacing:1px; }
    .message-box p { color:#F4F1EA; margin:8px 0 0; font-size:14px; }
    .footer { background-color:#0B0B0B; padding:24px 32px; text-align:center; border-top:1px solid #1F1F1F; }
    .footer-text { color:#666; font-size:12px; margin:0; }
    @media only screen and (max-width: 480px) {
      .content { padding:24px 20px; }
      .card { padding:16px; }
    }
  </style>
</head>
<body>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#0B0B0B;">
    <tr><td align="center" style="padding:24px 12px;">
      <div class="wrapper">
        <div class="header">
          <p class="brand">LCS <span>STYLE</span></p>
          <p class="hero-title">Nouveau rendez-vous confirmé</p>
        </div>

        <div class="content">
          <div class="card">
            <p class="card-title">Client</p>
            <p class="client-row"><strong>Nom :</strong> ${booking.clientName}</p>
            <p class="client-row"><strong>Email :</strong> ${booking.clientEmail}</p>
            <p class="client-row"><strong>Téléphone :</strong> ${booking.clientPhone}</p>
          </div>

          <div class="card">
            <p class="card-title">Rendez-vous</p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr class="detail-row"><td class="label">Date</td><td class="value">${booking.appointmentDate}</td></tr>
              <tr class="detail-row"><td class="label">Heure</td><td class="value">${booking.appointmentTime}</td></tr>
              <tr class="detail-row"><td class="label">Prestation</td><td class="value">${booking.serviceName} (${booking.servicePrice}€)</td></tr>
              ${addressRow ? `<tr class="detail-row"><td class="label">Adresse</td><td class="value">${addressHtml}</td></tr>` : ''}
              ${booking.travelFee > 0 ? `<tr class="detail-row"><td class="label">Frais de déplacement</td><td class="value">${booking.travelFee}€</td></tr>` : ''}
              <tr class="total-row"><td class="total-label">Total</td><td class="total-value">${booking.totalPrice}€</td></tr>
            </table>
          </div>

          ${booking.message ? `<div class="message-box"><strong>Message du client</strong><p>${booking.message}</p></div>` : ''}
        </div>

        <div class="footer">
          <p class="footer-text">Notification admin — LCS Style</p>
        </div>
      </div>
    </td></tr>
  </table>
</body>
</html>`;
    }

    // Send email to client
    console.log("Sending email to client:", booking.clientEmail);
    const clientEmailResponse = await resend.emails.send({
      from: "LCS Style <noreply@lookware.fr>",
      to: [booking.clientEmail],
      subject: clientSubject,
      html: clientEmailHtml,
    });
    console.log("Client email sent:", clientEmailResponse);

    // Send email to admin
    if (barberEmail) {
      console.log("Sending email to admin:", barberEmail);
      const adminEmailResponse = await resend.emails.send({
        from: "LCS Style <noreply@lookware.fr>",
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
