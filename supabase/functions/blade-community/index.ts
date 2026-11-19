// BLADE « Réalisations » : photos et vidéos des prestataires, galerie publique et likes.
// Les fichiers restent dans un espace de stockage privé ; le navigateur reçoit des liens signés temporaires.
// Les messages privés entre prestataires ne sont pas encore ouverts.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@4';

const BUCKET = 'blade-works';
const PAGE = 12;
const SIGNED_TTL = 3600;
const IMAGE: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const VIDEO: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm' };
const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;
const MESSAGING = new Set(['conversations', 'directory', 'conversation', 'messages', 'send', 'read']);

const res = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const fail = (error: string, status = 400) => res({ error }, status);
const uuid = z.uuid();

const WorkValues = z.object({
  title: z.string().trim().min(2).max(150),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.string().trim().min(1).max(80),
  service_id: z.uuid(),
  duration: z.number().positive().max(60).optional().nullable(),
});
const ProfileValues = z.object({
  name: z.string().trim().min(1).max(200), city: z.string().trim().min(1).max(200), zone: z.string().trim().min(1).max(200),
  home: z.boolean().optional(), near: z.boolean().optional(), active: z.boolean().optional(),
});

async function sha(text: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d), b => b.toString(16).padStart(2, '0')).join('');
}
const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join('');

type Row = { id: string; provider_id: string; service_id: string; title: string; description: string | null; category: string; kind: 'image' | 'video'; status: string; media_path: string; thumbnail_path: string | null; published_at: string | null; ready: boolean };
const COLS = 'id,provider_id,service_id,title,description,category,kind,status,media_path,thumbnail_path,published_at,ready';
type Profile = { provider_id: string; name: string; city: string; zone: string; home: boolean; near: boolean; active: boolean; photo_path: string | null; latitude: number | null; longitude: number | null; booking_path: string | null };

async function signed(db: SupabaseClient, paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  const map = new Map<string, string>();
  if (!unique.length) return map;
  const { data } = await db.storage.from(BUCKET).createSignedUrls(unique, SIGNED_TTL);
  for (const s of data ?? []) if (s.path && s.signedUrl) map.set(s.path, s.signedUrl);
  return map;
}

async function decorate(db: SupabaseClient, rows: Row[], actor: string | null) {
  if (!rows.length) return [];
  const providers = [...new Set(rows.map(r => r.provider_id))];
  const services = [...new Set(rows.map(r => r.service_id))];
  const ids = rows.map(r => r.id);
  const [{ data: profiles }, { data: svc }, { data: likes }, urls] = await Promise.all([
    db.from('blade_public_profiles').select('provider_id,name,city,zone,home,near,booking_path').in('provider_id', providers),
    db.from('services').select('id,name,price,duration_minutes').in('id', services),
    db.from('blade_work_likes').select('publication_id,actor_hash').in('publication_id', ids),
    signed(db, rows.flatMap(r => [r.media_path, r.thumbnail_path ?? ''])),
  ]);
  const pMap = new Map((profiles ?? []).map(p => [p.provider_id, p]));
  const sMap = new Map((svc ?? []).map(s => [s.id, s]));
  return rows.map(r => {
    const p = pMap.get(r.provider_id); const s = sMap.get(r.service_id);
    const l = (likes ?? []).filter(x => x.publication_id === r.id);
    return {
      id: r.id, provider_id: r.provider_id, service_id: r.service_id, title: r.title, description: r.description, category: r.category, kind: r.kind,
      name: p?.name ?? '', city: p?.city ?? '', zone: p?.zone ?? '', home: p?.home ?? false, near: p?.near ?? false, photo_url: null,
      price: Number(s?.price ?? 0), service_name: s?.name ?? '', duration_minutes: s?.duration_minutes ?? 0,
      booking_path: p ? `/blade/profil/${r.provider_id}` : null,
      likes: l.length, liked: actor ? l.some(x => x.actor_hash === actor) : false,
      media_url: urls.get(r.media_path) ?? '', thumbnail_url: r.thumbnail_path ? urls.get(r.thumbnail_path) ?? null : null,
      status: r.status, published_at: r.published_at,
    };
  });
}

async function ensureBucket(db: SupabaseClient) {
  const { data } = await db.storage.getBucket(BUCKET);
  if (data) return;
  await db.storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_VIDEO, allowedMimeTypes: [...Object.keys(IMAGE), ...Object.keys(VIDEO)] });
}

async function ensureProfile(db: SupabaseClient, provider: { id: string; display_name: string | null }) {
  const { data: existing } = await db.from('blade_public_profiles').select('provider_id,active').eq('provider_id', provider.id).maybeSingle();
  if (existing?.active) return;
  if (existing) { await db.from('blade_public_profiles').update({ active: true, updated_at: new Date().toISOString() }).eq('provider_id', provider.id); return; }
  const { data: salon } = await db.from('blade_salons').select('name,city,lat,lng').eq('provider_id', provider.id).maybeSingle();
  const city = salon?.city?.trim() || 'Île-de-France';
  await db.from('blade_public_profiles').insert({
    provider_id: provider.id, name: provider.display_name?.trim() || salon?.name || 'Professionnel BLADE', city, zone: 'Île-de-France',
    home: true, near: Boolean(salon), active: true, latitude: salon?.lat ?? null, longitude: salon?.lng ?? null,
  });
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('Méthode non autorisée', 405);
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return fail('Service indisponible', 503);
  const db = createClient(url, key, { auth: { persistSession: false } });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const action = typeof body?.action === 'string' ? body.action : '';
  if (!body || !action) return fail('Informations invalides');
  if (MESSAGING.has(action)) return fail('Messagerie pas encore ouverte', 403);

  const jwt = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
  const { data: auth } = jwt ? await db.auth.getUser(jwt) : { data: { user: null } };
  const user = auth?.user ?? null;
  const salt = key.slice(-24);
  const visitorRaw = typeof body.visitor_token === 'string' && /^[0-9a-f]{48}$/.test(body.visitor_token) ? body.visitor_token : '';
  const actor = user ? await sha(`u:${user.id}:${salt}`) : visitorRaw ? await sha(`v:${visitorRaw}:${salt}`) : null;

  // Prestataire actif connecté (actions de gestion).
  const provider = async () => {
    if (!user) return null;
    const { data } = await db.from('blade_providers').select('id,display_name,status').eq('user_id', user.id).maybeSingle();
    return data?.status === 'active' ? data : null;
  };
  const ownWork = async (providerId: string, id: unknown) => {
    if (!uuid.safeParse(id).success) return null;
    const { data } = await db.from('blade_publications').select(COLS).eq('id', id as string).eq('provider_id', providerId).neq('status', 'deleted').maybeSingle();
    return data as Row | null;
  };

  try {
    switch (action) {
      case 'feed': {
        const page = Math.max(0, Math.min(50, Number(body.page) || 0));
        const category = typeof body.category === 'string' ? body.category.trim().slice(0, 80) : '';
        const city = typeof body.city === 'string' ? body.city.trim().slice(0, 100) : '';
        const { data: profiles } = await db.from('blade_public_profiles').select('provider_id,city,latitude,longitude').eq('active', true);
        let allowed = profiles ?? [];
        if (city) allowed = allowed.filter(p => p.city.toLowerCase().includes(city.toLowerCase()));
        if (!allowed.length) return res({ items: [], hasMore: false, categories: [] });
        const { data: all } = await db.from('blade_publications').select(COLS).eq('status', 'published').in('provider_id', allowed.map(p => p.provider_id)).order('published_at', { ascending: false }).limit(600);
        let rows = (all ?? []) as Row[];
        const categories = [...new Set(rows.map(r => r.category))].sort((a, b) => a.localeCompare(b, 'fr'));
        if (category) rows = rows.filter(r => r.category === category);
        const c = body.coords as { lat?: number; lng?: number } | null;
        if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
          const pos = new Map(allowed.map(p => [p.provider_id, p]));
          const d = (r: Row) => { const p = pos.get(r.provider_id); return p?.latitude == null || p?.longitude == null ? 1e9 : (p.latitude - c.lat!) ** 2 + (p.longitude - c.lng!) ** 2; };
          rows = [...rows].sort((a, b) => d(a) - d(b));
        }
        const slice = rows.slice(0, (page + 1) * PAGE);
        return res({ items: await decorate(db, slice, actor), hasMore: rows.length > slice.length, categories });
      }
      case 'work': {
        if (!uuid.safeParse(body.id).success) return res(null);
        const { data } = await db.from('blade_publications').select(COLS).eq('id', body.id as string).eq('status', 'published').maybeSingle();
        if (!data) return res(null);
        const { data: p } = await db.from('blade_public_profiles').select('active').eq('provider_id', data.provider_id).maybeSingle();
        if (!p?.active) return res(null);
        return res((await decorate(db, [data as Row], actor))[0]);
      }
      case 'profile': {
        if (!uuid.safeParse(body.id).success) return res(null);
        const { data: p } = await db.from('blade_public_profiles').select('*').eq('provider_id', body.id as string).eq('active', true).maybeSingle();
        if (!p) return res(null);
        const { data: s } = await db.from('services').select('id,name,price,duration_minutes').eq('provider_id', p.provider_id).eq('is_active', true).order('price');
        const prof = p as Profile;
        return res({ provider_id: prof.provider_id, name: prof.name, city: prof.city, zone: prof.zone, home: prof.home, near: prof.near, photo_url: null, booking_path: prof.booking_path, services: s ?? [] });
      }
      case 'like': {
        if (!uuid.safeParse(body.id).success) return fail('Informations invalides');
        let token: string | undefined; let who = actor;
        if (!who) { token = randomToken(); who = await sha(`v:${token}:${salt}`); }
        const { data: ok } = await db.rpc('blade_community_limit', { p_actor: who, p_scope: 'like', p_limit: 120, p_seconds: 3600 });
        if (!ok) return fail('Trop de réactions, réessaie plus tard', 429);
        const { data: w } = await db.from('blade_publications').select('id').eq('id', body.id as string).eq('status', 'published').maybeSingle();
        if (!w) return fail('Réalisation introuvable', 404);
        if (body.liked) await db.from('blade_work_likes').upsert({ publication_id: w.id, actor_hash: who }, { onConflict: 'publication_id,actor_hash', ignoreDuplicates: true });
        else await db.from('blade_work_likes').delete().eq('publication_id', w.id).eq('actor_hash', who);
        const { count } = await db.from('blade_work_likes').select('publication_id', { count: 'exact', head: true }).eq('publication_id', w.id);
        return res({ likes: count ?? 0, liked: Boolean(body.liked), ...(token ? { visitor_token: token } : {}) });
      }
    }

    // ---- Actions réservées au prestataire actif ----
    const pro = await provider();
    if (!pro) return fail(user ? 'Espace professionnel non activé' : 'Connecte-toi pour continuer', user ? 403 : 401);

    switch (action) {
      case 'own': {
        const { data } = await db.from('blade_publications').select(COLS).eq('provider_id', pro.id).neq('status', 'deleted').order('created_at', { ascending: false }).limit(200);
        return res(await decorate(db, (data ?? []) as Row[], actor));
      }
      case 'upload': {
        const values = WorkValues.safeParse(body.values);
        if (!values.success) return fail('Informations invalides');
        const type = String(body.type ?? ''); const size = Number(body.size);
        const isImage = type in IMAGE, isVideo = type in VIDEO;
        if (!isImage && !isVideo) return fail('Format non accepté');
        if (!Number.isFinite(size) || size < 1 || size > (isImage ? MAX_IMAGE : MAX_VIDEO)) return fail('Fichier trop lourd');
        const thumb = body.thumbnail as { type?: string; size?: number } | null;
        if (isVideo) {
          if (!values.data.duration) return fail('Durée de la vidéo manquante');
          if (!thumb || !(String(thumb.type) in IMAGE) || !(Number(thumb.size) >= 1 && Number(thumb.size) <= MAX_IMAGE)) return fail('Miniature manquante ou invalide');
        }
        const { data: ok } = await db.rpc('blade_community_limit', { p_actor: `p:${pro.id}`, p_scope: 'upload', p_limit: 30, p_seconds: 3600 });
        if (!ok) return fail('Trop d’envois, réessaie dans une heure', 429);
        await ensureBucket(db);
        const id = crypto.randomUUID();
        const media_path = `${pro.id}/${id}.${isImage ? IMAGE[type] : VIDEO[type]}`;
        const thumbnail_path = isVideo ? `${pro.id}/${id}-thumb.${IMAGE[String(thumb!.type)]}` : null;
        const { error } = await db.from('blade_publications').insert({
          id, provider_id: pro.id, service_id: values.data.service_id, title: values.data.title, description: values.data.description || null,
          category: values.data.category, kind: isImage ? 'image' : 'video', status: 'processing', media_path, thumbnail_path,
          mime_type: type, size_bytes: size, duration_seconds: isVideo ? values.data.duration : null, ready: false,
        });
        if (error) return fail('Prestation invalide');
        const main = await db.storage.from(BUCKET).createSignedUploadUrl(media_path);
        if (main.error || !main.data) throw main.error ?? new Error('upload url');
        let thumbnail: { url: string; token: string; path: string } | undefined;
        if (thumbnail_path) {
          const t = await db.storage.from(BUCKET).createSignedUploadUrl(thumbnail_path);
          if (t.error || !t.data) throw t.error ?? new Error('thumb url');
          thumbnail = { url: t.data.signedUrl, token: t.data.token, path: t.data.path };
        }
        return res({ id, url: main.data.signedUrl, token: main.data.token, path: main.data.path, thumbnail });
      }
      case 'finalize': {
        const w = await ownWork(pro.id, body.id);
        if (!w) return fail('Réalisation introuvable', 404);
        const { data: files } = await db.storage.from(BUCKET).list(pro.id, { search: w.id, limit: 10 });
        const name = (p: string) => p.split('/').pop();
        const media = files?.find(f => f.name === name(w.media_path));
        const thumbOk = !w.thumbnail_path || files?.some(f => f.name === name(w.thumbnail_path!));
        const meta = media?.metadata as { size?: number; mimetype?: string } | undefined;
        const limit = w.kind === 'image' ? MAX_IMAGE : MAX_VIDEO;
        if (!media || !thumbOk || !meta?.size || meta.size > limit || (meta.mimetype && !(meta.mimetype in (w.kind === 'image' ? IMAGE : VIDEO)))) {
          await db.from('blade_publications').update({ status: 'error' }).eq('id', w.id);
          return fail('Fichier non reçu ou invalide');
        }
        await db.from('blade_publications').update({ ready: true, status: 'draft', size_bytes: meta.size }).eq('id', w.id);
        return res({ ok: true });
      }
      case 'save': {
        const w = await ownWork(pro.id, body.id);
        if (!w) return fail('Réalisation introuvable', 404);
        const values = WorkValues.safeParse(body.values);
        if (!values.success) return fail('Informations invalides');
        const { error } = await db.from('blade_publications').update({ title: values.data.title, description: values.data.description || null, category: values.data.category, service_id: values.data.service_id }).eq('id', w.id);
        if (error) return fail('Prestation invalide');
        return res({ id: w.id });
      }
      case 'status': {
        const w = await ownWork(pro.id, body.id);
        if (!w) return fail('Réalisation introuvable', 404);
        const status = String(body.status);
        if (status === 'deleted') {
          await db.storage.from(BUCKET).remove([w.media_path, ...(w.thumbnail_path ? [w.thumbnail_path] : [])]);
          await db.from('blade_publications').update({ status: 'deleted', ready: false }).eq('id', w.id);
          return res({ ok: true });
        }
        if (status === 'hidden') { await db.from('blade_publications').update({ status: 'hidden' }).eq('id', w.id); return res({ ok: true }); }
        if (status === 'published') {
          if (!w.ready) return fail('Le fichier n’est pas encore prêt');
          await ensureProfile(db, pro);
          const { error } = await db.from('blade_publications').update({ status: 'published' }).eq('id', w.id);
          if (error) return fail('Publication impossible : vérifie que la prestation est active');
          return res({ ok: true });
        }
        return fail('Statut invalide');
      }
      case 'save-profile': {
        const v = ProfileValues.safeParse(body.values);
        if (!v.success) return fail('Informations invalides');
        const { error } = await db.from('blade_public_profiles').upsert({ provider_id: pro.id, name: v.data.name, city: v.data.city, zone: v.data.zone, home: v.data.home ?? false, near: v.data.near ?? false, active: v.data.active ?? false, updated_at: new Date().toISOString() }, { onConflict: 'provider_id' });
        if (error) throw error;
        return res({ ok: true });
      }
    }
    return fail('Action inconnue');
  } catch (e) {
    console.error('blade-community', action, e);
    return fail('Service indisponible', 500);
  }
});
