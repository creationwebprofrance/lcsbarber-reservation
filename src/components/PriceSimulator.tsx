import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calculator, MapPin, CalendarIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePricingSettings } from "@/hooks/usePricingSettings";
import { Separator } from "@/components/ui/separator";
import { calculateTravelFees, formatTravelTime, formatDistance } from "@/lib/travel-calculator";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

export const PriceSimulator = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState("14:00");
  const [address, setAddress] = useState("");
  const [travelFee, setTravelFee] = useState(0);
  const [travelDuration, setTravelDuration] = useState(0);
  const [travelDistance, setTravelDistance] = useState(0);
  const [calculatingTravel, setCalculatingTravel] = useState(false);
  const { data: settings } = usePricingSettings();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("services").select("id, name, price, duration_minutes").eq("is_active", true).order("name");
      if (data) setServices(data);
    };
    load();
  }, []);

  const selectedService = services.find(s => s.id === selectedServiceId);

  // Auto-detect Sunday and same-day
  const isSunday = date ? date.getDay() === 0 : false;
  const isSameDay = date ? date.toDateString() === new Date().toDateString() : false;

  // Calculate travel fees from address
  const calculateTravel = useCallback(async () => {
    if (!address.trim()) {
      setTravelFee(0);
      setTravelDuration(0);
      setTravelDistance(0);
      return;
    }
    setCalculatingTravel(true);
    try {
      const { data: tokenData } = await supabase.functions.invoke("get-mapbox-token");
      const token = tokenData?.token;
      if (!token) return;

      const travelSettings = settings ? {
        freeMinutes: settings.travel_free_minutes,
        intervalMinutes: settings.travel_interval_minutes,
        feePerInterval: settings.travel_fee_per_interval,
      } : undefined;

      const result = await calculateTravelFees(address, token, travelSettings);
      setTravelFee(result.fees);
      setTravelDuration(result.duration);
      setTravelDistance(result.distance);
    } catch {
      setTravelFee(0);
      setTravelDuration(0);
      setTravelDistance(0);
    } finally {
      setCalculatingTravel(false);
    }
  }, [address, settings]);

  const simulation = useMemo(() => {
    if (!selectedService || !settings) return null;

    const basePrice = selectedService.price;
    const hour = parseInt(time.split(":")[0]);

    let hourSupplement = 0;
    if (hour < settings.early_hour_threshold) {
      hourSupplement = (settings.early_hour_threshold - hour) * settings.early_hour_fee;
    }
    if (hour >= settings.late_hour_threshold) {
      hourSupplement = (hour - (settings.late_hour_threshold - 1)) * settings.late_hour_fee;
    }

    const sameDayFee = isSameDay ? settings.same_day_fee : 0;
    const sundayFee = isSunday ? settings.sunday_fee : 0;
    const total = basePrice + hourSupplement + travelFee + sameDayFee + sundayFee;

    return { basePrice, hourSupplement, travelFee, sameDayFee, sundayFee, total };
  }, [selectedService, time, travelFee, isSameDay, isSunday, settings]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Simulation de prix
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Inputs */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Service</Label>
              <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un service" />
                </SelectTrigger>
                <SelectContent>
                  {services.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} - {s.price}€</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5" /> Date du RDV</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP", { locale: fr }) : "Choisir une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                    locale={fr}
                  />
                </PopoverContent>
              </Popover>
              {date && (isSunday || isSameDay) && (
                <div className="flex gap-2 flex-wrap">
                  {isSunday && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Dimanche</span>}
                  {isSameDay && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Jour même</span>}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Heure du RDV</Label>
              <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Adresse du client</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: 10 rue de Paris, 95000 Cergy"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={calculateTravel}
                  disabled={calculatingTravel || !address.trim()}
                >
                  {calculatingTravel ? <Loader2 className="h-4 w-4 animate-spin" /> : "Calculer"}
                </Button>
              </div>
              {travelDuration > 0 && (
                <p className="text-xs text-muted-foreground">
                  {formatTravelTime(travelDuration)} · {formatDistance(travelDistance)}
                </p>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <h4 className="font-semibold text-sm mb-3">Détail du prix</h4>
            {simulation ? (
              <>
                <div className="flex justify-between text-sm">
                  <span>Prix de base</span>
                  <span className="font-medium">{simulation.basePrice}€</span>
                </div>
                {simulation.hourSupplement > 0 && (
                  <div className="flex justify-between text-sm text-amber-600">
                    <span>Supplément horaire</span>
                    <span className="font-medium">+{simulation.hourSupplement}€</span>
                  </div>
                )}
                {simulation.travelFee > 0 && (
                  <div className="flex justify-between text-sm text-blue-600">
                    <span>Frais de déplacement</span>
                    <span className="font-medium">+{simulation.travelFee}€</span>
                  </div>
                )}
                {simulation.sameDayFee > 0 && (
                  <div className="flex justify-between text-sm text-orange-600">
                    <span>Supplément jour même</span>
                    <span className="font-medium">+{simulation.sameDayFee}€</span>
                  </div>
                )}
                {simulation.sundayFee > 0 && (
                  <div className="flex justify-between text-sm text-purple-600">
                    <span>Supplément dimanche</span>
                    <span className="font-medium">+{simulation.sundayFee}€</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">{simulation.total}€</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                Sélectionnez un service pour voir la simulation
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
