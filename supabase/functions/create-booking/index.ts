import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation schema for booking data
const bookingSchema = z.object({
  service_id: z.string().uuid(),
  appointment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  appointment_time: z.string().regex(/^\d{2}:\d{2}$/),
  client_name: z.string().min(2).max(100),
  client_email: z.string().email().max(255),
  client_phone: z.string().min(10).max(20),
  client_address: z.string().min(5).max(500),
  total_price: z.number().positive(),
  travel_fee: z.number().min(0).optional().default(0),
  notes: z.string().max(1000).optional().nullable(),
  deposit_paid: z.boolean().optional().default(false),
});

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Validate input
    const validatedData = bookingSchema.parse(body);
    
    // Create Supabase client with service role to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Rate limiting: Check for recent bookings from this email
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentBookings, error: rateLimitError } = await supabase
      .from('bookings')
      .select('id')
      .eq('client_email', validatedData.client_email)
      .gte('created_at', fiveMinutesAgo);
    
    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
    }
    
    if (recentBookings && recentBookings.length >= 3) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Trop de réservations récentes. Veuillez patienter quelques minutes.' 
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Check if the time slot is already booked
    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('appointment_date', validatedData.appointment_date)
      .eq('appointment_time', validatedData.appointment_time)
      .in('status', ['confirmed', 'pending'])
      .single();
    
    if (existingBooking) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Ce créneau n\'est plus disponible. Veuillez en choisir un autre.' 
        }),
        { 
          status: 409, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Create the booking
    const { data: newBooking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        ...validatedData,
        status: 'confirmed',
      })
      .select()
      .single();
    
    if (bookingError) {
      console.error('Booking creation error:', bookingError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erreur lors de la création de la réservation.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Upsert client info
    await supabase
      .from('clients')
      .upsert({
        email: validatedData.client_email,
        name: validatedData.client_name,
        phone: validatedData.client_phone,
        address: validatedData.client_address,
      }, { onConflict: 'email' });
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        booking: newBooking 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('Error:', error);
    
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Données invalides', details: error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ success: false, error: 'Erreur serveur' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
