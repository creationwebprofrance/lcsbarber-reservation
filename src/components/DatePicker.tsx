import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { fr } from "date-fns/locale";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { BookingRequestForm } from "@/components/BookingRequestForm";

interface DatePickerProps {
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  onBack?: () => void;
  mode?: 'domicile' | 'deplacement';
}

const matchesMode = (slotMode: string | null | undefined, mode?: 'domicile' | 'deplacement') =>
  !mode || !slotMode || slotMode === 'both' || slotMode === mode;

export const DatePicker = ({ selectedDate, onDateSelect, onBack, mode }: DatePickerProps) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [month, setMonth] = useState(today);
  const [weeklySlots, setWeeklySlots] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + 3);

  useEffect(() => {
    const load = async () => {
      const [{ data: cs }, { data: dov }] = await Promise.all([
        supabase.from('calendar_settings').select('day_of_week, is_available, mode'),
        supabase.from('date_overrides').select('date, start_time, end_time, is_available, mode'),
      ]);
      setWeeklySlots(cs || []);
      setOverrides(dov || []);
      setLoaded(true);
    };
    load();
  }, []);

  const isDateDisabled = (date: Date) => {
    return date < today;
  };

  const isAvailableDay = (date: Date) => {
    if (date < today) return false;
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayOverrides = overrides.filter(o => o.date === dateStr);

    // Jour bloqué par une exception sans horaires (pour ce mode uniquement)
    if (dayOverrides.some(o => !o.is_available && !o.start_time && matchesMode(o.mode, mode))) return false;

    // Exceptions avec horaires pour ce mode
    const overrideSlots = dayOverrides.filter(o => o.is_available && o.start_time && o.end_time && matchesMode(o.mode, mode));
    if (dayOverrides.some(o => o.is_available && o.start_time)) {
      return overrideSlots.length > 0;
    }

    // Créneaux hebdomadaires
    const dayOfWeek = date.getDay();
    return weeklySlots.some(s => s.day_of_week === dayOfWeek && s.is_available && matchesMode(s.mode, mode));
  };

  // Aucun créneau ouvert dans le futur pour ce mode → inviter à contacter le coiffeur
  const hasFutureAvailability = (() => {
    const d = new Date(today);
    while (d <= maxDate) {
      if (isAvailableDay(d)) return true;
      d.setDate(d.getDate() + 1);
    }
    return false;
  })();

  if (loaded && !hasFutureAvailability) {
    return (
      <div className="px-1 sm:px-0">
        {onBack && (
          <Button variant="outline" size="sm" onClick={onBack} className="mb-4 flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" /> Retour
          </Button>
        )}
        <Card className="p-6 sm:p-8 text-center border-primary/30 bg-gradient-card">
          <h2 className="text-lg sm:text-2xl font-semibold mb-2">Aucun créneau disponible pour le moment</h2>
          <p className="text-muted-foreground mb-5">Envoie-moi une demande de réservation, je te recontacte pour la confirmer.</p>
          <BookingRequestForm mode={mode} />
          <Button asChild variant="outline" className="mt-4">
            <a href="https://www.snapchat.com/add/lcsbarber" target="_blank" rel="noopener noreferrer">
              Ou me contacter sur Snapchat (lcsbarber)
            </a>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-1 sm:px-0">
      <div className="mb-4 sm:mb-6 flex items-center justify-between">
        {onBack && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="flex items-center gap-1 sm:gap-2 h-9 px-2 sm:px-3"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Retour</span>
          </Button>
        )}
        <h2 className="text-center text-lg sm:text-2xl font-semibold flex-1">
          Choisissez votre date
        </h2>
        <div className="w-10 sm:w-20"></div>
      </div>

      <div className="flex justify-center">
        <Card className="border-border/20 bg-gradient-card backdrop-blur-sm shadow-elegant p-3 sm:p-6 hover:shadow-glow transition-all duration-300 w-full sm:w-auto">
          <Calendar
            mode="single"
            selected={selectedDate || undefined}
            onSelect={(date) => date && onDateSelect(date)}
            disabled={isDateDisabled}
            fromDate={today}
            toDate={maxDate}
            month={month}
            onMonthChange={setMonth}
            locale={fr}
            className="pointer-events-auto"
            modifiers={{ available: isAvailableDay }}
            modifiersClassNames={{
              available: "bg-primary/15 text-primary font-bold border border-primary/40",
            }}
            classNames={{
              months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
              month: "space-y-2 sm:space-y-4",
              caption: "flex justify-center pt-1 relative items-center text-lg font-semibold text-foreground",
              caption_label: "text-base sm:text-lg font-semibold capitalize",
              nav: "space-x-1 flex items-center",
              nav_button: "h-8 w-8 bg-transparent p-0 opacity-60 hover:opacity-100 hover:bg-accent rounded-lg transition-all",
              nav_button_previous: "absolute left-1",
              nav_button_next: "absolute right-1",
              table: "w-full border-collapse space-y-1 sm:space-y-2",
              head_row: "flex mb-1 sm:mb-2",
              head_cell: "text-muted-foreground rounded-md w-10 h-8 sm:w-12 sm:h-10 font-medium text-xs sm:text-sm flex items-center justify-center",
              row: "flex w-full mt-0.5 sm:mt-1",
              cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 rounded-lg flex-1",
              day: "h-10 w-10 sm:h-12 sm:w-12 p-0 font-normal rounded-lg hover:bg-accent/80 hover:text-accent-foreground transition-all duration-200 hover:scale-105 hover:shadow-md flex items-center justify-center mx-auto text-sm sm:text-base",
              day_selected: "bg-gradient-primary text-primary-foreground hover:bg-gradient-primary hover:text-primary-foreground focus:bg-gradient-primary focus:text-primary-foreground shadow-glow scale-105 font-semibold border-2 border-primary/20",
              day_today: "bg-accent/60 text-accent-foreground font-semibold border-2 border-primary/30 hover:bg-accent/80",
              day_outside: "text-muted-foreground opacity-40 aria-selected:bg-accent/20 aria-selected:text-muted-foreground aria-selected:opacity-30",
              day_disabled: "text-muted-foreground opacity-30 cursor-not-allowed hover:bg-transparent hover:scale-100",
              day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
              day_hidden: "invisible",
            }}
          />
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <div className="h-3 w-3 rounded bg-primary/15 border border-primary/40"></div>
            <span>Jour disponible</span>
          </div>
        </Card>
      </div>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Réservation possible jusqu'à 3 mois à l'avance • Les jours en bronze sont disponibles
      </p>
    </div>
  );
};
