// Prepared source only: do not move into auto-deployed functions until authorized.
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@4';

const schema = z.object({
  request_id: z.string().uuid(), client_name: z.string().trim().min(2).max(100),
  client_email: z.string().trim().email().max(255), mode: z.enum(['domicile','deplacement']),
  requested_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d = new Date(`${v}T12:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === v; }),
  requested_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), message: z.string().trim().max(1000).default(''),
});
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c] ?? c));

serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply({ error: 'Méthode non autorisée.' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL'); const anon = Deno.env.get('SUPABASE_ANON_KEY'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anon || !key) return reply({ error: 'Service indisponible.' }, 503);
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return reply({ error: 'Connectez-vous pour envoyer une demande.' }, 401);
    const client = createClient(url, anon, { auth: { persistSession: false } });
    const { data: { user }, error: authError } = await client.auth.getUser(auth.slice(7));
    if (authError || !user || !user.email) return reply({ error: 'Connexion expirée. Reconnectez-vous.' }, 401);
    if (!user.email_confirmed_at) return reply({ error: 'Vérifiez votre adresse e-mail avant d’envoyer une demande.' }, 403);
    let body: unknown; try { body = await req.json(); } catch { return reply({ error: 'Demande invalide.' }, 400); }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return reply({ error: 'Vérifiez votre nom, votre e-mail, la date et l’horaire.' }, 400);
    const input = parsed.data;
    if (input.client_email.toLowerCase() !== user.email.toLowerCase()) return reply({ error: 'Utilisez l’e-mail de votre compte.' }, 400);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
    if (input.requested_date < today) return reply({ error: 'Choisissez une date à partir d’aujourd’hui.' }, 400);
    const db = createClient(url, key, { auth: { persistSession: false } });
    const { data: id, error } = await db.rpc('create_blade_slot_request', { p_id:input.request_id, p_user_id:user.id, p_name:input.client_name, p_email:user.email, p_mode:input.mode, p_date:input.requested_date, p_time:input.requested_time, p_message:input.message });
    if (error || !id) {
      const limited = error?.message.includes('Too many requests');
      return reply({ error: limited ? 'Trop de demandes. Réessayez dans une heure.' : 'La demande n’a pas été enregistrée.' }, limited ? 429 : 400);
    }
    const { data: stored, error: readError } = await db.from('slot_requests').select('client_name,client_email,mode,requested_date,requested_time,message,email_sent_at').eq('id', id).single();
    if (readError || !stored) return reply({ id, email_sent:false });
    if (stored.email_sent_at) return reply({ id, email_sent:true });
    // Sender must be verified in Resend before deployment; never assume verification.
    const emailKey = Deno.env.get('RESEND_API_KEY');
    if (!emailKey) return reply({ id, email_sent:false });
    const response = await fetch('https://api.resend.com/emails', {
      method:'POST', headers:{ Authorization:`Bearer ${emailKey}`, 'Content-Type':'application/json', 'Idempotency-Key':`blade-slot-request-${id}` },
      body:JSON.stringify({ from:'LCS Barber <noreply@lookware.fr>', to:['lucas.chipan97@gmail.com'], reply_to:stored.client_email, subject:'BLADE — Demande d’ouverture de créneau', html:`<h2>Demande de créneau</h2><p>${escape(stored.client_name)} — ${escape(stored.client_email)}</p><p>${escape(stored.requested_date)} à ${escape(stored.requested_time.slice(0,5))}</p><p>${stored.mode === 'deplacement' ? 'Chez le client' : 'Chez LCS Barber'}</p>${stored.message ? `<p>${escape(stored.message)}</p>` : ''}<p>Cette demande n’est pas une réservation confirmée.</p>` }),
    }).catch(() => null);
    let sent = false; let emailError = 'Notification non envoyée';
    if (response?.ok) {
      const receipt = await response.json().catch(() => null); sent = Boolean(receipt?.id);
    } else if (response) { emailError = `Resend ${response.status}`; }
    await db.from('slot_requests').update(sent ? { email_sent_at:new Date().toISOString(), email_error:null } : { email_error:emailError }).eq('id', id);
    return reply({ id, email_sent:sent });
  } catch { return reply({ error:'Service indisponible. Réessayez.' }, 500); }
});