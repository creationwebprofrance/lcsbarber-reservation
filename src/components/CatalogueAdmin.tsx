import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Scissors } from "lucide-react";

interface Haircut {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  display_order: number;
}

export const CatalogueAdmin = () => {
  const [haircuts, setHaircuts] = useState<Haircut[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", display_order: "0" });
  const [file, setFile] = useState<File | null>(null);
  const { toast } = useToast();

  const load = async () => {
    const { data } = await supabase
      .from("haircuts")
      .select("*")
      .order("display_order", { ascending: true });
    setHaircuts((data as Haircut[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const addHaircut = async () => {
    if (!form.title.trim() || !file) {
      toast({ title: "Erreur", description: "Titre et photo requis.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `haircuts/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("artist-photos")
        .upload(path, file, { cacheControl: "31536000", upsert: false });
      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage.from("artist-photos").getPublicUrl(path);

      const { error } = await supabase.from("haircuts").insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        image_url: pub.publicUrl,
        display_order: Number(form.display_order) || 0,
      });
      if (error) throw error;

      toast({ title: "Coupe ajoutée au catalogue" });
      setForm({ title: "", description: "", display_order: "0" });
      setFile(null);
      load();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("haircuts").delete().eq("id", id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Coupe supprimée" });
    load();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5" /> Ajouter une coupe au catalogue
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Titre</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Fade + contours"
              />
            </div>
            <div>
              <Label>Ordre d'affichage</Label>
              <Input
                type="number"
                value={form.display_order}
                onChange={(e) => setForm({ ...form, display_order: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Description (optionnel)</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Détails de la prestation..."
            />
          </div>
          <div>
            <Label>Photo</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button onClick={addHaircut} disabled={uploading}>
            <Plus className="h-4 w-4 mr-2" />
            {uploading ? "Envoi..." : "Ajouter"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catalogue ({haircuts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Chargement...</p>
          ) : haircuts.length === 0 ? (
            <p className="text-muted-foreground">Aucune coupe pour le moment.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {haircuts.map((h) => (
                <div key={h.id} className="space-y-2">
                  <div className="aspect-[3/4] overflow-hidden rounded-lg border border-border/50">
                    <img
                      src={`${h.image_url}?width=300&resize=contain`}
                      alt={h.title}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <p className="text-sm font-medium truncate">{h.title}</p>
                  <Button size="sm" variant="destructive" className="w-full" onClick={() => remove(h.id)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Supprimer
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
