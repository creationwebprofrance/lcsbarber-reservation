import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Car, ArrowLeft, Loader2, Gauge, Wrench } from "lucide-react";
import { VehicleIdentification } from "@/components/vehicle/VehicleIdentification";
import { Vehicle3D } from "@/components/vehicle/Vehicle3D";
import { VehicleForecast, buildForecasts } from "@/components/vehicle/VehicleForecast";
import { VehicleFuel } from "@/components/vehicle/VehicleFuel";
import { VehicleDetailsDialog } from "@/components/vehicle/VehicleDetailsDialog";
import {
  estimateOdometer, type MaintenanceEvent, type MaintenanceRule,
  type OdometerReading, type Vehicle,
} from "@/lib/vehicle";

const NEW = "__new__";

const vehicleName = (v: Vehicle) =>
  v.label || [v.make, v.model].filter(Boolean).join(" ") || "Véhicule sans nom";

export const AdminVehicules = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [readings, setReadings] = useState<OdometerReading[]>([]);
  const [rules, setRules] = useState<MaintenanceRule[]>([]);
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);
  const [details, setDetails] = useState(false);
  const [allForecasts, setAllForecasts] = useState(false);
  const [adding, setAdding] = useState(false);

  const current = vehicles.find((v) => v.id === currentId) ?? null;

  const loadVehicles = useCallback(async () => {
    const { data } = await supabase.from("vehicles").select("*")
      .eq("archived", false).order("is_default", { ascending: false }).order("created_at");
    const list = (data ?? []) as Vehicle[];
    setVehicles(list);
    setCurrentId((prev) => (prev && list.some((v) => v.id === prev) ? prev : list[0]?.id ?? null));
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      const { data: roles } = await supabase.from("user_roles").select("role")
        .eq("user_id", session.user.id).eq("role", "admin");
      if (!roles || roles.length === 0) {
        toast({ title: "Accès refusé", variant: "destructive" });
        navigate("/");
        return;
      }
      setAllowed(true);
      await loadVehicles();
      setChecking(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadVehicleData = useCallback(async (id: string | null) => {
    if (!id) { setReadings([]); setRules([]); setEvents([]); return; }
    const [o, r, e] = await Promise.all([
      supabase.from("odometer_readings").select("*").eq("vehicle_id", id),
      supabase.from("vehicle_maintenance_rules").select("*").eq("vehicle_id", id),
      supabase.from("vehicle_maintenance_events").select("*").eq("vehicle_id", id),
    ]);
    setReadings((o.data ?? []) as OdometerReading[]);
    setRules((r.data ?? []) as MaintenanceRule[]);
    setEvents((e.data ?? []) as MaintenanceEvent[]);
  }, []);

  useEffect(() => { loadVehicleData(currentId); }, [currentId, loadVehicleData]);

  const refresh = () => { loadVehicles(); loadVehicleData(currentId); };

  const setDefault = async (id: string) => {
    await supabase.from("vehicles").update({ is_default: true }).eq("id", id);
    toast({ title: "Véhicule principal mis à jour" });
    loadVehicles();
  };

  const archive = async (id: string) => {
    await supabase.from("vehicles").update({ archived: true, is_default: false }).eq("id", id);
    toast({ title: "Véhicule archivé" });
    setCurrentId(null);
    loadVehicles();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) {
      toast({ title: "Suppression impossible", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Véhicule supprimé" });
    setDetails(false);
    setCurrentId(null);
    loadVehicles();
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!allowed) return null;

  const est = estimateOdometer(readings);
  const kmLabel = est.value === null
    ? "Kilométrage inconnu"
    : `${est.value.toLocaleString("fr-FR")} ${current?.odometer_unit ?? "km"}${est.isEstimate ? " (estimation)" : ""}`;

  const nextOp = current
    ? buildForecasts(current, rules, events, est.value).find((f) => f.status !== "unknown") ?? null
    : null;

  const title = current
    ? [current.make, current.model].filter(Boolean).join(" ") || current.label || "Véhicule"
    : "";
  const year = current?.model_year ?? (current?.first_registration
    ? Number(current.first_registration.slice(0, 4))
    : null);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-4">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Car className="h-6 w-6" /> Mon véhicule
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {vehicles.length > 0 && (
              <Select
                value={adding ? NEW : currentId ?? ""}
                onValueChange={(v) => {
                  if (v === NEW) { setAdding(true); return; }
                  setAdding(false);
                  setCurrentId(v);
                }}
              >
                <SelectTrigger className="w-56"><SelectValue placeholder="Choisir un véhicule" /></SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {vehicleName(v)}{v.is_default ? " ★" : ""}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW}>+ Ajouter un véhicule</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Administration
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto space-y-6 px-4 py-8">
        <p className="text-sm text-muted-foreground">
          Espace strictement privé : aucune de ces informations n'apparaît côté client.
        </p>

        {adding || !current ? (
          <div className="space-y-3">
            {adding && vehicles.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
                ← Revenir à {current ? vehicleName(current) : "mes véhicules"}
              </Button>
            )}
            <VehicleIdentification
              vehicleId={null}
              onSaved={() => { setAdding(false); refresh(); }}
            />
          </div>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">{title}</CardTitle>
                  <CardDescription>{year ? `Année ${year}` : "Année non renseignée"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border p-3">
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Gauge className="h-4 w-4" /> Kilométrage actuel
                      </p>
                      <p className="text-lg font-semibold">{kmLabel}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Wrench className="h-4 w-4" /> Prochain entretien
                      </p>
                      <p className="font-semibold">
                        {nextOp ? nextOp.item.label : "À compléter"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {nextOp ? nextOp.phrase : "Renseigne un intervalle pour obtenir une projection."}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setDetails(true)}>Voir / modifier les détails</Button>
                    {!current.is_default && (
                      <Button variant="outline" onClick={() => setDefault(current.id)}>
                        Définir comme principal
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => setAdding(true)}>
                      <Plus className="mr-2 h-4 w-4" /> Ajouter un véhicule
                    </Button>
                    <Button variant="ghost" onClick={() => archive(current.id)}>
                      Archiver
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer {vehicleName(current)} ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Le véhicule, son kilométrage, ses entretiens, ses dépenses et ses documents
                            seront définitivement effacés. Cette action est irréversible.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(current.id)}>
                            Supprimer définitivement
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>

              <Vehicle3D
                make={current.make}
                model={current.model}
                year={year}
                expectedBody={current.body_type}
              />
            </div>

            <VehicleForecast
              vehicle={current}
              currentKm={est.value}
              compact
              onShowAll={() => setAllForecasts(true)}
            />

            <VehicleFuel vehicle={current} onComplete={() => setDetails(true)} />

            <VehicleDetailsDialog
              vehicle={current}
              open={details}
              onOpenChange={(o) => { setDetails(o); if (!o) refresh(); }}
              onSaved={refresh}
              currentKm={est.value}
            />

            {allForecasts && (
              <div className="space-y-3">
                <VehicleForecast vehicle={current} currentKm={est.value} />
                <Button variant="ghost" size="sm" onClick={() => setAllForecasts(false)}>
                  Masquer les prévisions
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminVehicules;
