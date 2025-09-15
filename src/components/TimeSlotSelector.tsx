import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface TimeSlotSelectorProps {
  selectedDate: Date;
  selectedTime: string | null;
  onTimeSelect: (time: string) => void;
  onBack: () => void;
}

export const TimeSlotSelector = ({
  selectedDate,
  selectedTime,
  onTimeSelect,
  onBack,
}: TimeSlotSelectorProps) => {
  // Créneaux horaires disponibles
  const timeSlots = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"
  ];

  // Simuler des créneaux indisponibles (déjà réservés)
  const unavailableSlots = ["10:30", "15:00", "16:30"];

  const isSlotAvailable = (time: string) => {
    return !unavailableSlots.includes(time);
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
        <h2 className="text-xl font-semibold">
          {format(selectedDate, "EEEE d MMMM yyyy", { locale: fr })}
        </h2>
        <div></div>
      </div>

      <div className="space-y-4">
        <h3 className="text-center text-lg font-medium">
          Choisissez votre créneau horaire
        </h3>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {timeSlots.map((time) => {
            const isAvailable = isSlotAvailable(time);
            const isSelected = selectedTime === time;

            return (
              <Card
                key={time}
                className={`cursor-pointer border transition-all duration-200 ${
                  !isAvailable
                    ? "border-border/30 bg-muted/30 cursor-not-allowed"
                    : isSelected
                    ? "border-primary bg-primary/10 shadow-glow"
                    : "border-border/50 bg-card/50 hover:border-primary/50 hover:bg-primary/5"
                }`}
                onClick={() => isAvailable && onTimeSelect(time)}
              >
                <div className="p-4 text-center">
                  <span
                    className={`font-medium ${
                      !isAvailable
                        ? "text-muted-foreground/50"
                        : isSelected
                        ? "text-primary"
                        : "text-foreground"
                    }`}
                  >
                    {time}
                  </span>
                  {!isAvailable && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Indisponible
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-6 flex justify-center space-x-4 text-sm">
          <div className="flex items-center">
            <div className="mr-2 h-3 w-3 rounded-full bg-success"></div>
            <span className="text-muted-foreground">Disponible</span>
          </div>
          <div className="flex items-center">
            <div className="mr-2 h-3 w-3 rounded-full bg-muted"></div>
            <span className="text-muted-foreground">Indisponible</span>
          </div>
          <div className="flex items-center">
            <div className="mr-2 h-3 w-3 rounded-full bg-primary"></div>
            <span className="text-muted-foreground">Sélectionné</span>
          </div>
        </div>
      </div>
    </div>
  );
};