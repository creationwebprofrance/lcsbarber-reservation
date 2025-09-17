import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Users, Euro, CheckCircle2, TrendingUp, Clock } from "lucide-react";
import { Link } from "react-router-dom";

const Dashboard = () => {
  // Données mockées - seront remplacées par des vraies données de Supabase
  const mockStats = {
    totalBookings: 24,
    totalRevenue: 1240,
    confirmedBookings: 18,
    pendingBookings: 6,
    todayBookings: 3,
    monthlyGrowth: 15.2
  };

  const mockRecentBookings = [
    {
      id: 1,
      clientName: "Marie Dupont",
      service: "Coupe + Barbe",
      date: "2024-01-15",
      time: "14:30",
      price: 65,
      status: "Confirmé",
      deposit: 32.5
    },
    {
      id: 2,
      clientName: "Pierre Martin",
      service: "Coupe",
      date: "2024-01-15",
      time: "16:00",
      price: 45,
      status: "En attente",
      deposit: 22.5
    },
    {
      id: 3,
      clientName: "Sophie Leroy",
      service: "Coupe enfant",
      date: "2024-01-14",
      time: "10:00",
      price: 25,
      status: "Confirmé",
      deposit: 12.5
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-secondary p-4">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="mb-2 text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Dashboard Coiffure
            </h1>
            <p className="text-muted-foreground">
              Gérez vos rendez-vous et suivez votre activité
            </p>
          </div>
          <Link to="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour aux réservations
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-card shadow-card border-border/50 backdrop-blur-sm">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Réservations
                  </p>
                  <p className="text-3xl font-bold">{mockStats.totalBookings}</p>
                </div>
                <div className="rounded-full bg-primary/20 p-3">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-card shadow-card border-border/50 backdrop-blur-sm">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Chiffre d'Affaires
                  </p>
                  <p className="text-3xl font-bold">{mockStats.totalRevenue}€</p>
                </div>
                <div className="rounded-full bg-success/20 p-3">
                  <Euro className="h-6 w-6 text-success" />
                </div>
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-card shadow-card border-border/50 backdrop-blur-sm">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    RDV Confirmés
                  </p>
                  <p className="text-3xl font-bold">{mockStats.confirmedBookings}</p>
                </div>
                <div className="rounded-full bg-success/20 p-3">
                  <CheckCircle2 className="h-6 w-6 text-success" />
                </div>
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-card shadow-card border-border/50 backdrop-blur-sm">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Croissance
                  </p>
                  <p className="text-3xl font-bold">+{mockStats.monthlyGrowth}%</p>
                </div>
                <div className="rounded-full bg-primary/20 p-3">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Bookings */}
        <Card className="bg-gradient-card shadow-card border-border/50 backdrop-blur-sm">
          <div className="p-6">
            <h2 className="mb-6 text-xl font-semibold">Réservations Récentes</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                      Client
                    </th>
                    <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                      Service
                    </th>
                    <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                      Date & Heure
                    </th>
                    <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                      Prix
                    </th>
                    <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                      Acompte
                    </th>
                    <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                      Statut
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mockRecentBookings.map((booking) => (
                    <tr key={booking.id} className="border-b border-border/50">
                      <td className="py-4 font-medium">{booking.clientName}</td>
                      <td className="py-4 text-muted-foreground">{booking.service}</td>
                      <td className="py-4 text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {booking.date}
                          <Clock className="h-4 w-4 ml-2" />
                          {booking.time}
                        </div>
                      </td>
                      <td className="py-4 font-semibold">{booking.price}€</td>
                      <td className="py-4 text-success font-semibold">{booking.deposit}€</td>
                      <td className="py-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            booking.status === "Confirmé"
                              ? "bg-success/20 text-success"
                              : "bg-warning/20 text-warning"
                          }`}
                        >
                          {booking.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        {/* Note about real data */}
        <Card className="mt-6 bg-warning/10 border-warning/20">
          <div className="p-4">
            <p className="text-sm text-warning-foreground">
              <strong>Note:</strong> Ceci est un dashboard avec des données de démonstration. 
              Pour afficher les vraies données de réservation, vous devez connecter votre projet à Supabase 
              via l'intégration native de Lovable.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;