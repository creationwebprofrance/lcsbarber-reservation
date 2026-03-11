import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Users, DollarSign, Calendar, Phone, Clock, Save, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const ADMIN_EMAIL = "lucas.chipan97@gmail.com";

interface ClientStat {
  key: string;
  client_email: string;
  client_name: string;
  client_phone: string;
  total_bookings: number;
  total_spent: number;
  avg_spent: number;
  services: string[];
  last_service: string;
  last_date: string;
  avg_days_between: number | null;
  dates: string[];
}

export const ClientStats = () => {
  const [stats, setStats] = useState<ClientStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalClients, setTotalClients] = useState(0);
  const [selectedClient, setSelectedClient] = useState<ClientStat | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          id,
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
        // For admin email, group by client_name; otherwise by email
        const groupKey = email === ADMIN_EMAIL
          ? `name:${booking.client_name?.toLowerCase().trim()}`
          : `email:${email}`;

        if (!clientMap.has(groupKey)) {
          clientMap.set(groupKey, {
            key: groupKey,
            client_email: email,
            client_name: booking.client_name,
            client_phone: booking.client_phone || "Non renseigné",
            total_bookings: 0,
            total_spent: 0,
            avg_spent: 0,
            services: [],
            last_service: booking.services?.name || "—",
            last_date: booking.appointment_date,
            avg_days_between: null,
            dates: [],
          });
        }

        const client = clientMap.get(groupKey)!;
        client.total_bookings += 1;
        client.total_spent += Number(booking.total_price);
        client.dates.push(booking.appointment_date);

        const serviceName = booking.services?.name;
        if (serviceName && !client.services.includes(serviceName)) {
          client.services.push(serviceName);
        }
      });

      const statsArray = Array.from(clientMap.values())
        .map(c => {
          // Calculate average days between cuts
          let avgDays: number | null = null;
          if (c.dates.length >= 2) {
            const sorted = [...c.dates].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
            let totalDiff = 0;
            for (let i = 1; i < sorted.length; i++) {
              totalDiff += differenceInDays(new Date(sorted[i]), new Date(sorted[i - 1]));
            }
            avgDays = Math.round(totalDiff / (sorted.length - 1));
          }
          return {
            ...c,
            avg_spent: c.total_bookings > 0 ? c.total_spent / c.total_bookings : 0,
            avg_days_between: avgDays,
          };
        })
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

  const openClientDialog = (client: ClientStat) => {
    setSelectedClient(client);
    setEditName(client.client_name);
    setEditPhone(client.client_phone === "Non renseigné" ? "" : client.client_phone);
    setEditEmail(client.client_email);
  };

  const handleSave = async () => {
    if (!selectedClient) return;
    setSaving(true);
    try {
      const isAdminGrouped = selectedClient.key.startsWith("name:");

      // Build the update query matching all bookings for this client
      let query = supabase.from('bookings').update({
        client_name: editName.trim(),
        client_phone: editPhone.trim(),
        client_email: editEmail.trim(),
      });

      if (isAdminGrouped) {
        query = query
          .eq('client_email', ADMIN_EMAIL)
          .ilike('client_name', selectedClient.client_name);
      } else {
        query = query.eq('client_email', selectedClient.client_email);
      }

      const { error } = await query;
      if (error) throw error;

      // Also update clients table if exists
      await supabase
        .from('clients')
        .update({
          name: editName.trim(),
          phone: editPhone.trim(),
          email: editEmail.trim(),
        })
        .eq('email', selectedClient.client_email);

      toast({ title: "Succès", description: "Fiche client mise à jour." });
      setSelectedClient(null);
      loadStats();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
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
              {stats.reduce((sum, c) => sum + c.total_bookings, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((client) => (
          <Card key={client.key} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle
                  className="text-base cursor-pointer hover:underline text-primary"
                  onClick={() => openClientDialog(client)}
                >
                  {client.client_name}
                </CardTitle>
                <Pencil
                  className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-primary"
                  onClick={() => openClientDialog(client)}
                />
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

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Délai moyen
                </span>
                <span className="font-medium">
                  {client.avg_days_between !== null ? `${client.avg_days_between} jours` : "—"}
                </span>
              </div>

              <div className="flex flex-wrap gap-1 pt-1">
                {client.services.map((s) => (
                  <Badge key={s} variant="secondary" className="text-xs">
                    {s}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.length === 0 && (
        <div className="text-center text-muted-foreground py-8">Aucun client trouvé</div>
      )}

      {/* Edit dialog */}
      <Dialog open={selectedClient !== null} onOpenChange={(open) => !open && setSelectedClient(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fiche client — {selectedClient?.client_name}</DialogTitle>
          </DialogHeader>
          {selectedClient && (
            <div className="space-y-4">
              {/* Stats summary */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/50">
                <div className="text-sm">
                  <span className="text-muted-foreground">RDV total : </span>
                  <span className="font-semibold">{selectedClient.total_bookings}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Total dépensé : </span>
                  <span className="font-semibold">{selectedClient.total_spent.toFixed(2)}€</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Moyenne : </span>
                  <span className="font-semibold">{selectedClient.avg_spent.toFixed(2)}€</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Délai moyen : </span>
                  <span className="font-semibold">
                    {selectedClient.avg_days_between !== null ? `${selectedClient.avg_days_between} j` : "—"}
                  </span>
                </div>
                <div className="text-sm col-span-2">
                  <span className="text-muted-foreground">Dernière presta. : </span>
                  <span className="font-semibold">{selectedClient.last_service}</span>
                  {selectedClient.last_date && (
                    <span className="text-muted-foreground ml-1">
                      ({format(new Date(selectedClient.last_date), "d MMM yyyy", { locale: fr })})
                    </span>
                  )}
                </div>
                <div className="col-span-2 flex flex-wrap gap-1">
                  {selectedClient.services.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                  ))}
                </div>
              </div>

              {/* Editable fields */}
              <div className="space-y-3">
                <div>
                  <Label>Nom</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div>
                  <Label>Téléphone</Label>
                  <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} type="email" />
                </div>
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
