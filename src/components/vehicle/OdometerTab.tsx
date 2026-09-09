import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";
import { estimateOdometer, type OdometerReading } from "@/lib/vehicle";

export const OdometerTab = ({ vehicleId, unit }: { vehicleId: string; unit: string }) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<OdometerReading[]>([]);
  const [value, setValue] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [isCorrection, setIsCorrection] = useState(false);
  const [isReplacement, setIsReplacement] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("odometer_readings")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("reading_date", { ascending: false });
    setRows((data ?? []) as OdometerReading[]);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [vehicleId]);

  const est = estimateOdometer(rows);

  const add = async () => {
    const v = parseFloat(value.replace(",", "."));
    if (Number.isNaN(v) || v < 0) {
      toast({ title: "Valeur invalide", variant: "destructive" });
      return;
    }
    const previous = rows
      .filter((r) => r.reading_date <= date && !r.is_replacement)
      .sort((a, b) => b.reading_date.localeCompare(a.reading_date))[0];
    if (previous && v < Number(previous.value) && !isCorrection && !isReplacement) {
      toast({
        title: "Relevé plus bas que le précédent",
        description: "Coche « correction » ou « compteur remplacé » pour l'enregistrer.",
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase.from("odometer_readings").insert({
      vehicle_id: vehicleId,
      value: v,
      unit,
      reading_date: date,
      source: "manual",
      confirmed: true,
      is_correction: isCorrection,
      is_replacement: isReplacement,
    } as never);
    if (error) {
      toast({ title: "Enregistrement impossible", description: error.message, variant: "destructive" });
      return;
    }
    setValue(""); setIsCorrection(false); setIsReplacement(false);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("odometer_readings").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Kilométrage</CardTitle>
          <CardDescription>
            {est.value === null
              ? "Aucun relevé enregistré pour l'instant."
              : `${est.value.toLocaleString("fr-FR")} ${unit}${est.isEstimate ? " (estimation)" : ""}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {est.isEstimate && (
            <Badge variant="outline">
              Estimé d'après {est.kmPerDay} {unit}/jour — dernier relevé confirmé le{" "}
              {est.lastReadingDate && new Date(est.lastReadingDate).toLocaleDateString("fr-FR")}
            </Badge>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Relevé ({unit})</Label>
              <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={add} className="w-full">Ajouter</Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox checked={isCorrection} onCheckedChange={(v) => setIsCorrection(Boolean(v))} />
              Correction d'une erreur
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={isReplacement} onCheckedChange={(v) => setIsReplacement(Boolean(v))} />
              Compteur remplacé
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Historique</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 && <p className="text-sm text-muted-foreground">Aucun relevé.</p>}
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
              <span>
                {new Date(r.reading_date).toLocaleDateString("fr-FR")} —{" "}
                <strong>{Number(r.value).toLocaleString("fr-FR")} {r.unit}</strong>
                {r.is_correction && <Badge variant="outline" className="ml-2">correction</Badge>}
                {r.is_replacement && <Badge variant="outline" className="ml-2">compteur remplacé</Badge>}
              </span>
              <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
