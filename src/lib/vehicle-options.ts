/** Listes de choix pour guider la saisie d'un véhicule (jamais de valeur devinée). */

export const OTHER = "__other__";

export const VEHICLE_MAKES: string[] = [
  "Alfa Romeo", "Audi", "BMW", "Citroën", "Cupra", "Dacia", "DS", "Fiat", "Ford",
  "Honda", "Hyundai", "Jeep", "Kia", "Land Rover", "Lexus", "Mazda", "Mercedes-Benz",
  "MG", "Mini", "Mitsubishi", "Nissan", "Opel", "Peugeot", "Porsche", "Renault",
  "Seat", "Skoda", "Smart", "Subaru", "Suzuki", "Tesla", "Toyota", "Volkswagen", "Volvo",
];

/** Modèles les plus courants par marque — la saisie libre reste toujours possible. */
export const VEHICLE_MODELS: Record<string, string[]> = {
  "Alfa Romeo": ["Giulia", "Giulietta", "Mito", "Stelvio", "Tonale"],
  Audi: ["A1", "A3", "A4", "A5", "A6", "Q2", "Q3", "Q5", "Q7", "TT"],
  BMW: ["Serie 1", "Serie 2", "Serie 3", "Serie 4", "Serie 5", "X1", "X3", "X5"],
  Citroën: ["C1", "C3", "C3 Aircross", "C4", "C5 Aircross", "Berlingo", "DS3"],
  Cupra: ["Ateca", "Formentor", "Leon", "Born"],
  Dacia: ["Sandero", "Duster", "Logan", "Jogger", "Spring"],
  DS: ["DS3 Crossback", "DS4", "DS7 Crossback"],
  Fiat: ["500", "500X", "Panda", "Tipo", "Punto"],
  Ford: ["Fiesta", "Focus", "Puma", "Kuga", "Mondeo", "Transit"],
  Honda: ["Civic", "CR-V", "HR-V", "Jazz"],
  Hyundai: ["i10", "i20", "i30", "Kona", "Tucson"],
  Jeep: ["Renegade", "Compass", "Avenger"],
  Kia: ["Picanto", "Rio", "Ceed", "Sportage", "Niro"],
  "Land Rover": ["Defender", "Discovery", "Range Rover Evoque", "Range Rover Sport"],
  Lexus: ["CT", "IS", "NX", "UX"],
  Mazda: ["2", "3", "6", "CX-3", "CX-5"],
  "Mercedes-Benz": ["Classe A", "Classe B", "Classe C", "Classe E", "CLA", "GLA", "GLC", "Vito"],
  MG: ["MG3", "MG4", "ZS", "HS"],
  Mini: ["Cooper", "Countryman", "Clubman"],
  Mitsubishi: ["ASX", "Outlander", "Space Star"],
  Nissan: ["Micra", "Juke", "Qashqai", "X-Trail", "Leaf"],
  Opel: ["Corsa", "Astra", "Mokka", "Crossland", "Grandland"],
  Peugeot: ["108", "208", "2008", "308", "3008", "5008", "Partner", "Expert"],
  Porsche: ["911", "Cayenne", "Macan", "Panamera"],
  Renault: ["Twingo", "Clio", "Captur", "Megane", "Scenic", "Kadjar", "Kangoo", "Trafic", "Zoe"],
  Seat: ["Ibiza", "Leon", "Arona", "Ateca"],
  Skoda: ["Fabia", "Octavia", "Superb", "Kamiq", "Karoq", "Kodiaq"],
  Smart: ["Fortwo", "Forfour"],
  Subaru: ["Forester", "Impreza", "XV"],
  Suzuki: ["Swift", "Vitara", "S-Cross", "Ignis"],
  Tesla: ["Model 3", "Model Y", "Model S", "Model X"],
  Toyota: ["Aygo", "Yaris", "Yaris Cross", "Corolla", "C-HR", "RAV4", "Proace"],
  Volkswagen: ["Polo", "Golf", "Passat", "T-Roc", "Tiguan", "Touran", "Caddy", "ID.3"],
  Volvo: ["V40", "V60", "XC40", "XC60", "XC90"],
};

export const FUEL_OPTIONS = [
  "Essence", "Diesel", "Hybride essence", "Hybride diesel",
  "Hybride rechargeable", "Électrique", "GPL", "Bioéthanol E85",
];

export const BODY_TYPE_OPTIONS = [
  "Citadine", "Berline", "Break", "SUV", "Monospace", "Coupé",
  "Cabriolet", "Utilitaire", "Pick-up",
];

export const GEARBOX_OPTIONS = ["Manuelle", "Automatique", "Semi-automatique", "Sans boîte (électrique)"];

export const PLATE_COUNTRIES = [
  { code: "FR", label: "France" },
  { code: "BE", label: "Belgique" },
  { code: "CH", label: "Suisse" },
  { code: "LU", label: "Luxembourg" },
  { code: "DE", label: "Allemagne" },
  { code: "ES", label: "Espagne" },
  { code: "IT", label: "Italie" },
  { code: "PT", label: "Portugal" },
  { code: "NL", label: "Pays-Bas" },
  { code: "GB", label: "Royaume-Uni" },
];

/** Années proposées, de l'année en cours jusqu'à 1980. */
export function registrationYears(): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: current - 1979 }, (_, i) => current - i);
}
