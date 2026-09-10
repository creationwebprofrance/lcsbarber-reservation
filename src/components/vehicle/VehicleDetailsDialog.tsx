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
  const initial = (v: Vehicle) => ({
    label: v.label ?? "",
    make: v.make ?? "",
    model: v.model ?? "",
    model_year: v.model_year != null ? String(v.model_year) : "",
    plate: v.plate ?? "",
    vin: v.vin ?? "",
    fuel: v.fuel ?? "",
    gearbox_type: v.gearbox_type ?? "",
    segment: v.segment ?? "",
    body_type: v.body_type ?? "",
    drivetrain: v.drivetrain ?? "",
    hybrid_type: v.hybrid_type ?? "",
    trim_level: v.trim_level ?? "",
    doors: v.doors != null ? String(v.doors) : "",
    seats: v.seats != null ? String(v.seats) : "",
    consumption_l_100km: v.consumption_l_100km != null ? String(v.consumption_l_100km) : "",
    fuel_price_per_l: v.fuel_price_per_l != null ? String(v.fuel_price_per_l) : "",
    consumption_kwh_100km: v.consumption_kwh_100km != null ? String(v.consumption_kwh_100km) : "",
    elec_price_per_kwh: v.elec_price_per_kwh != null ? String(v.elec_price_per_kwh) : "",
  });

  const [form, setForm] = useState(() => initial(vehicle));

  useEffect(() => { setForm(initial(vehicle)); }, [vehicle]);

  const num = (s: string) => (s.trim() === "" ? null : parseFloat(s.replace(",", ".")));

  const save = async () => {
    const { error } = await supabase.from("vehicles").update({
      label: form.label.trim() || null,
      make: form.make.trim() || null,
      model: form.model.trim() || null,
      model_year: form.model_year ? parseInt(form.model_year, 10) : null,
      plate: form.plate.trim().toUpperCase() || null,
      vin: form.vin.trim().toUpperCase() || null,
      fuel: form.fuel || null,
      gearbox_type: form.gearbox_type || null,
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
            <CardHeader><CardTitle className="text-base">Modifier l'identité</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Nom du véhicule (facultatif)</Label>
                <Input value={form.label} placeholder="Ex. Voiture de tournée"
                  onChange={(e) => setForm({ ...form, label: e.target.value })} />
              </div>
              <div><Label>Marque</Label>
                <Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} /></div>
              <div><Label>Modèle</Label>
                <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
              <div>
                <Label>Année</Label>
                <Select value={form.model_year} onValueChange={(v) => setForm({ ...form, model_year: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {registrationYears().map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Énergie</Label>
                <Select value={form.fuel} onValueChange={(v) => setForm({ ...form, fuel: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {FUEL_OPTIONS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Boîte de vitesses</Label>
                <Select value={form.gearbox_type} onValueChange={(v) => setForm({ ...form, gearbox_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {GEARBOXES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Immatriculation</Label>
                <Input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>VIN (facultatif)</Label>
                <Input value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value })} /></div>
              <div className="sm:col-span-2">
                <Button onClick={save}>Enregistrer les modifications</Button>
              </div>
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
