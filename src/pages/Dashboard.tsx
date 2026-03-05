import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Users, DollarSign, Calendar as CalendarIcon, TrendingUp, Trash2, Pencil, Check, X, MapPin, Ban } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { MonthlyRevenue } from "@/components/MonthlyRevenue";
import { CityStatsMap } from "@/components/CityStatsMap";
import { AdminBookingForm } from "@/components/AdminBookingForm";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DashboardStats {
  totalBookings: number;
  totalRevenue: number;
  confirmedBookings: number;
  monthlyGrowth: number;
}

interface CityStats {
  city: string;
  count: number;
}

interface RecentBooking {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  appointment_date: string;
  appointment_time: string;
  total_price: number;
  deposit_paid: boolean;
  status: string;
  service: {
    name: string;
  };
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalBookings: 0,
    totalRevenue: 0,
    confirmedBookings: 0,
    monthlyGrowth: 0
  });
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [cityStats, setCityStats] = useState<CityStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<string>("");
  const [editingTimeBookingId, setEditingTimeBookingId] = useState<string | null>(null);
  const [editingTime, setEditingTime] = useState<string>("");
  const [editingDateBookingId, setEditingDateBookingId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<Date | undefined>(undefined);
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!isAdmin) {
      navigate('/');
      return;
    }
    loadDashboardData();
  }, [user, isAdmin, navigate]);

  const loadDashboardData = async () => {
    try {
      // Load bookings with services
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          *,
          service:services(name)
        `)
        .order('created_at', { ascending: false });

      if (bookingsError) throw bookingsError;

      // Calculate stats
      const totalBookings = bookings?.length || 0;
      const totalRevenue = bookings?.reduce((sum, booking) => sum + Number(booking.total_price), 0) || 0;
      const confirmedBookings = bookings?.filter(b => b.status === 'confirmed').length || 0;
      
      // Mock monthly growth for now
      const monthlyGrowth = 12;

      setStats({
        totalBookings,
        totalRevenue,
        confirmedBookings,
        monthlyGrowth
      });

      // Calculate city statistics
      const cityMap = new Map<string, number>();
      bookings?.forEach((booking) => {
        if (booking.client_address) {
          // Extract city from address (assume last part after comma or the whole address)
          const parts = booking.client_address.split(',');
          const city = parts.length > 1 
            ? parts[parts.length - 1].trim().replace(/\d{5}/g, '').trim() 
            : booking.client_address.trim();
          if (city) {
            cityMap.set(city, (cityMap.get(city) || 0) + 1);
          }
        }
      });
      
      const sortedCities = Array.from(cityMap.entries())
        .map(([city, count]) => ({ city, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      
      setCityStats(sortedCities);

      setRecentBookings(bookings?.slice(0, 10) || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId);

      if (error) throw error;

      toast({
        title: "Réservation supprimée",
        description: "La réservation a été supprimée avec succès.",
      });

      loadDashboardData();
    } catch (error) {
      console.error('Erreur suppression:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la réservation.",
        variant: "destructive",
      });
    }
  };

  const handleCancelBooking = async (booking: RecentBooking) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', booking.id);

      if (error) throw error;

      // Send cancellation email
      try {
        await supabase.functions.invoke('send-cancellation-email', {
          body: {
            clientName: booking.client_name,
            clientEmail: booking.client_email,
            clientPhone: booking.client_phone || '',
            serviceName: booking.service?.name || '',
            appointmentDate: new Date(booking.appointment_date).toLocaleDateString('fr-FR'),
            appointmentTime: booking.appointment_time,
            totalPrice: booking.total_price,
          },
        });
      } catch (emailError) {
        console.error('Erreur envoi email annulation:', emailError);
      }

      toast({
        title: "Réservation annulée",
        description: "Le client a été notifié par email.",
      });

      loadDashboardData();
    } catch (error) {
      console.error('Erreur annulation:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'annuler la réservation.",
        variant: "destructive",
      });
    }
  };

  const handleEditPrice = (booking: RecentBooking) => {
    setEditingBookingId(booking.id);
    setEditingPrice(booking.total_price.toString());
  };

  const handleCancelEdit = () => {
    setEditingBookingId(null);
    setEditingPrice("");
  };

  const handleEditTime = (booking: RecentBooking) => {
    setEditingTimeBookingId(booking.id);
    setEditingTime(booking.appointment_time);
  };

  const handleEditDate = (booking: RecentBooking) => {
    setEditingDateBookingId(booking.id);
    setEditingDate(new Date(booking.appointment_date + 'T00:00:00'));
  };

  const handleCancelDateEdit = () => {
    setEditingDateBookingId(null);
    setEditingDate(undefined);
  };

  const handleSaveDate = async (bookingId: string) => {
    if (!editingDate) return;

    const booking = recentBookings.find(b => b.id === bookingId);
    if (!booking) return;
    const oldDate = booking.appointment_date;
    const newDate = format(editingDate, 'yyyy-MM-dd');

    if (oldDate === newDate) {
      handleCancelDateEdit();
      return;
    }

    try {
      const { error } = await supabase
        .from('bookings')
        .update({ appointment_date: newDate })
        .eq('id', bookingId);

      if (error) throw error;

      // Send email notification
      try {
        await supabase.functions.invoke('notify-booking-time-change', {
          body: {
            clientName: booking.client_name,
            clientEmail: booking.client_email,
            serviceName: booking.service?.name || 'Service',
            oldTime: new Date(oldDate).toLocaleDateString('fr-FR'),
            newTime: format(editingDate, 'd MMMM yyyy', { locale: fr }),
            appointmentDate: new Date(oldDate).toLocaleDateString('fr-FR'),
            type: 'date',
          },
        });
      } catch (emailError) {
        console.error("Email notification error:", emailError);
      }

      toast({
        title: "Date modifiée",
        description: `Date mise à jour. Notifications envoyées.`,
      });

      handleCancelDateEdit();
      loadDashboardData();
    } catch (error) {
      console.error('Erreur modification date:', error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier la date.",
        variant: "destructive",
      });
    }
  };

  const handleCancelTimeEdit = () => {
    setEditingTimeBookingId(null);
    setEditingTime("");
  };

  const handleSaveTime = async (bookingId: string) => {
    if (!editingTime || !/^\d{2}:\d{2}/.test(editingTime)) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer une heure valide.",
        variant: "destructive",
      });
      return;
    }

    const booking = recentBookings.find(b => b.id === bookingId);
    if (!booking) return;
    const oldTime = booking.appointment_time;
    const newTime = editingTime.slice(0, 5); // HH:mm

    if (oldTime === newTime) {
      handleCancelTimeEdit();
      return;
    }

    try {
      const { error } = await supabase
        .from('bookings')
        .update({ appointment_time: newTime })
        .eq('id', bookingId);

      if (error) throw error;

      // Send email notification
      try {
        await supabase.functions.invoke('notify-booking-time-change', {
          body: {
            clientName: booking.client_name,
            clientEmail: booking.client_email,
            serviceName: booking.service?.name || 'Service',
            oldTime,
            newTime,
            appointmentDate: new Date(booking.appointment_date).toLocaleDateString('fr-FR'),
          },
        });
      } catch (emailError) {
        console.error("Email notification error:", emailError);
      }

      toast({
        title: "Horaire modifié",
        description: `Horaire mis à jour (${oldTime} → ${newTime}). Notifications envoyées.`,
      });

      setEditingTimeBookingId(null);
      setEditingTime("");
      loadDashboardData();
    } catch (error) {
      console.error('Erreur modification horaire:', error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier l'horaire.",
        variant: "destructive",
      });
    }
  };

  const handleSavePrice = async (bookingId: string) => {
    const newPrice = parseFloat(editingPrice);
    if (isNaN(newPrice) || newPrice < 0) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer un prix valide.",
        variant: "destructive",
      });
      return;
    }

    const booking = recentBookings.find(b => b.id === bookingId);
    if (!booking) return;
    const oldPrice = booking.total_price;

    if (oldPrice === newPrice) {
      setEditingBookingId(null);
      setEditingPrice("");
      return;
    }

    try {
      const { error } = await supabase
        .from('bookings')
        .update({ total_price: newPrice })
        .eq('id', bookingId);

      if (error) throw error;

      // Send email notification to client and admin
      try {
        await supabase.functions.invoke('notify-booking-price-change', {
          body: {
            clientName: booking.client_name,
            clientEmail: booking.client_email,
            serviceName: booking.service?.name || 'Service',
            oldPrice,
            newPrice,
            appointmentDate: new Date(booking.appointment_date).toLocaleDateString('fr-FR'),
            appointmentTime: booking.appointment_time,
          },
        });
      } catch (emailError) {
        console.error("Email notification error:", emailError);
      }

      toast({
        title: "Prix modifié",
        description: `Prix mis à jour (${oldPrice}€ → ${newPrice}€). Notifications envoyées.`,
      });

      setEditingBookingId(null);
      setEditingPrice("");
      loadDashboardData();
    } catch (error) {
      console.error('Erreur modification prix:', error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier le prix.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Chargement du dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* En-tête */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
            <p className="text-muted-foreground">Aperçu de votre activité</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/admin">Administration</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Link>
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="monthly">CA Mensuel</TabsTrigger>
            <TabsTrigger value="bookings">Réservations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Statistiques */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Réservations totales</CardTitle>
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalBookings}</div>
                  <p className="text-xs text-muted-foreground">Ce mois</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Chiffre d'affaires</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalRevenue.toFixed(2)}€</div>
                  <p className="text-xs text-muted-foreground">Ce mois</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Confirmées</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.confirmedBookings}</div>
                  <p className="text-xs text-muted-foreground">Réservations confirmées</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Croissance</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">+{stats.monthlyGrowth}%</div>
                  <p className="text-xs text-muted-foreground">Par rapport au mois dernier</p>
                </CardContent>
              </Card>
            </div>

            {/* Top Cities Card with Map */}
            <CityStatsMap cityStats={cityStats} onCityUpdated={loadDashboardData} />
          </TabsContent>

          <TabsContent value="monthly">
            <MonthlyRevenue />
          </TabsContent>

          <TabsContent value="bookings">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Toutes les réservations</CardTitle>
                <AdminBookingForm onBookingCreated={loadDashboardData} />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentBookings.length > 0 ? recentBookings.map((booking) => (
                    <div key={booking.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{booking.client_name}</span>
                          <Badge className={getStatusColor(booking.status)}>
                            {booking.status === 'confirmed' ? 'Confirmé' :
                             booking.status === 'pending' ? 'En attente' :
                             booking.status === 'cancelled' ? 'Annulé' :
                             booking.status === 'completed' ? 'Terminé' : booking.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {booking.service?.name}
                        </p>
                        <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-1">
                          {editingDateBookingId === booking.id ? (
                            <span className="inline-flex items-center gap-1">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-7 text-xs">
                                    <CalendarIcon className="h-3 w-3 mr-1" />
                                    {editingDate ? format(editingDate, 'd MMM yyyy', { locale: fr }) : 'Choisir'}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={editingDate}
                                    onSelect={setEditingDate}
                                    initialFocus
                                    className={cn("p-3 pointer-events-auto")}
                                  />
                                </PopoverContent>
                              </Popover>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600" onClick={() => handleSaveDate(booking.id)}>
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600" onClick={handleCancelDateEdit}>
                                <X className="h-3 w-3" />
                              </Button>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              {new Date(booking.appointment_date).toLocaleDateString('fr-FR')}
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditDate(booking)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </span>
                          )}
                          <span>à</span>
                          {editingTimeBookingId === booking.id ? (
                            <span className="inline-flex items-center gap-1">
                              <Input
                                type="time"
                                value={editingTime}
                                onChange={(e) => setEditingTime(e.target.value)}
                                className="w-28 h-7 inline-block text-xs"
                              />
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600" onClick={() => handleSaveTime(booking.id)}>
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600" onClick={handleCancelTimeEdit}>
                                <X className="h-3 w-3" />
                              </Button>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              {booking.appointment_time}
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditTime(booking)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          {editingBookingId === booking.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={editingPrice}
                                onChange={(e) => setEditingPrice(e.target.value)}
                                className="w-24 h-8"
                                min="0"
                                step="0.01"
                              />
                              <span>€</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600"
                                onClick={() => handleSavePrice(booking.id)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600"
                                onClick={handleCancelEdit}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="font-bold">{booking.total_price}€</div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEditPrice(booking)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          <div className="text-sm text-muted-foreground">
                            {booking.deposit_paid ? '✓ Acompte payé' : '⚠ Acompte non payé'}
                          </div>
                        </div>
                        {booking.status !== 'cancelled' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="icon" className="border-orange-300 text-orange-600 hover:bg-orange-50">
                                <Ban className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Annuler ce rendez-vous ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Le client sera notifié par email de l'annulation.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Retour</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleCancelBooking(booking)} className="bg-orange-600 hover:bg-orange-700">
                                  Annuler le RDV
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                              <AlertDialogDescription>
                                Êtes-vous sûr de vouloir supprimer cette réservation ? Cette action est irréversible.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteBooking(booking.id)}>
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Aucune réservation trouvée
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}