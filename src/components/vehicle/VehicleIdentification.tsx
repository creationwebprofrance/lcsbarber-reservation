import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ScanLine, Info } from "lucide-react";
import {
  STATUS_LABELS, SOURCE_LABELS, isValidVin, normalizePlate, formatPlateFr,
} from "@/lib/vehicle";

const FIELD_LABELS: Record<string, string> = {
  make: "Marque",
  model: "Modèle",
  generation: "Génération",
  body_type: "Carrosserie",
  first_registration: "1re mise en circulation",
  model_year: "Année-modèle",
  vin: "VIN",
  cnit: "CNIT / type mine",
  tvv: "TVV",
  fuel: "Énergie",
  engine_version: "Version moteur",
  engine_code: "Code moteur",
  displacement_cm3: "Cylindrée (cm³)",
  power_kw: "Puissance (kW)",
  fiscal_power: "Puissance fiscale",
  gearbox_type: "Boîte de vitesses",
};

interface Props {
  vehicleId: string | null;
  onSaved: () => void;
}

type Candidate = { key: string; value: string; provider: string; keep: boolean };

export const VehicleIdentification = ({ vehicleId, onSaved }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [plate, setPlate] = useState("");
  const [country, setCountry] = useState("FR");
  const [vin, setVin] = useState("");
  const [status, setStatus] = useState<{ label: string; detail?: string } | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [ocrText, setOcrText] = useState("");
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [manual, setManual] = useState({ make: "", model: "", generation: "", fuel: "", first_registration: "" });

  const call = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("vehicle-lookup", { body: payload });
    if (error) throw new Error(error.message);
    return data as {
      provider: string; status: string; message?: string;
      fields?: Record<string, unknown>; quota?: { used: number; max: number };
    };
  };

  const handleResult = (res: Awaited<ReturnType<typeof call>>) => {
    const label = STATUS_LABELS[res.status] ?? res.status;
    const quota = res.quota ? ` — ${res.quota.used}/${res.quota.max} appels ce mois` : "";
    setStatus({ label: `${SOURCE_LABELS[res.provider] ?? res.provider} : ${label}${quota}`, detail: res.message });
    if (res.fields) {
      setCandidates(
        Object.entries(res.fields)
          .filter(([, v]) => v !== null && v !== "" && v !== undefined)
          .map(([key, v]) => ({ key, value: String(v), provider: res.provider, keep: true })),
      );
    } else {
      setCandidates([]);
    }
  };

  const runLookup = async (payload: Record<string, unknown>) => {
    setLoading(true);
    setCandidates([]);
    setStatus(null);
    try {
      handleResult(await call(payload));
    } catch (e) {
      setStatus({ label: "Service momentanément indisponible", detail: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const runOcr = async (file: File) => {
    setOcrProgress(0);
    setOcrText("");
    try {
      const { default: Tesseract } = await import("tesseract.js");
      const { data } = await Tesseract.recognize(file, "fra", {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") setOcrProgress(Math.round(m.progress * 100));
        },
      });
      const text = data.text ?? "";
      setOcrText(text);
      const vinMatch = text.toUpperCase().match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
      const plateMatch = text.toUpperCase().match(/\b[A-Z]{2}[- ]?\d{3}[- ]?[A-Z]{2}\b/);
      if (vinMatch) setVin(vinMatch[0]);
      if (plateMatch) setPlate(normalizePlate(plateMatch[0]));
      if (!vinMatch && !plateMatch) {
        toast({ title: "Rien de reconnu", description: "Saisis les informations à la main." });
      }
    } catch (e) {
      toast({ title: "Lecture impossible", description: (e as Error).message, variant: "destructive" });
    } finally {
      setOcrProgress(null);
    }
  };

  const save = async (extra: Record<string, unknown> = {}, provider = "manual") => {
    const kept = candidates.filter((c) => c.keep);
    const payload: Record<string, unknown> = { ...extra };
    for (const c of kept) {
      if (["displacement_cm3", "fiscal_power", "model_year"].includes(c.key)) {
        const n = parseInt(c.value.replace(/\D/g, ""), 10);
        if (!Number.isNaN(n)) payload[c.key] = n;
      } else if (c.key === "power_kw") {
        const n = parseFloat(c.value.replace(",", "."));
        if (!Number.isNaN(n)) payload[c.key] = n;
      } else if (c.key === "first_registration") {
        const d = c.value.match(/(\d{4})-(\d{2})-(\d{2})/) ??
          c.value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (d) payload[c.key] = d[0].includes("/") ? `${d[3]}-${d[2]}-${d[1]}` : d[0];
      } else {
        payload[c.key] = c.value;
      }
    }
    if (plate) payload.plate = formatPlateFr(plate);
    if (plate) payload.plate_raw = normalizePlate(plate);
    if (country) payload.plate_country = country;
    if (vin && isValidVin(vin)) payload.vin = vin.toUpperCase();
    if (Object.keys(payload).length === 0) {
      toast({ title: "Rien à enregistrer", variant: "destructive" });
      return;
    }
    payload.status = payload.make && payload.model ? "identified" : "partial";

    setLoading(true);
    try {
      let id = vehicleId;
      if (id) {
        const { error } = await supabase.from("vehicles").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from("vehicles")
          .insert({ ...payload, owner_id: user!.id, is_default: true } as never)
          .select("id")
          .single();
        if (error) throw error;
        id = data.id;
      }
      if (kept.length > 0 && id) {
        await supabase.from("vehicle_field_sources").insert(
          kept.map((c) => ({
            vehicle_id: id!,
            field_name: c.key,
            source: c.provider ?? provider,
            source_date: new Date().toISOString().slice(0, 10),
            original_value: c.value,
            retained_value: c.value,
            confirmed_by_user: true,
            status: "confirmed",
          })) as never,
        );
      }
      toast({ title: "Fiche enregistrée" });
      setCandidates([]);
      onSaved();
    } catch (e) {
      toast({ title: "Enregistrement impossible", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Identifier le véhicule</CardTitle>
        <CardDescription>
          Aucune donnée n'est devinée : chaque information proposée doit être confirmée par toi
          avant d'être enregistrée, et sa provenance est conservée.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <Tabs defaultValue="plate">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="plate">Plaque</TabsTrigger>
            <TabsTrigger value="vin">VIN</TabsTrigger>
            <TabsTrigger value="guided">Saisie guidée</TabsTrigger>
            <TabsTrigger value="ocr">Photo du document</TabsTrigger>
          </TabsList>

          <TabsContent value="plate" className="space-y-3 pt-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <div>
                <Label>Immatriculation</Label>
                <Input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="AA-123-BB" />
              </div>
              <div>
                <Label>Pays</Label>
                <Input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} maxLength={2} />
              </div>
            </div>
            <Button
              disabled={loading || plate.length < 4}
              onClick={() => runLookup({ action: "plate", plate: normalizePlate(plate), country })}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Rechercher
            </Button>
          </TabsContent>

          <TabsContent value="vin" className="space-y-3 pt-4">
            <Label>Numéro VIN (17 caractères)</Label>
            <Input value={vin} onChange={(e) => setVin(e.target.value.toUpperCase())} maxLength={17} />
            {vin.length > 0 && !isValidVin(vin) && (
              <p className="text-xs text-destructive">VIN incomplet ou contenant I, O ou Q.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button disabled={loading || !isValidVin(vin)} onClick={() => runLookup({ action: "vin", vin })}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Rechercher (Europe)
              </Button>
              <Button
                variant="outline"
                disabled={loading || !isValidVin(vin)}
                onClick={() => runLookup({ action: "vpic", vin })}
              >
                Véhicule importé des États-Unis
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="guided" className="space-y-3 pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {(["make", "model", "generation", "fuel"] as const).map((k) => (
                <div key={k}>
                  <Label>{FIELD_LABELS[k] ?? k}</Label>
                  <Input
                    value={manual[k]}
                    onChange={(e) => setManual({ ...manual, [k]: e.target.value })}
                  />
                </div>
              ))}
              <div>
                <Label>1re mise en circulation</Label>
                <Input
                  type="date"
                  value={manual.first_registration}
                  onChange={(e) => setManual({ ...manual, first_registration: e.target.value })}
                />
              </div>
            </div>
            <Button
              disabled={loading || !manual.make || !manual.model}
              onClick={() =>
                save(
                  Object.fromEntries(Object.entries(manual).filter(([, v]) => v !== "")),
                  "manual",
                )}
            >
              Enregistrer la saisie
            </Button>
          </TabsContent>

          <TabsContent value="ocr" className="space-y-3 pt-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                La lecture automatique sert seulement à pré-remplir la plaque ou le VIN.
                Rien n'est enregistré sans ta confirmation.
              </AlertDescription>
            </Alert>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && runOcr(e.target.files[0])}
            />
            {ocrProgress !== null && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ScanLine className="h-4 w-4 animate-pulse" /> Lecture en cours… {ocrProgress}%
              </p>
            )}
            {ocrText && (
              <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs">{ocrText}</pre>
            )}
            <p className="text-xs text-muted-foreground">
              Pour un PDF, prends d'abord une capture d'écran ou une photo de la page.
            </p>
          </TabsContent>
        </Tabs>

        {status && (
          <Alert>
            <AlertDescription>
              <strong>{status.label}</strong>
              {status.detail && <span className="block text-xs opacity-80">{status.detail}</span>}
            </AlertDescription>
          </Alert>
        )}

        {candidates.length > 0 && (
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">Informations proposées — coche celles que tu valides</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {candidates.map((c, i) => (
                <label key={c.key} className="flex items-start gap-3 rounded-md border p-2 text-sm">
                  <Checkbox
                    checked={c.keep}
                    onCheckedChange={(v) =>
                      setCandidates(candidates.map((x, j) => (j === i ? { ...x, keep: Boolean(v) } : x)))}
                  />
                  <span>
                    <span className="block text-xs text-muted-foreground">
                      {FIELD_LABELS[c.key] ?? c.key}
                    </span>
                    <span className="font-medium">{c.value}</span>
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      {SOURCE_LABELS[c.provider] ?? c.provider}
                    </Badge>
                  </span>
                </label>
              ))}
            </div>
            <Button disabled={loading} onClick={() => save()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmer et enregistrer
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
