import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Calendar, Clock, Scissors } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { calculatePricing } from "@/lib/pricing";

interface Service {
  id: string;
  name: string;
  price: number;
  description?: string;
}

interface BookingFormProps {
  bookingData: {
    service: Service;
    date: Date;
    time: string;
  };
  onSubmit: (clientInfo: any) => void;
  onBack: () => void;
}

export const BookingForm = ({ bookingData, onSubmit, onBack }: BookingFormProps) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    message: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Calculer le prix total avec supplément horaire si applicable
  const pricing = calculatePricing(bookingData.service.price, bookingData.time);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Le nom est requis";
    }

    if (!formData.email.trim()) {
      newErrors.email = "L'email est requis";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "L'email n'est pas valide";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Le téléphone est requis";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: "" });
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Button 
          variant="ghost" 
          onClick={onBack}
          className="hover:bg-accent"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <h2 className="text-xl font-semibold">Vos informations</h2>
        <div></div>
      </div>

      {/* Récapitulatif */}
      <Card className="mb-6 border-border/50 bg-primary/5">
        <div className="p-4">
          <h3 className="mb-3 font-medium text-primary">Récapitulatif de votre rendez-vous</h3>
          <div className="flex flex-col space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Scissors className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{bookingData.service.name}</span>
              </div>
              <span className="font-medium">{pricing.basePrice}€</span>
            </div>
            {pricing.hasTimeupplement && (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Clock className="mr-2 h-4 w-4 text-orange-600" />
                  <span className="text-orange-600">Supplément horaire</span>
                </div>
                <span className="font-medium text-orange-600">+{pricing.supplement}€</span>
              </div>
            )}
            <div className="flex items-center">
              <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>{format(bookingData.date, "EEEE d MMMM yyyy", { locale: fr })}</span>
            </div>
            <div className="flex items-center">
              <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>{bookingData.time}</span>
            </div>
            <div className="border-t pt-2 mt-2">
              <div className="flex items-center justify-between font-semibold">
                <span>Total</span>
                <span className="text-primary text-lg">{pricing.totalPrice}€</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="name">Nom complet *</Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              className={`mt-1 ${errors.name ? "border-destructive" : ""}`}
              placeholder="Votre nom complet"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              className={`mt-1 ${errors.email ? "border-destructive" : ""}`}
              placeholder="votre@email.com"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-destructive">{errors.email}</p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="phone">Téléphone *</Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => handleInputChange("phone", e.target.value)}
            className={`mt-1 ${errors.phone ? "border-destructive" : ""}`}
            placeholder="01 23 45 67 89"
          />
          {errors.phone && (
            <p className="mt-1 text-sm text-destructive">{errors.phone}</p>
          )}
        </div>

        <div>
          <Label htmlFor="address">Adresse</Label>
          <Input
            id="address"
            type="text"
            value={formData.address}
            onChange={(e) => handleInputChange("address", e.target.value)}
            className="mt-1"
            placeholder="Votre adresse complète"
          />
        </div>

        <div>
          <Label htmlFor="message">Message (optionnel)</Label>
          <Textarea
            id="message"
            value={formData.message}
            onChange={(e) => handleInputChange("message", e.target.value)}
            className="mt-1"
            placeholder="Décrivez brièvement l'objet de votre rendez-vous..."
            rows={4}
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onBack}>
            Retour
          </Button>
          <Button 
            type="submit" 
            className="bg-gradient-primary shadow-elegant hover:shadow-glow transition-all"
          >
            Confirmer le rendez-vous
          </Button>
        </div>
      </form>
    </div>
  );
};