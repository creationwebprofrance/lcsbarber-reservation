import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { fr } from "date-fns/locale";

interface DatePickerProps {
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
}

export const DatePicker = ({ selectedDate, onDateSelect }: DatePickerProps) => {
  const today = new Date();
  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + 3); // 3 mois à l'avance

  const isDateDisabled = (date: Date) => {
    const day = date.getDay();
    // Désactiver les dimanches (0) et les dates passées
    return day === 0 || date < today;
  };

  return (
    <div>
      <h2 className="mb-6 text-center text-2xl font-semibold">
        Choisissez votre date
      </h2>
      
      <div className="flex justify-center">
        <Card className="border-border/20 bg-gradient-card backdrop-blur-sm shadow-elegant p-6 hover:shadow-glow transition-all duration-300">
          <Calendar
            mode="single"
            selected={selectedDate || undefined}
            onSelect={(date) => date && onDateSelect(date)}
            disabled={isDateDisabled}
            fromDate={today}
            toDate={maxDate}
            locale={fr}
            className="pointer-events-auto"
            classNames={{
              months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
              month: "space-y-4",
              caption: "flex justify-center pt-1 relative items-center mb-4",
              caption_label: "text-lg font-semibold text-foreground",
              nav: "space-x-1 flex items-center",
              nav_button: "h-8 w-8 bg-transparent border border-border/30 rounded-full hover:bg-accent hover:border-accent hover:shadow-glow transition-all duration-300 flex items-center justify-center",
              nav_button_previous: "absolute left-1",
              nav_button_next: "absolute right-1",
              table: "w-full border-collapse space-y-2",
              head_row: "flex mb-2",
              head_cell: "text-muted-foreground rounded-md w-10 h-10 font-medium text-sm flex items-center justify-center",
              row: "flex w-full mt-1",
              cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 rounded-lg",
              day: "h-10 w-10 p-0 font-normal rounded-lg hover:bg-accent/80 hover:text-accent-foreground transition-all duration-200 hover:scale-105 hover:shadow-md flex items-center justify-center",
              day_selected: "bg-gradient-primary text-primary-foreground hover:bg-gradient-primary hover:text-primary-foreground focus:bg-gradient-primary focus:text-primary-foreground shadow-glow scale-105 font-semibold border-2 border-primary/20",
              day_today: "bg-accent/60 text-accent-foreground font-semibold border-2 border-primary/30 hover:bg-accent/80",
              day_outside: "text-muted-foreground opacity-40 aria-selected:bg-accent/20 aria-selected:text-muted-foreground aria-selected:opacity-30",
              day_disabled: "text-muted-foreground opacity-30 cursor-not-allowed hover:bg-transparent hover:scale-100",
              day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
              day_hidden: "invisible",
            }}
          />
        </Card>
      </div>
      
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Les dimanches ne sont pas disponibles
      </p>
    </div>
  );
};