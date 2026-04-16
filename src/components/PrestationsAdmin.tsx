import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Euro, Calendar } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface Prestation {
  id: string;
  name: string;
  client_name: string | null;
  amount: number;
  prestation_date: string;
  notes: string | null;
  created_at: string;
}

export const PrestationsAdmin = () => {
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    client_name: "",
    amount: "",
    prestation_date: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    loadPrestations();
  }, []);

  const loadPrestations = async () => {
    const { data, error } = await supabase
      .from("prestations")
      .select("*")
      .order("prestation_date", { ascending: false });

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      setPrestations(data || []);
    }
    setLoading(false);
  };

  const addPrestation = async () => {
    if (!form.name || !form.amount) {
      toast({ title: "Erreur", description: "Nom et montant requis.", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("prestations").insert({
      name: form.name.trim(),
      client_name: form.client_name.trim() || null,
      amount: Number(form.amount),
      prestation_date: form.prestation_date,
      notes: form.notes.trim() || null,
    });

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Prestation ajoutée" });
    setForm({ name: "", client_name: "", amount: "", prestation_date: new Date().toISOString().split("T")[0], notes: "" });
    loadPrestations();
  };

  const deletePrestation = async (id: string) => {
    await supabase.from("prestations").delete().eq("id", id);
    toast({ title: "Prestation supprimée" });
    loadPrestations();
  };

  const totalRevenue = prestations.reduce((sum, p) => sum + Number(p.amount), 0);

  if (loading) return <div className="p-4">Chargement...</div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total prestations</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRevenue.toFixed(2)}€</div>
            <p className="text-xs text-muted-foreground">{prestations.length} prestation(s)</p>
          </CardContent>
        </Card>
      </div>

      {/* Add form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" /> Ajouter une prestation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Nom de la prestation *</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Coupe classique" />
            </div>
            <div>
              <Label>Nom du client</Label>
              <Input value={form.client_name} onChange={(e) => setForm(f => ({ ...f, client_name: e.target.value }))} placeholder="Optionnel" />
            </div>
            <div>
              <Label>Montant (€) *</Label>
              <Input value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} type="number" min="0" step="0.01" />
            </div>
            <div>
              <Label>Date</Label>
              <Input value={form.prestation_date} onChange={(e) => setForm(f => ({ ...f, prestation_date: e.target.value }))} type="date" />
            </div>
            <div className="sm:col-span-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optionnel" />
            </div>
            <div className="sm:col-span-2">
              <Button onClick={addPrestation} className="w-full">
                <Plus className="h-4 w-4 mr-2" /> Ajouter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des prestations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {prestations.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{p.name}</span>
                    <Badge variant="secondary">{Number(p.amount).toFixed(2)}€</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(p.prestation_date), "d MMM yyyy", { locale: fr })}
                    </span>
                    {p.client_name && <span>• {p.client_name}</span>}
                    {p.notes && <span>• {p.notes}</span>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => deletePrestation(p.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {prestations.length === 0 && (
              <div className="text-center text-muted-foreground py-8">Aucune prestation enregistrée</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
