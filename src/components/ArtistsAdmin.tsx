import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, Upload, X, Images } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ArtistImage {
  id: string;
  image_url: string;
  display_order: number;
}

interface Artist {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  display_order: number;
  images: ArtistImage[];
}

export function ArtistsAdmin() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [galleryArtistId, setGalleryArtistId] = useState<string | null>(null);
  const [editingArtist, setEditingArtist] = useState<Artist | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => { loadArtists(); }, []);

  const loadArtists = async () => {
    const { data: artistsData } = await supabase
      .from("artists")
      .select("*")
      .order("display_order", { ascending: true });

    const { data: imagesData } = await supabase
      .from("artist_images")
      .select("*")
      .order("display_order", { ascending: true });

    const artistsList = (artistsData || []).map((a: any) => ({
      ...a,
      images: (imagesData || []).filter((img: any) => img.artist_id === a.id),
    }));

    setArtists(artistsList);
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
    if (!confirm("Supprimer cet artiste et toutes ses photos ?")) return;
    // Delete all images from storage
    const artist = artists.find(a => a.id === id);
    if (artist) {
      const paths = artist.images.map(img => {
        const p = img.image_url.split("/artist-photos/")[1];
        return p;
      }).filter(Boolean);
      if (paths.length > 0) await supabase.storage.from("artist-photos").remove(paths);
      if (artist.photo_url) {
        const oldPath = artist.photo_url.split("/artist-photos/")[1];
        if (oldPath) await supabase.storage.from("artist-photos").remove([oldPath]);
      }
    }
    await supabase.from("artists").delete().eq("id", id);
    toast({ title: "Artiste supprimé" });
    loadArtists();
  };

  const handleImageUpload = async (artistId: string, files: FileList) => {
    setUploading(artistId);
    const artist = artists.find(a => a.id === artistId);
    const currentMax = artist?.images.length || 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split(".").pop();
      const filePath = `${artistId}/${Date.now()}_${i}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("artist-photos")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        toast({ title: "Erreur upload", description: uploadError.message, variant: "destructive" });
        continue;
      }

      const { data: urlData } = supabase.storage.from("artist-photos").getPublicUrl(filePath);

      await supabase.from("artist_images").insert({
        artist_id: artistId,
        image_url: urlData.publicUrl,
        display_order: currentMax + i,
      });

      // Also set as main photo_url if none exists
      if (!artist?.photo_url && i === 0) {
        await supabase.from("artists").update({ photo_url: urlData.publicUrl }).eq("id", artistId);
      }
    }

    toast({ title: `${files.length} photo(s) ajoutée(s)` });
    setUploading(null);
    loadArtists();
  };

  const handleRemoveImage = async (imageId: string, imageUrl: string, artistId: string) => {
    const path = imageUrl.split("/artist-photos/")[1];
    if (path) await supabase.storage.from("artist-photos").remove([path]);
    await supabase.from("artist_images").delete().eq("id", imageId);

    // If this was the main photo, update to next available or null
    const artist = artists.find(a => a.id === artistId);
    if (artist?.photo_url === imageUrl) {
      const remaining = artist.images.filter(img => img.id !== imageId);
      await supabase.from("artists").update({
        photo_url: remaining.length > 0 ? remaining[0].image_url : null,
      }).eq("id", artistId);
    }

    toast({ title: "Photo supprimée" });
    loadArtists();
  };

  const handleSetMainPhoto = async (artistId: string, imageUrl: string) => {
    await supabase.from("artists").update({ photo_url: imageUrl }).eq("id", artistId);
    toast({ title: "Photo principale mise à jour" });
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

  const galleryArtist = artists.find(a => a.id === galleryArtistId);

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
              {/* Photo principale */}
              <div className="aspect-[3/4] bg-muted relative group">
                {artist.photo_url ? (
                  <img src={artist.photo_url} alt={artist.name} className="w-full h-full object-cover" />
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
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) handleImageUpload(artist.id, files);
                    }}
                  />
                </label>
                {/* Badge nombre de photos */}
                {artist.images.length > 0 && (
                  <div className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-medium flex items-center gap-1">
                    <Images className="h-3 w-3" />
                    {artist.images.length}
                  </div>
                )}
              </div>
              {/* Info */}
              <div className="p-3 space-y-2">
                <h4 className="font-semibold text-sm text-foreground truncate">{artist.name}</h4>
                <p className="text-xs text-muted-foreground line-clamp-2">{artist.description || "—"}</p>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => openEdit(artist)}>
                    Modifier
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setGalleryArtistId(artist.id)}>
                    <Images className="h-3 w-3" />
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

      {/* Gallery Dialog */}
      <Dialog open={!!galleryArtistId} onOpenChange={() => setGalleryArtistId(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Photos — {galleryArtist?.name}</span>
              <label className="cursor-pointer">
                <Button size="sm" asChild>
                  <span>
                    <Plus className="h-4 w-4 mr-1" /> Ajouter
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files && files.length > 0 && galleryArtistId) {
                          handleImageUpload(galleryArtistId, files);
                        }
                      }}
                    />
                  </span>
                </Button>
              </label>
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
            {galleryArtist?.images.map((img) => (
              <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {galleryArtist.photo_url !== img.image_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => handleSetMainPhoto(galleryArtist.id, img.image_url)}
                    >
                      ⭐ Principal
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    className="text-xs"
                    onClick={() => handleRemoveImage(img.id, img.image_url, galleryArtist.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                {galleryArtist.photo_url === img.image_url && (
                  <div className="absolute top-1 left-1 bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-[10px] font-semibold">
                    ⭐ Principal
                  </div>
                )}
              </div>
            ))}
            {(!galleryArtist?.images || galleryArtist.images.length === 0) && (
              <div className="col-span-3 text-center py-8 text-muted-foreground text-sm">
                Aucune photo. Cliquez sur "Ajouter" pour uploader des images.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
