import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Calendar, Clock, Scissors, MapPin, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { calculatePricing } from "@/lib/pricing";
import { calculateTravelFees, formatTravelTime, formatDistance, type TravelCalculation } from "@/lib/travel-calculator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

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

// Comprehensive validation schema to prevent malicious data injection
const bookingFormSchema = z.object({
  name: z.string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(100, "Le nom ne peut pas dépasser 100 caractères")
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, "Le nom ne peut contenir que des lettres, espaces, apostrophes et tirets"),
  email: z.string()
    .trim()
    .email("L'email n'est pas valide")
    .max(255, "L'email ne peut pas dépasser 255 caractères")
    .toLowerCase(),
  phone: z.string()
    .trim()
    .min(10, "Le numéro de téléphone doit contenir au moins 10 chiffres")
    .max(20, "Le numéro de téléphone ne peut pas dépasser 20 caractères")
    .regex(/^[0-9\s+()-]+$/, "Le numéro de téléphone ne peut contenir que des chiffres, espaces, +, - et ()"),
  address: z.string()
    .trim()
    .min(5, "L'adresse doit contenir au moins 5 caractères")
    .max(500, "L'adresse ne peut pas dépasser 500 caractères"),
  message: z.string()
    .trim()
    .max(1000, "Le message ne peut pas dépasser 1000 caractères")
    .optional()
});

export const BookingForm = ({ bookingData, onSubmit, onBack }: BookingFormProps) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    message: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mapboxToken, setMapboxToken] = useState(() => {
    const defaultToken = 'pk.eyJ1IjoibGNoaXBhbiIsImEiOiJjbWZtOHc1dG4wZDdzMmlzN3hmeDRldnhzIn0.lK1A8wh63mIkudWk8h7f6Q';
    return localStorage.getItem('mapbox-token') || defaultToken;
  });
  const [travelCalculation, setTravelCalculation] = useState<TravelCalculation>({
    duration: 0,
    fees: 0,
    distance: 0
  });
  const [isCalculatingTravel, setIsCalculatingTravel] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [depositPaidConfirmed, setDepositPaidConfirmed] = useState(false);
  const { toast } = useToast();
  
  // Effet pour sauvegarder le token Mapbox
  useEffect(() => {
    if (mapboxToken) {
      localStorage.setItem('mapbox-token', mapboxToken);
    }
  }, [mapboxToken]);

  // Effet pour calculer les frais de déplacement quand l'adresse change
  useEffect(() => {
    const calculateTravel = async () => {
      if (formData.address.trim() && mapboxToken.trim()) {
        setIsCalculatingTravel(true);
        try {
          const result = await calculateTravelFees(formData.address, mapboxToken);
          setTravelCalculation(result);
        } catch (error) {
          console.error('Erreur calcul déplacement:', error);
          setTravelCalculation({ duration: 0, fees: 0, distance: 0 });
          toast({
            title: "Erreur de calcul",
            description: "Impossible de calculer les frais de déplacement. Vérifiez l'adresse et la clé API.",
            variant: "destructive"
          });
        } finally {
          setIsCalculatingTravel(false);
        }
      } else {
        setTravelCalculation({ duration: 0, fees: 0, distance: 0 });
      }
    };

    // Délai pour éviter trop de requêtes
    const timeoutId = setTimeout(calculateTravel, 1000);
    return () => clearTimeout(timeoutId);
  }, [formData.address, mapboxToken, toast]);
  
  // Calculer le prix total avec supplément horaire et frais de déplacement
  const pricing = calculatePricing(bookingData.service.price, bookingData.time, travelCalculation.fees);
  
  // Calculer l'acompte (50% du total)
  const depositAmount = Math.round(pricing.totalPrice * 0.5);
  
  // Générer le lien PayPal avec acompte
  const generatePayPalLink = () => {
    return `https://www.paypal.me/lczzz/${depositAmount}EUR`;
  };

  const validateForm = () => {
    try {
      // Validate using Zod schema
      bookingFormSchema.parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.issues.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const requiresDeposit = bookingData.service.price > 50;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Vérifier si l'acompte est obligatoire et confirmé
    if (requiresDeposit && !depositPaidConfirmed) {
      toast({
        title: "Acompte requis",
        description: "Veuillez confirmer que vous avez effectué le paiement de l'acompte avant de continuer.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Validate and sanitize form data before submission
      const validatedData = bookingFormSchema.parse(formData);
      
      // Créer une réservation en attente (vérification par email)
      const verificationToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const pendingToInsert = {
        service_id: bookingData.service.id,
        appointment_date: format(bookingData.date, 'yyyy-MM-dd'),
        appointment_time: bookingData.time,
        client_name: validatedData.name,
        client_email: validatedData.email,
        client_phone: validatedData.phone,
        client_address: validatedData.address,
        total_price: pricing.totalPrice,
        travel_fee: travelCalculation.fees,
        notes: validatedData.message || null,
        verification_token: verificationToken,
        expires_at: expiresAt,
      };

      const { data: pending, error: pendingError } = await supabase
        .from('pending_bookings')
        .insert([pendingToInsert])
        .select()
        .single();

      if (pendingError) {
        throw new Error(`Erreur lors de la création de la réservation en attente: ${pendingError.message}`);
      }

      // Envoyer l'email de vérification
      const verificationEmailData = {
        clientName: validatedData.name,
        clientEmail: validatedData.email,
        serviceName: bookingData.service.name,
        appointmentDate: format(bookingData.date, "dd MMMM yyyy", { locale: fr }),
        appointmentTime: bookingData.time,
        verificationToken,
        appUrl: window.location.origin,
      };

      const { error: verificationEmailError } = await supabase.functions.invoke('send-verification-email', {
        body: verificationEmailData,
      });

      if (verificationEmailError) {
        console.error('Erreur envoi email de vérification:', verificationEmailError);
      }

      toast({
        title: "Vérification requise",
        description: "Un email de vérification vous a été envoyé pour confirmer votre rendez-vous.",
      });

      // Passer au screen de confirmation sans ID (sera ajouté après vérification)
      onSubmit({ ...formData, bookingId: null });
      
    } catch (error: any) {
      console.error('Erreur lors de la réservation:', error);
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de la réservation.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
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

      {/* Configuration Mapbox */}
      {!mapboxToken && (
        <Card className="mb-6 border-orange-200 bg-orange-50">
          <div className="p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-orange-800 mb-2">Configuration requise</h3>
                <p className="text-sm text-orange-700 mb-3">
                  Pour calculer automatiquement les frais de déplacement, veuillez entrer votre clé API Mapbox.
                  <br />
                  <a href="https://mapbox.com/" target="_blank" rel="noopener noreferrer" className="underline">
                    Obtenez votre clé gratuite sur mapbox.com
                  </a>
                </p>
                <Input
                  placeholder="Entrez votre clé API Mapbox..."
                  value={mapboxToken}
                  onChange={(e) => setMapboxToken(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
          </div>
        </Card>
      )}

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
            {pricing.hasTravelFees && (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <MapPin className="mr-2 h-4 w-4 text-blue-600" />
                  <div className="flex flex-col">
                    <span className="text-blue-600">Frais de déplacement</span>
                    <span className="text-xs text-muted-foreground">
                      {formatTravelTime(travelCalculation.duration)} • {formatDistance(travelCalculation.distance)}
                    </span>
                  </div>
                </div>
                <span className="font-medium text-blue-600">+{pricing.travelFees}€</span>
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
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-1">
                <span>Acompte (50%)</span>
                <span>{depositAmount}€</span>
              </div>
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
          <Label htmlFor="address">Adresse *</Label>
          <Input
            id="address"
            type="text"
            value={formData.address}
            onChange={(e) => handleInputChange("address", e.target.value)}
            className={`mt-1 ${errors.address ? "border-destructive" : ""}`}
            placeholder="Votre adresse complète"
          />
          {isCalculatingTravel && (
            <p className="mt-1 text-sm text-blue-600">Calcul des frais de déplacement...</p>
          )}
          {travelCalculation.fees > 0 && !isCalculatingTravel && (
            <p className="mt-1 text-sm text-blue-600">
              Frais de déplacement: {travelCalculation.fees}€ 
              ({formatTravelTime(travelCalculation.duration)}, {formatDistance(travelCalculation.distance)})
            </p>
          )}
          {errors.address && (
            <p className="mt-1 text-sm text-destructive">{errors.address}</p>
          )}
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

        <div className="flex flex-col space-y-3 pt-4">
          {requiresDeposit ? (
            <>
              <div className="text-center bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">
                  ⚠️ Pour les prestations de plus de 50€, le paiement de l'acompte de {depositAmount}€ est obligatoire avant la réservation.
                </p>
                <Button 
                  type="button"
                  onClick={() => window.open(generatePayPalLink(), '_blank')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white mb-3"
                  size="lg"
                >
                  💳 Payer l'acompte obligatoire ({depositAmount}€)
                </Button>
                <div className="flex items-center justify-center space-x-2 mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <input
                    type="checkbox"
                    id="deposit-confirm"
                    checked={depositPaidConfirmed}
                    onChange={(e) => setDepositPaidConfirmed(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="deposit-confirm" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    Je confirme avoir effectué le paiement de l'acompte
                  </label>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Cochez cette case après avoir effectué le paiement pour finaliser votre réservation
                </p>
              </div>
            </>
          ) : (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Pour finaliser votre réservation, veuillez régler l'acompte de {depositAmount}€
              </p>
              <Button 
                type="button"
                onClick={() => window.open(generatePayPalLink(), '_blank')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white mb-3"
              >
                💳 Payer l'acompte ({depositAmount}€) - PayPal
              </Button>
            </div>
          )}
          
          <div className="flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={onBack}>
              Retour
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || (requiresDeposit && !depositPaidConfirmed)}
              className="bg-gradient-primary shadow-elegant hover:shadow-glow transition-all"
              title={(requiresDeposit && !depositPaidConfirmed) ? "Vous devez confirmer avoir payé l'acompte" : ""}
            >
              {isSubmitting ? "Enregistrement..." : "Confirmer le rendez-vous"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};