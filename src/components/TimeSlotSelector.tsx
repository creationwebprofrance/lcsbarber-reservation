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
  mode?: 'domicile' | 'deplacement';
}

interface TimeSlot {
  id: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  mode?: string;
}

const matchesMode = (slotMode: string | null | undefined, mode?: 'domicile' | 'deplacement') =>
  !mode || !slotMode || slotMode === 'both' || slotMode === mode;

export const TimeSlotSelector = ({
  selectedDate,
  selectedTime,
  onTimeSelect,
  onBack,
  hideSupplements = false,
  customSlots,
  mode,
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
  }, [selectedDate, customSlots, mode]);

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

      // Vérifier s'il y a une exception bloquante (jour fermé) pour ce mode
      const blockingOverride = dateOverrides?.find(o => !o.is_available && !o.start_time && matchesMode(o.mode, mode));

      if (blockingOverride) {
        // Jour bloqué pour ce mode - aucun créneau
        setAvailableSlots([]);
        setBookedSlots([]);
        setLoading(false);
        return;
      }

      // Récupérer les créneaux des exceptions avec horaires (filtrés par mode)
      const overrideSlots = dateOverrides?.filter(o => o.is_available && o.start_time && o.end_time && matchesMode(o.mode, mode)) || [];
      // Y a-t-il des exceptions avec horaires pour cette date (tous modes confondus) ?
      const hasAnyTimedOverride = (dateOverrides?.some(o => o.start_time && o.end_time && o.is_available)) || false;

      // Génère des créneaux toutes les 30 minutes (rendez-vous plus courts / plus longs)
      const pushRange = (startRaw: string, endRaw: string) => {
        const start = startRaw.substring(0, 5);
        const end = endRaw.substring(0, 5);
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        const startMin = sh * 60 + sm;
        let endMin = eh * 60 + em;
        if (endMin <= startMin) endMin = 24 * 60; // 00:00 = minuit
        for (let m = startMin; m < endMin; m += 30) {
          const h = Math.floor(m / 60) % 24;
          const mn = m % 60;
          slots.push(`${h.toString().padStart(2, '0')}:${mn.toString().padStart(2, '0')}`);
        }
      };

      if (hasAnyTimedOverride) {
        // Des exceptions avec horaires existent : seuls les créneaux de ce mode sont visibles
        overrideSlots.forEach((override) => pushRange(override.start_time!, override.end_time!));
      } else {
        timeSlots?.filter((slot: TimeSlot) => matchesMode(slot.mode, mode)).forEach((slot: TimeSlot) => {
          pushRange(slot.start_time, slot.end_time);
        });
      }

      // Marquer les créneaux déjà réservés
      const booked = bookings?.map(b => b.appointment_time.substring(0, 5)) || [];

      setAvailableSlots(Array.from(new Set(slots)).sort());
      setBookedSlots(booked);

    } catch (error) {
      console.error('Error loading time slots:', error);
    } finally {
      setLoading(false);
    }
  };

  // Un créneau déjà réservé est bloqué : non sélectionnable.
  const isSlotAvailable = (time: string) => !bookedSlots.includes(time);
  const isSlotBooked = (time: string) => bookedSlots.includes(time);

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
            const isBooked = isSlotBooked(time);
            const isSelected = selectedTime === time;
            const supplementText = hideSupplements ? null : getTimeSupplementText(time);

            return (
              <Card
                key={time}
                className={`cursor-pointer border-2 transition-all duration-200 ${
                  isSelected
                    ? "border-primary bg-primary/20 shadow-glow ring-2 ring-primary/30"
                    : isBooked
                    ? "border-orange-500/50 bg-orange-500/10 hover:border-orange-500"
                    : "border-success/50 bg-success/10 hover:border-success hover:bg-success/20"
                }`}
                onClick={() => onTimeSelect(time)}
              >
                <div className="p-2 sm:p-3 text-center">
                  <span
                    className={`font-semibold text-sm sm:text-base ${
                      isSelected
                        ? "text-primary"
                        : isBooked
                        ? "text-orange-500"
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
                  {isBooked && (
                    <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-orange-500 font-medium">
                      Déjà pris
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
            <div className="h-3 w-3 sm:h-4 sm:w-4 rounded-full bg-orange-500 border-2 border-orange-500"></div>
            <span className="text-foreground font-medium">Déjà pris (superposition possible)</span>
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
