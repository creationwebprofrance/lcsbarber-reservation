import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Scissors, Calendar, Clock, CheckCircle, ShoppingCart, Home, Car, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ServiceSelector } from "./ServiceSelector";
import { DatePicker } from "./DatePicker";
import { TimeSlotSelector } from "./TimeSlotSelector";
import { MultiBookingForm } from "./MultiBookingForm";
import { BookingCart, type BookingItem } from "./BookingCart";
import { BookingRouteMap } from "./BookingRouteMap";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { usePricingSettings } from "@/hooks/usePricingSettings";
import { calculatePricing, type HourlySupplementSettings } from "@/lib/pricing";
import { supabase } from "@/integrations/supabase/client";

interface Service {
  id: string;
  name: string;
  price: number;
  description?: string;
}

interface CurrentSelection {
  service: Service | null;
  date: Date | null;
  time: string | null;
}

type BookingMode = "domicile" | "deplacement" | null;

// Tarifs spéciaux "le client se déplace" — pas de frais de déplacement
const DOMICILE_SERVICES: Record<string, { label: string; price: number }> = {
  "Contours": { label: "Contours", price: 10 },
  "Coupe classique": { label: "Coupe", price: 15 },
  "Coupe + barbe": { label: "Coupe + barbe", price: 20 },
};

const DOMICILE_ADDRESS = "Imp. des Hirondelles Prolongée, 95380 Puiseux-en-France";

export const BookingTool = () => {
  const [mode, setMode] = useState<BookingMode>(null);
  const [currentStep, setCurrentStepState] = useState(1);
  const setCurrentStep = (step: number) => {
    setCurrentStepState(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const [currentSelection, setCurrentSelection] = useState<CurrentSelection>({
    service: null,
    date: null,
    time: null,
  });
  const [bookingItems, setBookingItems] = useState<BookingItem[]>([]);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [clientInfo, setClientInfo] = useState<any>(null);
  const [isBookingDirect, setIsBookingDirect] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();
  const { data: pricingSettings } = usePricingSettings();

  const hourlySettings: HourlySupplementSettings | undefined = pricingSettings ? {
    earlyHourThreshold: pricingSettings.early_hour_threshold,
    earlyHourFee: pricingSettings.early_hour_fee,
    lateHourThreshold: pricingSettings.late_hour_threshold,
    lateHourFee: pricingSettings.late_hour_fee,
    sameDayFee: pricingSettings.same_day_fee,
    sundayFee: pricingSettings.sunday_fee,
  } : undefined;

  const steps = [
    { number: 1, title: "Choisir la prestation", icon: Scissors },
    { number: 2, title: "Choisir une date", icon: Calendar },
    { number: 3, title: "Sélectionner l'heure", icon: Clock },
    ...(mode !== "domicile" ? [{ number: 4, title: "Vos informations", icon: CheckCircle }] : []),
  ];

  const handleModeSelect = (selectedMode: BookingMode) => {
    setMode(selectedMode);
    setCurrentSelection({ service: null, date: null, time: null });
    setBookingItems([]);
    setCurrentStep(1);
  };

  const handleServiceSelect = (service: Service) => {
    setCurrentSelection({ ...currentSelection, service });
    setCurrentStep(2);
  };

  const handleDateSelect = (date: Date) => {
    setCurrentSelection({ ...currentSelection, date });
    setCurrentStep(3);
  };

  const handleTimeSelect = (time: string) => {
    if (mode === "domicile") {
      handleDirectDomicileBooking(time);
      return;
    }
    // Add to cart and stay on step 3 or show cart
    if (currentSelection.service && currentSelection.date) {
      const newItem: BookingItem = {
        id: crypto.randomUUID(),
        service: currentSelection.service,
        date: currentSelection.date,
        time: time,
      };
      setBookingItems([...bookingItems, newItem]);
      // Reset selection for potential next booking
      setCurrentSelection({ service: null, date: null, time: null });
      setCurrentStep(1);
    }
  };

  // Réservation directe "le client se déplace" : pas de formulaire, on utilise le compte connecté
  const handleDirectDomicileBooking = async (time: string) => {
    if (!currentSelection.service || !currentSelection.date || !user?.email) return;

    setIsBookingDirect(true);
    try {
      // Nom depuis le profil / métadonnées
      let clientName =
        (user.user_metadata?.full_name as string) ||
        (user.user_metadata?.name as string) ||
        user.email.split("@")[0];

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profile?.full_name) clientName = profile.full_name;
      if (clientName.trim().length < 2) clientName = "Client LCS";

      // Frais horaires uniquement (pas de déplacement, pas de jour même / dimanche)
      const pricing = calculatePricing(
        currentSelection.service.price,
        time,
        0,
        hourlySettings,
        undefined
      );
      const totalPrice = currentSelection.service.price + pricing.supplement;

      const { data: bookingResult, error: bookingError } = await supabase.functions.invoke("create-booking", {
        body: {
          service_id: currentSelection.service.id,
          appointment_date: format(currentSelection.date, "yyyy-MM-dd"),
          appointment_time: time,
          client_name: clientName,
          client_email: user.email,
          client_phone: "Non renseigné",
          client_address: DOMICILE_ADDRESS,
          total_price: totalPrice,
          travel_fee: 0,
          notes: "Réservation — le client se déplace",
          deposit_paid: true,
        },
      });

      if (bookingError || !bookingResult?.success) {
        throw new Error(bookingResult?.error || bookingError?.message || "Erreur lors de la réservation");
      }

      // Email de confirmation
      await supabase.functions.invoke("send-booking-emails", {
        body: {
          clientName,
          clientEmail: user.email,
          clientPhone: "Non renseigné",
          clientAddress: DOMICILE_ADDRESS,
          clientPostalCode: "",
          clientCity: "",
          serviceName: currentSelection.service.name,
          servicePrice: currentSelection.service.price,
          appointmentDate: format(currentSelection.date, "EEEE d MMMM yyyy", { locale: fr }),
          appointmentTime: time,
          totalPrice,
          travelFee: 0,
          message: "Réservation — le client se déplace",
        },
      });

      setCurrentSelection({ ...currentSelection, time });
      setIsConfirmed(true);
    } catch (error: any) {
      console.error("Erreur réservation 'le client se déplace':", error);
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de la réservation.",
        variant: "destructive",
      });
    } finally {
      setIsBookingDirect(false);
    }
  };

  const handleRemoveItem = (id: string) => {
    setBookingItems(bookingItems.filter(item => item.id !== id));
  };

  const handleAddAnother = () => {
    setCurrentStep(1);
    setCurrentSelection({ service: null, date: null, time: null });
  };

  const handleProceedToForm = () => {
    setCurrentStep(4);
  };

  const handleFormSubmit = (info: any) => {
    setClientInfo(info);
    setIsConfirmed(true);
  };

  const resetBooking = () => {
    setBookingItems([]);
    setCurrentSelection({ service: null, date: null, time: null });
    setClientInfo(null);
    setIsConfirmed(false);
    setMode(null);
    setCurrentStep(1);
  };

  const showCart = mode !== "domicile" && bookingItems.length > 0 && currentStep < 4 && !isConfirmed;
  const showForm = mode !== "domicile" && currentStep === 4 && bookingItems.length > 0;

  return (
    <div className="min-h-screen bg-gradient-secondary p-2 sm:p-4">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-4 sm:mb-8 text-center">
          <h1 className="mb-2 sm:mb-4 text-2xl sm:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Prenez Rendez-vous
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {mode === null
              ? "Réservez facilement votre créneau en quelques clics"
              : bookingItems.length > 0
              ? `${bookingItems.length} rendez-vous sélectionné${bookingItems.length > 1 ? 's' : ''} - Ajoutez-en d'autres ou continuez`
              : mode === "domicile"
              ? "Le client se déplace — tarifs réduits, sans frais de déplacement"
              : "LCS Barber se déplace — je me déplace chez toi"
            }
          </p>
          <p className="mt-1 text-xs text-muted-foreground/80">
            De 10h à 20h <span className="text-primary">(frais hors horaire)</span>
          </p>
        </div>

        {/* Choix du mode : le client se déplace ou LCS Barber se déplace */}
        {mode === null && !isConfirmed && (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto">
            <Card
              className="cursor-pointer border-2 border-border hover:border-primary/60 hover:shadow-glow transition-all"
              onClick={() => handleModeSelect("domicile")}
            >
              <div className="p-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Home className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-1">Le client se déplace</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {DOMICILE_ADDRESS} — réservation instantanée, sans formulaire
                </p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Contours : <span className="text-primary font-semibold">10€</span></p>
                  <p>Coupe : <span className="text-primary font-semibold">15€</span></p>
                  <p>Coupe + barbe : <span className="text-primary font-semibold">20€</span></p>
                </div>
              </div>
            </Card>

            <Card
              className="cursor-pointer border-2 border-border hover:border-primary/60 hover:shadow-glow transition-all"
              onClick={() => handleModeSelect("deplacement")}
            >
              <div className="p-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Car className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-1">LCS Barber se déplace</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Je me déplace chez toi — frais de déplacement selon la distance
                </p>
                <div className="text-xs text-muted-foreground">
                  <p>Tarifs classiques + frais de déplacement</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Progress Steps */}
        {mode !== null && (
          <div className="mb-4 sm:mb-8 flex justify-center overflow-x-auto">
            <div className="flex items-center space-x-1 sm:space-x-4">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = currentStep === step.number;
                const isCompleted = currentStep > step.number || isConfirmed;

                return (
                  <div key={step.number} className="flex items-center">
                    <div
                      className={`flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full transition-all ${
                        isCompleted
                          ? "bg-success text-success-foreground"
                          : isActive
                          ? "bg-primary text-primary-foreground shadow-glow"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <span
                      className={`ml-2 hidden text-sm font-medium lg:block ${
                        isActive ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {step.title}
                    </span>
                    {index < steps.length - 1 && (
                      <div className="mx-1 sm:mx-4 h-px w-4 sm:w-8 bg-border"></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cart indicator */}
        {bookingItems.length > 0 && !isConfirmed && currentStep < 4 && mode !== "domicile" && (
          <div className="mb-4 flex justify-center">
            <Button
              variant="outline"
              onClick={handleProceedToForm}
              className="gap-2"
            >
              <ShoppingCart className="h-4 w-4" />
              Finaliser ({bookingItems.length} RDV)
            </Button>
          </div>
        )}

        {/* Main Content */}
        {mode !== null && (
          <Card className="bg-gradient-card shadow-card border-border/50 backdrop-blur-sm">
            <div className="p-3 sm:p-6">
              {!isConfirmed && currentStep === 1 && (
                <>
                  <div className="mb-4">
                    <Button variant="ghost" size="sm" onClick={() => setMode(null)}>
                      ← Changer de mode
                    </Button>
                  </div>
                  <ServiceSelector
                    selectedService={currentSelection.service}
                    onServiceSelect={handleServiceSelect}
                    domicileMode={mode === "domicile"}
                    domicileServices={DOMICILE_SERVICES}
                  />
                  {mode && <BookingRouteMap mode={mode} />}
                </>
              )}

              {!isConfirmed && currentStep === 2 && currentSelection.service && (
                <DatePicker
                  selectedDate={currentSelection.date}
                  onDateSelect={handleDateSelect}
                  onBack={() => setCurrentStep(1)}
                  mode={mode ?? undefined}
                />
              )}

              {!isConfirmed && currentStep === 3 && currentSelection.date && (
                <>
                  {isBookingDirect ? (
                    <div className="py-12 text-center space-y-4">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                      <p className="text-muted-foreground">Confirmation de votre rendez-vous...</p>
                    </div>
                  ) : (
                    <TimeSlotSelector
                      selectedDate={currentSelection.date}
                      selectedTime={currentSelection.time}
                      onTimeSelect={handleTimeSelect}
                      onBack={() => setCurrentStep(2)}
                      mode={mode ?? undefined}
                    />
                  )}
                </>
              )}

              {showForm && !isConfirmed && (
                <MultiBookingForm
                  bookingItems={bookingItems}
                  onSubmit={handleFormSubmit}
                  onBack={() => setCurrentStep(1)}
                />
              )}

              {isConfirmed && (
                <div className="text-center space-y-6">
                  <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/20">
                    <CheckCircle className="h-8 w-8 text-success" />
                  </div>
                  <h2 className="mb-4 text-2xl font-bold">
                    {bookingItems.length > 1 ? 'Rendez-vous confirmés !' : 'Rendez-vous confirmé !'}
                  </h2>
                  <p className="mb-6 text-muted-foreground">
                    {mode === "domicile" ? (
                      <>
                        Ton rendez-vous « Le client se déplace » a été enregistré
                        {currentSelection.service && currentSelection.date && currentSelection.time && (
                          <>
                            <br />
                            <span className="font-medium text-foreground">
                              {currentSelection.service.name} — {format(currentSelection.date, "EEEE d MMMM", { locale: fr })} à {currentSelection.time}
                            </span>
                            <br />
                            <span className="font-medium text-foreground">{DOMICILE_ADDRESS}</span>
                          </>
                        )}
                        <br />
                      </>
                    ) : bookingItems.length > 1 ? (
                      <>
                        Vos {bookingItems.length} rendez-vous ont été enregistrés.
                        <br />
                      </>
                    ) : (
                      <>
                        Votre rendez-vous a été enregistré.
                        <br />
                      </>
                    )}
                    Un email de confirmation vous a été envoyé.
                  </p>

                  <Button variant="outline" onClick={resetBooking}>
                    Prendre un autre rendez-vous
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Booking Cart */}
        {showCart && (
          <BookingCart
            items={bookingItems}
            onRemoveItem={handleRemoveItem}
            onAddAnother={handleAddAnother}
            onProceedToForm={handleProceedToForm}
          />
        )}
      </div>
    </div>
  );
};
