import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePricingSettingsRaw, useUpdatePricingSetting } from "@/hooks/usePricingSettings";
import { Loader2, Save, Car, Clock } from "lucide-react";

const settingLabels: Record<string, { label: string; unit: string; icon: "car" | "clock" }> = {
  travel_free_minutes: { label: "Minutes gratuites", unit: "min", icon: "car" },
  travel_interval_minutes: { label: "Intervalle par tranche", unit: "min", icon: "car" },
  travel_fee_per_interval: { label: "Prix par tranche", unit: "€", icon: "car" },
  early_hour_threshold: { label: "Heure début supplément matin", unit: "h", icon: "clock" },
  early_hour_fee: { label: "Supplément par heure (matin)", unit: "€", icon: "clock" },
  late_hour_threshold: { label: "Heure début supplément soir", unit: "h", icon: "clock" },
  late_hour_fee: { label: "Supplément par heure (soir)", unit: "€", icon: "clock" },
};

export const PricingSettingsManager = () => {
  const { data: settings, isLoading } = usePricingSettingsRaw();
  const updateSetting = useUpdatePricingSetting();
  const { toast } = useToast();
  const [editedValues, setEditedValues] = useState<Record<string, number>>({});

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleValueChange = (settingKey: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setEditedValues((prev) => ({ ...prev, [settingKey]: numValue }));
  };

  const handleSave = async (id: string, settingKey: string) => {
    const value = editedValues[settingKey];
    if (value === undefined) return;

    try {
      await updateSetting.mutateAsync({ id, value });
      toast({
        title: "Paramètre mis à jour",
        description: `${settingLabels[settingKey]?.label || settingKey} a été modifié.`,
      });
      setEditedValues((prev) => {
        const newValues = { ...prev };
        delete newValues[settingKey];
        return newValues;
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le paramètre.",
        variant: "destructive",
      });
    }
  };

  const travelSettings = settings?.filter((s) => s.setting_key.startsWith("travel_")) || [];
  const hourlySettings = settings?.filter((s) => s.setting_key.includes("hour")) || [];

  const renderSettingRow = (setting: typeof settings[0]) => {
    const config = settingLabels[setting.setting_key];
    const currentValue = editedValues[setting.setting_key] ?? setting.setting_value;
    const hasChanges = editedValues[setting.setting_key] !== undefined;

    return (
      <div key={setting.id} className="flex items-center gap-4 py-3 border-b border-border/50 last:border-0">
        <div className="flex-1">
          <Label className="text-sm font-medium">{config?.label || setting.setting_key}</Label>
          <p className="text-xs text-muted-foreground">{setting.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={currentValue}
            onChange={(e) => handleValueChange(setting.setting_key, e.target.value)}
            className="w-24 text-right"
            min={0}
          />
          <span className="text-sm text-muted-foreground w-8">{config?.unit}</span>
          <Button
            size="sm"
            variant={hasChanges ? "default" : "ghost"}
            onClick={() => handleSave(setting.id, setting.setting_key)}
            disabled={!hasChanges || updateSetting.isPending}
          >
            {updateSetting.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Frais de déplacement */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Car className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Frais de déplacement</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Configurez le calcul automatique des frais de déplacement basé sur le temps de trajet.
        </p>
        <div className="bg-muted/30 rounded-lg p-4 mb-4">
          <p className="text-sm">
            <strong>Formule :</strong> Si le trajet dépasse les minutes gratuites, 
            le prix est calculé par tranches. Exemple avec les valeurs par défaut : 
            0-19 min = 0€, 20-39 min = 10€, 40-59 min = 20€, etc.
          </p>
        </div>
        <div className="divide-y divide-border/50">
          {travelSettings.map(renderSettingRow)}
        </div>
      </Card>

      {/* Suppléments horaires */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Suppléments horaires</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Configurez les suppléments pour les rendez-vous tôt le matin ou tard le soir.
        </p>
        <div className="bg-muted/30 rounded-lg p-4 mb-4">
          <p className="text-sm">
            <strong>Formule :</strong> Un supplément est ajouté pour chaque heure avant le seuil du matin
            (ex: RDV à 8h avec seuil à 10h = 2h × supplément) ou après le seuil du soir
            (ex: RDV à 21h avec seuil à 20h = 2h × supplément).
          </p>
        </div>
        <div className="divide-y divide-border/50">
          {hourlySettings.map(renderSettingRow)}
        </div>
      </Card>
    </div>
  );
};
