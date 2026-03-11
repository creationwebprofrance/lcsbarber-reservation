import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, Calendar, Phone, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ClientStat {
  client_email: string;
  client_name: string;
  client_phone: string;
  total_bookings: number;
  total_spent: number;
  avg_spent: number;
  services: string[];
  last_service: string;
  last_date: string;
}

export const ClientStats = () => {
  const [stats, setStats] = useState<ClientStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalClients, setTotalClients] = useState(0);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          client_email,
          client_name,
          client_phone,
          total_price,
          service_id,
          appointment_date,
          services (name)
        `)
        .order('appointment_date', { ascending: false });

      if (error) throw error;

      const clientMap = new Map<string, ClientStat>();

      bookings?.forEach((booking: any) => {
        const email = booking.client_email;
        if (!clientMap.has(email)) {
          clientMap.set(email, {
            client_email: email,
            client_name: booking.client_name,
            client_phone: booking.client_phone || "Non renseigné",
            total_bookings: 0,
            total_spent: 0,
            avg_spent: 0,
            services: [],
            last_service: booking.services?.name || "—",
            last_date: booking.appointment_date,
          });
        }

        const client = clientMap.get(email)!;
        client.total_bookings += 1;
        client.total_spent += Number(booking.total_price);

        const serviceName = booking.services?.name;
        if (serviceName && !client.services.includes(serviceName)) {
          client.services.push(serviceName);
        }
      });

      const statsArray = Array.from(clientMap.values())
        .map(c => ({ ...c, avg_spent: c.total_bookings > 0 ? c.total_spent / c.total_bookings : 0 }))
        .sort((a, b) => b.total_spent - a.total_spent);

      setStats(statsArray);
      setTotalClients(statsArray.length);
      setTotalRevenue(statsArray.reduce((sum, client) => sum + client.total_spent, 0));
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-4">Chargement des statistiques...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClients}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chiffre d'affaires</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRevenue.toFixed(2)}€</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rendez-vous</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.reduce((sum, client) => sum + client.total_bookings, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((client) => {
          const isExpanded = expandedClient === client.client_email;
          return (
            <Card
              key={client.client_email}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setExpandedClient(isExpanded ? null : client.client_email)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{client.client_name}</CardTitle>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {client.client_phone}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-lg font-bold">{client.total_bookings}</div>
                    <div className="text-xs text-muted-foreground">RDV</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold">{client.avg_spent.toFixed(0)}€</div>
                    <div className="text-xs text-muted-foreground">Moy.</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold">{client.total_spent.toFixed(0)}€</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Dernière presta.</span>
                  <span className="font-medium">{client.last_service}</span>
                </div>

                {client.last_date && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Dernier RDV</span>
                    <span className="font-medium">
                      {format(new Date(client.last_date), "d MMM yyyy", { locale: fr })}
                    </span>
                  </div>
                )}

                {isExpanded && (
                  <div className="pt-2 border-t space-y-2">
                    <div className="text-sm text-muted-foreground">{client.client_email}</div>
                    <div className="flex flex-wrap gap-1">
                      {client.services.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {stats.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          Aucun client trouvé
        </div>
      )}
    </div>
  );
};
