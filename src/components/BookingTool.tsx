import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Scissors, Calendar, Clock, CheckCircle, ShoppingCart } from "lucide-react";
import { ServiceSelector } from "./ServiceSelector";
import { DatePicker } from "./DatePicker";
import { TimeSlotSelector } from "./TimeSlotSelector";
import { MultiBookingForm } from "./MultiBookingForm";
import { BookingCart, type BookingItem } from "./BookingCart";

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

export const BookingTool = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [currentSelection, setCurrentSelection] = useState<CurrentSelection>({
    service: null,
    date: null,
    time: null,
  });
  const [bookingItems, setBookingItems] = useState<BookingItem[]>([]);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [clientInfo, setClientInfo] = useState<any>(null);

  const steps = [
    { number: 1, title: "Choisir la prestation", icon: Scissors },
    { number: 2, title: "Choisir une date", icon: Calendar },
    { number: 3, title: "Sélectionner l'heure", icon: Clock },
    { number: 4, title: "Vos informations", icon: CheckCircle },
  ];

  const handleServiceSelect = (service: Service) => {
    setCurrentSelection({ ...currentSelection, service });
    setCurrentStep(2);
  };

  const handleDateSelect = (date: Date) => {
    setCurrentSelection({ ...currentSelection, date });
    setCurrentStep(3);
  };

  const handleTimeSelect = (time: string) => {
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
    setCurrentStep(1);
  };

  const showCart = bookingItems.length > 0 && currentStep < 4 && !isConfirmed;
  const showForm = currentStep === 4 && bookingItems.length > 0;

  return (
    <div className="min-h-screen bg-gradient-secondary p-2 sm:p-4">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-4 sm:mb-8 text-center">
          <h1 className="mb-2 sm:mb-4 text-2xl sm:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Prenez Rendez-vous
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {bookingItems.length > 0 
              ? `${bookingItems.length} rendez-vous sélectionné${bookingItems.length > 1 ? 's' : ''} - Ajoutez-en d'autres ou continuez`
              : "Réservez facilement votre créneau en quelques clics"
            }
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-4 sm:mb-8 flex justify-center overflow-x-auto">
          <div className="flex items-center space-x-1 sm:space-x-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.number;
              const isCompleted = currentStep > step.number;
              
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

        {/* Cart indicator */}
        {bookingItems.length > 0 && !isConfirmed && currentStep < 4 && (
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
        <Card className="bg-gradient-card shadow-card border-border/50 backdrop-blur-sm">
          <div className="p-3 sm:p-6">
            {!isConfirmed && currentStep === 1 && (
              <ServiceSelector
                selectedService={currentSelection.service}
                onServiceSelect={handleServiceSelect}
              />
            )}

            {!isConfirmed && currentStep === 2 && currentSelection.service && (
              <DatePicker
                selectedDate={currentSelection.date}
                onDateSelect={handleDateSelect}
                onBack={() => setCurrentStep(1)}
              />
            )}

            {!isConfirmed && currentStep === 3 && currentSelection.date && (
              <TimeSlotSelector
                selectedDate={currentSelection.date}
                selectedTime={currentSelection.time}
                onTimeSelect={handleTimeSelect}
                onBack={() => setCurrentStep(2)}
              />
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
                  {bookingItems.length > 1 
                    ? `Vos ${bookingItems.length} rendez-vous ont été enregistrés.`
                    : 'Votre rendez-vous a été enregistré.'
                  }
                  <br />
                  Un email de confirmation vous a été envoyé.
                </p>
                
                <Button variant="outline" onClick={resetBooking}>
                  Prendre un autre rendez-vous
                </Button>
              </div>
            )}
          </div>
        </Card>

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
