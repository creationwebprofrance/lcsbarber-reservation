import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Service {
  id: string;
  name: string;
  price: number;
  description?: string;
}

interface ServiceSelectorProps {
  selectedService: Service | null;
  onServiceSelect: (service: Service) => void;
  onBack?: () => void;
}

export const ServiceSelector = ({ selectedService, onServiceSelect, onBack }: ServiceSelectorProps) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error loading services:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div>Chargement des services...</div>
      </div>
    );
  }
  return (
    <div className="px-1 sm:px-0">
      {onBack && (
        <div className="mb-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            ← Retour
          </Button>
        </div>
      )}
      
      <div className="mb-4 sm:mb-6 text-center">
        <h2 className="text-xl sm:text-2xl font-bold mb-2">Choisissez votre prestation</h2>
        <p className="text-sm sm:text-base text-muted-foreground">Sélectionnez le service que vous souhaitez</p>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => {
          const isSelected = selectedService?.id === service.id;
          
          return (
            <Card
              key={service.id}
              className={`relative cursor-pointer transition-all border-2 hover:shadow-glow ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-glow"
                  : "border-border hover:border-primary/50"
              }`}
              onClick={() => onServiceSelect(service)}
            >
              <div className="p-4 sm:p-6">
                {isSelected && (
                  <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-primary">
                    <Check className="h-3 w-3 sm:h-4 sm:w-4 text-primary-foreground" />
                  </div>
                )}
                
                <div className="mb-2 sm:mb-3 pr-6">
                  <h3 className="text-base sm:text-lg font-semibold">{service.name}</h3>
                  {service.description && (
                    <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{service.description}</p>
                  )}
                </div>
                
                <div className="text-xl sm:text-2xl font-bold text-primary">
                  {service.price}€
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {selectedService && (
        <div className="mt-6 flex justify-end">
          <Button 
            onClick={() => onServiceSelect(selectedService)}
            className="bg-gradient-primary shadow-elegant hover:shadow-glow transition-all"
          >
            Continuer
          </Button>
        </div>
      )}
    </div>
  );
};