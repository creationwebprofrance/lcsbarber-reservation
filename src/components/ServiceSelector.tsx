import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";

interface Service {
  id: string;
  name: string;
  price: number;
  description?: string;
}

interface ServiceSelectorProps {
  selectedService: Service | null;
  onServiceSelect: (service: Service) => void;
}

const services: Service[] = [
  {
    id: "coupe",
    name: "Coupe",
    price: 20,
    description: "Coupe classique"
  },
  {
    id: "coupe-barbe",
    name: "Coupe + Barbe",
    price: 25,
    description: "Coupe + taille de barbe"
  },
  {
    id: "coupe-enfant",
    name: "Coupe enfant et contours",
    price: 12,
    description: "Coupe spéciale enfant"
  }
];

export const ServiceSelector = ({ selectedService, onServiceSelect }: ServiceSelectorProps) => {
  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold mb-2">Choisissez votre prestation</h2>
        <p className="text-muted-foreground">Sélectionnez le service que vous souhaitez</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
              <div className="p-6">
                {isSelected && (
                  <div className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                    <Check className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
                
                <div className="mb-3">
                  <h3 className="text-lg font-semibold">{service.name}</h3>
                  {service.description && (
                    <p className="text-sm text-muted-foreground">{service.description}</p>
                  )}
                </div>
                
                <div className="text-2xl font-bold text-primary">
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