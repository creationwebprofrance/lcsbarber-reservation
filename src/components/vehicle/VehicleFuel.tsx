import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Fuel } from "lucide-react";
import { retainedDistance, type Vehicle, type VehicleTrip } from "@/lib/vehicle";
import { FUEL_ESTIMATE_DISCLAIMER } from "@/lib/vehicle-normalize";
import { energyKind } from "@/lib/vehicle-maintenance-catalog";

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const isDone = (t: VehicleTrip) => /(termin|complet|done|realis|effectu)/i.test(t.state ?? "");
const isBusiness = (t: VehicleTrip) => !/perso/i.test(t.usage ?? "") ;

interface Row { id: string; date: string; title: string; km: number }

export const VehicleFuel = ({ vehicle, onComplete }: { vehicle: Vehicle; onComplete: () => void }) => {
  const [trips, setTrips] = useState<VehicleTrip[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("vehicle_trips").select("*")
      .eq("vehicle_id", vehicle.id).order("started_at", { ascending: false }).limit(500);
    setTrips((data ?? []) as VehicleTrip[]);
  }, [vehicle.id]);
  useEffect(() => { load(); }, [load]);

  const electric = energyKind(vehicle) === "electrique";
  const consumption = electric
    ? vehicle.consumption_kwh_100km != null ? Number(vehicle.consumption_kwh_100km) : null
    : vehicle.consumption_l_100km != null ? Number(vehicle.consumption_l_100km) : null;
  const price = electric
    ? vehicle.elec_price_per_kwh != null ? Number(vehicle.elec_price_per_kwh) : null
    : vehicle.fuel_price_per_l != null ? Number(vehicle.fuel_price_per_l) : null;
  const unit = electric ? "kWh" : "L";

  const { rows, prevKm } = useMemo(() => {
    const now = monthKey(new Date());
    const prevDate = new Date();
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prev = monthKey(prevDate);
    let prevKm = 0;
    const rows: Row[] = [];
    for (const t of trips) {
      if (!isDone(t) || !isBusiness(t)) continue;
      const when = (t.ended_at ?? t.started_at ?? t.created_at).slice(0, 7);
      const km = t.retained_distance_km != null
        ? Number(t.retained_distance_km)
        : retainedDistance(t).value;
      if (km == null) continue;
      const share = Number(t.business_share ?? 1);
      const kept = km * (share > 1 ? 1 : share);
      if (when === now) {
        rows.push({
          id: t.id,
          date: (t.ended_at ?? t.started_at ?? t.created_at).slice(0, 10),
          title: t.title || "Prestation",
          km: kept,
        });
      } else if (when === prev) prevKm += kept;
    }
    return { rows, prevKm };
  }, [trips]);

  const totalKm = rows.reduce((s, r) => s + r.km, 0);
  const usable = consumption != null && price != null && totalKm > 0;
  const quantity = usable ? (totalKm * consumption!) / 100 : null;
  const cost = quantity != null ? quantity * price! : null;
  const prevCost = usable && prevKm > 0 ? (prevKm * consumption!) / 100 * price! : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fuel className="h-5 w-5" /> Carburant professionnel ce mois-ci
        </CardTitle>
        <CardDescription>Dépenses de carburant estimées à partir des prestations réalisées.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!usable ? (
          <>
            <p className="font-medium">Estimation indisponible</p>
            <p className="text-xs text-muted-foreground">
              {totalKm === 0
                ? "Aucun kilomètre de prestation enregistré ce mois-ci."
                : "Renseigne la consommation moyenne et le prix moyen."}
            </p>
            <Button variant="outline" size="sm" onClick={onComplete}>Compléter les informations</Button>
          </>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Kilomètres pris en compte</p>
                <p className="text-lg font-semibold">{Math.round(totalKm).toLocaleString("fr-FR")} km</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{electric ? "kWh estimés" : "Litres estimés"}</p>
                <p className="text-lg font-semibold">{quantity!.toFixed(2)} {unit}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Dépense estimée</p>
                <p className="text-lg font-semibold">{cost!.toFixed(2)} €</p>
              </div>
            </div>
            {prevCost != null && (
              <p className="text-xs text-muted-foreground">
                Mois précédent : {Math.round(prevKm).toLocaleString("fr-FR")} km · {prevCost.toFixed(2)} €
              </p>
            )}
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Voir le détail</Button>
          </>
        )}
        <Alert><AlertDescription className="text-xs">{FUEL_ESTIMATE_DISCLAIMER}</AlertDescription></Alert>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détail du carburant professionnel</DialogTitle>
            <DialogDescription>Une ligne par prestation réalisée ce mois-ci.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border p-2">
                <span>
                  {new Date(r.date).toLocaleDateString("fr-FR")} — {r.title}
                </span>
                <span className="text-right">
                  {Math.round(r.km)} km
                  {usable && ` · ${((r.km * consumption!) / 100 * price!).toFixed(2)} €`}
                </span>
              </div>
            ))}
            <Alert><AlertDescription className="text-xs">{FUEL_ESTIMATE_DISCLAIMER}</AlertDescription></Alert>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
