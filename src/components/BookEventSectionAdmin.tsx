import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

const BOOK_KEYS = [
  { key: "book_event_label", label: "Label (en haut)", placeholder: "BOOK ÉVÉNEMENTIEL" },
  { key: "book_event_title", label: "Titre principal", placeholder: "Événements, artistes & collaborations" },
  { key: "book_event_description", label: "Description", placeholder: "Découvrez mes partenaires...", multiline: true },
  { key: "book_event_button_text", label: "Texte du bouton", placeholder: "Voir mes prestations" },
  { key: "book_event_button_link", label: "Lien du bouton", placeholder: "/evenements" },
];

export function BookEventSectionAdmin() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data, error } = await supabase
      .from("carnaval_settings")
      .select("setting_key, setting_value")
      .like("setting_key", "book_event_%");

    if (!error && data) {
      const map: Record<string, string> = {};
      data.forEach((row) => (map[row.setting_key] = row.setting_value));
      setValues(map);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const { key } of BOOK_KEYS) {
        if (values[key] !== undefined) {
          await supabase
            .from("carnaval_settings")
            .update({ setting_value: values[key] })
            .eq("setting_key", key);
        }
      }
      toast({ title: "Succès", description: "Section BOOK mise à jour." });
    } catch {
      toast({ title: "Erreur", description: "Impossible de sauvegarder.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Chargement…</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Section BOOK Événementiel (page d'accueil)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {BOOK_KEYS.map(({ key, label, placeholder, multiline }) => (
          <div key={key}>
            <Label>{label}</Label>
            {multiline ? (
              <Textarea
                value={values[key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                placeholder={placeholder}
                rows={3}
              />
            ) : (
              <Input
                value={values[key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                placeholder={placeholder}
              />
            )}
          </div>
        ))}
        <Button onClick={handleSave} disabled={saving} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </CardContent>
    </Card>
  );
}
