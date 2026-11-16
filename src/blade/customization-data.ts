// BLADE provider page customization and loyalty cards: reads and owner-validated RPC writes.
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Review, Service } from './data';
import { DEFAULT_ACCENT, ALL_SECTIONS, type FontKey, type Reward, type SectionKey } from './customization-model';
import type { BookingModes, Question, StepOrder } from '../../supabase/functions/_shared/blade-booking-rules';

const db = supabase as SupabaseClient;
async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}
type State<T> = { data: T | null; loading: boolean; error: string | null };
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): State<T> {
  const [state, setState] = useState<State<T>>({ data: null, loading: true, error: null });
  useEffect(() => {
    let alive = true; setState(s => ({ ...s, loading: true }));
    load().then(data => alive && setState({ data, loading: false, error: null })).catch(e => alive && setState({ data: null, loading: false, error: e?.message || 'Erreur de chargement' }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export type PageSettings = {
  accent_color: string; font_key: FontKey; logo_path: string | null; cover_path: string | null; bio: string | null; city: string | null; salon_address: string | null;
  instagram: string | null; tiktok: string | null; sections: SectionKey[]; gallery_paths: string[]; booking_modes: BookingModes; step_order: StepOrder;
  welcome_message: string | null; booking_rules: string | null; custom_questions: Question[];
};
export const DEFAULT_PAGE: PageSettings = {
  accent_color: DEFAULT_ACCENT, font_key: 'classique', logo_path: null, cover_path: null, bio: null, city: null, salon_address: null, instagram: null, tiktok: null,
  sections: ALL_SECTIONS, gallery_paths: [], booking_modes: 'both', step_order: 'service', welcome_message: null, booking_rules: null, custom_questions: [],
};
export type OpeningHour = { day_of_week: number; start_time: string; end_time: string; mode: string };
export type PublicPage = { provider_id: string; name: string; is_lcs: boolean; is_premium?: boolean; page: Partial<PageSettings> | null; services: Service[]; reviews: Review[]; hours: OpeningHour[] };
export const pageOf = (p: PublicPage): PageSettings => ({ ...DEFAULT_PAGE, ...(p.page ?? {}) } as PageSettings);

/** Public profile + booking settings of an active provider (null id = LCS Barber). */
export const usePublicPage = (providerId: string | null, refresh = 0) => useAsync(() => rpc<PublicPage | null>('blade_public_page', { p_provider: providerId }), [providerId, refresh]);
export const savePage = (values: Partial<PageSettings>) => rpc<PageSettings>('blade_save_page', { p_values: values });

export const MEDIA_BUCKET = 'blade-provider-media';
const MEDIA_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export async function uploadMedia(providerId: string, file: File, kind: 'logo' | 'cover' | 'gallery'): Promise<string> {
  const ext = MEDIA_TYPES[file.type];
  if (!ext) throw new Error('Format non accepté : JPEG, PNG ou WebP.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Photo trop lourde (5 Mo maximum).');
  const path = `${providerId}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error('Envoi de la photo impossible. Réessaie.');
  return path;
}
/** Temporary links for provider photos (the bucket is private; published photos are readable by everyone). */
export function useMediaUrls(paths: (string | null | undefined)[]) {
  const list = [...new Set(paths.filter((p): p is string => !!p))];
  const key = list.join('|');
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!list.length) { setUrls({}); return; }
    let alive = true;
    supabase.storage.from(MEDIA_BUCKET).createSignedUrls(list, 3600).then(({ data }) => {
      if (!alive) return;
      const out: Record<string, string> = {};
      for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
      setUrls(out);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
}

// ---- Loyalty ----
export type LoyaltyProgram = { active: boolean; name: string; kind: 'visits' | 'euros'; points_per_visit: number; points_per_euro: number; rewards: Reward[] };
export type LoyaltyEvent = { kind: string; delta: number; label: string | null; created_at: string };
export type LoyaltyCard = { id: string; code: string; points: number; client_name: string; client_email: string | null; sent_at: string | null; provider_id: string; provider_name: string;
  accent_color: string; font_key: FontKey; logo_path: string | null; program: LoyaltyProgram; events: LoyaltyEvent[] };
export type CardRow = { id: string; code: string; client_name: string; client_email: string; points: number; sent_at: string | null; created_at: string; updated_at: string };

export const loyaltyOverview = () => rpc<{ program: LoyaltyProgram | null; cards: CardRow[] }>('blade_loyalty_overview');
export const saveProgram = (v: LoyaltyProgram) => rpc<LoyaltyProgram>('blade_loyalty_save_program', { p_values: v });
export const issueCard = (email: string, name: string) => rpc<LoyaltyCard>('blade_loyalty_issue_card', { p_email: email, p_name: name });
export const findCard = (code: string) => rpc<LoyaltyCard>('blade_loyalty_find', { p_code: code });
export const addPoints = (card: string, kind: 'visit' | 'amount' | 'manual', o: { amount?: number; points?: number; label?: string } = {}) =>
  rpc<LoyaltyCard>('blade_loyalty_add', { p_card: card, p_kind: kind, p_amount: o.amount ?? null, p_points: o.points ?? null, p_label: o.label ?? null });
export const redeemReward = (card: string, reward: string) => rpc<LoyaltyCard>('blade_loyalty_redeem', { p_card: card, p_reward: reward });
export const publicCard = (code: string) => rpc<LoyaltyCard | null>('blade_loyalty_public_card', { p_code: code });
export const myCards = () => rpc<LoyaltyCard[]>('blade_my_loyalty_cards');
export async function sendCardEmail(cardId: string): Promise<'sent' | 'disabled' | 'failed'> {
  const { data, error } = await supabase.functions.invoke('blade-notify', { body: { event: 'loyalty_card', card_id: cardId } });
  if (error) return 'failed';
  return data?.email_sent ? 'sent' : data?.reason === 'emails_disabled' ? 'disabled' : 'failed';
}
export const cardLink = (code: string) => `${window.location.origin}/blade/fidelite/${code}`;
export const scanLink = (code: string) => `${window.location.origin}/blade/pro/fidelite?carte=${code}`;
