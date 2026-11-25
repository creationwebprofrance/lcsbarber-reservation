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

// ---- Modèle de page de profil ----
/** Mises en page du profil public ; « classique » est l'affichage historique en widgets. */
export const LAYOUTS = {
  classique: { label: 'Classique', hint: 'Tes blocs dans l’ordre que tu choisis' },
  agenda: { label: 'Agenda', hint: 'La réservation d’abord : fiche à gauche, prestations à choisir à droite' },
  vitrine: { label: 'Vitrine', hint: 'Tes réalisations d’abord : grande couverture, galerie, prestations en cartes' },
  salon: { label: 'Salon', hint: 'Adresse, horaires et avis mis en avant, encadré de réservation' },
} as const;
export type LayoutKey = keyof typeof LAYOUTS;
export const LAYOUT_KEYS = Object.keys(LAYOUTS) as LayoutKey[];
export const layoutOf = (value: unknown): LayoutKey => (typeof value === 'string' && Object.prototype.hasOwnProperty.call(LAYOUTS, value) ? value as LayoutKey : 'classique');

// ---- Profil en widgets ----
export const WIDGETS = {
  about: { label: 'Présentation', hint: 'Ta bio, quelques mots sur toi' },
  social: { label: 'Réseaux sociaux', hint: 'Instagram et TikTok' },
  services: { label: 'Prestations', hint: 'Tes prestations et tarifs' },
  gallery: { label: 'Galerie', hint: 'Tes réalisations' },
  reviews: { label: 'Avis', hint: 'Ce que disent tes clients' },
  hours: { label: 'Horaires', hint: 'Tes jours et heures' },
  map: { label: 'Adresse et zone', hint: 'Où tu reçois, où tu te déplaces' },
  booking: { label: 'Bouton Réserver', hint: 'Un grand appel à réserver' },
  text: { label: 'Texte libre', hint: 'Promo, infos pratiques, message…' },
} as const;
export type WidgetType = keyof typeof WIDGETS;
export const WIDGET_TYPES = Object.keys(WIDGETS) as WidgetType[];
export type Widget = { id: string; type: WidgetType; size: 'full' | 'half'; title?: string; text?: string };
export const MAX_WIDGETS = 16;

/** Widgets of a page; older pages (sections only) get the bio and social blocks first, then their sections. */
export function widgetsOf(page: { widgets?: Widget[] | null; sections?: SectionKey[] | null }): Widget[] {
  if (Array.isArray(page.widgets)) return page.widgets.filter(w => w && w.type in WIDGETS);
  const sections = page.sections ?? ALL_SECTIONS;
  return (['about', 'social', ...sections] as WidgetType[]).map(type => ({ id: type, type, size: 'full' as const }));
}
export const canAddWidget = (list: Widget[], type: WidgetType) => list.length < MAX_WIDGETS && (type === 'text' || !list.some(w => w.type === type));
export function addWidget(list: Widget[], type: WidgetType, id = shortId(type)): Widget[] {
  if (!canAddWidget(list, type)) return list;
  return [...list, type === 'text' ? { id, type, size: 'full', title: 'Bon à savoir', text: '' } : { id, type, size: 'full' }];
}
/** Moves the widget at `from` to position `to` (drag and drop). */
export function moveWidget<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length || to < 0 || to >= list.length) return list;
  const next = [...list]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next;
}
/** Legacy `sections` column kept in sync for older readers. */
export const sectionsOfWidgets = (list: Widget[]) => list.map(w => w.type).filter((t): t is SectionKey => t in SECTIONS);

/** Repère de carte au logo du prestataire (initiale ou ciseaux s'il n'a pas de logo). */
export function logoPinHtml(url: string | undefined, name: string, style?: LogoStyle | null): string {
  const esc = (v: string) => v.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
  const letter = esc(name.trim().slice(0, 1).toUpperCase() || '✂');
  const vars = Object.entries(logoStyleVars(style)).map(([k, v]) => `${k}:${esc(v)}`).join(';');
  return `<span class="blade-logo-pin${url ? '' : ' is-empty'}" style="${vars}">${url ? `<img src="${esc(url)}" alt="" />` : letter}</span><span class="blade-logo-pin-tip"></span>`;
}

/** Fichier de galerie vidéo (MP4, WebM, MOV). */
export const isVideoPath = (path: string | null | undefined) => !!path && /\.(mp4|webm|mov)$/i.test(path);

// ---- Réglage du logo ----
export type LogoStyle = { zoom: number; x: number; y: number; fit: 'cover' | 'contain'; bg?: string | null };
export const DEFAULT_LOGO_STYLE: LogoStyle = { zoom: 1, x: 50, y: 50, fit: 'cover', bg: null };
const clamp = (v: unknown, lo: number, hi: number, d: number) => typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
/** Même bornes que le serveur (blade_clean_logo_style). */
export function cleanLogoStyle(s?: Partial<LogoStyle> | null): LogoStyle {
  return { zoom: clamp(s?.zoom, 0.5, 3, 1), x: clamp(s?.x, 0, 100, 50), y: clamp(s?.y, 0, 100, 50), fit: s?.fit === 'contain' ? 'contain' : 'cover',
    bg: typeof s?.bg === 'string' && /^#[0-9a-f]{6}$/i.test(s.bg) ? s.bg : null };
}
/** Variables CSS appliquées au logo (profil, aperçu, repère de carte). */
export function logoStyleVars(s?: Partial<LogoStyle> | null): Record<string, string> {
  const c = cleanLogoStyle(s);
  return { '--logo-zoom': String(c.zoom), '--logo-tx': `${c.x - 50}%`, '--logo-ty': `${c.y - 50}%`, '--logo-fit': c.fit, ...(c.bg ? { '--logo-bg': c.bg } : {}) };
}
