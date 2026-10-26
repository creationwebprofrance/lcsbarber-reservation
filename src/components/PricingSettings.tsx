import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Euro, Clock, MapPin, Mail, Loader2 } from "lucide-react";
import { PricingSettingsManager } from "./PricingSettingsManager";


interface Service {
  id: string;
  name: string;
  price: number;
  description: string;
  duration_minutes: number;
}

export const PricingSettings = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftPrices, setDraftPrices] = useState<Record<string,string>>({});
  const { toast } = useToast();

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('name');

      if (error) throw error;
      setServices(data || []);
      setDraftPrices(Object.fromEntries((data || []).map(s => [s.id,String(s.price)])));
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les services.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const [updatingPriceId, setUpdatingPriceId] = useState<string | null>(null);

  const updateServicePrice = async (serviceId: string, newPrice: number) => {
    const service = services.find(s => s.id === serviceId);
    if (!service || !Number.isFinite(newPrice) || newPrice < 0) return;
    const oldPrice = service.price;

    // Don't do anything if price hasn't changed
    if (oldPrice === newPrice) return;

    setUpdatingPriceId(serviceId);
    try {
      const { error } = await supabase
        .from('services')
        .update({ price: newPrice })
        .eq('id', serviceId);

      if (error) throw error;

      toast({ title: "Succès", description: `Prix mis à jour (${oldPrice}€ → ${newPrice}€). Aucun email automatique envoyé.` });
      loadServices();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le prix.",
        variant: "destructive",
      });
    } finally {
      setUpdatingPriceId(null);
    }
  };

  if (loading) {
    return <div>Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Services pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5" />
            Prix des services
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {services.map((service) => (
              <div key={service.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <h3 className="font-semibold">{service.name}</h3>
                  <p className="text-sm text-muted-foreground">{service.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {service.duration_minutes} minutes
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draftPrices[service.id] ?? String(service.price)}
                    onChange={(e) => setDraftPrices(prev => ({ ...prev, [service.id]:e.target.value }))}
                    className="w-24"
                    disabled={updatingPriceId === service.id}
                  />
                  <Button disabled={updatingPriceId === service.id || !draftPrices[service.id]?.trim() || Number(draftPrices[service.id]) === service.price} onClick={() => updateServicePrice(service.id, Number(draftPrices[service.id]))}>Enregistrer</Button>
                  {updatingPriceId === service.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="font-medium">€</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pricing Settings Manager */}
      <PricingSettingsManager />
    </div>
  );
};
