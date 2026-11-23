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

// Prix « le client se déplace » : doit rester identique à DOMICILE_SERVICES dans src/components/BookingTool.tsx.
const DOMICILE_ADDRESS = "Imp. des Hirondelles Prolongée, 95380 Puiseux-en-France";
const DOMICILE_PRICES: Record<string, number> = { "Contours": 10, "Coupe classique": 15, "Coupe + barbe": 20 };

// Mêmes valeurs par défaut que src/hooks/usePricingSettings.tsx.
const DEFAULT_HOURLY = { early_hour_threshold: 10, early_hour_fee: 5, late_hour_threshold: 20, late_hour_fee: 5 };

// Même règle que calculatePricing (src/lib/pricing.ts) pour le supplément horaire.
const hourlySupplement = (time: string, s: typeof DEFAULT_HOURLY) => {
  const hour = parseInt(time.split(':')[0], 10);
  let supplement = 0;
  if (hour < s.early_hour_threshold) supplement += (s.early_hour_threshold - hour) * s.early_hour_fee;
  if (hour >= s.late_hour_threshold) supplement += (hour - (s.late_hour_threshold - 1)) * s.late_hour_fee;
  return supplement;
};

// Même règle que calculateDeposit (src/lib/deposit.ts).
const calculateDeposit = (total: number) => (!total || total <= 0 ? 0 : total < 20 ? 10 : Math.round((total / 2) * 100) / 100);

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
    
    // Prix minimal recalculé côté serveur : prix de la prestation en base (ou tarif « client se déplace »)
    // + supplément horaire + frais de déplacement annoncés. Le navigateur ne peut pas payer moins.
    const { data: service } = await supabase
      .from('services')
      .select('name, price, is_active, provider_id')
      .eq('id', validatedData.service_id)
      .maybeSingle();
    if (!service || !service.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cette prestation n'est plus disponible. Recharge la page.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const settingsQuery = supabase.from('pricing_settings').select('setting_key, setting_value');
    const { data: settingRows } = service.provider_id
      ? await settingsQuery.eq('provider_id', service.provider_id)
      : await settingsQuery;
    const hourly = { ...DEFAULT_HOURLY };
    for (const row of settingRows ?? []) {
      if (row.setting_key in hourly) (hourly as Record<string, number>)[row.setting_key] = Number(row.setting_value);
    }
    const isDomicile = validatedData.client_address.trim() === DOMICILE_ADDRESS && service.name in DOMICILE_PRICES;
    const basePrice = isDomicile ? DOMICILE_PRICES[service.name] : Number(service.price);
    const minimumPrice = basePrice + hourlySupplement(validatedData.appointment_time, hourly) + (validatedData.travel_fee ?? 0);
    // Mode observation par défaut : rejouée sur l'historique, cette règle aurait refusé 77 réservations sur 189
    // (prix modifiés depuis, corrections admin). On journalise d'abord ; PRICE_FLOOR_ENFORCE=true pour bloquer.
    const priceTooLow = validatedData.total_price + 0.01 < minimumPrice;
    if (priceTooLow) {
      console.warn('create-booking: price below minimum', { service_id: validatedData.service_id, sent: validatedData.total_price, minimumPrice, isDomicile });
    }
    if (priceTooLow && Deno.env.get('PRICE_FLOOR_ENFORCE') === 'true') {
      return new Response(
        JSON.stringify({ success: false, error: 'Le prix a changé. Recharge la page pour voir le tarif à jour.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
    // L'ID de session peut être envoyé brut (cs_...) ou précédemment préfixé par "Stripe "
    const stripeSessionId = typeof deposit_reference === 'string'
      ? deposit_reference.match(/cs_[A-Za-z0-9_]+/)?.[0] ?? null
      : null;

    let verifiedDepositPaid = false;
    if (deposit_paid && stripeSessionId) {
      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
      if (stripeKey) {
        try {
          const res = await fetch(
            `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(stripeSessionId)}`,
            { headers: { Authorization: `Bearer ${stripeKey}` } }
          );
          if (res.ok) {
            const session = await res.json();
            const expectedCents = deposit_amount ? Math.round(deposit_amount * 100) : null;
            // Session récente (< 6 h) et pas déjà utilisée par une réservation plus ancienne
            // (un même paiement couvre les rendez-vous d'une même commande, créés dans la foulée).
            const recentSession = typeof session.created === 'number' && Date.now() / 1000 - session.created < 6 * 3600;
            const { count: reuseCount } = await supabase
              .from('bookings')
              .select('id', { count: 'exact', head: true })
              .ilike('notes', `%${stripeSessionId}%`)
              .lt('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());
            verifiedDepositPaid =
              session.payment_status === 'paid' &&
              expectedCents !== null &&
              session.amount_total === expectedCents &&
              (deposit_amount ?? 0) >= calculateDeposit(validatedData.total_price) &&
              recentSession &&
              (reuseCount ?? 0) === 0;
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
