// Pure helpers for provider page customization and loyalty cards (no runtime imports, tested).
export const FONTS = {
  classique: { label: 'Classique', heading: 'Arial, Helvetica, sans-serif', body: 'Arial, Helvetica, sans-serif', google: null },
  elegante: { label: 'Élégante', heading: "'Playfair Display', Georgia, serif", body: "'Lato', Arial, sans-serif", google: 'family=Playfair+Display:wght@600;700&family=Lato:wght@400;700' },
  moderne: { label: 'Moderne', heading: "'Space Grotesk', Arial, sans-serif", body: "'DM Sans', Arial, sans-serif", google: 'family=Space+Grotesk:wght@500;700&family=DM+Sans:wght@400;600' },
  urbaine: { label: 'Urbaine', heading: "'Bebas Neue', Impact, sans-serif", body: "'Manrope', Arial, sans-serif", google: 'family=Bebas+Neue&family=Manrope:wght@400;600' },
  douce: { label: 'Douce', heading: "'Nunito', Arial, sans-serif", body: "'Nunito', Arial, sans-serif", google: 'family=Nunito:wght@400;700;800' },
} as const;
export type FontKey = keyof typeof FONTS;
export const FONT_KEYS = Object.keys(FONTS) as FontKey[];

/** Suggested accent colors; providers can also pick any color. */
export const PALETTE = ['#4B342B', '#0A0A0A', '#1F4E79', '#0F766E', '#7C2D12', '#9D174D', '#6D28D9', '#B45309'];
export const DEFAULT_ACCENT = '#4B342B';

export const SECTIONS = { services: 'Prestations', gallery: 'Galerie', reviews: 'Avis', hours: 'Horaires', map: 'Adresse et zone' } as const;
export type SectionKey = keyof typeof SECTIONS;
export const ALL_SECTIONS = Object.keys(SECTIONS) as SectionKey[];

export function hexToHsl(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

/** Text color that stays readable on the accent: dark text on light accents, white otherwise. */
export function readableOn(hex: string): 'dark' | 'light' {
  const m = /^#([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) return 'light';
  const n = parseInt(m[1], 16);
  const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255);
  return L > 0.4 ? 'dark' : 'light';
}

/** CSS variables that re-theme BLADE components inside a provider's page. */
export function brandVars(accent: string, font: FontKey | string): Record<string, string> {
  const [h, s, l] = hexToHsl(accent) ?? hexToHsl(DEFAULT_ACCENT)!;
  const tone = `${h} ${s}% ${l}%`;
  const f = FONTS[(font in FONTS ? font : 'classique') as FontKey];
  return {
    '--primary': tone, '--ring': tone, '--blade-signature': tone,
    '--blade-hover': `${h} ${s}% ${l > 50 ? l - 8 : Math.min(l + 8, 92)}%`,
    '--primary-foreground': readableOn(accent) === 'dark' ? '0 0% 9%' : '0 0% 100%',
    '--blade-brand-heading': f.heading, '--blade-brand-body': f.body,
  };
}

export function moveItem<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const j = index + dir;
  if (index < 0 || j < 0 || j >= list.length) return list;
  const next = [...list]; [next[index], next[j]] = [next[j], next[index]]; return next;
}
export const toggleSection = (list: SectionKey[], key: SectionKey): SectionKey[] => list.includes(key) ? list.filter(k => k !== key) : [...list, key];
/** "Court, Mi-long, Long" → up to 8 unique trimmed answers. */
export const parseOptions = (text: string) => [...new Set(text.split(',').map(s => s.trim()).filter(Boolean))].slice(0, 8);
export const shortId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

// ---- Loyalty ----
export type Reward = { id: string; label: string; points: number };
/** Smallest reward the client cannot afford yet, with the missing points; null when every reward is reachable. */
export function nextReward(points: number, rewards: Reward[]): { reward: Reward; missing: number; pct: number } | null {
  const next = [...rewards].sort((a, b) => a.points - b.points).find(r => r.points > points);
  if (!next) return null;
  return { reward: next, missing: next.points - points, pct: Math.max(0, Math.min(100, Math.round(points / next.points * 100))) };
}
/** Points earned for an amount spent; same rounding as the server (floor). */
export const pointsForAmount = (amount: number, perEuro: number) => amount > 0 && perEuro > 0 ? Math.floor(Math.round(amount * perEuro * 1e6) / 1e6) : 0;
/** Extracts a card code from a scanned QR text, a pasted link or the raw code. */
export function codeFromScan(text: string): string | null {
  const m = /([0-9a-f]{64})/i.exec(text ?? '');
  return m ? m[1].toLowerCase() : null;
}
export const earnRule = (p: { kind: 'visits' | 'euros'; points_per_visit: number; points_per_euro: number }) =>
  p.kind === 'visits' ? `${p.points_per_visit} point${p.points_per_visit > 1 ? 's' : ''} par visite` : `${Number(p.points_per_euro).toLocaleString('fr-FR')} point${Number(p.points_per_euro) > 1 ? 's' : ''} par euro dépensé`;
