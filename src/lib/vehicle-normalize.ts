/** Normalisation marque / modèle / carrosserie.
 *  La valeur d'origine reste affichée dans la fiche ; la valeur normalisée
 *  n'est utilisée que pour la recherche du visuel CarImages. */

const strip = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

const MAKE_ALIASES: Record<string, string> = {
  citroen: "Citroën",
  mercedes: "Mercedes-Benz",
  "mercedes benz": "Mercedes-Benz",
  vw: "Volkswagen",
  volkswagen: "Volkswagen",
  bmw: "BMW",
  mg: "MG",
  ds: "DS",
  seat: "SEAT",
  skoda: "Skoda",
  "land rover": "Land Rover",
  "alfa romeo": "Alfa Romeo",
};

/** Modèles normalisés en anglais, par marque normalisée. */
const MODEL_ALIASES: Record<string, Record<string, string>> = {
  BMW: {
    "serie 1": "1 Series", "série 1": "1 Series", "1 serie": "1 Series", "1-serie": "1 Series",
    "serie 2": "2 Series", "serie 3": "3 Series", "3-serie": "3 Series",
    "serie 4": "4 Series", "serie 5": "5 Series", "5-serie": "5 Series",
    "serie 6": "6 Series", "serie 7": "7 Series", "serie 8": "8 Series",
  },
  "Mercedes-Benz": {
    "classe a": "A-Class", "class a": "A-Class",
    "classe b": "B-Class", "classe c": "C-Class", "classe e": "E-Class",
    "classe s": "S-Class", "classe g": "G-Class", "classe v": "V-Class",
  },
  Volkswagen: { coccinelle: "Beetle", "golf sw": "Golf" },
  Renault: { "megane": "Megane", "scenic": "Scenic" },
  Peugeot: {},
};

export function normalizeMake(make?: string | null): string {
  if (!make) return "";
  const key = strip(make);
  if (MAKE_ALIASES[key]) return MAKE_ALIASES[key];
  return make.trim().replace(/\s+/g, " ");
}

/** Retire la marque répétée, applique les alias, ignore accents et casse. */
export function normalizeModel(make?: string | null, model?: string | null): string {
  if (!model) return "";
  const nMake = normalizeMake(make);
  let raw = model.trim().replace(/\s+/g, " ");
  const makeKey = strip(nMake);
  if (makeKey && strip(raw).startsWith(makeKey + " ")) raw = raw.slice(nMake.length).trim();
  const alias = MODEL_ALIASES[nMake]?.[strip(raw)];
  return alias ?? raw;
}

export interface CarImagesQuery { make: string; model: string; year: string; type: "car" }

/** Paramètres envoyés à CarImages : jamais de carrosserie, d'énergie ni de boîte. */
export function carImagesQuery(
  make?: string | null, model?: string | null, year?: number | string | null,
): CarImagesQuery | null {
  const m = normalizeMake(make);
  const mo = normalizeModel(make, model);
  const y = year ? String(year).match(/\d{4}/)?.[0] : null;
  if (!m || !mo || !y) return null;
  return { make: m, model: mo, year: y, type: "car" };
}

/** Segments (usage courant) — distincts de la carrosserie réelle. */
export const SEGMENT_OPTIONS = [
  "Citadine ou compacte", "Berline", "Break", "SUV ou crossover",
  "Coupé ou cabriolet", "Monospace ou ludospace", "Utilitaire ou van",
  "Pick-up", "Autre", "Je ne sais pas",
];

/** Carrosseries réelles proposées, avec le code attendu par le catalogue. */
export const BODY_TYPES: { label: string; code: string }[] = [
  { label: "Citadine à hayon", code: "hatchback" },
  { label: "Compacte à hayon", code: "hatchback" },
  { label: "Berline à hayon (bicorps)", code: "hatchback" },
  { label: "Berline classique (tricorps, 4 portes)", code: "sedan" },
  { label: "Break (Estate, Touring, Avant, Variant, SW)", code: "wagon" },
  { label: "Shooting brake", code: "shooting_brake" },
  { label: "Coupé", code: "coupe" },
  { label: "Cabriolet / décapotable", code: "convertible" },
  { label: "Roadster", code: "roadster" },
  { label: "SUV", code: "suv" },
  { label: "Crossover", code: "crossover" },
  { label: "Monospace (MPV)", code: "mpv" },
  { label: "Grand monospace / minivan", code: "minivan" },
  { label: "Ludospace / combispace", code: "mpv" },
  { label: "Van / fourgon vitré / combi", code: "van" },
  { label: "Fourgon utilitaire (tôlé)", code: "cargo_van" },
  { label: "Pick-up", code: "pickup" },
  { label: "Minibus", code: "minibus" },
  { label: "Châssis-cabine / plateau / benne", code: "chassis_cab" },
  { label: "Voiture sans permis / microcar", code: "microcar" },
  { label: "Carrosserie spéciale", code: "other" },
  { label: "Je ne sais pas", code: "unknown" },
];

/** Carrosseries compatibles avec un segment, pour guider sans deviner. */
export const SEGMENT_TO_BODIES: Record<string, string[]> = {
  "Citadine ou compacte": ["hatchback", "sedan", "coupe", "unknown"],
  Berline: ["sedan", "hatchback", "unknown"],
  Break: ["wagon", "shooting_brake", "unknown"],
  "SUV ou crossover": ["suv", "crossover", "unknown"],
  "Coupé ou cabriolet": ["coupe", "convertible", "roadster", "unknown"],
  "Monospace ou ludospace": ["mpv", "minivan", "van", "unknown"],
  "Utilitaire ou van": ["van", "cargo_van", "minibus", "chassis_cab", "unknown"],
  "Pick-up": ["pickup", "unknown"],
  Autre: ["other", "unknown"],
  "Je ne sais pas": ["unknown"],
};

export function bodyCodeFromLabel(label?: string | null): string {
  if (!label) return "unknown";
  const found = BODY_TYPES.find((b) => strip(b.label) === strip(label));
  if (found) return found.code;
  // anciennes valeurs libres
  const s = strip(label);
  if (/break|touring|avant|variant|estate|\bsw\b/.test(s)) return "wagon";
  if (/berline/.test(s)) return "sedan";
  if (/citadine|compacte|hayon/.test(s)) return "hatchback";
  if (/suv/.test(s)) return "suv";
  if (/crossover/.test(s)) return "crossover";
  if (/monospace|mpv/.test(s)) return "mpv";
  if (/pick/.test(s)) return "pickup";
  if (/cabri|decap/.test(s)) return "convertible";
  if (/coupe/.test(s)) return "coupe";
  if (/utilitaire|fourgon|van/.test(s)) return "van";
  return "unknown";
}

export const PRO_DISCLAIMER =
  "Ces informations sont des suggestions fondées sur les données renseignées, le kilométrage et " +
  "les informations disponibles. Elles ne constituent pas un diagnostic. Fais-les valider par un " +
  "professionnel de l'automobile avant toute intervention ou achat de pièce.";

export const SAFETY_DISCLAIMER =
  "En cas de doute ou de signe anormal, limite l'utilisation du véhicule et consulte rapidement un professionnel.";

export const GENERIC_PART_DISCLAIMER =
  "Illustration générique — la forme et l'emplacement peuvent varier selon le véhicule";

export const PART_COMPAT_DISCLAIMER =
  "Compatibilité de la pièce à vérifier avec le VIN, la motorisation et un professionnel";

export const FUEL_ESTIMATE_DISCLAIMER =
  "Estimation calculée à partir des kilomètres des prestations, de la consommation et du prix renseignés. " +
  "Le montant réel peut varier.";
