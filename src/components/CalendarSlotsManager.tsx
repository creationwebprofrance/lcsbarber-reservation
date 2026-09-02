import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Trash2, X, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TimeSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  mode: string;
}

const slotModeLabels: Record<string, string> = {
  both: 'Les deux',
  domicile: '🏠 Le client se déplace',
  deplacement: '🚗 LCS Barber se déplace',
};

interface DateOverride {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  is_available: boolean;
  reason: string | null;
  mode: string;
}

interface Booking {
  id: string;
  appointment_date: string;
  appointment_time: string;
  client_name: string;
  status: string;
  services: { name: string };
}

const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const fullDayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export const CalendarSlotsManager = () => {
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [dateOverrides, setDateOverrides] = useState<DateOverride[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSlot, setNewSlot] = useState({ start_time: '09:00', end_time: '10:00', mode: 'both' as 'both' | 'domicile' | 'deplacement' });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadTimeSlots(), loadDateOverrides(), loadBookings()]);
    setLoading(false);
  };

  const loadTimeSlots = async () => {
    const { data } = await supabase
      .from('calendar_settings')
      .select('*')
      .order('day_of_week')
      .order('start_time');
    setTimeSlots(data || []);
  };

  const loadDateOverrides = async () => {
    const { data } = await supabase
      .from('date_overrides')
      .select('*')
      .order('date');
    setDateOverrides(data || []);
  };

  const loadBookings = async () => {
    const { data } = await supabase
      .from('bookings')
      .select('id, appointment_date, appointment_time, client_name, status, services(name)')
      .in('status', ['confirmed', 'pending'])
      .order('appointment_date')
      .order('appointment_time');
    setBookings(data || []);
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  const getSlotsForDay = (date: Date) => {
    const dayOfWeek = date.getDay();
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Check for date overrides first
    const overrides = dateOverrides.filter(o => o.date === dateStr);
    
    // If there's a blocking override (is_available = false without times), day is blocked
    const blockingOverride = overrides.find(o => !o.is_available && !o.start_time);
    if (blockingOverride) return [];
    
    // Get custom slots from overrides
    const overrideSlots = overrides
      .filter(o => o.is_available && o.start_time && o.end_time)
      .map(o => ({ 
        id: o.id, 
        start_time: o.start_time!, 
        end_time: o.end_time!, 
        is_available: true,
        mode: o.mode || 'both',
        isOverride: true 
      }));
    
    // If there are override slots, use only those
    if (overrideSlots.length > 0) {
      return overrideSlots;
    }
    
    // Otherwise, use regular weekly slots
    return timeSlots
      .filter(slot => slot.day_of_week === dayOfWeek && slot.is_available)
      .map(slot => ({ ...slot, isOverride: false }));
  };

  const getBookingsForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return bookings.filter(b => b.appointment_date === dateStr);
  };

  const isDayBlocked = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const overrides = dateOverrides.filter(o => o.date === dateStr);
    
    // Check if there's a blocking override
    const blockingOverride = overrides.find(o => !o.is_available && !o.start_time);
    if (blockingOverride) return true;
    
    // If there are available overrides with times, day is not blocked
    if (overrides.some(o => o.is_available && o.start_time)) return false;
    
    const dayOfWeek = date.getDay();
    const daySlots = timeSlots.filter(s => s.day_of_week === dayOfWeek && s.is_available);
    return daySlots.length === 0;
  };

  const toggleDayAvailability = async (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const existingOverride = dateOverrides.find(o => o.date === dateStr);
    
    if (existingOverride) {
      // Toggle existing override
      const { error } = await supabase
        .from('date_overrides')
        .update({ is_available: !existingOverride.is_available })
        .eq('id', existingOverride.id);
        
      if (error) {
        toast({ title: "Erreur", variant: "destructive" });
        return;
      }
    } else {
      // Create new override to block the day
      const { error } = await supabase
        .from('date_overrides')
        .insert({
          date: dateStr,
          is_available: false,
          reason: 'Bloqué manuellement'
        });
        
      if (error) {
        toast({ title: "Erreur", variant: "destructive" });
        return;
      }
    }
    
    toast({ title: "Disponibilité mise à jour" });
    loadDateOverrides();
  };

  const addSlotForDate = async () => {
    if (!selectedDay) return;
    
    const dateStr = format(selectedDay, 'yyyy-MM-dd');
    
    // Always create a new override for additional slots
    const { error } = await supabase
      .from('date_overrides')
      .insert({
        date: dateStr,
        start_time: newSlot.start_time,
        end_time: newSlot.end_time,
        is_available: true,
        mode: newSlot.mode
      });
      
    if (error) {
      if (error.code === '23505') {
        toast({ 
          title: "Erreur", 
          description: "Un créneau avec cette heure de début existe déjà",
          variant: "destructive" 
        });
      } else {
        toast({ title: "Erreur", variant: "destructive" });
      }
      return;
    }
    
    toast({ title: "Créneau ajouté" });
    loadDateOverrides();
    setNewSlot({ start_time: '09:00', end_time: '10:00', mode: 'both' });
  };

  const removeOverride = async (overrideId: string) => {
    const { error } = await supabase
      .from('date_overrides')
      .delete()
      .eq('id', overrideId);
      
    if (error) {
      toast({ title: "Erreur", variant: "destructive" });
      return;
    }
    
    toast({ title: "Créneau supprimé" });
    loadDateOverrides();
  };

  const openDayDialog = (date: Date) => {
    setSelectedDay(date);
    setDialogOpen(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Chargement...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">
          Semaine du {format(currentWeekStart, 'd MMMM yyyy', { locale: fr })}
        </h2>
        <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day, index) => {
          const slots = getSlotsForDay(day);
          const dayBookings = getBookingsForDay(day);
          const isBlocked = isDayBlocked(day);
          const isToday = isSameDay(day, new Date());
          const dateStr = format(day, 'yyyy-MM-dd');
          const hasOverride = dateOverrides.some(o => o.date === dateStr);

          return (
            <Card 
              key={index} 
              className={`min-h-[200px] cursor-pointer transition-all hover:shadow-md ${
                isBlocked ? 'bg-muted/50 opacity-60' : ''
              } ${isToday ? 'ring-2 ring-primary' : ''}`}
              onClick={() => openDayDialog(day)}
            >
              <CardHeader className="p-2 pb-1">
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">{dayNames[day.getDay()]}</div>
                    <div className={`text-lg font-bold ${isToday ? 'text-primary' : ''}`}>
                      {format(day, 'd')}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-2 pt-0 space-y-1">
                {isBlocked ? (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    Fermé
                  </div>
                ) : (
                  <>
                    {/* Time slots */}
                    {slots.map((slot: any, idx) => (
                      <div 
                        key={idx} 
                        className="text-xs bg-primary/10 text-primary rounded px-1.5 py-0.5 flex items-center justify-between gap-1"
                      >
                        <span>{slot.start_time?.slice(0, 5)} - {slot.end_time?.slice(0, 5)}</span>
                        {slot.mode && slot.mode !== 'both' && (
                          <span>{slot.mode === 'domicile' ? '🏠' : '🚗'}</span>
                        )}
                      </div>
                    ))}
                    
                    {/* Bookings */}
                    {dayBookings.map((booking) => (
                      <div 
                        key={booking.id} 
                        className={`text-xs rounded px-1.5 py-0.5 ${
                          booking.status === 'confirmed' 
                            ? 'bg-green-500/20 text-green-700' 
                            : 'bg-yellow-500/20 text-yellow-700'
                        }`}
                      >
                        <div className="font-medium">{booking.appointment_time.slice(0, 5)}</div>
                        <div className="truncate">{booking.client_name}</div>
                      </div>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-primary/10"></div>
          <span className="text-muted-foreground">Créneau disponible</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-500/20"></div>
          <span className="text-muted-foreground">RDV confirmé</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-yellow-500/20"></div>
          <span className="text-muted-foreground">RDV en attente</span>
        </div>
      </div>

      {/* Day Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {selectedDay && format(selectedDay, 'EEEE d MMMM yyyy', { locale: fr })}
            </DialogTitle>
          </DialogHeader>
          
          {selectedDay && (
            <div className="space-y-4">
              {/* Toggle day availability */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium">Jour disponible</span>
                <Switch
                  checked={!isDayBlocked(selectedDay)}
                  onCheckedChange={() => toggleDayAvailability(selectedDay)}
                />
              </div>

              {/* Current slots/bookings */}
              <div className="space-y-2">
                <Label>Créneaux et réservations</Label>
                {getSlotsForDay(selectedDay).length === 0 && getBookingsForDay(selectedDay).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun créneau pour ce jour</p>
                ) : (
                  <div className="space-y-2">
                    {getSlotsForDay(selectedDay).map((slot: any, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-primary/10 rounded">
                        <span className="text-sm flex items-center gap-2">
                          {slot.start_time?.slice(0, 5)} - {slot.end_time?.slice(0, 5)}
                          <Badge variant="outline" className="text-xs">
                            {slotModeLabels[slot.mode || 'both']}
                          </Badge>
                        </span>
                        {slot.isOverride && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => removeOverride(slot.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {getBookingsForDay(selectedDay).map((booking) => (
                      <div 
                        key={booking.id} 
                        className={`p-2 rounded ${
                          booking.status === 'confirmed' 
                            ? 'bg-green-500/20' 
                            : 'bg-yellow-500/20'
                        }`}
                      >
                        <div className="text-sm font-medium">
                          {booking.appointment_time.slice(0, 5)} - {booking.client_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {booking.services?.name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add custom slot for this date */}
              <div className="space-y-2 pt-4 border-t">
                <Label>Ajouter un créneau spécifique</Label>
                <div className="flex gap-2">
                  <Input
                    type="time"
                    value={newSlot.start_time}
                    onChange={(e) => setNewSlot(prev => ({ ...prev, start_time: e.target.value }))}
                  />
                  <Input
                    type="time"
                    value={newSlot.end_time}
                    onChange={(e) => setNewSlot(prev => ({ ...prev, end_time: e.target.value }))}
                  />
                </div>
                <Select value={newSlot.mode} onValueChange={(v) => setNewSlot(prev => ({ ...prev, mode: v as typeof prev.mode }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Type de prestation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Les deux</SelectItem>
                    <SelectItem value="domicile">🏠 Le client se déplace</SelectItem>
                    <SelectItem value="deplacement">🚗 LCS Barber se déplace</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={addSlotForDate} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
