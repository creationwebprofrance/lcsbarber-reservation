import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
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
  appointmentDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  appointmentTime: z.string().trim().min(1).max(20),
  totalPrice: z.number().positive().max(10000),
  travelFee: z.number().min(0).max(1000),
  depositAmount: z.number().min(0).max(10000),
  message: z.string().trim().max(2000).optional(),
});

type BookingEmailRequest = z.infer<typeof bookingEmailSchema>;

// Function to replace template variables
const replaceTemplateVars = (template: string, data: BookingEmailRequest): string => {
  let result = template;
  
  // Replace all variables
  result = result.replace(/\{\{clientName\}\}/g, data.clientName);
  result = result.replace(/\{\{clientEmail\}\}/g, data.clientEmail);
  result = result.replace(/\{\{clientPhone\}\}/g, data.clientPhone);
  result = result.replace(/\{\{clientAddress\}\}/g, data.clientAddress);
  result = result.replace(/\{\{serviceName\}\}/g, data.serviceName);
  result = result.replace(/\{\{servicePrice\}\}/g, data.servicePrice.toString());
  result = result.replace(/\{\{appointmentDate\}\}/g, data.appointmentDate);
  result = result.replace(/\{\{appointmentTime\}\}/g, data.appointmentTime);
  result = result.replace(/\{\{totalPrice\}\}/g, data.totalPrice.toString());
  result = result.replace(/\{\{travelFee\}\}/g, data.travelFee.toString());
  result = result.replace(/\{\{depositAmount\}\}/g, data.depositAmount.toString());
  result = result.replace(/\{\{remainingAmount\}\}/g, (data.totalPrice - data.depositAmount).toString());
  
  // Handle conditional blocks
  if (data.travelFee > 0) {
    result = result.replace(/\{\{#if travelFee\}\}([\s\S]*?)\{\{\/if\}\}/g, '$1');
  } else {
    result = result.replace(/\{\{#if travelFee\}\}[\s\S]*?\{\{\/if\}\}/g, '');
  }
  
  if (data.message) {
    result = result.replace(/\{\{#if message\}\}([\s\S]*?)\{\{\/if\}\}/g, '$1');
    result = result.replace(/\{\{message\}\}/g, data.message);
  } else {
    result = result.replace(/\{\{#if message\}\}[\s\S]*?\{\{\/if\}\}/g, '');
  }
  
  return result;
};

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

    // Format the date for display in French
    const dateObj = new Date(booking.appointmentDate + 'T00:00:00');
    const formattedDate = new Intl.DateTimeFormat('fr-FR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }).format(dateObj);

    // Fetch email template from database
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('subject, html_content')
      .eq('template_type', 'booking_confirmation_client')
      .single();

    if (templateError || !template) {
      console.error("Error fetching template:", templateError);
      throw new Error("Could not load email template");
    }

    console.log("Template loaded successfully");

    // Replace template variables
    const emailHtml = replaceTemplateVars(
      template.html_content,
      { ...booking, appointmentDate: formattedDate }
    );

    // Send email to client
    const clientEmailResponse = await resend.emails.send({
      from: "LCS Style <noreply@lookware.fr>",
      to: [booking.clientEmail],
      subject: template.subject,
      html: emailHtml,
    });

    console.log("Client email sent:", clientEmailResponse);

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