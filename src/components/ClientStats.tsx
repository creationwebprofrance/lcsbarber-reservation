import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, DollarSign, Calendar } from "lucide-react";

interface ClientStat {
  client_email: string;
  client_name: string;
  total_bookings: number;
  total_spent: number;
  services: string[];
}

export const ClientStats = () => {
  const [stats, setStats] = useState<ClientStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalClients, setTotalClients] = useState(0);

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
          total_price,
          service_id,
          services (name)
        `)
        .order('client_email');

      if (error) throw error;

      // Agréger les données par client
      const clientMap = new Map<string, ClientStat>();

      bookings?.forEach((booking: any) => {
        const email = booking.client_email;
        if (!clientMap.has(email)) {
          clientMap.set(email, {
            client_email: email,
            client_name: booking.client_name,
            total_bookings: 0,
            total_spent: 0,
            services: []
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

      <Card>
        <CardHeader>
          <CardTitle>Détail par client</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-center">Rendez-vous</TableHead>
                <TableHead>Prestations</TableHead>
                <TableHead className="text-right">Total dépensé</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map((client) => (
                <TableRow key={client.client_email}>
                  <TableCell className="font-medium">{client.client_name}</TableCell>
                  <TableCell>{client.client_email}</TableCell>
                  <TableCell className="text-center">{client.total_bookings}</TableCell>
                  <TableCell>{client.services.join(', ')}</TableCell>
                  <TableCell className="text-right font-medium">
                    {client.total_spent.toFixed(2)}€
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
