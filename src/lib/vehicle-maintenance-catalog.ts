/** Liste des opérations potentiellement applicables à un véhicule.
 *  Aucune périodicité constructeur n'est inventée : l'intervalle vient
 *  uniquement des règles saisies dans l'application. */
import type { Vehicle } from "@/lib/vehicle";

export type Nature = "entretien" | "controle" | "usure" | "reparation";

export interface CatalogItem {
  key: string;
  label: string;
  /** zone cliquable sur le visuel du véhicule */
  zone: string;
  nature: Nature;
  role: string;
  /** vigilance sécurité (freins, pneus, direction, suspension…) */
  safety?: boolean;
}

const ITEMS: CatalogItem[] = [
  { key: "huile", label: "Huile moteur", zone: "moteur", nature: "entretien", role: "Lubrifie et refroidit le moteur." },
  { key: "filtre_huile", label: "Filtre à huile", zone: "filtres", nature: "entretien", role: "Retient les impuretés de l'huile moteur." },
  { key: "filtre_air", label: "Filtre à air", zone: "filtres", nature: "entretien", role: "Filtre l'air admis par le moteur." },
  { key: "filtre_habitacle", label: "Filtre habitacle", zone: "filtres", nature: "entretien", role: "Filtre l'air de la ventilation intérieure." },
  { key: "filtre_carburant", label: "Filtre à carburant", zone: "filtres", nature: "entretien", role: "Protège le circuit d'injection." },
  { key: "bougies", label: "Bougies d'allumage", zone: "moteur", nature: "entretien", role: "Déclenchent la combustion (moteur essence)." },
  { key: "prechauffage", label: "Bougies de préchauffage", zone: "moteur", nature: "entretien", role: "Facilitent le démarrage à froid (diesel)." },
  { key: "distribution", label: "Courroie ou chaîne de distribution", zone: "moteur", nature: "controle", role: "Synchronise le moteur. Type à confirmer avant toute intervention." },
  { key: "accessoires", label: "Courroie d'accessoires", zone: "moteur", nature: "controle", role: "Entraîne alternateur, pompe et climatisation." },
  { key: "refroidissement", label: "Liquide de refroidissement", zone: "moteur", nature: "entretien", role: "Maintient la température du moteur.", safety: true },
  { key: "liquide_frein", label: "Liquide de frein", zone: "freins_avant", nature: "entretien", role: "Transmet l'effort de freinage.", safety: true },
  { key: "plaquettes", label: "Plaquettes de frein", zone: "freins_avant", nature: "usure", role: "Pièce d'usure du freinage.", safety: true },
  { key: "disques", label: "Disques de frein", zone: "freins_arriere", nature: "usure", role: "Surface de friction du freinage.", safety: true },
  { key: "pneus", label: "Pneus", zone: "pneus_avant", nature: "usure", role: "Seul contact avec la route.", safety: true },
  { key: "amortisseurs", label: "Amortisseurs et suspension", zone: "suspension", nature: "controle", role: "Tenue de route et confort.", safety: true },
  { key: "direction", label: "Direction", zone: "suspension", nature: "controle", role: "Précision et sécurité de conduite.", safety: true },
  { key: "essuie_glaces", label: "Essuie-glaces", zone: "essuie_glaces", nature: "usure", role: "Visibilité par temps de pluie." },
  { key: "eclairage", label: "Éclairage", zone: "eclairage", nature: "controle", role: "Voir et être vu." },
  { key: "batterie12", label: "Batterie 12 V", zone: "batterie_12v", nature: "usure", role: "Démarrage et alimentation électrique." },
  { key: "batterie_traction", label: "Batterie de traction", zone: "batterie_traction", nature: "controle", role: "Stocke l'énergie de propulsion électrique." },
  { key: "systeme_hybride", label: "Système hybride", zone: "transmission", nature: "controle", role: "Gestion moteur thermique / électrique." },
  { key: "embrayage", label: "Embrayage", zone: "transmission", nature: "usure", role: "Liaison moteur / boîte (boîte manuelle)." },
  { key: "boite", label: "Boîte de vitesses", zone: "transmission", nature: "controle", role: "Transmission du couple aux roues." },
  { key: "echappement", label: "Échappement", zone: "echappement", nature: "controle", role: "Évacue et dépollue les gaz." },
  { key: "injection", label: "Système d'injection", zone: "moteur", nature: "controle", role: "Dosage du carburant." },
  { key: "turbo", label: "Turbo", zone: "moteur", nature: "controle", role: "Suralimentation du moteur." },
  { key: "egr", label: "Vanne EGR", zone: "moteur", nature: "controle", role: "Recirculation des gaz d'échappement." },
  { key: "fap", label: "Filtre à particules (FAP)", zone: "fap", nature: "controle", role: "Retient les particules à l'échappement." },
  { key: "adblue", label: "AdBlue", zone: "adblue", nature: "entretien", role: "Traitement des oxydes d'azote." },
  { key: "gpl", label: "Système GPL / GNV", zone: "moteur", nature: "controle", role: "Circuit de carburant gazeux." },
];

const norm = (s?: string | null) =>
  (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export type EnergyKind = "essence" | "diesel" | "hybride" | "electrique" | "gaz" | "inconnue";

export function energyKind(vehicle: Pick<Vehicle, "fuel" | "electrification">): EnergyKind {
  const f = norm(vehicle.fuel) + " " + norm(vehicle.electrification);
  if (/electri|bev/.test(f) && !/hybri/.test(f)) return "electrique";
  if (/hybri|hev|phev|mhev/.test(f)) return "hybride";
  if (/diesel|gazole|hdi|tdi/.test(f)) return "diesel";
  if (/gpl|gnv|cng|e85|ethanol/.test(f)) return "gaz";
  if (/essence|petrol|tsi|thp/.test(f)) return "essence";
  return "inconnue";
}

const COMMON = ["pneus", "plaquettes", "disques", "liquide_frein", "filtre_habitacle",
  "essuie_glaces", "eclairage", "amortisseurs", "direction", "batterie12"];

/** Opérations réellement applicables, filtrées selon énergie et boîte. */
export function applicableOperations(vehicle: Vehicle): CatalogItem[] {
  const kind = energyKind(vehicle);
  const gearbox = norm(vehicle.gearbox_type);
  const keys = new Set<string>(COMMON);

  if (kind === "electrique") {
    ["batterie_traction", "refroidissement", "boite"].forEach((k) => keys.add(k));
  } else {
    ["huile", "filtre_huile", "filtre_air", "refroidissement", "distribution",
      "accessoires", "echappement", "boite"].forEach((k) => keys.add(k));
    if (kind === "essence" || kind === "gaz") keys.add("bougies");
    if (kind === "diesel") {
      ["prechauffage", "filtre_carburant", "injection"].forEach((k) => keys.add(k));
    }
    if (kind === "hybride") {
      ["batterie_traction", "systeme_hybride", "bougies"].forEach((k) => keys.add(k));
    }
    if (kind === "gaz") keys.add("gpl");
    if (kind === "inconnue") keys.add("filtre_carburant");
  }

  if (/manuel/.test(gearbox)) keys.add("embrayage");

  return ITEMS.filter((i) => keys.has(i.key));
}

export const ZONE_LABELS: Record<string, string> = {
  pneus_avant: "Pneus avant",
  pneus_arriere: "Pneus arrière",
  freins_avant: "Freins avant",
  freins_arriere: "Freins arrière",
  moteur: "Moteur / compartiment moteur",
  batterie_12v: "Batterie 12 V",
  batterie_traction: "Batterie de traction",
  essuie_glaces: "Essuie-glaces",
  eclairage: "Éclairage",
  suspension: "Suspension et direction",
  transmission: "Transmission",
  echappement: "Échappement",
  fap: "Filtre à particules",
  adblue: "Réservoir AdBlue",
  filtres: "Filtres",
};
