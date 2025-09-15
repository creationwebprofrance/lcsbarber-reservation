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
        <Card className="border-border/50 bg-card/50 p-4">
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
              day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground shadow-glow",
              day_today: "bg-accent text-accent-foreground font-semibold",
              day: "hover:bg-accent hover:text-accent-foreground transition-colors",
              head_cell: "text-muted-foreground font-medium",
              cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
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