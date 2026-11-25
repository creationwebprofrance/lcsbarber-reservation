// BLADE : un prestataire relance par email des clients de son propre fichier.
// Contrôles : prestataire actif, clients lui appartenant, non bloqués, avec email ;
// au plus une relance par client tous les 7 jours et 200 emails par jour et par prestataire.
// Fonction des plans Pro et Premium : le plan est relu côté serveur (blade_effective_plan).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@4';
import { BLADE_SITE, esc, layout, sendEmail } from '../_shared/blade-email.ts';

const Body = z.object({
  client_ids: z.array(z.uuid()).min(1).max(50),
  subject: z.string().trim().min(3).max(150),
  message: z.string().trim().min(10).max(3000),
});
const COOLDOWN_DAYS = 7;
const DAILY_LIMIT = 200;

const res = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const fill = (text: string, name: string) => {
  const first = name.trim().split(/\s+/)[0] || '';
  return text.replace(/\{\s*prenom\s*\}/gi, first).replace(/\{\s*nom\s*\}/gi, name.trim());
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return res({ error: 'Méthode non autorisée' }, 405);
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return res({ error: 'Service indisponible' }, 503);
  const db = createClient(url, key, { auth: { persistSession: false } });

  const jwt = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!jwt) return res({ error: 'Connecte-toi pour continuer' }, 401);
  const { data: { user } } = await db.auth.getUser(jwt);
  if (!user) return res({ error: 'Connecte-toi pour continuer' }, 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return res({ error: 'Informations invalides : objet (3 à 150 caractères) et message (10 à 3000 caractères) obligatoires.' }, 400);
  const input = parsed.data;

  try {
    const { data: provider } = await db.from('blade_providers').select('id,status,display_name,email').eq('user_id', user.id).maybeSingle();
    if (!provider || provider.status !== 'active') return res({ error: 'Espace professionnel non activé' }, 403);
    const { data: plan, error: planError } = await db.rpc('blade_effective_plan', { p_provider: provider.id });
    if (planError) { console.error('blade-relance plan', planError.message); return res({ error: 'Service indisponible' }, 503); }
    if (plan !== 'pro' && plan !== 'premium') return res({ error: 'La relance des clients est incluse dans le plan Pro.' }, 403);

    const ids = [...new Set(input.client_ids)];
    const { data: clients } = await db.from('clients').select('id,name,email,is_blacklisted').eq('provider_id', provider.id).in('id', ids);
    const since = new Date(Date.now() - COOLDOWN_DAYS * 86400000).toISOString();
    const { data: recent } = await db.from('blade_client_relances').select('client_id').eq('provider_id', provider.id).in('client_id', ids).gte('sent_at', since);
    const recentSet = new Set((recent ?? []).map(r => r.client_id));

    const { data: salon } = await db.from('blade_salons').select('slug,name,status').eq('provider_id', provider.id).maybeSingle();
    const bookUrl = salon?.slug ? `${BLADE_SITE}/r/${salon.slug}` : `${BLADE_SITE}/profil/${provider.id}`;
    const proName = provider.display_name?.trim() || salon?.name || 'Ton professionnel';
    const replyTo = provider.email || user.email || undefined;

    const skipped: { id: string; name: string; reason: string }[] = [];
    let sent = 0;
    const byId = new Map((clients ?? []).map(c => [c.id, c]));
    for (const id of ids) {
      const c = byId.get(id);
      if (!c) { skipped.push({ id, name: '', reason: 'Client introuvable' }); continue; }
      const email = (c.email ?? '').trim();
      if (c.is_blacklisted) { skipped.push({ id, name: c.name, reason: 'Client bloqué' }); continue; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { skipped.push({ id, name: c.name, reason: 'Pas d’email valide' }); continue; }
      if (recentSet.has(id)) { skipped.push({ id, name: c.name, reason: `Déjà relancé il y a moins de ${COOLDOWN_DAYS} jours` }); continue; }
      const { data: allowed } = await db.rpc('blade_community_limit', { p_actor: `relance:${provider.id}`, p_scope: 'relance', p_limit: DAILY_LIMIT, p_seconds: 86400 });
      if (!allowed) { skipped.push({ id, name: c.name, reason: 'Limite de 200 relances par jour atteinte' }); continue; }

      const subject = fill(input.subject, c.name);
      const body = esc(fill(input.message, c.name)).replace(/\r?\n/g, '<br>');
      const contact = replyTo ? `<p style="margin-top:20px;color:#525252;font-size:14px">Pour répondre à ${esc(proName)}, écris à <a href="mailto:${esc(replyTo)}">${esc(replyTo)}</a>.</p>` : '';
      const html = layout(`Un message de ${proName}`, `<p>${body}</p>${contact}`, { label: 'Réserver mon prochain rendez-vous', url: bookUrl });
      const ok = await sendEmail([email], subject, html, `relance-${provider.id}-${id}-${new Date().toISOString().slice(0, 10)}`, replyTo);
      if (!ok) { skipped.push({ id, name: c.name, reason: 'Envoi refusé par le service email' }); continue; }
      await db.from('blade_client_relances').insert({ provider_id: provider.id, client_id: id, subject });
      sent++;
    }
    return res({ sent, skipped });
  } catch (e) {
    console.error('blade-relance', e);
    return res({ error: 'Service indisponible' }, 500);
  }
});
