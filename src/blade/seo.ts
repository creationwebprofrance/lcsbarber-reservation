// Référencement : villes d'Île-de-France couvertes et titres / descriptions par page.

export type City = { slug: string; name: string; dept: string; deptName: string };

export const DEPARTMENTS: Record<string, string> = {
  '75': 'Paris', '77': 'Seine-et-Marne', '78': 'Yvelines', '91': 'Essonne',
  '92': 'Hauts-de-Seine', '93': 'Seine-Saint-Denis', '94': 'Val-de-Marne', '95': "Val-d'Oise",
};

const raw: [string, string, string][] = [
  ['paris', 'Paris', '75'],
  ['boulogne-billancourt', 'Boulogne-Billancourt', '92'], ['nanterre', 'Nanterre', '92'], ['colombes', 'Colombes', '92'],
  ['asnieres-sur-seine', 'Asnières-sur-Seine', '92'], ['courbevoie', 'Courbevoie', '92'], ['rueil-malmaison', 'Rueil-Malmaison', '92'],
  ['issy-les-moulineaux', 'Issy-les-Moulineaux', '92'], ['levallois-perret', 'Levallois-Perret', '92'], ['neuilly-sur-seine', 'Neuilly-sur-Seine', '92'],
  ['saint-denis', 'Saint-Denis', '93'], ['montreuil', 'Montreuil', '93'], ['aubervilliers', 'Aubervilliers', '93'],
  ['aulnay-sous-bois', 'Aulnay-sous-Bois', '93'], ['drancy', 'Drancy', '93'], ['noisy-le-grand', 'Noisy-le-Grand', '93'],
  ['creteil', 'Créteil', '94'], ['vitry-sur-seine', 'Vitry-sur-Seine', '94'], ['champigny-sur-marne', 'Champigny-sur-Marne', '94'],
  ['saint-maur-des-fosses', 'Saint-Maur-des-Fossés', '94'], ['ivry-sur-seine', 'Ivry-sur-Seine', '94'],
  ['argenteuil', 'Argenteuil', '95'], ['cergy', 'Cergy', '95'],
  ['versailles', 'Versailles', '78'], ['saint-germain-en-laye', 'Saint-Germain-en-Laye', '78'],
  ['evry-courcouronnes', 'Évry-Courcouronnes', '91'], ['massy', 'Massy', '91'],
  ['meaux', 'Meaux', '77'], ['melun', 'Melun', '77'],
];

export const CITIES: City[] = raw.map(([slug, name, dept]) => ({ slug, name, dept, deptName: DEPARTMENTS[dept] }));
export const cityBySlug = (slug?: string) => CITIES.find(c => c.slug === slug);
export const citiesInDept = (dept: string) => CITIES.filter(c => c.dept === dept);

export type PageMeta = { title: string; description: string };
const SITE = 'BLADE Hairstyle';
const DEFAULT: PageMeta = {
  title: `${SITE} — Ton barber à domicile ou près de toi en Île-de-France`,
  description: 'Trouve un barber ou une coiffeuse à domicile ou près de chez toi en Île-de-France, regarde ses réalisations et réserve ton créneau en ligne.',
};

export function metaFor(pathname: string): PageMeta {
  const p = pathname.replace(/\/+$/, '') || '/blade';
  const city = /^\/blade\/barber\/([^/]+)$/.exec(p);
  if (city) {
    const c = cityBySlug(city[1]);
    if (c) return {
      title: `Barber à domicile à ${c.name} (${c.dept}) — ${SITE}`,
      description: `Réserve un barber à domicile ou près de chez toi à ${c.name} (${c.deptName}). Profils, réalisations et créneaux disponibles en ligne sur BLADE.`,
    };
  }
  const table: Record<string, PageMeta> = {
    '/blade': DEFAULT,
    '/blade/tarifs': { title: `Tarifs pour les barbers — ${SITE}`, description: 'Aucune commission sur tes prestations. Découverte gratuit, Pro à 19,90 €/mois avec carte de fidélité incluse, Premium à 39,90 €/mois, 10 % de réduction en annuel. Sans engagement.' },
    '/blade/barber': { title: `Barbers à domicile en Île-de-France — ${SITE}`, description: 'Paris, Hauts-de-Seine, Seine-Saint-Denis, Val-de-Marne et toute l’Île-de-France : trouve un barber à domicile ou près de chez toi.' },
    '/blade/outils/calculateur-barber': { title: `Calculateur de revenus et de prix pour barber — ${SITE}`, description: 'Estime ton chiffre d’affaires, tes cotisations et ton revenu net de barber indépendant, et trouve le bon prix pour ta coupe.' },
    '/blade/client': { title: `Trouver un barber — ${SITE}`, description: 'Cherche un barber ou une coiffeuse à domicile ou près de chez toi et réserve en ligne.' },
    '/blade/connexion': { title: `Connexion — ${SITE}`, description: 'Connecte-toi à ton espace client ou professionnel BLADE.' },
    '/blade/devenir-pro': { title: `Devenir barber sur BLADE — ${SITE}`, description: 'Crée ton profil de barber, reçois des réservations et fidélise tes clients.' },
  };
  if (table[p]) return table[p];
  if (p.startsWith('/blade/pro')) return { title: `Espace professionnel — ${SITE}`, description: DEFAULT.description };
  if (p.startsWith('/blade/client')) return { title: `Espace client — ${SITE}`, description: DEFAULT.description };
  return DEFAULT;
}

// Met à jour titre, description, liens canoniques et image de partage.
export function applyMeta(pathname: string) {
  const { title, description } = metaFor(pathname);
  const url = `${window.location.origin}${pathname}`;
  const image = `${window.location.origin}/blade/og-image.png`;
  document.title = title;
  const set = (selector: string, attr: string, key: string, value: string) => {
    let el = document.head.querySelector<HTMLMetaElement | HTMLLinkElement>(selector);
    if (!el) { el = document.createElement(selector.startsWith('link') ? 'link' : 'meta') as HTMLMetaElement; el.setAttribute(attr, key); document.head.appendChild(el); }
    el.setAttribute(selector.startsWith('link') ? 'href' : 'content', value);
  };
  set('meta[name="description"]', 'name', 'description', description);
  set('meta[property="og:title"]', 'property', 'og:title', title);
  set('meta[property="og:description"]', 'property', 'og:description', description);
  set('meta[property="og:url"]', 'property', 'og:url', url);
  set('meta[property="og:image"]', 'property', 'og:image', image);
  set('meta[name="twitter:image"]', 'name', 'twitter:image', image);
  set('link[rel="canonical"]', 'rel', 'canonical', url);
  set('link[rel="manifest"]', 'rel', 'manifest', '/blade/manifest.webmanifest');
  set('meta[name="theme-color"]', 'name', 'theme-color', '#2e1f16');
  set('link[rel="apple-touch-icon"]', 'rel', 'apple-touch-icon', '/blade/icon-192.png');
  set('meta[name="apple-mobile-web-app-title"]', 'name', 'apple-mobile-web-app-title', 'BLADE');
  set('meta[name="mobile-web-app-capable"]', 'name', 'mobile-web-app-capable', 'yes');
}
