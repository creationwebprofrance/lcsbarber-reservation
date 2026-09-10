import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Car, ArrowLeft, Loader2, Gauge, Route, Wrench, Euro, FileText, Sparkles } from "lucide-react";
import { VehicleIdentification } from "@/components/vehicle/VehicleIdentification";
import { Vehicle3D } from "@/components/vehicle/Vehicle3D";
import { OdometerTab } from "@/components/vehicle/OdometerTab";
import { VehicleTrips } from "@/components/vehicle/VehicleTrips";
import { VehicleMaintenance } from "@/components/vehicle/VehicleMaintenance";
import { VehicleExpenses } from "@/components/vehicle/VehicleExpenses";
import { VehicleDocuments } from "@/components/vehicle/VehicleDocuments";
import {
  completeness, estimateOdometer, STATUS_LABELS, SOURCE_LABELS,
  type OdometerReading, type Vehicle,
} from "@/lib/vehicle";

interface QuotaRow { provider: string; period: string; call_count: number; max_calls: number }

export const AdminVehicules = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [readings, setReadings] = useState<OdometerReading[]>([]);
  const [quotas, setQuotas] = useState<QuotaRow[]>([]);
  const [visualBusy, setVisualBusy] = useState(false);

  const current = vehicles.find((v) => v.id === currentId) ?? null;

  const loadVehicles = useCallback(async () => {
    const { data } = await supabase.from("vehicles").select("*")
      .eq("archived", false).order("is_default", { ascending: false }).order("created_at");
    const list = (data ?? []) as Vehicle[];
    setVehicles(list);
    setCurrentId((prev) => prev && list.some((v) => v.id === prev) ? prev : list[0]?.id ?? null);
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

  useEffect(() => {
    if (!currentId) { setReadings([]); return; }
    supabase.from("odometer_readings").select("*").eq("vehicle_id", currentId)
      .then(({ data }) => setReadings((data ?? []) as OdometerReading[]));
  }, [currentId]);

  const loadQuotas = async () => {
    const { data, error } = await supabase.functions.invoke("vehicle-lookup", { body: { action: "quota" } });
    if (error) return;
    setQuotas(((data as { quotas: QuotaRow[] }).quotas ?? []).slice(0, 6));
  };
  useEffect(() => { if (allowed) loadQuotas(); }, [allowed]);

  const fetchVisual = async () => {
    if (!current?.make || !current?.model) return;
    setVisualBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("vehicle-lookup", {
        body: { action: "visual", make: current.make, model: current.model, generation: current.generation },
      });
      if (error) throw new Error(error.message);
      const res = data as { status: string; fields?: Record<string, unknown> };
      if (res.status === "matched" || res.status === "fallback") {
        await supabase.from("vehicles").update({
          visual_source: "carimages",
          visual_meta: res.fields as never,
        }).eq("id", current.id);
        await loadVehicles();
      } else {
        toast({ title: STATUS_LABELS[res.status] ?? res.status });
      }
      loadQuotas();
    } catch (e) {
      toast({ title: "Visuel indisponible", description: (e as Error).message, variant: "destructive" });
    } finally {
      setVisualBusy(false);
    }
  };

  const setDefault = async (id: string) => {
    await supabase.from("vehicles").update({ is_default: true }).eq("id", id);
    loadVehicles();
  };

  const archive = async (id: string) => {
    await supabase.from("vehicles").update({ archived: true, is_default: false }).eq("id", id);
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
  const visual = (current?.visual_meta ?? null) as
    | { model_url?: string; fallback?: boolean; watermarked?: boolean }
    | null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-4">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Car className="h-6 w-6" /> Mon véhicule
          </h1>
          <div className="flex items-center gap-2">
            {vehicles.length > 0 && (
              <Select value={currentId ?? ""} onValueChange={setCurrentId}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.label || [v.make, v.model].filter(Boolean).join(" ") || "Véhicule sans nom"}
                    </SelectItem>
                  ))}
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

        {!current ? (
          <VehicleIdentification vehicleId={null} onSaved={loadVehicles} />
        ) : (
          <Tabs defaultValue="overview" className="space-y-6">
            <div className="-mx-4 overflow-x-auto px-4 pb-2">
              <TabsList className="inline-flex w-max gap-1 p-1">
                <TabsTrigger value="overview" className="gap-2"><Car className="h-4 w-4" />Vue d'ensemble</TabsTrigger>
                <TabsTrigger value="identity" className="gap-2"><Sparkles className="h-4 w-4" />Identification</TabsTrigger>
                <TabsTrigger value="odometer" className="gap-2"><Gauge className="h-4 w-4" />Kilométrage</TabsTrigger>
                <TabsTrigger value="trips" className="gap-2"><Route className="h-4 w-4" />Déplacements</TabsTrigger>
                <TabsTrigger value="maintenance" className="gap-2"><Wrench className="h-4 w-4" />Entretien</TabsTrigger>
                <TabsTrigger value="expenses" className="gap-2"><Euro className="h-4 w-4" />Dépenses</TabsTrigger>
                <TabsTrigger value="documents" className="gap-2"><FileText className="h-4 w-4" />Documents</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {current.label || [current.make, current.model].filter(Boolean).join(" ") || "Véhicule"}
                    </CardTitle>
                    <CardDescription>
                      Fiche complétée à {completeness(current)} % ·{" "}
                      {est.value !== null
                        ? `${est.value.toLocaleString("fr-FR")} ${current.odometer_unit}${est.isEstimate ? " (estimation)" : ""}`
                        : "kilométrage inconnu"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {([
                        ["Immatriculation", current.plate],
                        ["VIN", current.vin],
                        ["Énergie", current.fuel],
                        ["Carrosserie", current.body_type],
                        ["1re mise en circulation", current.first_registration],
                        ["Version moteur", current.engine_version],
                        ["Cylindrée", current.displacement_cm3 ? `${current.displacement_cm3} cm³` : null],
                        ["Puissance", current.power_kw ? `${current.power_kw} kW` : null],
                        ["Boîte", current.gearbox_type],
                      ] as [string, string | number | null][]).map(([l, v]) => (
                        <div key={l}>
                          <p className="text-xs text-muted-foreground">{l}</p>
                          <p className="font-medium">{v || "Non renseigné"}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {!current.is_default && (
                        <Button variant="outline" size="sm" onClick={() => setDefault(current.id)}>
                          Définir par défaut
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => archive(current.id)}>Archiver</Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-3">
                  <Vehicle3D
                    make={current.make}
                    model={current.model}
                    year={current.model_year ?? (current.first_registration
                      ? Number(current.first_registration.slice(0, 4))
                      : null)}
                  />
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Services externes gratuits</CardTitle>
                  <CardDescription>
                    Consommation du mois, plafonnée volontairement sous les quotas gratuits.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {quotas.length === 0 && (
                    <p className="text-sm text-muted-foreground">Aucun appel enregistré ce mois-ci.</p>
                  )}
                  {quotas.map((q) => (
                    <Badge key={`${q.provider}-${q.period}`} variant="outline">
                      {SOURCE_LABELS[q.provider] ?? q.provider} : {q.call_count}/{q.max_calls}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="identity">
              <VehicleIdentification vehicleId={current.id} onSaved={loadVehicles} />
            </TabsContent>
            <TabsContent value="odometer">
              <OdometerTab vehicleId={current.id} unit={current.odometer_unit} />
            </TabsContent>
            <TabsContent value="trips"><VehicleTrips vehicleId={current.id} /></TabsContent>
            <TabsContent value="maintenance"><VehicleMaintenance vehicleId={current.id} /></TabsContent>
            <TabsContent value="expenses"><VehicleExpenses vehicleId={current.id} /></TabsContent>
            <TabsContent value="documents"><VehicleDocuments vehicleId={current.id} /></TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default AdminVehicules;
