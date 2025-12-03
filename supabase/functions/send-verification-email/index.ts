import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const verificationEmailSchema = z.object({
  clientName: z.string().trim().min(1).max(100),
  clientEmail: z.string().trim().email().max(255),
  clientPhone: z.string().trim().min(1).max(50).optional(),
  clientAddress: z.string().trim().max(500).optional(),
  serviceName: z.string().trim().min(1).max(200),
  servicePrice: z.number().min(0).optional(),
  appointmentDate: z.string().trim().min(1).max(50),
  appointmentTime: z.string().trim().min(1).max(20),
  totalPrice: z.number().min(0).optional(),
  travelFee: z.number().min(0).optional(),
  notes: z.string().trim().max(1000).optional(),
  verificationToken: z.string().trim().min(1).max(500),
  appUrl: z.string().trim().url().max(500),
});

type VerificationEmailRequest = z.infer<typeof verificationEmailSchema>;

// Function to replace template variables
const replaceTemplateVars = (template: string, data: VerificationEmailRequest): string => {
  const verificationLink = `${data.appUrl}/verify-booking?token=${data.verificationToken}`;
  const depositAmount = data.totalPrice ? Math.round(data.totalPrice * 0.5) : 0;
  
  let result = template
    .replace(/\{\{clientName\}\}/g, data.clientName || '')
    .replace(/\{\{clientEmail\}\}/g, data.clientEmail || '')
    .replace(/\{\{clientPhone\}\}/g, data.clientPhone || '')
    .replace(/\{\{clientAddress\}\}/g, data.clientAddress || '')
    .replace(/\{\{serviceName\}\}/g, data.serviceName || '')
    .replace(/\{\{servicePrice\}\}/g, String(data.servicePrice || 0))
    .replace(/\{\{appointmentDate\}\}/g, data.appointmentDate || '')
    .replace(/\{\{appointmentTime\}\}/g, data.appointmentTime || '')
    .replace(/\{\{totalPrice\}\}/g, String(data.totalPrice || 0))
    .replace(/\{\{travelFee\}\}/g, String(data.travelFee || 0))
    .replace(/\{\{depositAmount\}\}/g, String(depositAmount))
    .replace(/\{\{verificationLink\}\}/g, verificationLink)
    .replace(/\{\{notes\}\}/g, data.notes || '');

  // Handle conditional blocks for travelFee
  if (data.travelFee && data.travelFee > 0) {
    result = result.replace(/\{\{#if travelFee\}\}/g, '').replace(/\{\{\/if\}\}/g, '');
  } else {
    result = result.replace(/\{\{#if travelFee\}\}[\s\S]*?\{\{\/if\}\}/g, '');
  }

  // Handle conditional blocks for clientAddress
  if (data.clientAddress && data.clientAddress.trim()) {
    result = result.replace(/\{\{#if clientAddress\}\}/g, '').replace(/\{\{\/if\}\}/g, '');
  } else {
    result = result.replace(/\{\{#if clientAddress\}\}[\s\S]*?\{\{\/if\}\}/g, '');
  }

  return result;
};

// Fallback template if database template is not found
const getFallbackTemplate = (data: VerificationEmailRequest) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Vérifiez votre rendez-vous - LCS Style</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f8f9fa; padding: 30px 20px; border-radius: 0 0 10px 10px; }
    .verification-box { background: white; padding: 30px; border-radius: 10px; margin: 20px 0; text-align: center; border: 2px solid #667eea; }
    .verify-button { display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
    .detail-row { margin: 10px 0; padding: 10px; background: white; border-radius: 5px; }
    .warning { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✂️ LCS Style</h1>
      <h2>Vérification de votre rendez-vous</h2>
    </div>
    <div class="content">
      <p>Bonjour <strong>${data.clientName}</strong>,</p>
      
      <p>Merci d'avoir réservé un rendez-vous avec LCS Style !</p>
      
      <div class="verification-box">
        <h3>🔐 Confirmez votre email</h3>
        <p>Pour finaliser votre réservation, veuillez cliquer sur le bouton ci-dessous :</p>
        
        <a href="${data.appUrl}/verify-booking?token=${data.verificationToken}" class="verify-button">
          ✅ Vérifier mon email
        </a>
        
        <p style="margin-top: 20px; font-size: 14px; color: #666;">
          Ce lien est valable pendant 24 heures
        </p>
      </div>
      
      <h3>📅 Récapitulatif de votre rendez-vous :</h3>
      
      <div class="detail-row">
        <strong>Service :</strong> ${data.serviceName}
      </div>
      
      <div class="detail-row">
        <strong>Date :</strong> ${data.appointmentDate}
      </div>
      
      <div class="detail-row">
        <strong>Heure :</strong> ${data.appointmentTime}
      </div>
      
      ${data.clientAddress ? `<div class="detail-row"><strong>Adresse :</strong> ${data.clientAddress}</div>` : ''}
      
      <div class="detail-row">
        <strong>Prix du service :</strong> ${data.servicePrice || 0}€
      </div>
      
      ${data.travelFee && data.travelFee > 0 ? `<div class="detail-row"><strong>Frais de déplacement :</strong> ${data.travelFee}€</div>` : ''}
      
      <div class="detail-row" style="background: #667eea; color: white;">
        <strong>Total :</strong> ${data.totalPrice || 0}€
      </div>
      
      <div class="detail-row">
        <strong>Acompte à régler :</strong> ${Math.round((data.totalPrice || 0) * 0.5)}€
      </div>
      
      <div class="warning">
        <strong>⚠️ Important :</strong><br>
        Votre rendez-vous ne sera confirmé qu'après avoir cliqué sur le lien de vérification ci-dessus.
        Sans cette vérification, votre réservation sera automatiquement annulée après 24 heures.
      </div>
      
      <div style="margin-top: 30px; text-align: center; color: #666; font-size: 14px;">
        <p>Vous n'avez pas demandé ce rendez-vous ?<br>Vous pouvez ignorer cet email en toute sécurité.</p>
        <p><strong>LCS Style</strong></p>
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
    console.log("Received verification email request");
    
    const rawData = await req.json();
    
    // Validate and sanitize input
    const validationResult = verificationEmailSchema.safeParse(rawData);
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error);
      return new Response(
        JSON.stringify({ error: "Invalid input data", details: validationResult.error.issues }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const data = validationResult.data;
    console.log("Verification data:", { ...data, verificationToken: "[REDACTED]" });

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Rate limiting: Check how many pending bookings this email has created in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: recentBookings, error: countError } = await supabase
      .from("pending_bookings")
      .select("id", { count: "exact", head: true })
      .eq("client_email", data.clientEmail)
      .gte("created_at", oneHourAgo);

    if (countError) {
      console.error("Error checking rate limit:", countError);
    } else if (recentBookings && recentBookings.length >= 5) {
      console.warn(`Rate limit exceeded for email: ${data.clientEmail}`);
      return new Response(
        JSON.stringify({ 
          error: "Too many booking attempts. Please try again later." 
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Fetch email template from database
    let htmlContent: string;
    let emailSubject = "🔐 Confirmez votre rendez-vous - LCS Style";
    
    const { data: templateData, error: templateError } = await supabase
      .from("email_templates")
      .select("html_content, subject")
      .eq("template_type", "verification_client")
      .single();

    if (templateError || !templateData) {
      console.warn("Template not found in database, using fallback:", templateError?.message);
      htmlContent = getFallbackTemplate(data);
    } else {
      console.log("Using database template for verification_client");
      htmlContent = replaceTemplateVars(templateData.html_content, data);
      emailSubject = templateData.subject;
    }

    // Toujours envoyer à l'adresse fixe du barbier
    const barberEmail = Deno.env.get("BARBER_EMAIL") || "lucas.chipan97@gmail.com";
    
    // Envoyer au barbier (toujours réussi)
    const barberEmailResponse = await resend.emails.send({
      from: "LCS Style <noreply@lookware.fr>",
      to: [barberEmail],
      subject: `📋 [COPIE] ${emailSubject}`,
      html: htmlContent,
    });

    console.log("Barber email sent:", barberEmailResponse);

    // Tenter d'envoyer au client
    let clientEmailResponse;
    try {
      clientEmailResponse = await resend.emails.send({
        from: "LCS Style <noreply@lookware.fr>",
        to: [data.clientEmail],
        subject: emailSubject,
        html: htmlContent,
      });
      console.log("Client email sent:", clientEmailResponse);
    } catch (clientError: any) {
      console.warn("Client email failed:", clientError.message);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailId: barberEmailResponse.data?.id
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
    console.error("Error in send-verification-email function:", error);
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
