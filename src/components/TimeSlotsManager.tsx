import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TimeSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  mode: string;
}

const modeLabels: Record<string, string> = {
  deplacement: 'LCS Barber se déplace',
};


const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export const TimeSlotsManager = () => {
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [newSlot, setNewSlot] = useState({
    start_time: '09:00',
    end_time: '12:00',
    is_available: true,
    mode: 'deplacement' as 'deplacement'
  });

  const { toast } = useToast();

  useEffect(() => {
    loadTimeSlots();
  }, []);

  const loadTimeSlots = async () => {
    const { data, error } = await supabase
      .from('calendar_settings')
      .select('*')
      .order('day_of_week')
      .order('start_time');

    if (error) {
      console.error('Error loading time slots:', error);
      return;
    }

    setTimeSlots(data || []);
  };

  const addTimeSlot = async () => {
    const { error } = await supabase
      .from('calendar_settings')
      .insert({
        day_of_week: selectedDay,
        start_time: newSlot.start_time,
        end_time: newSlot.end_time,
        is_available: newSlot.is_available,
        mode: newSlot.mode
      });

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le créneau",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Succès",
      description: "Créneau ajouté avec succès",
    });

    loadTimeSlots();
  };

  const deleteTimeSlot = async (id: string) => {
    const { error } = await supabase
      .from('calendar_settings')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le créneau",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Succès",
      description: "Créneau supprimé",
    });

    loadTimeSlots();
  };

  const toggleSlotAvailability = async (slot: TimeSlot) => {
    const { error } = await supabase
      .from('calendar_settings')
      .update({ is_available: !slot.is_available })
      .eq('id', slot.id);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de modifier le créneau",
        variant: "destructive",
      });
      return;
    }

    loadTimeSlots();
  };

  const slotsByDay = timeSlots.reduce((acc, slot) => {
    if (!acc[slot.day_of_week]) {
      acc[slot.day_of_week] = [];
    }
    acc[slot.day_of_week].push(slot);
    return acc;
  }, {} as Record<number, TimeSlot[]>);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ajouter un créneau horaire</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Jour de la semaine</Label>
              <Select value={selectedDay.toString()} onValueChange={(v) => setSelectedDay(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dayNames.map((day, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2 pt-8">
              <Switch
                checked={newSlot.is_available}
                onCheckedChange={(checked) => 
                  setNewSlot(prev => ({ ...prev, is_available: checked }))
                }
              />
              <Label>Disponible</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Type de prestation</Label>
            <Select value={newSlot.mode} onValueChange={(v) => setNewSlot(prev => ({ ...prev, mode: v as typeof prev.mode }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deplacement">LCS Barber se déplace</SelectItem>
              </SelectContent>
            </Select>
          </div>


          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Heure de début</Label>
              <Input
                type="time"
                value={newSlot.start_time}
                onChange={(e) => setNewSlot(prev => ({ ...prev, start_time: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Heure de fin</Label>
              <Input
                type="time"
                value={newSlot.end_time}
                onChange={(e) => setNewSlot(prev => ({ ...prev, end_time: e.target.value }))}
              />
            </div>
          </div>

          <Button onClick={addTimeSlot} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter le créneau
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Créneaux horaires par jour</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {dayNames.map((dayName, dayIndex) => (
            <div key={dayIndex} className="space-y-2">
              <h3 className="font-semibold text-lg">{dayName}</h3>
              <div className="space-y-2">
                {slotsByDay[dayIndex]?.length > 0 ? (
                  slotsByDay[dayIndex].map((slot) => (
                    <div key={slot.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <Switch
                          checked={slot.is_available}
                          onCheckedChange={() => toggleSlotAvailability(slot)}
                        />
                        <span className={slot.is_available ? '' : 'text-muted-foreground line-through'}>
                          {slot.start_time} - {slot.end_time}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {modeLabels[slot.mode] || 'LCS Barber se déplace'}
                        </Badge>

                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteTimeSlot(slot.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground italic">Aucun créneau défini</p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
