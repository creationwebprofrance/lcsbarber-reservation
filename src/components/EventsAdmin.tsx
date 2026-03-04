import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save, Trash2, CalendarDays, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface EventRow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  start_date: string;
  end_date: string;
  start_hour: string;
  end_hour: string;
  prix_coupe_classique: number;
  prix_coupe_barbe: number;
  prix_barbe: number;
  prix_contours: number;
  excluded_services: string | null;
}

export const EventsAdmin = () => {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => { loadEvents(); }, []);

  const loadEvents = async () => {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Erreur", description: "Impossible de charger les événements.", variant: "destructive" });
      return;
    }
    setEvents((data as EventRow[]) || []);
    setLoading(false);
  };

  const addEvent = async () => {
    const { error } = await supabase.from("events").insert({
      name: "Nouvel événement",
      start_date: new Date().toISOString().split("T")[0],
      end_date: new Date().toISOString().split("T")[0],
    });
    if (error) {
      toast({ title: "Erreur", description: "Impossible de créer l'événement.", variant: "destructive" });
      return;
    }
    toast({ title: "✅ Événement créé" });
    loadEvents();
  };

  const updateLocal = (id: string, field: string, value: any) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const saveEvent = async (event: EventRow) => {
    setSaving(event.id);
    const { error } = await supabase
      .from("events")
      .update({
        name: event.name,
        description: event.description,
        is_active: event.is_active,
        start_date: event.start_date,
        end_date: event.end_date,
        start_hour: event.start_hour,
        end_hour: event.end_hour,
        prix_coupe_classique: event.prix_coupe_classique,
        prix_coupe_barbe: event.prix_coupe_barbe,
        prix_barbe: event.prix_barbe,
        prix_contours: event.prix_contours,
        excluded_services: event.excluded_services,
        updated_at: new Date().toISOString(),
      })
      .eq("id", event.id);
    if (error) {
      toast({ title: "Erreur", description: "Échec de la sauvegarde.", variant: "destructive" });
    } else {
      toast({ title: "✅ Sauvegardé", description: `${event.name} mis à jour.` });
    }
    setSaving(null);
  };

  const deleteEvent = async (id: string) => {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      toast({ title: "Erreur", description: "Impossible de supprimer.", variant: "destructive" });
      return;
    }
    toast({ title: "Supprimé" });
    loadEvents();
  };

  if (loading) return <div className="text-center py-8">Chargement...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-bold">Gestion des événements</h2>
            <p className="text-sm text-muted-foreground">Créer, modifier et activer des événements spéciaux</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/evenements" target="_blank">
              <ExternalLink className="h-4 w-4 mr-1" />
              Voir la page
            </Link>
          </Button>
          <Button onClick={addEvent} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Nouvel événement
          </Button>
        </div>
      </div>

      {events.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aucun événement. Cliquez sur "Nouvel événement" pour en créer un.
          </CardContent>
        </Card>
      )}

      {events.map((event) => (
        <Card key={event.id} className={event.is_active ? "border-primary/40" : ""}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Input
                  value={event.name}
                  onChange={(e) => updateLocal(event.id, "name", e.target.value)}
                  className="text-lg font-bold border-none p-0 h-auto focus-visible:ring-0 max-w-xs"
                />
                <Badge variant={event.is_active ? "default" : "secondary"}>
                  {event.is_active ? "Actif" : "Inactif"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={event.is_active}
                  onCheckedChange={(checked) => updateLocal(event.id, "is_active", checked)}
                />
                <Button onClick={() => saveEvent(event)} disabled={saving === event.id} size="sm" className="gap-1">
                  <Save className="h-4 w-4" />
                  {saving === event.id ? "..." : "Sauvegarder"}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer cet événement ?</AlertDialogTitle>
                      <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteEvent(event.id)}>Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Description */}
            <div>
              <Label>Description</Label>
              <Textarea
                value={event.description || ""}
                onChange={(e) => updateLocal(event.id, "description", e.target.value)}
                placeholder="Description de l'événement..."
                className="mt-1"
              />
            </div>

            {/* Dates */}
            <div>
              <h4 className="text-sm font-semibold mb-3">📅 Dates</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Date de début</Label>
                  <Input type="date" value={event.start_date} onChange={(e) => updateLocal(event.id, "start_date", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Date de fin</Label>
                  <Input type="date" value={event.end_date} onChange={(e) => updateLocal(event.id, "end_date", e.target.value)} className="mt-1" />
                </div>
              </div>
            </div>

            {/* Horaires */}
            <div>
              <h4 className="text-sm font-semibold mb-3">🕐 Horaires</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Heure de début</Label>
                  <Input type="time" value={event.start_hour?.slice(0, 5) || "09:00"} onChange={(e) => updateLocal(event.id, "start_hour", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Heure de fin</Label>
                  <Input type="time" value={event.end_hour?.slice(0, 5) || "20:00"} onChange={(e) => updateLocal(event.id, "end_hour", e.target.value)} className="mt-1" />
                </div>
              </div>
            </div>

            {/* Prix */}
            <div>
              <h4 className="text-sm font-semibold mb-3">💰 Prix spéciaux</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { key: "prix_coupe_classique", label: "Coupe classique" },
                  { key: "prix_coupe_barbe", label: "Coupe + barbe" },
                  { key: "prix_barbe", label: "Barbe" },
                  { key: "prix_contours", label: "Contours" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <Label>{label}</Label>
                    <div className="relative mt-1">
                      <Input
                        type="number"
                        min="0"
                        value={(event as any)[key] || 0}
                        onChange={(e) => updateLocal(event.id, key, parseFloat(e.target.value) || 0)}
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">€</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Services exclus */}
            <div>
              <Label>🚫 Services exclus (séparés par des virgules)</Label>
              <Input
                value={event.excluded_services || ""}
                onChange={(e) => updateLocal(event.id, "excluded_services", e.target.value)}
                className="mt-1"
                placeholder="Ex: Coupe enfant, Contours"
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
