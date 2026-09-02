import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Calendar, Clock, Scissors, MapPin, Euro } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import lcsBarberLogo from "@/assets/lcs-barber-logo.png";

interface ClientBooking {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  total_price: number;
  travel_fee: number | null;
  client_address: string | null;
  notes: string | null;
  service: { name: string } | null;
}

const statusLabel: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmé",
  cancelled: "Annulé",
  completed: "Terminé",
};

export default function MesRendezVous() {
  const { user, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<ClientBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) return;
    supabase
      .from("bookings")
      .select("id, appointment_date, appointment_time, status, total_price, travel_fee, client_address, notes, service:services(name)")
      .order("appointment_date", { ascending: false })
      .then(({ data }) => {
        setBookings((data as unknown as ClientBooking[]) || []);
        setLoading(false);
      });
  }, [user?.email]);

  const today = startOfDay(new Date());
  const upcoming = bookings
    .filter((b) => !isBefore(parseISO(b.appointment_date), today) && b.status !== "cancelled")
    .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date));
  const past = bookings.filter(
    (b) => isBefore(parseISO(b.appointment_date), today) || b.status === "cancelled"
  );

  const totalSpent = bookings
    .filter((b) => b.status !== "cancelled")
    .reduce((s, b) => s + Number(b.total_price), 0);

  const eventName = (notes: string | null) => notes?.match(/^\[(.+?)\]/)?.[1] ?? null;

  const BookingCard = ({ b }: { b: ClientBooking }) => {
    const event = eventName(b.notes);
    return (
      <Card className="border-border/60">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Scissors className="h-4 w-4 text-primary" />
                <span className="font-semibold text-foreground">{b.service?.name ?? "Prestation"}</span>
                {event && (
                  <Badge variant="outline" className="border-primary/60 text-primary text-[10px]">
                    🎉 {event}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" />
                {format(parseISO(b.appointment_date), "EEEE d MMMM yyyy", { locale: fr })}
                <Clock className="h-3.5 w-3.5 ml-2" />
                {b.appointment_time.slice(0, 5)}
              </p>
              {b.client_address && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" /> {b.client_address}
                </p>
              )}
            </div>
            <div className="text-right space-y-2">
              <Badge variant={b.status === "cancelled" ? "destructive" : "secondary"}>
                {statusLabel[b.status] ?? b.status}
              </Badge>
              <p className="text-lg font-bold text-foreground">{Number(b.total_price).toFixed(0)} €</p>
            </div>
          </div>
          {b.status !== "cancelled" && (
            <LiveTrackingPanel
              bookingId={b.id}
              role="client"
              appointmentDate={b.appointment_date}
              appointmentTime={b.appointment_time}
              peerLabel="LCS Barber"
            />
          )}
        </CardContent>
      </Card>
    );
  };


  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/70 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-5xl mx-auto px-5 py-3 flex justify-between items-center">
          <Link to="/" className="shrink-0">
            <img src={lcsBarberLogo} alt="LCS Barber" className="h-16 sm:h-20" />
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Retour
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 pt-32 pb-20">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">Mon suivi</h1>
        <p className="text-muted-foreground mb-8">
          Retrouve toutes tes coupes et tes rendez-vous chez LCS Barber.
        </p>

        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { label: "Coupes réalisées", value: past.filter((b) => b.status !== "cancelled").length, icon: Scissors },
            { label: "RDV à venir", value: upcoming.length, icon: Calendar },
            { label: "Total dépensé", value: `${totalSpent.toFixed(0)} €`, icon: Euro },
          ].map((s) => (
            <Card key={s.label} className="border-border/60">
              <CardContent className="p-4 text-center">
                <s.icon className="h-4 w-4 text-primary mx-auto mb-2" />
                <div className="text-xl sm:text-2xl font-bold text-foreground">{s.value}</div>
                <div className="text-[11px] text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {authLoading || loading ? (
          <p className="text-muted-foreground">Chargement...</p>
        ) : !user ? (
          <Card className="border-border/60">
            <CardContent className="p-8 text-center space-y-4">
              <p className="text-muted-foreground">Connecte-toi pour voir tes rendez-vous.</p>
              <Button asChild><Link to="/auth">Se connecter</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="upcoming">
            <TabsList className="mb-6">
              <TabsTrigger value="upcoming">À venir ({upcoming.length})</TabsTrigger>
              <TabsTrigger value="past">Historique ({past.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="upcoming" className="space-y-4">
              {upcoming.length === 0 ? (
                <Card className="border-border/60">
                  <CardContent className="p-8 text-center space-y-4">
                    <p className="text-muted-foreground">Aucun rendez-vous à venir.</p>
                    <Button asChild><Link to="/reservation">Réserver un créneau</Link></Button>
                  </CardContent>
                </Card>
              ) : (
                upcoming.map((b) => <BookingCard key={b.id} b={b} />)
              )}
            </TabsContent>
            <TabsContent value="past" className="space-y-4">
              {past.length === 0 ? (
                <p className="text-muted-foreground">Pas encore d'historique.</p>
              ) : (
                past.map((b) => <BookingCard key={b.id} b={b} />)
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
