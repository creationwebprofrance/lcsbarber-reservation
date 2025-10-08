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
  serviceName: z.string().trim().min(1).max(200),
  appointmentDate: z.string().trim().min(1).max(50),
  appointmentTime: z.string().trim().min(1).max(20),
  verificationToken: z.string().trim().min(1).max(500),
  appUrl: z.string().trim().url().max(500),
});

type VerificationEmailRequest = z.infer<typeof verificationEmailSchema>;

const getVerificationEmailTemplate = (data: VerificationEmailRequest) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Vérifiez votre rendez-vous - Barbier Pro</title>
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
      <h1>✂️ Barbier Pro</h1>
      <h2>Vérification de votre rendez-vous</h2>
    </div>
    <div class="content">
      <p>Bonjour <strong>${data.clientName}</strong>,</p>
      
      <p>Merci d'avoir réservé un rendez-vous avec Barbier Pro !</p>
      
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
      
      <h3>📅 Détails de votre rendez-vous :</h3>
      
      <div class="detail-row">
        <strong>Service :</strong> ${data.serviceName}
      </div>
      
      <div class="detail-row">
        <strong>Date :</strong> ${data.appointmentDate}
      </div>
      
      <div class="detail-row">
        <strong>Heure :</strong> ${data.appointmentTime}
      </div>
      
      <div class="warning">
        <strong>⚠️ Important :</strong><br>
        Votre rendez-vous ne sera confirmé qu'après avoir cliqué sur le lien de vérification ci-dessus.
        Sans cette vérification, votre réservation sera automatiquement annulée après 24 heures.
      </div>
      
      <div style="margin-top: 30px; text-align: center; color: #666; font-size: 14px;">
        <p>Vous n'avez pas demandé ce rendez-vous ?<br>Vous pouvez ignorer cet email en toute sécurité.</p>
        <p><strong>Barbier Pro</strong></p>
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

    // Rate limiting: Check how many pending bookings this email has created in the last hour
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

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

    // Send verification email
    const emailResponse = await resend.emails.send({
      from: "Barbier Pro <onboarding@resend.dev>",
      to: [data.clientEmail],
      subject: "🔐 Vérifiez votre rendez-vous - Barbier Pro",
      html: getVerificationEmailTemplate(data),
    });

    console.log("Verification email sent:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailId: emailResponse.data?.id
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