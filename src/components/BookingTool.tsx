import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Scissors, Calendar, Clock, CheckCircle } from "lucide-react";
import { ServiceSelector } from "./ServiceSelector";
import { DatePicker } from "./DatePicker";
import { TimeSlotSelector } from "./TimeSlotSelector";
import { BookingForm } from "./BookingForm";
import { CalendarLinks } from "./CalendarLinks";

interface Service {
  id: string;
  name: string;
  price: number;
  description?: string;
}

interface BookingData {
  service: Service | null;
  date: Date | null;
  time: string | null;
  clientInfo: {
    name: string;
    email: string;
    phone: string;
    address: string;
    message: string;
    bookingId?: string;
  } | null;
}

export const BookingTool = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [bookingData, setBookingData] = useState<BookingData>({
    service: null,
    date: null,
    time: null,
    clientInfo: null,
  });

  const steps = [
    { number: 1, title: "Choisir la prestation", icon: Scissors },
    { number: 2, title: "Choisir une date", icon: Calendar },
    { number: 3, title: "Sélectionner l'heure", icon: Clock },
    { number: 4, title: "Vos informations", icon: CheckCircle },
  ];

  const handleServiceSelect = (service: Service) => {
    setBookingData({ ...bookingData, service });
    setCurrentStep(2);
  };

  const handleDateSelect = (date: Date) => {
    setBookingData({ ...bookingData, date });
    setCurrentStep(3);
  };

  const handleTimeSelect = (time: string) => {
    setBookingData({ ...bookingData, time });
    setCurrentStep(4);
  };

  const handleFormSubmit = (clientInfo: any) => {
    setBookingData({ ...bookingData, clientInfo });
    // Here you would typically send the data to your backend
    console.log("Booking confirmed:", { ...bookingData, clientInfo });
  };

  const resetBooking = () => {
    setBookingData({ service: null, date: null, time: null, clientInfo: null });
    setCurrentStep(1);
  };

  return (
    <div className="min-h-screen bg-gradient-secondary p-4">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-4 text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Prenez Rendez-vous
          </h1>
          <p className="text-muted-foreground">
            Réservez facilement votre créneau en quelques clics
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8 flex justify-center">
          <div className="flex items-center space-x-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.number;
              const isCompleted = currentStep > step.number;
              
              return (
                <div key={step.number} className="flex items-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${
                      isCompleted
                        ? "bg-success text-success-foreground"
                        : isActive
                        ? "bg-primary text-primary-foreground shadow-glow"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`ml-2 hidden text-sm font-medium sm:block ${
                      isActive ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.title}
                  </span>
                  {index < steps.length - 1 && (
                    <div className="mx-4 h-px w-8 bg-border"></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <Card className="bg-gradient-card shadow-card border-border/50 backdrop-blur-sm">
          <div className="p-6">
            {currentStep === 1 && (
              <ServiceSelector
                selectedService={bookingData.service}
                onServiceSelect={handleServiceSelect}
              />
            )}

            {currentStep === 2 && bookingData.service && (
              <DatePicker
                selectedDate={bookingData.date}
                onDateSelect={handleDateSelect}
                onBack={() => setCurrentStep(1)}
              />
            )}

            {currentStep === 3 && bookingData.date && (
              <TimeSlotSelector
                selectedDate={bookingData.date}
                selectedTime={bookingData.time}
                onTimeSelect={handleTimeSelect}
                onBack={() => setCurrentStep(2)}
              />
            )}

            {currentStep === 4 && bookingData.date && bookingData.time && bookingData.service && (
              <BookingForm
                bookingData={bookingData}
                onSubmit={handleFormSubmit}
                onBack={() => setCurrentStep(3)}
              />
            )}

            {bookingData.clientInfo && (
              <div className="text-center space-y-6">
                <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/20">
                  <CheckCircle className="h-8 w-8 text-success" />
                </div>
                <h2 className="mb-4 text-2xl font-bold">Rendez-vous confirmé !</h2>
                <p className="mb-6 text-muted-foreground">
                  Un email de confirmation vous a été envoyé.
                </p>
                
                {bookingData.clientInfo.bookingId && (
                  <div className="max-w-md mx-auto mb-6">
                    <CalendarLinks bookingId={bookingData.clientInfo.bookingId} />
                  </div>
                )}
                
                <Button variant="outline" onClick={resetBooking}>
                  Prendre un autre rendez-vous
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};