import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, Upload, X, GripVertical } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Artist {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  display_order: number;
}

export function ArtistsAdmin() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArtist, setEditingArtist] = useState<Artist | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => { loadArtists(); }, []);

  const loadArtists = async () => {
    const { data } = await supabase
      .from("artists")
      .select("*")
      .order("display_order", { ascending: true });
    setArtists((data as Artist[]) || []);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const maxOrder = artists.length > 0 ? Math.max(...artists.map(a => a.display_order)) + 1 : 1;
    const { error } = await supabase.from("artists").insert({
      name: form.name.trim(),
      description: form.description.trim() || null,
      display_order: maxOrder,
    });
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Artiste ajouté" });
      setForm({ name: "", description: "" });
      setDialogOpen(false);
      loadArtists();
    }
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!editingArtist || !form.name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("artists").update({
      name: form.name.trim(),
      description: form.description.trim() || null,
    }).eq("id", editingArtist.id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Artiste modifié" });
      setEditingArtist(null);
      setForm({ name: "", description: "" });
      setDialogOpen(false);
      loadArtists();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cet artiste ?")) return;
    const artist = artists.find(a => a.id === id);
    if (artist?.photo_url) {
      const path = artist.photo_url.split("/artist-photos/")[1];
      if (path) await supabase.storage.from("artist-photos").remove([path]);
    }
    await supabase.from("artists").delete().eq("id", id);
    toast({ title: "Artiste supprimé" });
    loadArtists();
  };

  const handlePhotoUpload = async (artistId: string, file: File) => {
    setUploading(artistId);
    const ext = file.name.split(".").pop();
    const filePath = `${artistId}.${ext}`;

    // Remove old photo first
    const artist = artists.find(a => a.id === artistId);
    if (artist?.photo_url) {
      const oldPath = artist.photo_url.split("/artist-photos/")[1];
      if (oldPath) await supabase.storage.from("artist-photos").remove([oldPath]);
    }

    const { error: uploadError } = await supabase.storage
      .from("artist-photos")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Erreur upload", description: uploadError.message, variant: "destructive" });
      setUploading(null);
      return;
    }

    const { data: urlData } = supabase.storage.from("artist-photos").getPublicUrl(filePath);
    await supabase.from("artists").update({ photo_url: urlData.publicUrl }).eq("id", artistId);
    toast({ title: "Photo mise à jour" });
    setUploading(null);
    loadArtists();
  };

  const handleRemovePhoto = async (artistId: string) => {
    const artist = artists.find(a => a.id === artistId);
    if (!artist?.photo_url) return;
    const path = artist.photo_url.split("/artist-photos/")[1];
    if (path) await supabase.storage.from("artist-photos").remove([path]);
    await supabase.from("artists").update({ photo_url: null }).eq("id", artistId);
    toast({ title: "Photo supprimée" });
    loadArtists();
  };

  const openEdit = (artist: Artist) => {
    setEditingArtist(artist);
    setForm({ name: artist.name, description: artist.description || "" });
    setDialogOpen(true);
  };

  const openAdd = () => {
    setEditingArtist(null);
    setForm({ name: "", description: "" });
    setDialogOpen(true);
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Chargement…</div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Gestion des artistes</CardTitle>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {artists.map((artist) => (
            <div key={artist.id} className="border border-border rounded-xl overflow-hidden bg-card">
              {/* Photo */}
              <div className="aspect-[3/4] bg-muted relative group">
                {artist.photo_url ? (
                  <>
                    <img src={artist.photo_url} alt={artist.name} className="w-full h-full object-cover" />
                    <button
                      onClick={() => handleRemovePhoto(artist.id)}
                      className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">Pas de photo</span>
                  </div>
                )}
                {/* Upload overlay */}
                <label className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  {uploading === artist.id ? (
                    <span className="text-xs">Upload...</span>
                  ) : (
                    <Upload className="h-6 w-6 text-foreground" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePhotoUpload(artist.id, file);
                    }}
                  />
                </label>
              </div>
              {/* Info */}
              <div className="p-3 space-y-2">
                <h4 className="font-semibold text-sm text-foreground truncate">{artist.name}</h4>
                <p className="text-xs text-muted-foreground line-clamp-2">{artist.description || "—"}</p>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => openEdit(artist)}>
                    Modifier
                  </Button>
                  <Button variant="destructive" size="sm" className="text-xs" onClick={() => handleDelete(artist.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {artists.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Aucun artiste. Cliquez sur "Ajouter" pour commencer.</p>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingArtist ? "Modifier l'artiste" : "Ajouter un artiste"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nom de l'artiste" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description de la prestation" rows={4} />
            </div>
            <Button onClick={editingArtist ? handleUpdate : handleAdd} disabled={saving} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Enregistrement…" : editingArtist ? "Modifier" : "Ajouter"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
