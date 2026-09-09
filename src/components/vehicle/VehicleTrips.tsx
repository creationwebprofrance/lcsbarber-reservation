import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Link2 } from "lucide-react";
import { retainedDistance, type VehicleTrip } from "@/lib/vehicle";

interface BookingLite {
  id: string;
  appointment_date: string;
  appointment_time: string;
  client_name: string;
  client_address: string | null;
}

const USAGES = [
  { v: "professionnel", l: "Professionnel" },
  { v: "personnel", l: "Personnel" },
  { v: "mixte", l: "Mixte" },
];

export const VehicleTrips = ({ vehicleId }: { vehicleId: string }) => {
  const { toast } = useToast();
  const [trips, setTrips] = useState<VehicleTrip[]>([]);
  const [bookings, setBookings] = useState<BookingLite[]>([]);
  const [form, setForm] = useState({
    title: "",
    date: new Date().toISOString().slice(0, 10),
    usage: "professionnel",
    trip_type: "aller_retour",
    declared: "",
    booking_id: "",
  });

  const load = async () => {
    const [t, b] = await Promise.all([
      supabase.from("vehicle_trips").select("*").eq("vehicle_id", vehicleId)
        .order("started_at", { ascending: false, nullsFirst: false }).limit(200),
      supabase.from("bookings")
        .select("id, appointment_date, appointment_time, client_name, client_address")
        .order("appointment_date", { ascending: false }).limit(60),
    ]);
    setTrips((t.data ?? []) as VehicleTrip[]);
    setBookings((b.data ?? []) as BookingLite[]);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [vehicleId]);

  const add = async () => {
    const declared = form.declared ? parseFloat(form.declared.replace(",", ".")) : null;
    if (form.booking_id && trips.some((t) => t.booking_id === form.booking_id)) {
      toast({
        title: "Rendez-vous déjà lié",
        description: "Un trajet existe déjà pour ce rendez-vous, pas de double comptage.",
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase.from("vehicle_trips").insert({
      vehicle_id: vehicleId,
      title: form.title || null,
      trip_type: form.trip_type,
      usage: form.usage,
      state: "termine",
      started_at: new Date(`${form.date}T08:00:00`).toISOString(),
      declared_distance_km: declared,
      retained_distance_km: declared,
      retained_distance_source: declared !== null ? "déclaré" : null,
      distance_is_estimate: declared === null,
      business_share: form.usage === "professionnel" ? 1 : form.usage === "mixte" ? 0.5 : 0,
      booking_id: form.booking_id || null,
    } as never);
    if (error) {
      toast({ title: "Enregistrement impossible", description: error.message, variant: "destructive" });
      return;
    }
    setForm({ ...form, title: "", declared: "", booking_id: "" });
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("vehicle_trips").delete().eq("id", id);
    load();
  };

  const totalPro = trips.reduce((s, t) => {
    const d = retainedDistance(t as never);
    return s + (d.value ?? 0) * Number(t.business_share ?? 0);
  }, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ajouter un déplacement</CardTitle>
          <CardDescription>
            Un rendez-vous ne peut être rattaché qu'à un seul trajet, pour éviter de compter deux fois
            les mêmes kilomètres.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>Intitulé</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <Label>Usage</Label>
            <Select value={form.usage} onValueChange={(v) => setForm({ ...form, usage: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {USAGES.map((u) => <SelectItem key={u.v} value={u.v}>{u.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Type</Label>
            <Select value={form.trip_type} onValueChange={(v) => setForm({ ...form, trip_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aller">Aller simple</SelectItem>
                <SelectItem value="aller_retour">Aller-retour</SelectItem>
                <SelectItem value="tournee">Tournée</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Distance déclarée (km)</Label>
            <Input value={form.declared} inputMode="decimal"
              onChange={(e) => setForm({ ...form, declared: e.target.value })} />
          </div>
          <div>
            <Label>Rendez-vous lié (facultatif)</Label>
            <Select value={form.booking_id || "none"}
              onValueChange={(v) => setForm({ ...form, booking_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun</SelectItem>
                {bookings.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {new Date(b.appointment_date).toLocaleDateString("fr-FR")} — {b.client_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <Button onClick={add}>Enregistrer le déplacement</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Déplacements</CardTitle>
          <CardDescription>
            Total professionnel retenu : {Math.round(totalPro).toLocaleString("fr-FR")} km
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {trips.length === 0 && <p className="text-sm text-muted-foreground">Aucun déplacement.</p>}
          {trips.map((t) => {
            const d = retainedDistance(t as never);
            return (
              <div key={t.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                <div>
                  <p className="font-medium">{t.title || "Déplacement"}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.started_at && new Date(t.started_at).toLocaleDateString("fr-FR")} · {t.usage}
                    {d.value !== null && ` · ${d.value} km (${d.source}${d.isEstimate ? ", estimation" : ""})`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {t.booking_id && <Badge variant="outline"><Link2 className="mr-1 h-3 w-3" />RDV</Badge>}
                  <Button variant="ghost" size="icon" onClick={() => remove(t.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};
