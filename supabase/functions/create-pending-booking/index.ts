import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation for creating a pending booking
const schema = z.object({
  service_id: z.string().uuid(),
  appointment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  appointment_time: z.string().min(1).max(20), // keep flexible HH:mm or HH:mm:ss
  client_name: z.string().trim().min(2).max(100),
  client_email: z.string().trim().email().max(255),
  client_phone: z.string().trim().min(6).max(20),
  client_address: z.string().trim().min(5).max(500),
  total_price: z.number().nonnegative(),
  travel_fee: z.number().nonnegative().nullable(),
  notes: z.string().trim().max(1000).nullable(),
  verification_token: z.string().trim().min(10).max(500),
});

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const parsed = schema.safeParse(payload);

    if (!parsed.success) {
      console.error("Validation error:", parsed.error.issues);
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parsed.error.issues }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const data = parsed.data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Basic rate limiting per email in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from("pending_bookings")
      .select("id", { count: "exact", head: true })
      .eq("client_email", data.client_email)
      .gte("created_at", oneHourAgo);

    if (countError) {
      console.warn("Rate limit check error:", countError.message);
    } else if ((count ?? 0) >= 5) {
      return new Response(
        JSON.stringify({ error: "Too many attempts, please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const insertPayload = {
      service_id: data.service_id,
      appointment_date: data.appointment_date,
      appointment_time: data.appointment_time,
      client_name: data.client_name,
      client_email: data.client_email,
      client_phone: data.client_phone,
      client_address: data.client_address,
      total_price: data.total_price,
      travel_fee: data.travel_fee ?? 0,
      notes: data.notes,
      verification_token: data.verification_token,
      expires_at: expiresAt,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("pending_bookings")
      .insert([insertPayload])
      .select()
      .maybeSingle();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, pendingId: inserted?.id, verificationToken: data.verification_token }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (e: any) {
    console.error("create-pending-booking error:", e?.message || e);
    return new Response(
      JSON.stringify({ error: "Server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
