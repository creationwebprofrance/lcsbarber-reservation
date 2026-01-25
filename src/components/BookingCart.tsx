import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Calendar, Clock, Scissors } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Service {
  id: string;
  name: string;
  price: number;
  description?: string;
}

export interface BookingItem {
  id: string;
  service: Service;
  date: Date;
  time: string;
}

interface BookingCartProps {
  items: BookingItem[];
  onRemoveItem: (id: string) => void;
  onAddAnother: () => void;
  onProceedToForm: () => void;
}

export const BookingCart = ({ items, onRemoveItem, onAddAnother, onProceedToForm }: BookingCartProps) => {
  const totalBasePrice = items.reduce((sum, item) => sum + item.service.price, 0);
  
  if (items.length === 0) {
    return null;
  }

  return (
    <Card className="mt-6 border-primary/20 bg-primary/5">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Badge variant="secondary" className="bg-primary text-primary-foreground">
              {items.length}
            </Badge>
            Rendez-vous sélectionné{items.length > 1 ? 's' : ''}
          </h3>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => (
            <div 
              key={item.id} 
              className="flex items-start justify-between bg-background rounded-lg p-3 border border-border/50"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    RDV {index + 1}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Scissors className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium">{item.service.name}</span>
                  <span className="text-muted-foreground">({item.service.price}€)</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{format(item.date, "d MMM", { locale: fr })}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{item.time}</span>
                  </div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => onRemoveItem(item.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">Sous-total prestations</span>
            <span className="font-semibold text-lg">{totalBasePrice}€</span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            * Les frais de déplacement seront calculés à l'étape suivante
          </p>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={onAddAnother}
              className="flex-1"
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un autre RDV
            </Button>
            <Button 
              onClick={onProceedToForm}
              className="flex-1 bg-gradient-primary"
            >
              Continuer ({items.length} RDV)
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
