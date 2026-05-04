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
  hideSupplements?: boolean;
  customSlots?: string[];
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
  hideSupplements = false,
  customSlots,
}: TimeSlotSelectorProps) => {
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (customSlots) {
      // Use custom slots instead of calendar_settings
      loadBookedSlotsOnly();
    } else {
      loadAvailableSlots();
    }
  }, [selectedDate, customSlots]);

  const loadBookedSlotsOnly = async () => {
    setLoading(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    try {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('appointment_time')
        .eq('appointment_date', dateStr)
        .in('status', ['pending', 'confirmed']);
      
      const booked = bookings?.map(b => b.appointment_time.substring(0, 5)) || [];
      setAvailableSlots(customSlots!.sort());
      setBookedSlots(booked);
    } catch (error) {
      console.error('Error loading booked slots:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableSlots = async () => {
    setLoading(true);
    const dayOfWeek = selectedDate.getDay();
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    try {
      // D'abord vérifier s'il y a des exceptions (date_overrides) pour cette date
      const { data: dateOverrides, error: overrideError } = await supabase
        .from('date_overrides')
        .select('*')
        .eq('date', dateStr);

      if (overrideError) throw overrideError;

      // Récupérer les créneaux réguliers pour ce jour de la semaine
      const { data: timeSlots, error: slotsError } = await supabase
        .from('calendar_settings')
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

      // Vérifier s'il y a une exception bloquante (jour fermé)
      const blockingOverride = dateOverrides?.find(o => !o.is_available && !o.start_time);
      
      if (blockingOverride) {
        // Jour bloqué - aucun créneau
        setAvailableSlots([]);
        setBookedSlots([]);
        setLoading(false);
        return;
      }

      // Récupérer les créneaux des exceptions avec horaires
      const overrideSlots = dateOverrides?.filter(o => o.is_available && o.start_time && o.end_time) || [];

      if (overrideSlots.length > 0) {
        // Utiliser les horaires des exceptions
        overrideSlots.forEach((override) => {
          const start = override.start_time!.substring(0, 5);
          const end = override.end_time!.substring(0, 5);
          
          const startHour = parseInt(start.split(':')[0]);
          let endHour = parseInt(end.split(':')[0]);
          // Traiter minuit (00:00) comme 24 pour générer les créneaux jusqu'à minuit
          if (endHour === 0) endHour = 24;
          
          // Générer des créneaux toutes les heures
          for (let hour = startHour; hour < endHour; hour++) {
            slots.push(`${hour.toString().padStart(2, '0')}:00`);
          }
        });
      } else {
        // Utiliser les créneaux réguliers
        timeSlots?.forEach((slot: TimeSlot) => {
          const start = slot.start_time.substring(0, 5);
          const end = slot.end_time.substring(0, 5);
          
          const startHour = parseInt(start.split(':')[0]);
          let endHour = parseInt(end.split(':')[0]);
          if (endHour === 0) endHour = 24;
          
          for (let hour = startHour; hour < endHour; hour++) {
            slots.push(`${hour.toString().padStart(2, '0')}:00`);
          }
        });
      }

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
            const supplementText = hideSupplements ? null : getTimeSupplementText(time);

            return (
              <Card
                key={time}
                className={`cursor-pointer border-2 transition-all duration-200 ${
                  !isAvailable
                    ? "border-muted-foreground/30 bg-muted/50 cursor-not-allowed opacity-60"
                    : isSelected
                    ? "border-primary bg-primary/20 shadow-glow ring-2 ring-primary/30"
                    : "border-success/50 bg-success/10 hover:border-success hover:bg-success/20"
                }`}
                onClick={() => isAvailable && onTimeSelect(time)}
              >
                <div className="p-2 sm:p-3 text-center">
                  <span
                    className={`font-semibold text-sm sm:text-base ${
                      !isAvailable
                        ? "text-muted-foreground/60 line-through"
                        : isSelected
                        ? "text-primary"
                        : "text-success"
                    }`}
                  >
                    {time}
                  </span>
                  {supplementText && isAvailable && (
                    <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-orange-500 font-medium">
                      {supplementText.match(/\+(\d+)€/)?.[0] || '+?€'}
                    </div>
                  )}
                  {!isAvailable && (
                    <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-muted-foreground font-medium">
                      Réservé
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-4 sm:mt-6 flex justify-center flex-wrap gap-4 sm:gap-6 text-xs sm:text-sm bg-card/50 p-3 rounded-lg border border-border/50">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 sm:h-4 sm:w-4 rounded-full bg-success border-2 border-success"></div>
            <span className="text-foreground font-medium">Disponible</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 sm:h-4 sm:w-4 rounded-full bg-muted-foreground/30 border-2 border-muted-foreground/30"></div>
            <span className="text-foreground font-medium">Réservé</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 sm:h-4 sm:w-4 rounded-full bg-primary border-2 border-primary"></div>
            <span className="text-foreground font-medium">Sélectionné</span>
          </div>
        </div>
      </div>
    </div>
  );
};
