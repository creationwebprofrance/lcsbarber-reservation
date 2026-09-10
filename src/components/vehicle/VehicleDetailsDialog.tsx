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
import type { Vehicle } from "@/lib/vehicle";
import { FUEL_OPTIONS, registrationYears } from "@/lib/vehicle-options";
import { energyKind } from "@/lib/vehicle-maintenance-catalog";

const GEARBOXES = ["Manuelle", "Automatique", "Je ne sais pas"];

interface Props {
  vehicle: Vehicle;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
  currentKm: number | null;
}

export const VehicleDetailsDialog = ({ vehicle, open, onOpenChange, onSaved, currentKm }: Props) => {
  const { toast } = useToast();
  const electric = energyKind(vehicle) === "electrique";
  const initial = (v: Vehicle) => ({
    label: v.label ?? "",
    make: v.make ?? "",
    model: v.model ?? "",
    model_year: v.model_year != null ? String(v.model_year) : "",
    plate: v.plate ?? "",
    fuel: v.fuel ?? "",
    gearbox_type: v.gearbox_type ?? "",
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
      fuel: form.fuel || null,
      gearbox_type: form.gearbox_type || null,
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
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mon véhicule</DialogTitle>
          <DialogDescription>
            Les informations essentielles, le kilométrage et les entretiens à venir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Mon véhicule</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Petit nom (facultatif)</Label>
                <Input value={form.label} placeholder="Ex. Ma voiture de tournée"
                  onChange={(e) => setForm({ ...form, label: e.target.value })} />
              </div>
              <div><Label>Marque</Label>
                <Input value={form.make} placeholder="Ex. Peugeot"
                  onChange={(e) => setForm({ ...form, make: e.target.value })} /></div>
              <div><Label>Modèle</Label>
                <Input value={form.model} placeholder="Ex. 308"
                  onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
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
                <Label>Carburant / énergie</Label>
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
              <div><Label>Plaque d'immatriculation</Label>
                <Input value={form.plate} placeholder="Ex. AB-123-CD"
                  onChange={(e) => setForm({ ...form, plate: e.target.value })} /></div>
              <div className="sm:col-span-2">
                <Button onClick={save}>Enregistrer</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Plein et consommation</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {!electric && (
                <>
                  <div>
                    <Label>Consommation moyenne (L/100 km)</Label>
                    <Input inputMode="decimal" value={form.consumption_l_100km} placeholder="Ex. 6,5"
                      onChange={(e) => setForm({ ...form, consumption_l_100km: e.target.value })} />
                  </div>
                  <div>
                    <Label>Prix du carburant (€/L)</Label>
                    <Input inputMode="decimal" value={form.fuel_price_per_l} placeholder="Ex. 1,85"
                      onChange={(e) => setForm({ ...form, fuel_price_per_l: e.target.value })} />
                  </div>
                </>
              )}
              {electric && (
                <>
                  <div>
                    <Label>Consommation (kWh/100 km)</Label>
                    <Input inputMode="decimal" value={form.consumption_kwh_100km} placeholder="Ex. 17"
                      onChange={(e) => setForm({ ...form, consumption_kwh_100km: e.target.value })} />
                  </div>
                  <div>
                    <Label>Prix de l'électricité (€/kWh)</Label>
                    <Input inputMode="decimal" value={form.elec_price_per_kwh} placeholder="Ex. 0,25"
                      onChange={(e) => setForm({ ...form, elec_price_per_kwh: e.target.value })} />
                  </div>
                </>
              )}
              <div className="sm:col-span-2">
                <Button onClick={save}>Enregistrer</Button>
              </div>
            </CardContent>
          </Card>

          <OdometerTab vehicleId={vehicle.id} unit={vehicle.odometer_unit} />

          <VehicleForecast vehicle={vehicle} currentKm={currentKm} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
