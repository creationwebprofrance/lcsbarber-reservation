import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Info } from "lucide-react";
import { STATUS_LABELS, SOURCE_LABELS, normalizePlate, formatPlateFr } from "@/lib/vehicle";
import {
  OTHER, VEHICLE_MAKES, VEHICLE_MODELS, FUEL_OPTIONS, registrationYears,
} from "@/lib/vehicle-options";

const SIMPLE_GEARBOX = ["Manuelle", "Automatique", "Je ne sais pas"];

const FIELD_LABELS: Record<string, string> = {
  make: "Marque",
  model: "Modèle",
  generation: "Génération",
  body_type: "Carrosserie",
  first_registration: "1re mise en circulation",
  model_year: "Année",
  fuel: "Énergie",
  gearbox_type: "Boîte de vitesses",
};

interface Props {
  vehicleId: string | null;
  onSaved: () => void;
}

type Candidate = { key: string; value: string; provider: string; keep: boolean };
type Variant = { label: string; fields: Record<string, unknown> };

export const VehicleIdentification = ({ vehicleId, onSaved }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [plate, setPlate] = useState("");
  const [status, setStatus] = useState<{ label: string; detail?: string } | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [ademe, setAdeme] = useState({ make: "", model: "", makeOther: "", modelOther: "" });
  const [manual, setManual] = useState({
    make: "", makeOther: "", model: "", modelOther: "",
    fuel: "", gearbox_type: "", year: "", odometer: "",
  });

  const setM = (patch: Partial<typeof manual>) => setManual((m) => ({ ...m, ...patch }));
  const finalMake = manual.make === OTHER ? manual.makeOther.trim() : manual.make;
  const finalModel = manual.model === OTHER ? manual.modelOther.trim() : manual.model;
  const modelChoices = VEHICLE_MODELS[manual.make] ?? [];
  const ademeMake = ademe.make === OTHER ? ademe.makeOther.trim() : ademe.make;
  const ademeModel = ademe.model === OTHER ? ademe.modelOther.trim() : ademe.model;

  const saveGuided = async () => {
    const extra: Record<string, unknown> = { make: finalMake, model: finalModel };
    if (manual.fuel) extra.fuel = manual.fuel;
    if (manual.gearbox_type) extra.gearbox_type = manual.gearbox_type;
    if (manual.year) extra.model_year = parseInt(manual.year, 10);

    const id = await save(extra, "manual");
    const km = manual.odometer ? parseFloat(manual.odometer.replace(",", ".")) : NaN;
    if (id && !Number.isNaN(km)) {
      await supabase.from("odometer_readings").insert({
        vehicle_id: id,
        value: km,
        unit: "km",
        reading_date: new Date().toISOString().slice(0, 10),
        source: "manual",
        confirmed: true,
      } as never);
      onSaved();
    }
  };

  const call = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("vehicle-lookup", { body: payload });
    if (error) throw new Error(error.message);
    return data as {
      provider: string; status: string; message?: string;
      fields?: Record<string, unknown>; candidates?: Variant[];
      quota?: { used: number; max: number };
    };
  };

  const toCandidates = (fields: Record<string, unknown>, provider: string) =>
    Object.entries(fields)
      .filter(([k, v]) => v !== null && v !== "" && v !== undefined && FIELD_LABELS[k])
      .map(([key, v]) => ({ key, value: String(v), provider, keep: true }));

  const handleResult = (res: Awaited<ReturnType<typeof call>>) => {
    const label = STATUS_LABELS[res.status] ?? res.status;
    setStatus({ label: `${SOURCE_LABELS[res.provider] ?? res.provider} : ${label}`, detail: res.message });
    if (res.candidates?.length) {
      setVariants(res.candidates);
      setCandidates([]);
    } else if (res.fields) {
      setVariants([]);
      setCandidates(toCandidates(res.fields, res.provider));
    } else {
      setVariants([]);
      setCandidates([]);
    }
  };

  const runLookup = async (payload: Record<string, unknown>) => {
    setLoading(true);
    setCandidates([]);
    setVariants([]);
    setStatus(null);
    try {
      handleResult(await call(payload));
    } catch (e) {
      setStatus({ label: "Service momentanément indisponible", detail: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const save = async (extra: Record<string, unknown> = {}, provider = "manual") => {
    const kept = candidates.filter((c) => c.keep);
    const payload: Record<string, unknown> = { ...extra };
    for (const c of kept) {
      if (c.key === "model_year") {
        const n = parseInt(c.value.replace(/\D/g, ""), 10);
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
    if (Object.keys(payload).length === 0) {
      toast({ title: "Rien à enregistrer", variant: "destructive" });
      return null;
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
      toast({ title: "Véhicule enregistré" });
      setCandidates([]);
      onSaved();
      return id;
    } catch (e) {
      toast({ title: "Enregistrement impossible", description: (e as Error).message, variant: "destructive" });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const makeSelect = (
    value: string, otherValue: string,
    onChange: (v: string) => void, onOther: (v: string) => void,
  ) => (
    <>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Choisir une marque" /></SelectTrigger>
        <SelectContent className="max-h-72">
          {VEHICLE_MAKES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          <SelectItem value={OTHER}>Autre marque…</SelectItem>
        </SelectContent>
      </Select>
      {value === OTHER && (
        <Input className="mt-2" placeholder="Nom de la marque" value={otherValue}
          onChange={(e) => onOther(e.target.value)} />
      )}
    </>
  );

  const modelSelect = (
    make: string, value: string, otherValue: string,
    onChange: (v: string) => void, onOther: (v: string) => void,
  ) => (
    <>
      <Select value={value} onValueChange={onChange} disabled={!make}>
        <SelectTrigger>
          <SelectValue placeholder={make ? "Choisir un modèle" : "Choisis d'abord la marque"} />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {(VEHICLE_MODELS[make] ?? []).map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          <SelectItem value={OTHER}>Autre modèle…</SelectItem>
        </SelectContent>
      </Select>
      {value === OTHER && (
        <Input className="mt-2" placeholder="Nom du modèle" value={otherValue}
          onChange={(e) => onOther(e.target.value)} />
      )}
    </>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ajouter mon véhicule</CardTitle>
        <CardDescription>
          Trois façons simples de retrouver ta voiture. Rien n'est enregistré sans ta confirmation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <Tabs defaultValue="plate">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="plate">Ma plaque</TabsTrigger>
            <TabsTrigger value="ademe">Marque &amp; modèle</TabsTrigger>
            <TabsTrigger value="guided">Saisie simple</TabsTrigger>
          </TabsList>

          <TabsContent value="plate" className="space-y-3 pt-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Entre ta plaque d'immatriculation : on retrouve la voiture pour toi.
              </AlertDescription>
            </Alert>
            <div>
              <Label>Plaque d'immatriculation</Label>
              <Input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="AA-123-BB" />
            </div>
            <Button
              disabled={loading || plate.length < 4}
              onClick={() => runLookup({ action: "plate", plate: normalizePlate(plate), country: "FR" })}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Retrouver ma voiture
            </Button>
          </TabsContent>

          <TabsContent value="ademe" className="space-y-3 pt-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Choisis la marque et le modèle, puis sélectionne ta voiture dans la liste proposée.
              </AlertDescription>
            </Alert>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Marque</Label>
                {makeSelect(
                  ademe.make, ademe.makeOther,
                  (v) => setAdeme((a) => ({ ...a, make: v, model: "", modelOther: "" })),
                  (v) => setAdeme((a) => ({ ...a, makeOther: v })),
                )}
              </div>
              <div>
                <Label>Modèle</Label>
                {modelSelect(
                  ademe.make, ademe.model, ademe.modelOther,
                  (v) => setAdeme((a) => ({ ...a, model: v })),
                  (v) => setAdeme((a) => ({ ...a, modelOther: v })),
                )}
              </div>
            </div>
            <Button
              disabled={loading || !ademeMake || !ademeModel}
              onClick={() => runLookup({ action: "ademe", make: ademeMake, model: ademeModel })}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Rechercher ma voiture
            </Button>
          </TabsContent>

          <TabsContent value="guided" className="space-y-3 pt-4">
            <p className="text-xs text-muted-foreground">
              Choisis dans les listes. Si une valeur manque, sélectionne « Autre » pour l'écrire toi-même.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Marque</Label>
                {makeSelect(
                  manual.make, manual.makeOther,
                  (v) => setM({ make: v, model: "", modelOther: "" }),
                  (v) => setM({ makeOther: v }),
                )}
              </div>
              <div>
                <Label>Modèle</Label>
                {modelSelect(
                  manual.make, manual.model, manual.modelOther,
                  (v) => setM({ model: v }),
                  (v) => setM({ modelOther: v }),
                )}
              </div>
              <div>
                <Label>Année</Label>
                <Select value={manual.year} onValueChange={(v) => setM({ year: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir une année" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {registrationYears().map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Carburant / énergie</Label>
                <Select value={manual.fuel} onValueChange={(v) => setM({ fuel: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {FUEL_OPTIONS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Boîte de vitesses</Label>
                <Select value={manual.gearbox_type} onValueChange={(v) => setM({ gearbox_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Je ne sais pas" /></SelectTrigger>
                  <SelectContent>
                    {SIMPLE_GEARBOX.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Kilométrage actuel (km)</Label>
                <Input inputMode="numeric" placeholder="Ex. 110000" value={manual.odometer}
                  onChange={(e) => setM({ odometer: e.target.value })} />
              </div>
            </div>
            <Button disabled={loading || !finalMake || !finalModel} onClick={saveGuided}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer mon véhicule
            </Button>
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

        {variants.length > 0 && (
          <div className="space-y-2 rounded-lg border p-4">
            <p className="text-sm font-medium">Laquelle est ta voiture ?</p>
            <div className="grid gap-2 max-h-72 overflow-auto">
              {variants.map((v, i) => (
                <Button
                  key={i}
                  variant="outline"
                  className="justify-start text-left h-auto py-2"
                  onClick={() => {
                    setCandidates(toCandidates(v.fields, "ademe"));
                    setVariants([]);
                  }}
                >
                  {v.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {candidates.length > 0 && (
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">Vérifie les informations trouvées</p>
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
              C'est bien ma voiture
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
