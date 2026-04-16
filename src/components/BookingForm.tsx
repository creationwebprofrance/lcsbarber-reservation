import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Calendar, Clock, Scissors, MapPin, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { calculatePricing, type HourlySupplementSettings } from "@/lib/pricing";
import { calculateTravelFees, formatTravelTime, formatDistance, type TravelCalculation, type TravelFeeSettings } from "@/lib/travel-calculator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { usePricingSettings } from "@/hooks/usePricingSettings";

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
  postalCode: z.string()
    .trim()
    .min(4, "Le code postal doit contenir au moins 4 caractères")
    .max(10, "Le code postal ne peut pas dépasser 10 caractères")
    .regex(/^[0-9\s-]+$/, "Le code postal ne peut contenir que des chiffres"),
  city: z.string()
    .trim()
    .min(2, "La ville doit contenir au moins 2 caractères")
    .max(100, "La ville ne peut pas dépasser 100 caractères"),
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
    postalCode: "",
    city: "",
    message: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const mapboxToken = 'pk.eyJ1IjoibGNoaXBhbiIsImEiOiJjbWZtOHc1dG4wZDdzMmlzN3hmeDRldnhzIn0.lK1A8wh63mIkudWk8h7f6Q';
  const [travelCalculation, setTravelCalculation] = useState<TravelCalculation>({
    duration: 0,
    fees: 0,
    distance: 0
  });
  const [isCalculatingTravel, setIsCalculatingTravel] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [depositPaidConfirmed, setDepositPaidConfirmed] = useState(false);
  const { toast } = useToast();
  
  // Fetch pricing settings from database
  const { data: pricingSettings } = usePricingSettings();
  
  // Convert settings to the format expected by calculation functions
  const travelFeeSettings: TravelFeeSettings | undefined = pricingSettings ? {
    freeMinutes: pricingSettings.travel_free_minutes,
    intervalMinutes: pricingSettings.travel_interval_minutes,
    feePerInterval: pricingSettings.travel_fee_per_interval,
  } : undefined;
  
  const hourlySettings: HourlySupplementSettings | undefined = pricingSettings ? {
    earlyHourThreshold: pricingSettings.early_hour_threshold,
    earlyHourFee: pricingSettings.early_hour_fee,
    lateHourThreshold: pricingSettings.late_hour_threshold,
    lateHourFee: pricingSettings.late_hour_fee,
    sameDayFee: pricingSettings.same_day_fee,
    sundayFee: pricingSettings.sunday_fee,
  } : undefined;
  

  const fullAddress = `${formData.address}, ${formData.postalCode} ${formData.city}`.trim();

  // Effet pour calculer les frais de déplacement quand l'adresse change
  useEffect(() => {
    const calculateTravel = async () => {
      if (formData.address.trim() && formData.postalCode.trim() && formData.city.trim() && mapboxToken.trim()) {
        setIsCalculatingTravel(true);
        try {
          const result = await calculateTravelFees(fullAddress, mapboxToken, travelFeeSettings);
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
  }, [fullAddress, mapboxToken, toast, travelFeeSettings?.freeMinutes, travelFeeSettings?.intervalMinutes, travelFeeSettings?.feePerInterval]);
  
  // Calculer le prix total avec supplément horaire, frais de déplacement et frais jour même
  const pricing = calculatePricing(bookingData.service.price, bookingData.time, travelCalculation.fees, hourlySettings, bookingData.date);
  
  // Acompte de 10€ si le total dépasse 50€
  const requiresDeposit = pricing.totalPrice > 50;
  const depositAmount = 10;
  
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
      
      // Créer la réservation via edge function (contourne RLS)
      const bookingPayload = {
        service_id: bookingData.service.id,
        appointment_date: format(bookingData.date, 'yyyy-MM-dd'),
        appointment_time: bookingData.time,
        client_name: validatedData.name,
        client_email: validatedData.email,
        client_phone: validatedData.phone,
        client_address: `${validatedData.address}, ${validatedData.postalCode} ${validatedData.city}`,
        total_price: pricing.totalPrice,
        travel_fee: travelCalculation.fees,
        notes: validatedData.message || null,
        deposit_paid: requiresDeposit ? depositPaidConfirmed : true,
      };

      const { data: bookingResult, error: bookingError } = await supabase.functions.invoke('create-booking', {
        body: bookingPayload,
      });

      if (bookingError || !bookingResult?.success) {
        throw new Error(bookingResult?.error || bookingError?.message || 'Erreur lors de la création de la réservation');
      }
      
      const newBooking = bookingResult.booking;


      // Envoyer les emails de confirmation (client + admin)
      const emailData = {
        clientName: validatedData.name,
        clientEmail: validatedData.email,
        clientPhone: validatedData.phone,
        clientAddress: validatedData.address,
        clientPostalCode: validatedData.postalCode,
        clientCity: validatedData.city,
        serviceName: bookingData.service.name,
        servicePrice: bookingData.service.price,
        appointmentDate: format(bookingData.date, "EEEE d MMMM yyyy", { locale: fr }),
        appointmentTime: bookingData.time,
        totalPrice: pricing.totalPrice,
        travelFee: travelCalculation.fees,
        message: validatedData.message || '',
      };

      const { error: emailError } = await supabase.functions.invoke('send-booking-emails', {
        body: emailData,
      });

      if (emailError) {
        console.error('Erreur envoi emails de confirmation:', emailError);
      }

      toast({
        title: "✅ Rendez-vous confirmé !",
        description: `Votre rendez-vous du ${format(bookingData.date, "d MMMM", { locale: fr })} à ${bookingData.time} a été enregistré. Un email de confirmation vous a été envoyé.`,
        duration: 6000,
      });

      // Passer au screen de confirmation avec l'ID du booking
      onSubmit({ ...formData, bookingId: newBooking?.id });
      
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
    <div className="px-1 sm:px-0">
      <div className="mb-4 sm:mb-6 flex items-center justify-between">
        <Button 
          variant="ghost" 
          onClick={onBack}
          className="hover:bg-accent h-9 px-2 sm:px-3"
          size="sm"
        >
          <ArrowLeft className="mr-1 sm:mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Retour</span>
        </Button>
        <h2 className="text-lg sm:text-xl font-semibold">Vos informations</h2>
        <div className="w-8 sm:w-16"></div>
      </div>

      {/* Configuration Mapbox */}
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
            <div className="border-t pt-2 mt-2 space-y-1">
              {pricing.hasSameDayFee && (
                <div className="flex items-center justify-between text-sm text-orange-600">
                  <span>Frais jour même</span>
                  <span>+{pricing.sameDayFee}€</span>
                </div>
              )}
              {pricing.hasSundayFee && (
                <div className="flex items-center justify-between text-sm text-orange-600">
                  <span>Supplément dimanche</span>
                  <span>+{pricing.sundayFee}€</span>
                </div>
              )}
              <div className="flex items-center justify-between font-semibold">
                <span>Total</span>
                <span className="text-primary text-lg">{pricing.totalPrice}€</span>
              </div>
              {requiresDeposit && (
                <div className="flex items-center justify-between text-sm text-blue-600">
                  <span>Acompte requis</span>
                  <span className="font-medium">{depositAmount}€</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:gap-4">
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
            placeholder="Numéro et nom de rue"
          />
          {errors.address && (
            <p className="mt-1 text-sm text-destructive">{errors.address}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="postalCode">Code postal *</Label>
            <Input
              id="postalCode"
              type="text"
              value={formData.postalCode}
              onChange={(e) => handleInputChange("postalCode", e.target.value)}
              className={`mt-1 ${errors.postalCode ? "border-destructive" : ""}`}
              placeholder="33000"
            />
            {errors.postalCode && (
              <p className="mt-1 text-sm text-destructive">{errors.postalCode}</p>
            )}
          </div>
          <div>
            <Label htmlFor="city">Ville *</Label>
            <Input
              id="city"
              type="text"
              value={formData.city}
              onChange={(e) => handleInputChange("city", e.target.value)}
              className={`mt-1 ${errors.city ? "border-destructive" : ""}`}
              placeholder="Bordeaux"
            />
            {errors.city && (
              <p className="mt-1 text-sm text-destructive">{errors.city}</p>
            )}
          </div>
        </div>

        <div>
          {isCalculatingTravel && (
            <p className="text-sm text-blue-600">Calcul des frais de déplacement...</p>
          )}
          {travelCalculation.fees > 0 && !isCalculatingTravel && (
            <p className="text-sm text-blue-600">
              Frais de déplacement: {travelCalculation.fees}€ 
              ({formatTravelTime(travelCalculation.duration)}, {formatDistance(travelCalculation.distance)})
            </p>
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
          {requiresDeposit && (
            <div className="text-center bg-blue-50 dark:bg-blue-950 p-3 sm:p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs sm:text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">
                ⚠️ Pour les réservations de plus de 50€, un acompte de {depositAmount}€ est obligatoire.
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