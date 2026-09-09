import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Download, Loader2 } from "lucide-react";
import type { VehicleDocument } from "@/lib/vehicle";

const TYPES = [
  { v: "carte_grise", l: "Carte grise" },
  { v: "assurance", l: "Assurance" },
  { v: "controle_technique", l: "Contrôle technique" },
  { v: "facture", l: "Facture / entretien" },
  { v: "carnet", l: "Carnet d'entretien" },
  { v: "autre", l: "Autre" },
];

export const VehicleDocuments = ({ vehicleId }: { vehicleId: string }) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<VehicleDocument[]>([]);
  const [docType, setDocType] = useState("facture");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("vehicle_documents").select("*")
      .eq("vehicle_id", vehicleId).order("created_at", { ascending: false });
    setRows((data ?? []) as VehicleDocument[]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [vehicleId]);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const path = `${vehicleId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("vehicle-documents").upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase.from("vehicle_documents").insert({
        vehicle_id: vehicleId,
        doc_type: docType,
        title: title || file.name,
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
      } as never);
      if (error) throw error;
      setTitle("");
      load();
    } catch (e) {
      toast({ title: "Envoi impossible", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const open = async (path: string) => {
    const { data, error } = await supabase.storage.from("vehicle-documents").createSignedUrl(path, 60);
    if (error || !data) {
      toast({ title: "Lien indisponible", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const remove = async (doc: VehicleDocument) => {
    await supabase.storage.from("vehicle-documents").remove([doc.storage_path]);
    await supabase.from("vehicle_documents").delete().eq("id", doc.id);
    load();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>
            Dossier privé : ces fichiers ne sont visibles que par toi, jamais par les clients.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Type</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Intitulé</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Fichier</Label>
            <Input type="file" disabled={busy}
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </div>
          {busy && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-3">
              <Loader2 className="h-4 w-4 animate-spin" /> Envoi en cours…
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Fichiers enregistrés</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 && <p className="text-sm text-muted-foreground">Aucun document.</p>}
          {rows.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
              <span>
                {TYPES.find((t) => t.v === d.doc_type)?.l ?? d.doc_type} — {d.title}
              </span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => open(d.storage_path)}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(d)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
