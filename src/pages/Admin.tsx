import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Settings, Calendar as CalendarIcon, Users, Star, Clock, Euro, Mail, Scissors, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientStats } from "@/components/ClientStats";
import { ReviewsList } from "@/components/ReviewsList";
import { TimeSlotsManager } from "@/components/TimeSlotsManager";
import { CalendarSlotsManager } from "@/components/CalendarSlotsManager";
import { UserManagement } from "@/components/UserManagement";
import { PricingSettings } from "@/components/PricingSettings";
import { BookingsCalendar } from "@/components/BookingsCalendar";
import { EmailTemplateEditor } from "@/components/EmailTemplateEditor";
import { PrestationsAdmin } from "@/components/PrestationsAdmin";
import { CatalogueAdmin } from "@/components/CatalogueAdmin";

interface CalendarSetting {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface DateOverride {
  id: string;
  date: string;
  start_time?: string;
  end_time?: string;
  is_available: boolean;
  reason?: string;
}

const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export const Admin = () => {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [calendarSettings, setCalendarSettings] = useState<CalendarSetting[]>([]);
  const [dateOverrides, setDateOverrides] = useState<DateOverride[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [overrideForm, setOverrideForm] = useState({
    start_time: '',
    end_time: '',
    is_available: false,
    reason: ''
  });
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    loadCalendarSettings();
    loadDateOverrides();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }

      setUser(session.user);

      // Check if user is admin using user_roles table
      const { data: roles, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin');

      if (roleError || !roles || roles.length === 0) {
        toast({
          title: "Accès refusé",
          description: "Vous n'avez pas les droits d'administration.",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error('Auth error:', error);
      navigate('/auth');
    } finally {
      setLoading(false);
    }
  };

  const loadCalendarSettings = async () => {
    const { data, error } = await supabase
      .from('calendar_settings')
      .select('*')
      .order('day_of_week');

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les paramètres du calendrier.",
        variant: "destructive",
      });
      return;
    }

    setCalendarSettings(data || []);
  };

  const loadDateOverrides = async () => {
    const { data, error } = await supabase
      .from('date_overrides')
      .select('*')
      .order('date');

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les exceptions de dates.",
        variant: "destructive",
      });
      return;
    }

    setDateOverrides(data || []);
  };

  const updateCalendarSetting = async (setting: CalendarSetting) => {
    const { error } = await supabase
      .from('calendar_settings')
      .update({
        start_time: setting.start_time,
        end_time: setting.end_time,
        is_available: setting.is_available
      })
      .eq('id', setting.id);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour les horaires.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Succès",
      description: "Horaires mis à jour.",
    });
    loadCalendarSettings();
  };

  const addDateOverride = async () => {
    if (!selectedDate) return;

    const { error } = await supabase
      .from('date_overrides')
      .insert({
        date: format(selectedDate, 'yyyy-MM-dd'),
        start_time: overrideForm.start_time || null,
        end_time: overrideForm.end_time || null,
        is_available: overrideForm.is_available,
        reason: overrideForm.reason || null
      });

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter l'exception de date.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Succès",
      description: "Exception de date ajoutée.",
    });

    setOverrideForm({
      start_time: '',
      end_time: '',
      is_available: false,
      reason: ''
    });
    loadDateOverrides();
  };

  const deleteOverride = async (id: string) => {
    const { error } = await supabase
      .from('date_overrides')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'exception.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Succès",
      description: "Exception supprimée.",
    });
    loadDateOverrides();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Chargement...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Accès refusé</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Administration
          </h1>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>Dashboard</Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/simulator')}>Simulation</Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin-evenements')}>Événements</Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>Accueil</Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="bookings" className="space-y-6">
          <div className="overflow-x-auto -mx-4 px-4 pb-2">
            <TabsList className="inline-flex w-max gap-1 p-1">
              <TabsTrigger value="bookings" className="flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium">
                <CalendarIcon className="h-4 w-4 shrink-0" />
                <span>Réservations</span>
              </TabsTrigger>
              <TabsTrigger value="pricing" className="flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium">
                <Euro className="h-4 w-4 shrink-0" />
                <span>Prix</span>
              </TabsTrigger>
              <TabsTrigger value="timeslots" className="flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium">
                <Clock className="h-4 w-4 shrink-0" />
                <span>Créneaux</span>
              </TabsTrigger>
              <TabsTrigger value="calendar" className="flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium">
                <CalendarIcon className="h-4 w-4 shrink-0" />
                <span>Exceptions</span>
              </TabsTrigger>
              <TabsTrigger value="clients" className="flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium">
                <Users className="h-4 w-4 shrink-0" />
                <span>Clients &amp; utilisateurs</span>
              </TabsTrigger>
              <TabsTrigger value="reviews" className="flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium">
                <Star className="h-4 w-4 shrink-0" />
                <span>Avis</span>
              </TabsTrigger>
              <TabsTrigger value="emails" className="flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium">
                <Mail className="h-4 w-4 shrink-0" />
                <span>Emails</span>
              </TabsTrigger>
              <TabsTrigger value="prestations" className="flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium">
                <Scissors className="h-4 w-4 shrink-0" />
                <span>Prestations</span>
              </TabsTrigger>
              <TabsTrigger value="catalogue" className="flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium">
                <ImageIcon className="h-4 w-4 shrink-0" />
                <span>Catalogue</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="bookings">
            <BookingsCalendar />
          </TabsContent>

          <TabsContent value="pricing">
            <PricingSettings />
          </TabsContent>

          <TabsContent value="timeslots">
            <CalendarSlotsManager />
          </TabsContent>

          <TabsContent value="calendar" className="space-y-8">
            {/* Horaires hebdomadaires */}
            <Card>
              <CardHeader>
                <CardTitle>Horaires hebdomadaires</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {calendarSettings.map((setting) => (
                    <div key={setting.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <span className="w-20 font-medium">
                          {dayNames[setting.day_of_week]}
                        </span>
                        <Switch
                          checked={setting.is_available}
                          onCheckedChange={(checked) => 
                            updateCalendarSetting({ ...setting, is_available: checked })
                          }
                        />
                      </div>
                      {setting.is_available && (
                        <div className="flex items-center space-x-2">
                          <Input
                            type="time"
                            value={setting.start_time}
                            onChange={(e) => 
                              setCalendarSettings(prev => 
                                prev.map(s => s.id === setting.id 
                                  ? { ...s, start_time: e.target.value }
                                  : s
                                )
                              )
                            }
                            onBlur={() => updateCalendarSetting(setting)}
                            className="w-32"
                          />
                          <span>à</span>
                          <Input
                            type="time"
                            value={setting.end_time}
                            onChange={(e) => 
                              setCalendarSettings(prev => 
                                prev.map(s => s.id === setting.id 
                                  ? { ...s, end_time: e.target.value }
                                  : s
                                )
                              )
                            }
                            onBlur={() => updateCalendarSetting(setting)}
                            className="w-32"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Exceptions de dates */}
              <Card>
                <CardHeader>
                  <CardTitle>Ajouter une exception</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Sélectionner une date</Label>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      locale={fr}
                      className="rounded-md border"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={overrideForm.is_available}
                      onCheckedChange={(checked) => 
                        setOverrideForm(prev => ({ ...prev, is_available: checked }))
                      }
                    />
                    <Label>Jour disponible</Label>
                  </div>

                  {overrideForm.is_available && (
                    <div className="flex space-x-2">
                      <div>
                        <Label>Heure de début</Label>
                        <Input
                          type="time"
                          value={overrideForm.start_time}
                          onChange={(e) => 
                            setOverrideForm(prev => ({ ...prev, start_time: e.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <Label>Heure de fin</Label>
                        <Input
                          type="time"
                          value={overrideForm.end_time}
                          onChange={(e) => 
                            setOverrideForm(prev => ({ ...prev, end_time: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <Label>Raison (optionnel)</Label>
                    <Textarea
                      value={overrideForm.reason}
                      onChange={(e) => 
                        setOverrideForm(prev => ({ ...prev, reason: e.target.value }))
                      }
                      placeholder="Ex: Congés, formation, etc."
                    />
                  </div>

                  <Button onClick={addDateOverride} className="w-full">
                    Ajouter l'exception
                  </Button>
                </CardContent>
              </Card>

              {/* Liste des exceptions existantes */}
              <Card>
                <CardHeader>
                  <CardTitle>Exceptions existantes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {dateOverrides.map((override) => (
                      <div key={override.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">
                            {format(new Date(override.date), 'dd MMMM yyyy', { locale: fr })}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {override.is_available 
                              ? `${override.start_time} - ${override.end_time}`
                              : 'Fermé'
                            }
                            {override.reason && ` (${override.reason})`}
                          </div>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteOverride(override.id)}
                        >
                          Supprimer
                        </Button>
                      </div>
                    ))}
                    {dateOverrides.length === 0 && (
                      <div className="text-center text-muted-foreground py-8">
                        Aucune exception définie
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="clients">
            <ClientStats />
          </TabsContent>

          <TabsContent value="reviews">
            <ReviewsList />
          </TabsContent>

          <TabsContent value="emails">
            <EmailTemplateEditor />
          </TabsContent>

          <TabsContent value="prestations">
            <PrestationsAdmin />
          </TabsContent>

          <TabsContent value="catalogue">
            <CatalogueAdmin />
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
};