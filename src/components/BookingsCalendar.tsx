import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar as CalendarIcon, User, Mail, Phone, MapPin, Clock, Euro, RotateCcw, Loader2 } from "lucide-react";

interface Booking {
  id: string;
  service_id: string;
  appointment_date: string;
  appointment_time: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  client_address: string;
  total_price: number;
  travel_fee: number;
  status: string;
  notes: string;
  deposit_paid: boolean;
  services: {
    name: string;
  };
}


export const BookingsCalendar = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedDateBookings, setSelectedDateBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [refundTarget, setRefundTarget] = useState<Booking | null>(null);
  const [refunding, setRefunding] = useState(false);
  const { toast } = useToast();

  const canRefund = (b: Booking) =>
    b.deposit_paid && /cs_[A-Za-z0-9_]+/.test(b.notes ?? "") && !/Acompte remboursé/i.test(b.notes ?? "");

  const handleRefund = async () => {
    if (!refundTarget) return;
    setRefunding(true);
    try {
      const { data, error } = await supabase.functions.invoke("refund-deposit", {
        body: { booking_id: refundTarget.id, cancel_booking: true },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({
        title: "Acompte remboursé",
        description: `${(data as any)?.amount ?? ""}€ remboursés à ${refundTarget.client_name}. Le rendez-vous est annulé.`,
      });
      setRefundTarget(null);
      await loadBookings();
    } catch (e: any) {
      toast({
        title: "Remboursement impossible",
        description: e?.message ?? "Erreur lors du remboursement.",
        variant: "destructive",
      });
    } finally {
      setRefunding(false);
    }
  };


  useEffect(() => {
    loadBookings();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      filterBookingsByDate(selectedDate);
    }
  }, [selectedDate, bookings]);

  const loadBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          services (
            name
          )
        `)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });

      if (error) throw error;
      setBookings(data || []);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les réservations.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterBookingsByDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const filtered = bookings.filter(
      booking => booking.appointment_date === dateStr
    );
    setSelectedDateBookings(filtered);
  };

  const isEventBooking = (b: Booking) => !!b.notes && /^\s*\[/.test(b.notes);

  const getBookingDates = () => {
    return bookings.filter(b => !isEventBooking(b)).map(b => new Date(b.appointment_date));
  };

  const getEventBookingDates = () => {
    return bookings.filter(isEventBooking).map(b => new Date(b.appointment_date));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-500';
      case 'pending':
        return 'bg-yellow-500';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'Confirmé';
      case 'pending':
        return 'En attente';
      case 'cancelled':
        return 'Annulé';
      default:
        return status;
    }
  };

  if (loading) {
    return <div>Chargement...</div>;
  }

  const searched = bookings.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [b.client_name, b.client_email, b.client_phone, b.client_address, b.services?.name, b.appointment_date]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Calendrier des réservations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            locale={fr}
            className="rounded-md border"
            modifiers={{
              booked: getBookingDates(),
              event: getEventBookingDates(),
            }}
            modifiersStyles={{
              booked: {
                fontWeight: 'bold',
                backgroundColor: 'hsl(var(--primary))',
                color: 'white',
              },
              event: {
                fontWeight: 'bold',
                backgroundColor: '#F97316',
                color: 'white',
              },
            }}
          />
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Légende</p>
            <div className="flex items-center gap-2 text-sm mb-1">
              <div className="w-4 h-4 rounded bg-primary"></div>
              <span className="text-muted-foreground">Réservations classiques</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#F97316' }}></div>
              <span className="text-muted-foreground">Réservations événement</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bookings for selected date */}
      <Card>
        <CardHeader>
          <CardTitle>
            {selectedDate
              ? `Réservations du ${format(selectedDate, 'd MMMM yyyy', { locale: fr })}`
              : 'Sélectionnez une date'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-h-[600px] overflow-y-auto">
            {selectedDateBookings.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                Aucune réservation pour cette date
              </div>
            ) : (
              selectedDateBookings.map((booking) => {
                const isEvent = isEventBooking(booking);
                const eventLabel = isEvent ? (booking.notes?.match(/^\s*\[([^\]]+)\]/)?.[1] ?? 'Événement') : null;
                return (
                <div
                  key={booking.id}
                  className="border rounded-lg p-4 space-y-3"
                  style={isEvent ? { borderLeft: '4px solid #F97316', backgroundColor: 'rgba(249,115,22,0.05)' } : undefined}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{booking.services?.name ?? 'Prestation'}</h3>
                      {isEvent && (
                        <span className="inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: '#F97316', color: 'white' }}>
                          🎉 {eventLabel}
                        </span>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{booking.appointment_time}</span>
                      </div>
                    </div>
                    <Badge className={getStatusColor(booking.status)}>
                      {getStatusLabel(booking.status)}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{booking.client_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${booking.client_email}`} className="text-primary hover:underline">
                        {booking.client_email}
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${booking.client_phone}`} className="text-primary hover:underline">
                        {booking.client_phone}
                      </a>
                    </div>
                    {booking.client_address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <span className="text-muted-foreground">{booking.client_address}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Prix total</span>
                      <span className="font-semibold">{booking.total_price}€</span>
                    </div>
                    {booking.travel_fee > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Frais de déplacement</span>
                        <span>{booking.travel_fee}€</span>
                      </div>
                    )}
                  </div>

                  {booking.notes && (
                    <div className="pt-3 border-t">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Notes : </span>
                        {booking.notes}
                      </p>
                    </div>
                  )}

                  {canRefund(booking) && (
                    <div className="pt-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setRefundTarget(booking)}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Rembourser l'acompte
                      </Button>
                    </div>
                  )}
                  {booking.deposit_paid === false && /Acompte remboursé/i.test(booking.notes ?? "") && (
                    <p className="pt-2 text-xs text-muted-foreground">Acompte déjà remboursé</p>
                  )}
                </div>

                );
              })

            )}
          </div>
        </CardContent>
      </Card>
    </div>

      {/* Liste complète : aucune réservation ne peut être invisible */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span>Toutes les réservations ({bookings.length})</span>
            <Input
              placeholder="Rechercher un client, un email, une date..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sm:max-w-xs"
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[500px] overflow-y-auto divide-y">
            {searched.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">Aucune réservation trouvée</p>
            ) : (
              searched.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedDate(new Date(b.appointment_date))}
                  className="w-full text-left py-3 flex items-center justify-between gap-3 hover:bg-muted/50 px-2 rounded"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{b.client_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {format(new Date(b.appointment_date), 'd MMM yyyy', { locale: fr })} · {b.appointment_time?.slice(0, 5)} · {b.services?.name ?? 'Prestation'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold">{b.total_price}€</span>
                    <Badge className={getStatusColor(b.status)}>{getStatusLabel(b.status)}</Badge>
                  </div>
                </button>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!refundTarget} onOpenChange={(o) => !o && setRefundTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rembourser l'acompte ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'acompte de {refundTarget?.client_name} sera remboursé via Stripe, le rendez-vous
              sera annulé et le client recevra un email d'information. Action irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={refunding}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleRefund();
              }}
              disabled={refunding}
            >
              {refunding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmer le remboursement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

  );
};
