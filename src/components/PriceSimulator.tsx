import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calculator, Clock, Car, Calendar, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePricingSettings } from "@/hooks/usePricingSettings";
import { Separator } from "@/components/ui/separator";

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

export const PriceSimulator = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [time, setTime] = useState("14:00");
  const [travelMinutes, setTravelMinutes] = useState(0);
  const [isSameDay, setIsSameDay] = useState(false);
  const [isSunday, setIsSunday] = useState(false);
  const { data: settings } = usePricingSettings();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("services").select("id, name, price, duration_minutes").eq("is_active", true).order("name");
      if (data) setServices(data);
    };
    load();
  }, []);

  const selectedService = services.find(s => s.id === selectedServiceId);

  const simulation = useMemo(() => {
    if (!selectedService || !settings) return null;

    const basePrice = selectedService.price;
    const hour = parseInt(time.split(":")[0]);

    // Supplément horaire
    let hourSupplement = 0;
    if (hour < settings.early_hour_threshold) {
      hourSupplement = (settings.early_hour_threshold - hour) * settings.early_hour_fee;
    }
    if (hour >= settings.late_hour_threshold) {
      hourSupplement = (hour - (settings.late_hour_threshold - 1)) * settings.late_hour_fee;
    }

    // Frais de déplacement
    let travelFee = 0;
    if (travelMinutes > settings.travel_free_minutes) {
      const extraMinutes = travelMinutes - settings.travel_free_minutes;
      const intervals = Math.ceil(extraMinutes / settings.travel_interval_minutes);
      travelFee = intervals * settings.travel_fee_per_interval;
    }

    // Frais jour même
    const sameDayFee = isSameDay ? settings.same_day_fee : 0;

    // Supplément dimanche
    const sundayFee = isSunday ? settings.sunday_fee : 0;

    const total = basePrice + hourSupplement + travelFee + sameDayFee + sundayFee;

    return { basePrice, hourSupplement, travelFee, sameDayFee, sundayFee, total };
  }, [selectedService, time, travelMinutes, isSameDay, isSunday, settings]);

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
              <Label className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Heure du RDV</Label>
              <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Car className="h-3.5 w-3.5" /> Temps de trajet (min)</Label>
              <Input type="number" min={0} value={travelMinutes} onChange={e => setTravelMinutes(parseInt(e.target.value) || 0)} />
            </div>

            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Réservation jour même</Label>
              <Switch checked={isSameDay} onCheckedChange={setIsSameDay} />
            </div>

            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1"><Sun className="h-3.5 w-3.5" /> Dimanche</Label>
              <Switch checked={isSunday} onCheckedChange={setIsSunday} />
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
