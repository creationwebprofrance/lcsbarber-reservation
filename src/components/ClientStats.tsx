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
  // Compte utilisateur lié (identifié par l'email)
  account_user_id: string | null;
  account_role: string | null;
  account_created_at: string | null;
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
  const [editAddress, setEditAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [mergeRecords, setMergeRecords] = useState<MergeRecord[]>([]);
  const [unmergeTarget, setUnmergeTarget] = useState<MergeRecord | null>(null);
  const [showBookings, setShowBookings] = useState(true);
  const [bookingToDelete, setBookingToDelete] = useState<BookingDetail | null>(null);
  const [search, setSearch] = useState("");
  const [accountToDelete, setAccountToDelete] = useState<ClientStat | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Drag & drop merge
  const [draggedClient, setDraggedClient] = useState<ClientStat | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [mergeConfirm, setMergeConfirm] = useState<{ source: ClientStat; target: ClientStat } | null>(null);

  // Sélection multiple pour fusion
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [multiMergeOpen, setMultiMergeOpen] = useState(false);
  const [multiTargetKey, setMultiTargetKey] = useState<string | null>(null);
  const [mergingMulti, setMergingMulti] = useState(false);

  // Comptes de fidélité
  const [loyaltyRunning, setLoyaltyRunning] = useState(false);
  const [loyaltyConfirm, setLoyaltyConfirm] = useState(false);



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

      // Comptes utilisateurs — identifiés par leur email
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, email, full_name, role, created_at');
      const profileMap = new Map<string, any>();
      profilesData?.forEach((p: any) => {
        if (p.email) profileMap.set(p.email.trim().toLowerCase(), p);
      });

      const clientMap = new Map<string, ClientStat>();
      const ADMIN_EMAIL = "lucas.chipan97@gmail.com";

      // Fusions enregistrées : les fiches fusionnées sont toujours regroupées
      const { data: mergesData } = await supabase.from('client_merges').select('merged_email, target_email');
      const mergeTo = new Map<string, string>();
      mergesData?.forEach((m: any) => {
        mergeTo.set((m.merged_email || "").trim().toLowerCase(), (m.target_email || "").trim().toLowerCase());
      });
      const resolveEmail = (email: string) => {
        let current = email;
        const seen = new Set<string>();
        while (mergeTo.has(current) && !seen.has(current)) {
          seen.add(current);
          current = mergeTo.get(current)!;
        }
        return current;
      };
      const mergedEmails = new Set<string>([
        ...Array.from(mergeTo.keys()),
        ...Array.from(mergeTo.values()),
      ]);

      const isGroupedAddress = (address: string | null) => {
        if (!address) return false;
        const normalized = address.trim().toLowerCase();
        return normalized.includes("louvres") || normalized.includes("4 square de banyuls");
      };

      bookings?.forEach((booking: any) => {
        const email = booking.client_email;
        const normalizedEmail = (email || "").trim().toLowerCase();
        const canonicalEmail = resolveEmail(normalizedEmail);
        // Pour l'admin et les adresses hors Louvres, chaque réservation est affichée individuellement
        const isAdminBooking = normalizedEmail === ADMIN_EMAIL;
        const isMerged = mergedEmails.has(normalizedEmail);
        const shouldGroup = (isMerged || isGroupedAddress(booking.client_address)) && !isAdminBooking;
        const groupKey = shouldGroup ? canonicalEmail : `single-${booking.id}`;


        if (!clientMap.has(groupKey)) {
          const info = clientInfoMap.get(email);
          const profile = profileMap.get(normalizedEmail);
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
            account_user_id: profile?.user_id || null,
            account_role: profile?.role || null,
            account_created_at: profile?.created_at || null,
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

      // Comptes sans aucune réservation : on les ajoute quand même à la liste
      const bookedEmails = new Set(
        Array.from(clientMap.values()).flatMap(c => c.client_emails.map(e => (e || "").trim().toLowerCase()))
      );
      profileMap.forEach((p, email) => {
        if (bookedEmails.has(email)) return;
        const info = clientInfoMap.get(p.email);
        clientMap.set(email, {
          key: email,
          client_emails: [p.email],

          client_name: p.full_name || p.email.split("@")[0],
          client_phone: "Non renseigné",
          total_bookings: 0,
          total_spent: 0,
          avg_spent: 0,
          services: [],
          last_service: "—",
          last_date: "",
          avg_days_between: null,
          dates: [],
          is_blacklisted: info?.is_blacklisted || false,
          unpaid_amount: info?.unpaid_amount || 0,
          bookings: [],
          account_user_id: p.user_id,
          account_role: p.role,
          account_created_at: p.created_at,
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
    setEditAddress(client.bookings.find(b => b.client_address)?.client_address || "");
    setShowBookings(true);
  };

  const handleSave = async () => {
    if (!selectedClient) return;
    setSaving(true);
    try {
      const isAdminBooking = selectedClient.key.startsWith("single-");
      const updatePayload = {
        client_name: editName.trim(),
        client_phone: editPhone.trim(),
        client_email: editEmail.trim(),
        client_address: editAddress.trim() || null,
      };

      const query = supabase.from('bookings').update(updatePayload);
      if (isAdminBooking && selectedClient.bookings.length === 1) {
        // Pour les réservations admin affichées individuellement, on ne modifie que ce RDV
        const { error } = await query.eq('id', selectedClient.bookings[0].id);
        if (error) throw error;
      } else {
        const { error } = await query.eq('client_email', selectedClient.client_emails[0])
          .ilike('client_name', selectedClient.client_name);
        if (error) throw error;
      }

      // Upsert client info
      const { data: existing } = await supabase.from('clients').select('id').eq('email', selectedClient.client_emails[0]).maybeSingle();
      if (existing) {
        await supabase.from('clients').update({
          name: editName.trim(),
          phone: editPhone.trim(),
          email: editEmail.trim(),
          address: editAddress.trim() || null,
          unpaid_amount: Number(editUnpaid) || 0,
        }).eq('id', existing.id);
      } else {
        await supabase.from('clients').insert({
          name: editName.trim(),
          phone: editPhone.trim(),
          email: editEmail.trim(),
          address: editAddress.trim() || null,
          unpaid_amount: Number(editUnpaid) || 0,
        });
      }

      // Synchroniser le profil du compte utilisateur lié (identifié par l'email)
      if (selectedClient.account_user_id) {
        await supabase.from('profiles').update({
          full_name: editName.trim(),
          email: editEmail.trim(),
        }).eq('user_id', selectedClient.account_user_id);
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

  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const handleMultiMerge = async () => {
    const selected = stats.filter(c => selectedKeys.includes(c.key));
    const target = selected.find(c => c.key === multiTargetKey);
    if (!target || selected.length < 2) return;
    setMergingMulti(true);
    try {
      const targetEmail = target.client_emails[0];
      for (const source of selected) {
        if (source.key === target.key) continue;
        const sourceEmail = source.client_emails[0];
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
      }
      toast({
        title: "Clients fusionnés",
        description: `${selected.length} fiches regroupées sous ${targetEmail}.`,
      });
      setMultiMergeOpen(false);
      setMultiTargetKey(null);
      setSelectedKeys([]);
      loadStats();
      loadMergeRecords();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setMergingMulti(false);
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

  // Suppression du compte utilisateur lié à l'email du client
  const handleDeleteAccount = async () => {
    if (!accountToDelete?.account_user_id) return;
    setDeletingAccount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non authentifié");

      const response = await fetch(
        `https://qgtbedvpxpadpqxrkzzx.supabase.co/functions/v1/delete-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ userId: accountToDelete.account_user_id }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erreur lors de la suppression");

      toast({ title: "Compte supprimé", description: "Le compte utilisateur a été supprimé." });
      setAccountToDelete(null);
      setSelectedClient(null);
      loadStats();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setDeletingAccount(false);
    }
  };

  // Création des comptes de fidélité + email à tous les clients
  const handleCreateLoyaltyAccounts = async () => {
    setLoyaltyRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-loyalty-accounts", {
        body: {},
      });
      if (error) throw error;
      toast({
        title: "Comptes fidélité",
        description: `${data.created} compte(s) créé(s), ${data.emailed} email(s) envoyé(s)${data.failed?.length ? `, ${data.failed.length} échec(s)` : ""}.`,
      });
      setLoyaltyConfirm(false);
      loadStats();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setLoyaltyRunning(false);
    }
  };

  const filteredStats = stats.filter((c) => {

    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.client_name.toLowerCase().includes(q) ||
      c.client_emails.some((e) => (e || "").toLowerCase().includes(q)) ||
      c.client_phone.toLowerCase().includes(q)
    );
  });

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

      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <p className="font-medium">Comptes de fidélité client</p>
            <p className="text-sm text-muted-foreground">
              Crée un compte pour chaque email client connu et envoie l'email d'activation.
            </p>
          </div>
          <Button onClick={() => setLoyaltyConfirm(true)} disabled={loyaltyRunning}>
            {loyaltyRunning ? "Envoi en cours…" : "Créer les comptes & envoyer l'email"}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={loyaltyConfirm} onOpenChange={setLoyaltyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Envoyer à tous les clients ?</AlertDialogTitle>
            <AlertDialogDescription>
              Un compte de fidélité sera créé pour chaque email client sans compte, et un email
              d'activation sera envoyé à toutes les adresses connues.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loyaltyRunning}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleCreateLoyaltyAccounts(); }} disabled={loyaltyRunning}>
              {loyaltyRunning ? "En cours…" : "Confirmer l'envoi"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>



      <p className="text-sm text-muted-foreground text-center">
        💡 Chaque client est identifié par son email — cochez plusieurs fiches pour les fusionner. Les réservations de lucas.chipan97@gmail.com sont affichées individuellement.
      </p>

      {/* Barre de fusion multiple */}
      {selectedKeys.length > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-primary/50 bg-primary/10">
          <span className="text-sm font-medium">{selectedKeys.length} client(s) sélectionné(s)</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelectedKeys([])}>Annuler</Button>
            <Button
              size="sm"
              disabled={selectedKeys.length < 2}
              onClick={() => {
                setMultiTargetKey(selectedKeys[0]);
                setMultiMergeOpen(true);
              }}
            >
              Fusionner en un seul client
            </Button>
          </div>
        </div>
      )}

      {/* Clients & comptes utilisateurs */}
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>Clients &amp; comptes ({filteredStats.length})</CardTitle>
          <Input
            placeholder="Rechercher par email, nom ou téléphone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {filteredStats.map((client) => (
              <div
                key={client.key}
                draggable
                onDragStart={(e) => handleDragStart(e, client)}
                onDragOver={(e) => handleDragOver(e, client.key)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, client)}
                onDragEnd={handleDragEnd}
                className={`flex items-center justify-between gap-2 p-3 rounded-lg border cursor-grab active:cursor-grabbing transition-all
                  ${dropTarget === client.key ? "ring-2 ring-primary bg-primary/10 scale-[1.02]" : ""}
                  ${selectedKeys.includes(client.key) ? "ring-2 ring-primary/70" : ""}
                  ${client.is_blacklisted ? "bg-destructive/10 border-destructive/30" : "hover:bg-accent/50"}
                  ${client.unpaid_amount > 0 ? "border-orange-400/50" : ""}
                `}
              >
                <div className="flex items-start gap-2 min-w-0">
                  <input
                    type="checkbox"
                    aria-label={`Sélectionner ${client.client_name}`}
                    className="mt-1 h-4 w-4 shrink-0 accent-primary cursor-pointer"
                    checked={selectedKeys.includes(client.key)}
                    onChange={() => toggleSelect(client.key)}
                    onClick={(e) => e.stopPropagation()}
                  />
                <div className="min-w-0">

                  <div className="flex items-center gap-2 min-w-0">
                    {client.is_blacklisted && <Ban className="h-4 w-4 text-destructive shrink-0" />}
                    <span
                      className="font-medium text-primary hover:underline truncate cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); openClientDialog(client); }}
                    >
                      {client.client_name}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{client.client_emails[0]}</div>
                </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="flex items-center gap-1">
                    {client.account_user_id ? (
                      <Badge variant="outline" className="text-[10px] border-primary/50 text-primary">
                        {client.account_role === "admin" ? "Admin" : "Compte"}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">Sans compte</Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">{client.total_bookings} RDV</Badge>
                  </div>
                  {client.unpaid_amount > 0 && (
                    <Badge variant="outline" className="text-xs border-orange-400 text-orange-600">
                      {client.unpaid_amount}€ dû
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
          {filteredStats.length === 0 && (
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
              {/* Compte utilisateur lié à l'email */}
              <div className="p-3 rounded-lg border space-y-2">
                <div className="text-sm font-semibold">Compte utilisateur</div>
                <div className="text-xs text-muted-foreground break-all">{selectedClient.client_emails[0]}</div>
                {selectedClient.account_user_id ? (
                  <>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="text-[10px] border-primary/50 text-primary">
                        {selectedClient.account_role === "admin" ? "Administrateur" : "Client"}
                      </Badge>
                      {selectedClient.account_created_at && (
                        <span className="text-muted-foreground">
                          Inscrit le {format(new Date(selectedClient.account_created_at), "d MMM yyyy", { locale: fr })}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={selectedClient.account_role === "admin"}
                      onClick={() => setAccountToDelete(selectedClient)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Supprimer le compte
                    </Button>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground">Aucun compte lié à cet email.</div>
                )}
              </div>

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
                  <div className="mt-2 space-y-4 max-h-96 overflow-y-auto">
                    {Object.entries(
                      selectedClient.bookings.reduce<Record<string, BookingDetail[]>>((acc, b) => {
                        const mail = (b.client_email || "Email inconnu").trim().toLowerCase();
                        (acc[mail] = acc[mail] || []).push(b);
                        return acc;
                      }, {})
                    ).map(([mail, mailBookings]) => (
                      <div key={mail} className="space-y-2">
                        <div className="flex items-center gap-2 sticky top-0 bg-background/95 py-1">
                          <Badge variant="outline" className="text-[10px] font-mono break-all">{mail}</Badge>
                          <span className="text-[10px] text-muted-foreground">{mailBookings.length} RDV</span>
                        </div>
                        {mailBookings.map((b) => (
                      <div key={b.id} className="p-3 rounded-lg text-sm bg-muted/30 border space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold">{b.service_name}</div>
                            <div className="text-muted-foreground text-xs">
                              {format(new Date(b.appointment_date), "EEEE d MMMM yyyy", { locale: fr })} à {b.appointment_time?.slice(0, 5)}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Badge variant={b.status === "confirmed" ? "default" : b.status === "cancelled" ? "destructive" : "secondary"} className="text-xs">
                              {b.status}
                            </Badge>
                            <span className="font-semibold">{b.total_price.toFixed(2)}€</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted-foreground pt-1 border-t">
                          {b.travel_fee > 0 && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Frais déplacement : </span>
                              <span className="font-medium text-foreground">{b.travel_fee.toFixed(2)}€</span>
                            </div>
                          )}
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Acompte : </span>
                            <span className="font-medium text-foreground">{b.deposit_paid ? "Payé" : "Non"}</span>
                          </div>
                          {b.client_phone && (
                            <div className="col-span-2 flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              <span>{b.client_phone}</span>
                            </div>
                          )}
                          {b.client_address && (
                            <div className="col-span-2 flex items-start gap-1">
                              <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                              <span className="break-words">{b.client_address}</span>
                            </div>
                          )}
                          {b.notes && (
                            <div className="col-span-2 flex items-start gap-1">
                              <StickyNote className="h-3 w-3 mt-0.5 shrink-0" />
                              <span className="break-words italic">{b.notes}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex justify-end pt-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setBookingToDelete(b)}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Retirer ce RDV
                          </Button>
                        </div>
                      </div>
                        ))}
                      </div>
                    ))}
                    {selectedClient.bookings.length === 0 && (
                      <div className="text-center text-muted-foreground py-4 text-sm">Aucune réservation</div>
                    )}
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
                    <MapPin className="h-3 w-3" /> Adresse
                  </Label>
                  <Input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} placeholder="Adresse du client" />
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

      {/* Delete booking confirmation */}
      <AlertDialog open={bookingToDelete !== null} onOpenChange={(open) => !open && setBookingToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer cette réservation ?</AlertDialogTitle>
            <AlertDialogDescription>
              {bookingToDelete && (
                <>
                  Le RDV <strong>{bookingToDelete.service_name}</strong> du{" "}
                  <strong>{format(new Date(bookingToDelete.appointment_date), "d MMMM yyyy", { locale: fr })}</strong>{" "}
                  à {bookingToDelete.appointment_time?.slice(0, 5)} sera définitivement supprimé.
                  <p className="mt-2 text-sm text-destructive">Cette action est irréversible.</p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBooking} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete account confirmation */}
      <AlertDialog open={accountToDelete !== null} onOpenChange={(open) => !open && setAccountToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce compte utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              {accountToDelete && (
                <>
                  Le compte de <strong>{accountToDelete.client_name}</strong> ({accountToDelete.client_emails[0]}) sera supprimé.
                  <p className="mt-2 text-sm text-destructive">Cette action est irréversible.</p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAccount}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deletingAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingAccount ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fusion multiple : choix du client principal */}
      <Dialog open={multiMergeOpen} onOpenChange={(open) => { if (!open) { setMultiMergeOpen(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Fusionner {selectedKeys.length} clients</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Choisis la fiche principale : tous les rendez-vous des autres emails seront rattachés à celle-ci.
            </p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {stats.filter(c => selectedKeys.includes(c.key)).map((c) => (
                <label
                  key={c.key}
                  className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer ${multiTargetKey === c.key ? "border-primary bg-primary/10" : "hover:bg-accent/50"}`}
                >
                  <input
                    type="radio"
                    name="multi-target"
                    className="h-4 w-4 accent-primary"
                    checked={multiTargetKey === c.key}
                    onChange={() => setMultiTargetKey(c.key)}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{c.client_name}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.client_emails[0]} · {c.total_bookings} RDV</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMultiMergeOpen(false)} disabled={mergingMulti}>Annuler</Button>
              <Button onClick={handleMultiMerge} disabled={mergingMulti || !multiTargetKey}>
                {mergingMulti ? "Fusion..." : "Fusionner"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>

  );
};
