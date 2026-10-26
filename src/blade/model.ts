export const clientLinks = [
  { path: '/blade/client', label: 'Recherche', icon: 'search' },
  { path: '/blade/client/rendez-vous', label: 'Rendez-vous', icon: 'calendar' },
  { path: '/blade/client/messages', label: 'Messages', icon: 'message' },
  { path: '/blade/client/profil', label: 'Profil', icon: 'user' },
] as const;
export type ProNavItem = { path?: string; label: string; icon: string; children?: { path: string; label: string }[] };
export const proNav: ProNavItem[] = [
  { path: '/blade/pro', label: 'Aujourd’hui', icon: 'home' },
  { path: '/blade/pro/agenda', label: 'Agenda', icon: 'calendar' },
  { label: 'Clients', icon: 'users', children: [
    { path: '/blade/pro/clients', label: 'Fiches clients' },
    { path: '/blade/pro/relances', label: 'Relances' },
  ] },
  { path: '/blade/pro/prestations', label: 'Prestations', icon: 'scissors' },
  { path: '/blade/pro/catalogue', label: 'Catalogue', icon: 'image' },
  { path: '/blade/pro/simulation', label: 'Simulation', icon: 'calculator' },
  { label: 'Pilotage', icon: 'chart', children: [
    { path: '/blade/pro/performance', label: 'Performance' },
    { path: '/blade/pro/revenus', label: 'Revenus' },
    { path: '/blade/pro/paiements', label: 'Paiements' },
  ] },
  { label: 'Mobilité', icon: 'car', children: [
    { path: '/blade/pro/deplacements', label: 'Déplacements' },
    { path: '/blade/pro/vehicule', label: 'Véhicule' },
  ] },
];
export const proSecondaryLinks = [
  { path: '/blade/pro/profil', label: 'Mon profil', icon: 'user' },
  { path: '/blade/pro/parametres', label: 'Paramètres', icon: 'settings' },
];
export const proLinks: { path: string; label: string; icon: string }[] = [
  ...proNav.flatMap(item => item.children ? item.children.map(c => ({ path: c.path, label: c.label, icon: item.icon })) : [{ path: item.path!, label: item.label, icon: item.icon }]),
  ...proSecondaryLinks,
];
export const bladeRoutes = [...clientLinks.map(x => x.path), '/blade/client/profil-professionnel', '/blade/client/reserver', '/blade/client/recapitulatif', '/blade/client/confirmation', ...proLinks.map(x => x.path)];
export function isBladePath(path: string) { return path === '/blade' || path.startsWith('/blade/'); }
export function validateLocalValue(value: string, kind: string) {
  if (!value.trim()) return '';
  if (kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Renseignez une adresse e-mail valide.';
  if (kind === 'number' && (!Number.isFinite(Number(value)) || Number(value) < 0)) return 'Renseignez un nombre positif ou nul.';
  return '';
}
export function monthCells(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const count = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, i) => i >= offset && i < offset + count ? i - offset + 1 : null);
}
