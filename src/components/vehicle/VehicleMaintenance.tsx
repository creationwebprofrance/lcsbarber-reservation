import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2, CheckCircle2 } from "lucide-react";
import {
  computeDue, estimateOdometer, SOURCE_LABELS,
  type MaintenanceEvent, type MaintenanceRule, type OdometerReading,
} from "@/lib/vehicle";

const STATUS_STYLE: Record<string, string> = {
  overdue: "bg-destructive/15 text-destructive border-destructive/40",
  due_soon: "bg-amber-500/15 text-amber-600 border-amber-500/40",
  ok: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  unknown: "",
};
const STATUS_TEXT: Record<string, string> = {
  overdue: "En retard",
  due_soon: "Bientôt",
  ok: "À jour",
  unknown: "Selon état",
};

export const VehicleMaintenance = ({ vehicleId }: { vehicleId: string }) => {
  const { toast } = useToast();
  const [rules, setRules] = useState<MaintenanceRule[]>([]);
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);
  const [readings, setReadings] = useState<OdometerReading[]>([]);
  const [form, setForm] = useState({
    operation: "", category: "entretien", interval_km: "", interval_months: "",
    source: "constructeur", source_reference: "", reference_odometer: "",
    reference_date: new Date().toISOString().slice(0, 10),
  });

  const load = async () => {
    const [r, e, o] = await Promise.all([
      supabase.from("vehicle_maintenance_rules").select("*").eq("vehicle_id", vehicleId).order("operation"),
      supabase.from("vehicle_maintenance_events").select("*").eq("vehicle_id", vehicleId).order("event_date", { ascending: false }),
      supabase.from("odometer_readings").select("*").eq("vehicle_id", vehicleId),
    ]);
    setRules((r.data ?? []) as MaintenanceRule[]);
    setEvents((e.data ?? []) as MaintenanceEvent[]);
    setReadings((o.data ?? []) as OdometerReading[]);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [vehicleId]);

  const est = estimateOdometer(readings);

  const addRule = async () => {
    if (!form.operation || !form.source_reference) {
      toast({
        title: "Source obligatoire",
        description: "Indique d'où vient cette préconisation (carnet, facture, notice…).",
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase.from("vehicle_maintenance_rules").insert({
      vehicle_id: vehicleId,
      category: form.category,
      operation: form.operation,
      source: form.source,
      source_reference: form.source_reference,
      interval_km: form.interval_km ? parseInt(form.interval_km, 10) : null,
      interval_months: form.interval_months ? parseInt(form.interval_months, 10) : null,
      reference_odometer: form.reference_odometer ? parseFloat(form.reference_odometer) : null,
      reference_date: form.reference_date || null,
      condition_based: !form.interval_km && !form.interval_months,
    } as never);
    if (error) {
      toast({ title: "Enregistrement impossible", description: error.message, variant: "destructive" });
      return;
    }
    setForm({ ...form, operation: "", interval_km: "", interval_months: "", source_reference: "" });
    load();
  };

  const markDone = async (rule: MaintenanceRule) => {
    const { error } = await supabase.from("vehicle_maintenance_events").insert({
      vehicle_id: vehicleId,
      rule_id: rule.id,
      operation: rule.operation,
      action_type: rule.action_type,
      event_date: new Date().toISOString().slice(0, 10),
      odometer: est.value,
      source: "personnel",
    } as never);
    if (error) {
      toast({ title: "Impossible", description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  const removeRule = async (id: string) => {
    await supabase.from("vehicle_maintenance_rules").delete().eq("id", id);
    load();
  };

  const dues = rules.map((r) => computeDue(r, events, est.value, est.isEstimate));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Échéances d'entretien</CardTitle>
          <CardDescription>
            Calculées uniquement à partir des préconisations que tu as saisies, avec leur source.
            Aucune périodicité n'est inventée.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {dues.length === 0 && <p className="text-sm text-muted-foreground">Aucune règle enregistrée.</p>}
          {dues.map((d) => (
            <div key={d.rule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
              <div>
                <p className="font-medium">{d.rule.operation}</p>
                <p className="text-xs text-muted-foreground">
                  {d.dueKm && `À ${d.dueKm.toLocaleString("fr-FR")} km`}
                  {d.dueKm && d.dueDate && " · "}
                  {d.dueDate && `Avant le ${new Date(d.dueDate).toLocaleDateString("fr-FR")}`}
                  {d.remainingKm !== null && ` · reste ${d.remainingKm.toLocaleString("fr-FR")} km`}
                  {d.isEstimate && " (kilométrage estimé)"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Source : {SOURCE_LABELS[d.rule.source] ?? d.rule.source}
                  {d.rule.source_reference && ` — ${d.rule.source_reference}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={STATUS_STYLE[d.status]}>{STATUS_TEXT[d.status]}</Badge>
                <Button variant="outline" size="sm" onClick={() => markDone(d.rule)}>
                  <CheckCircle2 className="mr-1 h-4 w-4" />Fait
                </Button>
                <Button variant="ghost" size="icon" onClick={() => removeRule(d.rule.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ajouter une préconisation</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2">
            <Label>Opération</Label>
            <Input value={form.operation} placeholder="Vidange moteur + filtre à huile"
              onChange={(e) => setForm({ ...form, operation: e.target.value })} />
          </div>
          <div>
            <Label>Catégorie</Label>
            <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <div>
            <Label>Tous les … km</Label>
            <Input value={form.interval_km} inputMode="numeric"
              onChange={(e) => setForm({ ...form, interval_km: e.target.value })} />
          </div>
          <div>
            <Label>Ou tous les … mois</Label>
            <Input value={form.interval_months} inputMode="numeric"
              onChange={(e) => setForm({ ...form, interval_months: e.target.value })} />
          </div>
          <div>
            <Label>Dernier passage (km)</Label>
            <Input value={form.reference_odometer} inputMode="numeric"
              onChange={(e) => setForm({ ...form, reference_odometer: e.target.value })} />
          </div>
          <div>
            <Label>Dernier passage (date)</Label>
            <Input type="date" value={form.reference_date}
              onChange={(e) => setForm({ ...form, reference_date: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>D'où vient cette préconisation ?</Label>
            <Input value={form.source_reference} placeholder="Carnet d'entretien page 42, facture garage…"
              onChange={(e) => setForm({ ...form, source_reference: e.target.value })} />
          </div>
          <div className="flex items-end">
            <Button onClick={addRule} className="w-full">Ajouter</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Interventions réalisées</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {events.length === 0 && <p className="text-sm text-muted-foreground">Aucune intervention.</p>}
          {events.map((e) => (
            <div key={e.id} className="rounded-md border p-2 text-sm">
              {new Date(e.event_date).toLocaleDateString("fr-FR")} — {e.operation}
              {e.odometer != null && ` à ${Number(e.odometer).toLocaleString("fr-FR")} km`}
              {e.cost != null && ` — ${Number(e.cost).toFixed(2)} €`}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
