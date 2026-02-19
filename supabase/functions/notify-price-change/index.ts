import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseKey);

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
    const { serviceName, oldPrice, newPrice } = await req.json();

    if (!serviceName || oldPrice === undefined || newPrice === undefined) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Find future bookings for this service
    const today = new Date().toISOString().split("T")[0];
    
    // Get service ID from name
    const { data: services } = await supabase
      .from("services")
      .select("id")
      .eq("name", serviceName);

    if (!services || services.length === 0) {
      return new Response(
        JSON.stringify({ success: true, emailsSent: 0, message: "No service found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const serviceIds = services.map((s: any) => s.id);

    // Get future bookings with this service
    const { data: bookings } = await supabase
      .from("bookings")
      .select("client_email, client_name")
      .in("service_id", serviceIds)
      .gte("appointment_date", today)
      .in("status", ["confirmed", "pending"]);

    if (!bookings || bookings.length === 0) {
      return new Response(
        JSON.stringify({ success: true, emailsSent: 0, message: "No future bookings found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Deduplicate by email
    const uniqueClients = new Map<string, string>();
    bookings.forEach((b: any) => {
      if (!uniqueClients.has(b.client_email)) {
        uniqueClients.set(b.client_email, b.client_name);
      }
    });

    const priceDirection = newPrice > oldPrice ? "augmenté" : "diminué";
    let emailsSent = 0;

    for (const [email, name] of uniqueClients) {
      const html = `
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
    .price-change { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0099FF; text-align: center; }
    .old-price { font-size: 18px; color: #999; text-decoration: line-through; }
    .new-price { font-size: 28px; color: #0099FF; font-weight: bold; }
    .arrow { font-size: 24px; margin: 10px 0; }
    .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💈 Modification de tarif</h1>
    </div>
    <div class="content">
      <p>Bonjour <strong>${name}</strong>,</p>
      <p>Nous vous informons que le tarif de la prestation <strong>${serviceName}</strong> a ${priceDirection}.</p>
      
      <div class="price-change">
        <div class="old-price">${oldPrice}€</div>
        <div class="arrow">⬇️</div>
        <div class="new-price">${newPrice}€</div>
      </div>
      
      <p>Ce nouveau tarif s'appliquera à vos prochains rendez-vous. Les rendez-vous déjà confirmés conservent leur prix initial.</p>
      
      <p>N'hésitez pas à nous contacter pour toute question.</p>
      <p>À très bientôt !</p>
    </div>
    <div class="footer">
      <p>LCS Style - Coiffure à domicile</p>
    </div>
  </div>
</body>
</html>`;

      try {
        await resend.emails.send({
          from: "LCS Style <noreply@lookware.fr>",
          to: [email],
          subject: `💈 Changement de tarif - ${serviceName}`,
          html,
        });
        emailsSent++;
      } catch (err) {
        console.error(`Failed to send email to ${email}:`, err);
      }
    }

    console.log(`Price change notification: ${emailsSent} emails sent for ${serviceName}`);

    return new Response(
      JSON.stringify({ success: true, emailsSent }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in notify-price-change:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
