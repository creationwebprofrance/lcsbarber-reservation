import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getTimeSupplementText } from "@/lib/pricing";
import { supabase } from "@/integrations/supabase/client";

interface TimeSlotSelectorProps {
  selectedDate: Date;
  selectedTime: string | null;
  onTimeSelect: (time: string) => void;
  onBack: () => void;
}

interface TimeSlot {
  id: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

export const TimeSlotSelector = ({
  selectedDate,
  selectedTime,
  onTimeSelect,
  onBack,
}: TimeSlotSelectorProps) => {
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAvailableSlots();
  }, [selectedDate]);

  const loadAvailableSlots = async () => {
    setLoading(true);
    const dayOfWeek = selectedDate.getDay();
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    try {
      // Récupérer les créneaux configurés pour ce jour
      const { data: timeSlots, error: slotsError } = await supabase
        .from('time_slots')
        .select('*')
        .eq('day_of_week', dayOfWeek)
        .eq('is_available', true);

      if (slotsError) throw slotsError;

      // Récupérer les réservations existantes pour cette date
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('appointment_time')
        .eq('appointment_date', dateStr)
        .in('status', ['pending', 'confirmed']);

      if (bookingsError) throw bookingsError;

      // Créer une liste de tous les créneaux disponibles (par heure)
      const slots: string[] = [];
      timeSlots?.forEach((slot: TimeSlot) => {
        const start = slot.start_time.substring(0, 5); // Format HH:MM
        const end = slot.end_time.substring(0, 5);
        
        const startHour = parseInt(start.split(':')[0]);
        const endHour = parseInt(end.split(':')[0]);
        
        for (let hour = startHour; hour < endHour; hour++) {
          slots.push(`${hour.toString().padStart(2, '0')}:00`);
        }
      });

      // Marquer les créneaux déjà réservés
      const booked = bookings?.map(b => b.appointment_time.substring(0, 5)) || [];

      setAvailableSlots(slots.sort());
      setBookedSlots(booked);
    } catch (error) {
      console.error('Error loading time slots:', error);
    } finally {
      setLoading(false);
    }
  };

  const isSlotAvailable = (time: string) => {
    return !bookedSlots.includes(time);
  };

  if (loading) {
    return <div className="text-center py-8">Chargement des créneaux disponibles...</div>;
  }

  if (availableSlots.length === 0) {
    return (
      <div className="text-center py-8">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <p className="text-muted-foreground">Aucun créneau disponible pour ce jour</p>
      </div>
    );
  }

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
        <h2 className="text-sm sm:text-xl font-semibold text-center flex-1 px-2">
          {format(selectedDate, "EEEE d MMMM", { locale: fr })}
        </h2>
        <div className="w-8 sm:w-16"></div>
      </div>

      <div className="space-y-3 sm:space-y-4">
        <h3 className="text-center text-base sm:text-lg font-medium">
          Choisissez votre créneau horaire
        </h3>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5">
          {availableSlots.map((time) => {
            const isAvailable = isSlotAvailable(time);
            const isSelected = selectedTime === time;
            const supplementText = getTimeSupplementText(time);

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
                <div className="p-2 sm:p-3 text-center">
                  <span
                    className={`font-medium text-sm sm:text-base ${
                      !isAvailable
                        ? "text-muted-foreground/50"
                        : isSelected
                        ? "text-primary"
                        : "text-foreground"
                    }`}
                  >
                    {time}
                  </span>
                  {supplementText && isAvailable && (
                    <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-orange-600 font-medium">
                      {supplementText.match(/\+(\d+)€/)?.[0] || '+?€'}
                    </div>
                  )}
                  {!isAvailable && (
                    <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-muted-foreground">
                      Réservé
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-4 sm:mt-6 flex justify-center flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm">
          <div className="flex items-center">
            <div className="mr-1.5 sm:mr-2 h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-success"></div>
            <span className="text-muted-foreground">Disponible</span>
          </div>
          <div className="flex items-center">
            <div className="mr-1.5 sm:mr-2 h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-muted"></div>
            <span className="text-muted-foreground">Réservé</span>
          </div>
          <div className="flex items-center">
            <div className="mr-1.5 sm:mr-2 h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-primary"></div>
            <span className="text-muted-foreground">Sélectionné</span>
          </div>
        </div>
      </div>
    </div>
  );
};
