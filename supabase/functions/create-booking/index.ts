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
  client_address: z.string().max(500).optional().default(''),
  total_price: z.number().positive(),
  travel_fee: z.number().min(0).optional().default(0),
  notes: z.string().max(1000).optional().nullable(),
  deposit_paid: z.boolean().optional().default(false),
  deposit_amount: z.number().min(0).optional(),
  deposit_reference: z.string().max(120).optional().nullable(),
  status: z.enum(['pending', 'confirmed']).optional().default('confirmed'),
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
    
    // Rate limiting: Check for recent bookings from this email (hourly + daily)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { count: hourCount, error: hourError } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('client_email', validatedData.client_email)
      .gte('created_at', oneHourAgo);
    
    const { count: dayCount, error: dayError } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('client_email', validatedData.client_email)
      .gte('created_at', oneDayAgo);
    
    if (hourError) {
      console.error('Rate limit check error:', hourError);
    }
    
    if ((hourCount ?? 0) >= 3 || (dayCount ?? 0) >= 5) {
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
    
    // Bloquer le créneau s'il est déjà réservé par un AUTRE client.
    // (Le même client peut cumuler plusieurs prestations sur le même créneau.)
    const { count: conflictCount, error: conflictError } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('appointment_date', validatedData.appointment_date)
      .eq('appointment_time', validatedData.appointment_time)
      .neq('client_email', validatedData.client_email)
      .in('status', ['pending', 'confirmed']);

    if (conflictError) {
      console.error('Conflict check error:', conflictError);
    }

    if ((conflictCount ?? 0) > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Ce créneau vient d\'être réservé. Veuillez en choisir un autre.'
        }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create the booking
    const { deposit_amount, deposit_reference, status, notes, deposit_paid, ...bookingFields } = validatedData;

    // Ne jamais faire confiance au flag client : vérifier le paiement Stripe côté serveur
    let verifiedDepositPaid = false;
    if (deposit_paid && deposit_reference?.startsWith('cs_')) {
      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
      if (stripeKey) {
        try {
          const res = await fetch(
            `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(deposit_reference)}`,
            { headers: { Authorization: `Bearer ${stripeKey}` } }
          );
          if (res.ok) {
            const session = await res.json();
            const expectedCents = deposit_amount ? Math.round(deposit_amount * 100) : null;
            verifiedDepositPaid =
              session.payment_status === 'paid' &&
              (expectedCents === null || session.amount_total === expectedCents);
          }
        } catch (e) {
          console.error('Stripe verification error:', e);
        }
      }
    }

    // Acompte annoncé mais non vérifié => le rendez-vous reste en attente
    const finalStatus = (deposit_paid && !verifiedDepositPaid) ? 'pending' : status;

    const depositNote = [
      deposit_amount ? `Acompte attendu: ${deposit_amount}€` : null,
      deposit_reference ? `Paiement acompte: ${deposit_reference}` : null,
    ].filter(Boolean).join(' | ');

    const finalNotes = [notes, depositNote].filter(Boolean).join('\n') || null;

    const { data: newBooking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        ...bookingFields,
        deposit_paid: verifiedDepositPaid,
        notes: finalNotes,
        status: finalStatus,
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
