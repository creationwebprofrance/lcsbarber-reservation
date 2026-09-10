import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { OdometerTab } from "@/components/vehicle/OdometerTab";
import { VehicleForecast } from "@/components/vehicle/VehicleForecast";
import { VehicleIdentification } from "@/components/vehicle/VehicleIdentification";
import type { Vehicle } from "@/lib/vehicle";
import { BODY_TYPES, SEGMENT_OPTIONS } from "@/lib/vehicle-normalize";
import { energyKind } from "@/lib/vehicle-maintenance-catalog";

const DRIVETRAINS = ["Traction (FWD)", "Propulsion (RWD)", "Intégrale (AWD)", "4 roues motrices (4WD)", "Je ne sais pas"];
const HYBRID_TYPES = ["Aucune", "Hybride léger (MHEV)", "Hybride (HEV)", "Hybride rechargeable (PHEV)", "Je ne sais pas"];

interface Props {
  vehicle: Vehicle;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
  currentKm: number | null;
}

const val = (v: unknown) => (v === null || v === undefined || v === "" ? "Non renseigné" : String(v));

export const VehicleDetailsDialog = ({ vehicle, open, onOpenChange, onSaved, currentKm }: Props) => {
  const { toast } = useToast();
  const electric = energyKind(vehicle) === "electrique";
  const [form, setForm] = useState({
    segment: vehicle.segment ?? "",
    body_type: vehicle.body_type ?? "",
    drivetrain: vehicle.drivetrain ?? "",
    hybrid_type: vehicle.hybrid_type ?? "",
    trim_level: vehicle.trim_level ?? "",
    doors: vehicle.doors != null ? String(vehicle.doors) : "",
    seats: vehicle.seats != null ? String(vehicle.seats) : "",
    consumption_l_100km: vehicle.consumption_l_100km != null ? String(vehicle.consumption_l_100km) : "",
    fuel_price_per_l: vehicle.fuel_price_per_l != null ? String(vehicle.fuel_price_per_l) : "",
    consumption_kwh_100km: vehicle.consumption_kwh_100km != null ? String(vehicle.consumption_kwh_100km) : "",
    elec_price_per_kwh: vehicle.elec_price_per_kwh != null ? String(vehicle.elec_price_per_kwh) : "",
  });

  useEffect(() => {
    setForm({
      segment: vehicle.segment ?? "",
      body_type: vehicle.body_type ?? "",
      drivetrain: vehicle.drivetrain ?? "",
      hybrid_type: vehicle.hybrid_type ?? "",
      trim_level: vehicle.trim_level ?? "",
      doors: vehicle.doors != null ? String(vehicle.doors) : "",
      seats: vehicle.seats != null ? String(vehicle.seats) : "",
      consumption_l_100km: vehicle.consumption_l_100km != null ? String(vehicle.consumption_l_100km) : "",
      fuel_price_per_l: vehicle.fuel_price_per_l != null ? String(vehicle.fuel_price_per_l) : "",
      consumption_kwh_100km: vehicle.consumption_kwh_100km != null ? String(vehicle.consumption_kwh_100km) : "",
      elec_price_per_kwh: vehicle.elec_price_per_kwh != null ? String(vehicle.elec_price_per_kwh) : "",
    });
  }, [vehicle]);

  const num = (s: string) => (s.trim() === "" ? null : parseFloat(s.replace(",", ".")));

  const save = async () => {
    const { error } = await supabase.from("vehicles").update({
      segment: form.segment || null,
      body_type: form.body_type || null,
      drivetrain: form.drivetrain || null,
      hybrid_type: form.hybrid_type || null,
      trim_level: form.trim_level || null,
      doors: form.doors ? parseInt(form.doors, 10) : null,
      seats: form.seats ? parseInt(form.seats, 10) : null,
      consumption_l_100km: num(form.consumption_l_100km),
      fuel_price_per_l: num(form.fuel_price_per_l),
      consumption_kwh_100km: num(form.consumption_kwh_100km),
      elec_price_per_kwh: num(form.elec_price_per_kwh),
    }).eq("id", vehicle.id);
    if (error) {
      toast({ title: "Enregistrement impossible", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Informations enregistrées" });
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Détails du véhicule</DialogTitle>
          <DialogDescription>
            Toutes les informations connues, les réglages de consommation et l'historique.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Fiche technique</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              {([
                ["Marque", vehicle.make],
                ["Modèle", vehicle.model],
                ["Année-modèle", vehicle.model_year],
                ["1re immatriculation", vehicle.first_registration],
                ["Génération", vehicle.generation],
                ["Phase / restylage", vehicle.phase],
                ["Finition", vehicle.trim_level],
                ["Segment", vehicle.segment],
                ["Carrosserie", vehicle.body_type],
                ["Énergie", vehicle.fuel],
                ["Type d'hybridation", vehicle.hybrid_type],
                ["Motorisation", vehicle.engine_version],
                ["Puissance", vehicle.power_kw ? `${vehicle.power_kw} kW` : null],
                ["Cylindrée", vehicle.displacement_cm3 ? `${vehicle.displacement_cm3} cm³` : null],
                ["Boîte de vitesses", vehicle.gearbox_type],
                ["Nombre de rapports", vehicle.gearbox_gears],
                ["Motricité", vehicle.drivetrain],
                ["Portes", vehicle.doors],
                ["Places", vehicle.seats],
                ["Immatriculation", vehicle.plate],
                ["VIN", vehicle.vin],
              ] as [string, unknown][]).map(([l, v]) => (
                <div key={l}>
                  <p className="text-xs text-muted-foreground">{l}</p>
                  <p className="font-medium">{val(v)}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Informations complémentaires</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Catégorie</Label>
                <Select value={form.segment} onValueChange={(v) => setForm({ ...form, segment: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {SEGMENT_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Carrosserie</Label>
                <Select value={form.body_type} onValueChange={(v) => setForm({ ...form, body_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {BODY_TYPES.map((b) => <SelectItem key={b.label} value={b.label}>{b.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Motricité</Label>
                <Select value={form.drivetrain} onValueChange={(v) => setForm({ ...form, drivetrain: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {DRIVETRAINS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type d'hybridation</Label>
                <Select value={form.hybrid_type} onValueChange={(v) => setForm({ ...form, hybrid_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {HYBRID_TYPES.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Finition</Label><Input value={form.trim_level} onChange={(e) => setForm({ ...form, trim_level: e.target.value })} /></div>
              <div><Label>Portes</Label><Input inputMode="numeric" value={form.doors} onChange={(e) => setForm({ ...form, doors: e.target.value })} /></div>
              <div><Label>Places</Label><Input inputMode="numeric" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Consommation et prix</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {!electric && (
                <>
                  <div>
                    <Label>Consommation moyenne (L/100 km)</Label>
                    <Input inputMode="decimal" value={form.consumption_l_100km}
                      onChange={(e) => setForm({ ...form, consumption_l_100km: e.target.value })} />
                  </div>
                  <div>
                    <Label>Prix moyen du carburant (€/L)</Label>
                    <Input inputMode="decimal" value={form.fuel_price_per_l}
                      onChange={(e) => setForm({ ...form, fuel_price_per_l: e.target.value })} />
                  </div>
                </>
              )}
              <div>
                <Label>Consommation électrique (kWh/100 km)</Label>
                <Input inputMode="decimal" value={form.consumption_kwh_100km}
                  onChange={(e) => setForm({ ...form, consumption_kwh_100km: e.target.value })} />
              </div>
              <div>
                <Label>Prix moyen de l'électricité (€/kWh)</Label>
                <Input inputMode="decimal" value={form.elec_price_per_kwh}
                  onChange={(e) => setForm({ ...form, elec_price_per_kwh: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Button onClick={save}>Enregistrer</Button>
              </div>
            </CardContent>
          </Card>

          <OdometerTab vehicleId={vehicle.id} unit={vehicle.odometer_unit} />

          <VehicleForecast vehicle={vehicle} currentKm={currentKm} />

          <VehicleIdentification vehicleId={vehicle.id} onSaved={onSaved} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
