import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PartyPopper, Save, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

interface CarnavalSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  description: string | null;
}

export const CarnavalAdmin = () => {
  const [settings, setSettings] = useState<CarnavalSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data, error } = await supabase
      .from("carnaval_settings")
      .select("*")
      .order("setting_key");

    if (error) {
      toast({ title: "Erreur", description: "Impossible de charger les paramètres Carnaval.", variant: "destructive" });
      return;
    }
    setSettings(data || []);
    setLoading(false);
  };

  const getValue = (key: string) => settings.find((s) => s.setting_key === key)?.setting_value || "";

  const updateLocal = (key: string, value: string) => {
    setSettings((prev) => prev.map((s) => (s.setting_key === key ? { ...s, setting_value: value } : s)));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const setting of settings) {
        const { error } = await supabase
          .from("carnaval_settings")
          .update({ setting_value: setting.setting_value, updated_at: new Date().toISOString() })
          .eq("id", setting.id);
        if (error) throw error;
      }
      toast({ title: "✅ Sauvegardé", description: "Les paramètres Carnaval ont été mis à jour." });
    } catch {
      toast({ title: "Erreur", description: "Échec de la sauvegarde.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-8">Chargement...</div>;

  const isEnabled = getValue("enabled") === "true";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PartyPopper className="h-6 w-6 text-orange-500" />
          <div>
            <h2 className="text-xl font-bold">Carnaval de Bordeaux</h2>
            <p className="text-sm text-muted-foreground">Gère les paramètres de l'événement spécial</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link to="/carnaval" target="_blank">
              <ExternalLink className="h-4 w-4 mr-1" />
              Voir la page
            </Link>
          </Button>
          <Button onClick={saveAll} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Sauvegarde..." : "Sauvegarder"}
          </Button>
        </div>
      </div>

      {/* Activation */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-semibold">Activer la page Carnaval</Label>
              <p className="text-sm text-muted-foreground">Affiche le bouton Carnaval sur la page d'accueil et active la page /carnaval</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={isEnabled ? "default" : "secondary"}>
                {isEnabled ? "Actif" : "Inactif"}
              </Badge>
              <Switch
                checked={isEnabled}
                onCheckedChange={(checked) => updateLocal("enabled", checked ? "true" : "false")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📅 Dates de l'événement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Date de début</Label>
              <Input
                type="date"
                value={getValue("start_date")}
                onChange={(e) => updateLocal("start_date", e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Date de fin</Label>
              <Input
                type="date"
                value={getValue("end_date")}
                onChange={(e) => updateLocal("end_date", e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prix spéciaux */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">💰 Prix spéciaux Carnaval</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: "prix_coupe_classique", label: "Coupe classique" },
              { key: "prix_coupe_barbe", label: "Coupe + barbe" },
              { key: "prix_barbe", label: "Barbe uniquement" },
              { key: "prix_contours", label: "Contours" },
            ].map(({ key, label }) => (
              <div key={key}>
                <Label>{label}</Label>
                <div className="relative mt-1">
                  <Input
                    type="number"
                    min="0"
                    value={getValue(key)}
                    onChange={(e) => updateLocal(key, e.target.value)}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">€</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Services exclus */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🚫 Services exclus</CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <Label>Noms des services exclus (séparés par des virgules)</Label>
            <Input
              value={getValue("excluded_services")}
              onChange={(e) => updateLocal("excluded_services", e.target.value)}
              className="mt-1"
              placeholder="Ex: Coupe enfant, Contours"
            />
            <p className="text-xs text-muted-foreground mt-1">Ces services ne seront pas proposés sur la page Carnaval</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
