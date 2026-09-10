import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import type { MaintenanceEvent, MaintenanceRule, Vehicle } from "@/lib/vehicle";
import { applicableOperations, type CatalogItem } from "@/lib/vehicle-maintenance-catalog";
import { PRO_DISCLAIMER, SAFETY_DISCLAIMER } from "@/lib/vehicle-normalize";

export type ForecastStatus = "now" | "soon" | "later" | "unknown";

const STATUS_TEXT: Record<ForecastStatus, string> = {
  now: "À vérifier maintenant",
  soon: "À anticiper",
  later: "Plus tard",
  unknown: "Informations insuffisantes",
};
const STATUS_STYLE: Record<ForecastStatus, string> = {
  now: "bg-destructive/15 text-destructive border-destructive/40",
  soon: "bg-amber-500/15 text-amber-600 border-amber-500/40",
  later: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  unknown: "",
};

const NATURE_TEXT: Record<string, string> = {
  entretien: "Entretien périodique",
  controle: "Contrôle à prévoir",
  usure: "Pièce d'usure",
  reparation: "Réparation diagnostiquée",
};

export interface Forecast {
  item: CatalogItem;
  rule: MaintenanceRule | null;
  lastEvent: MaintenanceEvent | null;
  referenceKm: number | null;
  dueKm: number | null;
  dueDate: string | null;
  remainingKm: number | null;
  status: ForecastStatus;
  phrase: string;
}

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");

export function buildForecasts(
  vehicle: Vehicle,
  rules: MaintenanceRule[],
  events: MaintenanceEvent[],
  currentKm: number | null,
): Forecast[] {
  const items = applicableOperations(vehicle);
  const list = items.map<Forecast>((item) => {
    const rule = rules.find((r) => r.operation === item.label) ?? null;
    const lastEvent =
      events
        .filter((e) => e.operation === item.label)
        .sort((a, b) => b.event_date.localeCompare(a.event_date))[0] ?? null;

    const referenceKm =
      lastEvent?.odometer != null
        ? Number(lastEvent.odometer)
        : rule?.reference_odometer != null
        ? Number(rule.reference_odometer)
        : currentKm;

    // Priorité à la règle saisie ; sinon ordre de grandeur générique du catalogue.
    const isEstimate = !(rule?.interval_km || rule?.interval_months);
    const intervalKm = rule?.interval_km ?? item.default_interval_km ?? null;
    const intervalMonths = rule?.interval_months ?? item.default_interval_months ?? null;

    const dueKm = intervalKm && referenceKm != null ? referenceKm + intervalKm : null;
    let dueDate: string | null = null;
    if (intervalMonths) {
      const base = lastEvent?.event_date ?? rule?.reference_date ?? null;
      if (base) {
        const d = new Date(base);
        d.setMonth(d.getMonth() + intervalMonths);
        dueDate = d.toISOString().slice(0, 10);
      }
    }
    // Si seule une échéance km est connue, on estime une date approximative
    // sur la base d'un rythme générique de 15 000 km/an.
    if (!dueDate && dueKm != null && currentKm != null && dueKm > currentKm) {
      const days = ((dueKm - currentKm) / 15000) * 365;
      const d = new Date(Date.now() + days * 86400000);
      dueDate = d.toISOString().slice(0, 10);
    }
    const remainingKm = dueKm != null && currentKm != null ? dueKm - currentKm : null;
    const remainingDays = dueDate
      ? Math.round((new Date(dueDate).getTime() - Date.now()) / 86400000)
      : null;

    let status: ForecastStatus = "unknown";
    if (remainingKm !== null || remainingDays !== null) {
      if ((remainingKm !== null && remainingKm <= 500) || (remainingDays !== null && remainingDays <= 15)) {
        status = "now";
      } else if ((remainingKm !== null && remainingKm <= 3000) || (remainingDays !== null && remainingDays <= 60)) {
        status = "soon";
      } else status = "later";
    }

    const approx = isEstimate ? "≈ " : "";
    let phrase = "Intervalle à renseigner";
    if (remainingKm !== null && dueKm !== null) {
      phrase = remainingKm >= 0
        ? `${approx}Dans ${fmt(remainingKm)} km, vers ${fmt(dueKm)} km`
        : `${approx}Dépassé de ${fmt(-remainingKm)} km (prévu vers ${fmt(dueKm)} km)`;
    } else if (dueKm !== null) {
      phrase = `${approx}Vers ${fmt(dueKm)} km`;
    }
    if (dueDate) {
      phrase += ` · ${isEstimate ? "vers" : "avant"} le ${new Date(dueDate).toLocaleDateString("fr-FR")}`;
    }
    if (isEstimate && (dueKm !== null || dueDate)) {
      phrase += " (estimation)";
    }

    return { item, rule, lastEvent, referenceKm, dueKm, dueDate, remainingKm, status, phrase };
  });

  const order: Record<ForecastStatus, number> = { now: 0, soon: 1, later: 2, unknown: 3 };
  return list.sort((a, b) => {
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return (a.remainingKm ?? Infinity) - (b.remainingKm ?? Infinity);
  });
}

interface Props {
  vehicle: Vehicle;
  currentKm: number | null;
  compact?: boolean;
  onShowAll?: () => void;
}

export const VehicleForecast = ({ vehicle, currentKm, compact, onShowAll }: Props) => {
  const { toast } = useToast();
  const [rules, setRules] = useState<MaintenanceRule[]>([]);
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<Forecast | null>(null);
  const [bulk, setBulk] = useState(false);
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().slice(0, 10));
  const [bulkKm, setBulkKm] = useState(currentKm != null ? String(currentKm) : "");
  const [bulkConfirm, setBulkConfirm] = useState(false);

  const load = useCallback(async () => {
    const [r, e] = await Promise.all([
      supabase.from("vehicle_maintenance_rules").select("*").eq("vehicle_id", vehicle.id),
      supabase.from("vehicle_maintenance_events").select("*").eq("vehicle_id", vehicle.id),
    ]);
    setRules((r.data ?? []) as MaintenanceRule[]);
    setEvents((e.data ?? []) as MaintenanceEvent[]);
  }, [vehicle.id]);

  useEffect(() => { load(); }, [load]);

  const forecasts = useMemo(
    () => buildForecasts(vehicle, rules, events, currentKm),
    [vehicle, rules, events, currentKm],
  );
  const shown = compact ? forecasts.slice(0, 3) : forecasts;

  const insertEvent = async (item: CatalogItem, date: string, km: number | null) => {
    const rule = rules.find((r) => r.operation === item.label) ?? null;
    await supabase.from("vehicle_maintenance_events").insert({
      vehicle_id: vehicle.id,
      rule_id: rule?.id ?? null,
      operation: item.label,
      action_type: item.nature,
      event_date: date,
      odometer: km,
      source: "personnel",
    } as never);
  };

  const markDone = async (f: Forecast) => {
    await insertEvent(f.item, new Date().toISOString().slice(0, 10), currentKm);
    toast({ title: "Opération enregistrée comme faite" });
    setDetail(null);
    load();
  };

  const validateSelected = async () => {
    const keys = Object.keys(selected).filter((k) => selected[k]);
    const km = bulkKm ? parseFloat(bulkKm.replace(",", ".")) : null;
    for (const key of keys) {
      const f = forecasts.find((x) => x.item.key === key);
      if (f) await insertEvent(f.item, bulkDate, km);
    }
    setSelected({});
    setBulk(false);
    setBulkConfirm(false);
    toast({ title: `${keys.length} opération(s) enregistrée(s)` });
    load();
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entretiens à prévoir</CardTitle>
        <CardDescription>
          Suggestions calculées à partir du kilométrage et des opérations déjà enregistrées.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {shown.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Complète l'énergie du véhicule pour obtenir des suggestions.
          </p>
        )}

        {shown.map((f) => (
          <div key={f.item.key} className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm">
            {!compact && (
              <Checkbox
                checked={Boolean(selected[f.item.key])}
                onCheckedChange={(v) => setSelected((s) => ({ ...s, [f.item.key]: Boolean(v) }))}
              />
            )}
            <button className="flex-1 text-left" onClick={() => setDetail(f)}>
              <p className="font-medium">{f.item.label}</p>
              <p className="text-xs text-muted-foreground">{NATURE_TEXT[f.item.nature]}</p>
              <p className="text-xs text-muted-foreground">{f.phrase}</p>
            </button>
            <Badge variant="outline" className={STATUS_STYLE[f.status]}>
              {compact && f.status === "unknown" ? "À compléter" : STATUS_TEXT[f.status]}
            </Badge>
          </div>
        ))}

        {compact ? (
          <Button variant="outline" size="sm" onClick={onShowAll}>Voir toutes les prévisions</Button>
        ) : (
          <Button size="sm" disabled={selectedCount === 0} onClick={() => setBulk(true)}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Tout ce qui est sélectionné a été fait ({selectedCount})
          </Button>
        )}

        <Alert>
          <AlertDescription className="text-xs">{PRO_DISCLAIMER}</AlertDescription>
        </Alert>
      </CardContent>

      <Dialog open={bulk} onOpenChange={setBulk}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer les opérations sélectionnées</DialogTitle>
            <DialogDescription>
              Seules les {selectedCount} opération(s) cochée(s) seront enregistrées. Les autres restent inchangées.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Date des interventions</Label>
              <Input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} />
            </div>
            <div>
              <Label>Kilométrage de référence</Label>
              <Input inputMode="numeric" value={bulkKm} onChange={(e) => setBulkKm(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={bulkConfirm} onCheckedChange={(v) => setBulkConfirm(Boolean(v))} />
              Je confirme que ces opérations ont bien été réalisées.
            </label>
          </div>
          <DialogFooter>
            <Button disabled={!bulkConfirm} onClick={validateSelected}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detail.item.label}</DialogTitle>
                <DialogDescription>{detail.item.role}</DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-sm">
                <p>
                  <strong>Dernier entretien connu :</strong>{" "}
                  {detail.lastEvent
                    ? `${new Date(detail.lastEvent.event_date).toLocaleDateString("fr-FR")}${
                        detail.lastEvent.odometer != null ? ` — ${fmt(Number(detail.lastEvent.odometer))} km` : ""
                      }`
                    : "Inconnu"}
                </p>
                <p><strong>Prochaine échéance :</strong> {detail.phrase}</p>

                <Alert><AlertDescription className="text-xs">{PRO_DISCLAIMER}</AlertDescription></Alert>
                {detail.item.safety && (
                  <Alert>
                    <ShieldAlert className="h-4 w-4" />
                    <AlertDescription className="text-xs">{SAFETY_DISCLAIMER}</AlertDescription>
                  </Alert>
                )}
              </div>

              <DialogFooter className="flex-wrap gap-2">
                <Button onClick={() => markDone(detail)}>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Marquer comme fait
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
