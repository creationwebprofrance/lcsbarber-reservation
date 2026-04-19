import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Users, DollarSign, Calendar, Clock, Save, Ban, Undo2, AlertTriangle, Euro, ChevronDown, ChevronUp, Trash2, MapPin, Phone, StickyNote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface BookingDetail {
  id: string;
  appointment_date: string;
  appointment_time: string;
  service_name: string;
  total_price: number;
  travel_fee: number;
  status: string;
  notes: string | null;
  client_address: string | null;
  client_phone: string;
  client_email: string;
  deposit_paid: boolean;
}

interface ClientStat {
  key: string;
  client_emails: string[];
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
  is_blacklisted: boolean;
  unpaid_amount: number;
  bookings: BookingDetail[];
}

interface MergeRecord {
  id: string;
  merged_email: string;
  target_email: string;
  original_client_name: string;
  created_at: string;
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
  const [editUnpaid, setEditUnpaid] = useState("0");
  const [saving, setSaving] = useState(false);
  const [mergeRecords, setMergeRecords] = useState<MergeRecord[]>([]);
  const [unmergeTarget, setUnmergeTarget] = useState<MergeRecord | null>(null);
  const [showBookings, setShowBookings] = useState(true);
  const [bookingToDelete, setBookingToDelete] = useState<BookingDetail | null>(null);

  // Drag & drop merge
  const [draggedClient, setDraggedClient] = useState<ClientStat | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [mergeConfirm, setMergeConfirm] = useState<{ source: ClientStat; target: ClientStat } | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    loadStats();
    loadMergeRecords();
  }, []);

  const loadMergeRecords = async () => {
    const { data } = await supabase
      .from('client_merges')
      .select('*')
      .order('created_at', { ascending: false });
    setMergeRecords(data || []);
  };

  const loadStats = async () => {
    try {
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`id, client_email, client_name, client_phone, client_address, total_price, travel_fee, service_id, appointment_date, appointment_time, status, notes, deposit_paid, services (name)`)
        .order('appointment_date', { ascending: false });

      if (error) throw error;

      const { data: clientsData } = await supabase.from('clients').select('email, is_blacklisted, unpaid_amount');
      const clientInfoMap = new Map<string, { is_blacklisted: boolean; unpaid_amount: number }>();
      clientsData?.forEach((c: any) => {
        clientInfoMap.set(c.email, { is_blacklisted: c.is_blacklisted || false, unpaid_amount: Number(c.unpaid_amount) || 0 });
      });

      const clientMap = new Map<string, ClientStat>();

      bookings?.forEach((booking: any) => {
        const email = booking.client_email;
        const name = booking.client_name?.trim().toLowerCase() || "";
        // Group by BOTH email AND name
        const groupKey = `${email}::${name}`;

        if (!clientMap.has(groupKey)) {
          const info = clientInfoMap.get(email);
          clientMap.set(groupKey, {
            key: groupKey,
            client_emails: [email],
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
            is_blacklisted: info?.is_blacklisted || false,
            unpaid_amount: info?.unpaid_amount || 0,
            bookings: [],
          });
        }

        const client = clientMap.get(groupKey)!;
        client.total_bookings += 1;
        client.total_spent += Number(booking.total_price);
        client.dates.push(booking.appointment_date);
        if (!client.client_emails.includes(email)) {
          client.client_emails.push(email);
        }
        const serviceName = booking.services?.name;
        if (serviceName && !client.services.includes(serviceName)) {
          client.services.push(serviceName);
        }
        client.bookings.push({
          id: booking.id,
          appointment_date: booking.appointment_date,
          appointment_time: booking.appointment_time,
          service_name: booking.services?.name || "—",
          total_price: Number(booking.total_price),
          travel_fee: Number(booking.travel_fee) || 0,
          status: booking.status,
          notes: booking.notes,
          client_address: booking.client_address,
          client_phone: booking.client_phone || "",
          client_email: booking.client_email,
          deposit_paid: !!booking.deposit_paid,
        });
      });

      const statsArray = Array.from(clientMap.values())
        .map(c => {
          let avgDays: number | null = null;
          if (c.dates.length >= 2) {
            const sorted = [...c.dates].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
            let totalDiff = 0;
            for (let i = 1; i < sorted.length; i++) {
              totalDiff += differenceInDays(new Date(sorted[i]), new Date(sorted[i - 1]));
            }
            avgDays = Math.round(totalDiff / (sorted.length - 1));
          }
          return { ...c, avg_spent: c.total_bookings > 0 ? c.total_spent / c.total_bookings : 0, avg_days_between: avgDays };
        })
        .sort((a, b) => b.total_spent - a.total_spent);

      setStats(statsArray);
      setTotalClients(statsArray.length);
      setTotalRevenue(statsArray.reduce((sum, c) => sum + c.total_spent, 0));
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
    setEditEmail(client.client_emails[0]);
    setEditUnpaid(String(client.unpaid_amount));
    setShowBookings(true);
  };

  const handleSave = async () => {
    if (!selectedClient) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('bookings').update({
        client_name: editName.trim(),
        client_phone: editPhone.trim(),
        client_email: editEmail.trim(),
      }).eq('client_email', selectedClient.client_emails[0])
        .ilike('client_name', selectedClient.client_name);

      if (error) throw error;

      // Upsert client info
      const { data: existing } = await supabase.from('clients').select('id').eq('email', selectedClient.client_emails[0]).maybeSingle();
      if (existing) {
        await supabase.from('clients').update({
          name: editName.trim(),
          phone: editPhone.trim(),
          email: editEmail.trim(),
          unpaid_amount: Number(editUnpaid) || 0,
        }).eq('id', existing.id);
      } else {
        await supabase.from('clients').insert({
          name: editName.trim(),
          phone: editPhone.trim(),
          email: editEmail.trim(),
          unpaid_amount: Number(editUnpaid) || 0,
        });
      }

      toast({ title: "Succès", description: "Fiche client mise à jour." });
      setSelectedClient(null);
      loadStats();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleBlacklist = async (client: ClientStat) => {
    const email = client.client_emails[0];
    const newVal = !client.is_blacklisted;
    const { data: existing } = await supabase.from('clients').select('id').eq('email', email).maybeSingle();
    if (existing) {
      await supabase.from('clients').update({ is_blacklisted: newVal }).eq('id', existing.id);
    } else {
      await supabase.from('clients').insert({ name: client.client_name, email, is_blacklisted: newVal });
    }
    toast({ title: newVal ? "Client blacklisté" : "Client retiré de la blacklist" });
    loadStats();
    if (selectedClient?.key === client.key) {
      setSelectedClient({ ...client, is_blacklisted: newVal });
    }
  };

  // Drag & drop handlers
  const handleDragStart = (e: React.DragEvent, client: ClientStat) => {
    setDraggedClient(client);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, clientKey: string) => {
    e.preventDefault();
    if (draggedClient && draggedClient.key !== clientKey) {
      setDropTarget(clientKey);
    }
  };

  const handleDragLeave = () => setDropTarget(null);

  const handleDrop = (e: React.DragEvent, target: ClientStat) => {
    e.preventDefault();
    setDropTarget(null);
    if (draggedClient && draggedClient.key !== target.key) {
      setMergeConfirm({ source: draggedClient, target });
    }
    setDraggedClient(null);
  };

  const handleDragEnd = () => { setDraggedClient(null); setDropTarget(null); };

  const handleMerge = async () => {
    if (!mergeConfirm) return;
    const { source, target } = mergeConfirm;
    try {
      const sourceEmail = source.client_emails[0];
      const targetEmail = target.client_emails[0];

      await supabase.from('client_merges').insert({
        merged_email: sourceEmail,
        target_email: targetEmail,
        original_client_name: source.client_name,
      });

      await supabase.from('bookings').update({
        client_email: targetEmail,
        client_name: target.client_name,
      }).eq('client_email', sourceEmail);

      await supabase.from('clients').delete().eq('email', sourceEmail);

      toast({ title: "Fusionné", description: `"${source.client_name}" fusionné dans "${target.client_name}".` });
      setMergeConfirm(null);
      loadStats();
      loadMergeRecords();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const handleUnmerge = async () => {
    if (!unmergeTarget) return;
    try {
      await supabase.from('bookings').update({
        client_email: unmergeTarget.merged_email,
        client_name: unmergeTarget.original_client_name,
      }).eq('client_email', unmergeTarget.target_email)
        .ilike('client_name', unmergeTarget.original_client_name);

      await supabase.from('client_merges').delete().eq('id', unmergeTarget.id);

      toast({ title: "Défusionné", description: `"${unmergeTarget.original_client_name}" a été restauré.` });
      setUnmergeTarget(null);
      loadStats();
      loadMergeRecords();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteBooking = async () => {
    if (!bookingToDelete) return;
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', bookingToDelete.id);
      if (error) throw error;
      toast({ title: "Réservation supprimée", description: "Le rendez-vous a été retiré." });

      // Update selected client locally
      if (selectedClient) {
        const updatedBookings = selectedClient.bookings.filter(b => b.id !== bookingToDelete.id);
        const newTotal = updatedBookings.reduce((sum, b) => sum + b.total_price, 0);
        setSelectedClient({
          ...selectedClient,
          bookings: updatedBookings,
          total_bookings: updatedBookings.length,
          total_spent: newTotal,
          avg_spent: updatedBookings.length > 0 ? newTotal / updatedBookings.length : 0,
        });
      }
      setBookingToDelete(null);
      loadStats();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  if (loading) return <div className="p-4">Chargement des statistiques...</div>;

  return (
    <div className="space-y-6">
      {/* Merge history */}
      {mergeRecords.length > 0 && (
        <Card className="border-blue-500/50 bg-blue-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Undo2 className="h-4 w-4" />
              Fusions récentes ({mergeRecords.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {mergeRecords.map((rec) => (
              <div key={rec.id} className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm">
                <span>
                  <strong>{rec.original_client_name}</strong>
                  <span className="text-muted-foreground"> ({rec.merged_email}) → {rec.target_email}</span>
                </span>
                <Button size="sm" variant="outline" onClick={() => setUnmergeTarget(rec)}>
                  <Undo2 className="h-3 w-3 mr-1" /> Défusionner
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalClients}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chiffre d'affaires</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalRevenue.toFixed(2)}€</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rendez-vous</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.reduce((sum, c) => sum + c.total_bookings, 0)}</div></CardContent>
        </Card>
      </div>

      <p className="text-sm text-muted-foreground text-center">
        💡 Glissez-déposez un client sur un autre pour les fusionner
      </p>

      {/* Client list */}
      <Card>
        <CardHeader><CardTitle>Clients ({stats.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {stats.map((client) => (
              <div
                key={client.key}
                draggable
                onDragStart={(e) => handleDragStart(e, client)}
                onDragOver={(e) => handleDragOver(e, client.key)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, client)}
                onDragEnd={handleDragEnd}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-grab active:cursor-grabbing transition-all
                  ${dropTarget === client.key ? "ring-2 ring-primary bg-primary/10 scale-[1.02]" : ""}
                  ${client.is_blacklisted ? "bg-destructive/10 border-destructive/30" : "hover:bg-accent/50"}
                  ${client.unpaid_amount > 0 ? "border-orange-400/50" : ""}
                `}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {client.is_blacklisted && <Ban className="h-4 w-4 text-destructive shrink-0" />}
                  <span
                    className="font-medium text-primary hover:underline truncate cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); openClientDialog(client); }}
                  >
                    {client.client_name}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {client.unpaid_amount > 0 && (
                    <Badge variant="outline" className="text-xs border-orange-400 text-orange-600">
                      {client.unpaid_amount}€ dû
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-xs">{client.total_bookings} RDV</Badge>
                </div>
              </div>
            ))}
          </div>
          {stats.length === 0 && (
            <div className="text-center text-muted-foreground py-8">Aucun client trouvé</div>
          )}
        </CardContent>
      </Card>

      {/* Client detail dialog */}
      <Dialog open={selectedClient !== null} onOpenChange={(open) => !open && setSelectedClient(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedClient?.is_blacklisted && <Ban className="h-5 w-5 text-destructive" />}
              Fiche client — {selectedClient?.client_name}
            </DialogTitle>
          </DialogHeader>
          {selectedClient && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/50">
                <div className="text-sm">
                  <span className="text-muted-foreground">RDV : </span>
                  <span className="font-semibold">{selectedClient.total_bookings}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Total : </span>
                  <span className="font-semibold">{selectedClient.total_spent.toFixed(2)}€</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Moyenne : </span>
                  <span className="font-semibold">{selectedClient.avg_spent.toFixed(2)}€</span>
                </div>
                <div className="text-sm flex items-center gap-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Délai : </span>
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

              {/* Booking history */}
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between"
                  onClick={() => setShowBookings(!showBookings)}
                >
                  <span>Historique des RDV ({selectedClient.bookings.length})</span>
                  {showBookings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                {showBookings && (
                  <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                    {selectedClient.bookings.map((b) => (
                      <div key={b.id} className="flex items-center justify-between p-2 rounded text-sm bg-muted/30 border">
                        <div className="min-w-0">
                          <span className="font-medium">{b.service_name}</span>
                          <span className="text-muted-foreground ml-2">
                            {format(new Date(b.appointment_date), "d MMM yyyy", { locale: fr })} à {b.appointment_time?.slice(0, 5)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={b.status === "confirmed" ? "default" : b.status === "cancelled" ? "destructive" : "secondary"} className="text-xs">
                            {b.status}
                          </Badge>
                          <span className="font-semibold">{b.total_price.toFixed(2)}€</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                <div>
                  <Label className="flex items-center gap-1">
                    <Euro className="h-3 w-3" /> Montant impayé
                  </Label>
                  <Input value={editUnpaid} onChange={(e) => setEditUnpaid(e.target.value)} type="number" min="0" step="0.01" />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </Button>
                <Button
                  variant={selectedClient.is_blacklisted ? "outline" : "destructive"}
                  onClick={() => toggleBlacklist(selectedClient)}
                >
                  <Ban className="h-4 w-4 mr-1" />
                  {selectedClient.is_blacklisted ? "Retirer" : "Blacklist"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Merge confirmation */}
      <AlertDialog open={mergeConfirm !== null} onOpenChange={(open) => !open && setMergeConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fusionner ces clients ?</AlertDialogTitle>
            <AlertDialogDescription>
              {mergeConfirm && (
                <>
                  <strong>{mergeConfirm.source.client_name}</strong> ({mergeConfirm.source.total_bookings} RDV)
                  sera fusionné dans <strong>{mergeConfirm.target.client_name}</strong> ({mergeConfirm.target.total_bookings} RDV).
                  <p className="mt-2 text-sm">Toutes les réservations seront regroupées sous l'email <strong>{mergeConfirm.target.client_emails[0]}</strong>.</p>
                  <p className="mt-1 text-sm text-muted-foreground">Vous pourrez défusionner ensuite.</p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleMerge}>Fusionner</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unmerge confirmation */}
      <AlertDialog open={unmergeTarget !== null} onOpenChange={(open) => !open && setUnmergeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Défusionner ce client ?</AlertDialogTitle>
            <AlertDialogDescription>
              {unmergeTarget && (
                <>
                  <strong>{unmergeTarget.original_client_name}</strong> sera restauré avec l'email <strong>{unmergeTarget.merged_email}</strong>.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnmerge}>Défusionner</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
