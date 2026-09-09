import type { Tables } from "@/integrations/supabase/types";

export type Vehicle = Tables<"vehicles">;
export type OdometerReading = Tables<"odometer_readings">;
export type VehicleTrip = Tables<"vehicle_trips">;
export type TripLeg = Tables<"vehicle_trip_legs">;
export type MaintenanceRule = Tables<"vehicle_maintenance_rules">;
export type MaintenanceEvent = Tables<"vehicle_maintenance_events">;
export type VehicleExpense = Tables<"vehicle_expenses">;
export type VehicleDocument = Tables<"vehicle_documents">;
export type FieldSource = Tables<"vehicle_field_sources">;

export const NO_VISUAL_LABEL = "Pas de visuel pour ce véhicule";

export const SOURCE_LABELS: Record<string, string> = {
  manual: "Saisi manuellement",
  ocr: "Lu sur un document (à confirmer)",
  apiplaque: "API Plaque (gratuit)",
  autoref: "AutoRef (gratuit)",
  vpic: "NHTSA vPIC (marché US)",
  ademe: "Base ADEME (import local)",
  carimages: "CarImages",
  personnel: "Renseigné par moi",
  constructeur: "Document constructeur",
  garage: "Garage / facture",
};

export const STATUS_LABELS: Record<string, string> = {
  not_configured: "Service non configuré",
  not_supported: "Non couvert par ce service",
  no_match: "Aucune correspondance",
  ambiguous: "Plusieurs correspondances",
  partial: "Correspondance partielle",
  matched: "Correspondance trouvée",
  fallback: "Visuel approchant",
  quota_exceeded: "Quota mensuel atteint",
  temporary_error: "Service momentanément indisponible",
};

/** Estimation du kilométrage courant à partir des relevés confirmés. */
export function estimateOdometer(readings: OdometerReading[]): {
  value: number | null;
  isEstimate: boolean;
  lastReadingDate: string | null;
  kmPerDay: number | null;
} {
  const confirmed = readings
    .filter((r) => r.confirmed && !r.is_replacement)
    .sort((a, b) => a.reading_date.localeCompare(b.reading_date));
  if (confirmed.length === 0) {
    return { value: null, isEstimate: false, lastReadingDate: null, kmPerDay: null };
  }
  const last = confirmed[confirmed.length - 1];
  const lastValue = Number(last.value);
  if (confirmed.length < 2) {
    return { value: lastValue, isEstimate: false, lastReadingDate: last.reading_date, kmPerDay: null };
  }
  const first = confirmed[0];
  const days =
    (new Date(last.reading_date).getTime() - new Date(first.reading_date).getTime()) / 86400000;
  const kmPerDay = days > 0 ? (lastValue - Number(first.value)) / days : null;
  const sinceLast = (Date.now() - new Date(last.reading_date).getTime()) / 86400000;
  if (!kmPerDay || kmPerDay <= 0 || sinceLast < 1) {
    return { value: lastValue, isEstimate: false, lastReadingDate: last.reading_date, kmPerDay };
  }
  return {
    value: Math.round(lastValue + kmPerDay * sinceLast),
    isEstimate: true,
    lastReadingDate: last.reading_date,
    kmPerDay: Math.round(kmPerDay * 10) / 10,
  };
}

export type DueStatus = "overdue" | "due_soon" | "ok" | "unknown";

export interface MaintenanceDue {
  rule: MaintenanceRule;
  dueKm: number | null;
  dueDate: string | null;
  remainingKm: number | null;
  remainingDays: number | null;
  status: DueStatus;
  isEstimate: boolean;
}

/** Calcule la prochaine échéance d'une règle d'entretien. */
export function computeDue(
  rule: MaintenanceRule,
  events: MaintenanceEvent[],
  currentKm: number | null,
  kmIsEstimate: boolean,
): MaintenanceDue {
  const done = events
    .filter((e) => e.rule_id === rule.id || e.operation === rule.operation)
    .sort((a, b) => b.event_date.localeCompare(a.event_date));
  const last = done[0] ?? null;

  const baseKm = last?.odometer != null
    ? Number(last.odometer)
    : rule.reference_odometer != null
    ? Number(rule.reference_odometer)
    : null;
  const baseDate = last?.event_date ?? rule.reference_date ?? null;

  const intervalKm = (last ? rule.interval_km : rule.first_interval_km ?? rule.interval_km) ?? null;
  const intervalMonths =
    (last ? rule.interval_months : rule.first_interval_months ?? rule.interval_months) ?? null;

  const dueKm = baseKm != null && intervalKm ? baseKm + intervalKm : null;
  let dueDate: string | null = rule.fixed_due_date ?? null;
  if (!dueDate && baseDate && intervalMonths) {
    const d = new Date(baseDate);
    d.setMonth(d.getMonth() + intervalMonths);
    dueDate = d.toISOString().slice(0, 10);
  }

  const remainingKm = dueKm != null && currentKm != null ? Math.round(dueKm - currentKm) : null;
  const remainingDays = dueDate
    ? Math.round((new Date(dueDate).getTime() - Date.now()) / 86400000)
    : null;

  let status: DueStatus = "unknown";
  if (rule.condition_based && remainingKm === null && remainingDays === null) {
    status = "unknown";
  } else if ((remainingKm !== null && remainingKm < 0) || (remainingDays !== null && remainingDays < 0)) {
    status = "overdue";
  } else if (
    (remainingKm !== null && remainingKm <= 1000) ||
    (remainingDays !== null && remainingDays <= 30)
  ) {
    status = "due_soon";
  } else if (remainingKm !== null || remainingDays !== null) {
    status = "ok";
  }

  return {
    rule,
    dueKm,
    dueDate,
    remainingKm,
    remainingDays,
    status,
    isEstimate: kmIsEstimate && remainingKm !== null,
  };
}

/** Distance retenue pour un trajet, avec la source, sans jamais inventer. */
export function retainedDistance(trip: {
  odometer_distance_km: number | null;
  gps_distance_km: number | null;
  declared_distance_km: number | null;
  planned_distance_km: number | null;
}): { value: number | null; source: string | null; isEstimate: boolean } {
  if (trip.odometer_distance_km != null)
    return { value: Number(trip.odometer_distance_km), source: "compteur", isEstimate: false };
  if (trip.gps_distance_km != null)
    return { value: Number(trip.gps_distance_km), source: "GPS", isEstimate: false };
  if (trip.declared_distance_km != null)
    return { value: Number(trip.declared_distance_km), source: "déclaré", isEstimate: false };
  if (trip.planned_distance_km != null)
    return { value: Number(trip.planned_distance_km), source: "estimation", isEstimate: true };
  return { value: null, source: null, isEstimate: false };
}

export function normalizePlate(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatPlateFr(plate: string): string {
  const p = normalizePlate(plate);
  const m = p.match(/^([A-Z]{2})(\d{3})([A-Z]{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : plate.toUpperCase();
}

export function isValidVin(vin: string): boolean {
  const v = vin.toUpperCase().trim();
  return v.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/.test(v);
}

export function completeness(v: Vehicle): number {
  const keys: (keyof Vehicle)[] = [
    "make", "model", "body_type", "first_registration", "fuel",
    "engine_version", "displacement_cm3", "power_kw", "gearbox_type", "vin",
  ];
  const filled = keys.filter((k) => v[k] !== null && v[k] !== "").length;
  return Math.round((filled / keys.length) * 100);
}
