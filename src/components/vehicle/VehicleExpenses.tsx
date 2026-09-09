import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";
import type { VehicleExpense } from "@/lib/vehicle";

const CATEGORIES = [
  { v: "carburant", l: "Carburant / recharge" },
  { v: "entretien", l: "Entretien" },
  { v: "peage", l: "Péage" },
  { v: "stationnement", l: "Stationnement" },
  { v: "assurance", l: "Assurance" },
  { v: "autre", l: "Autre" },
];

export const VehicleExpenses = ({ vehicleId }: { vehicleId: string }) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<VehicleExpense[]>([]);
  const [form, setForm] = useState({
    category: "carburant",
    expense_date: new Date().toISOString().slice(0, 10),
    amount: "",
    quantity: "",
    notes: "",
  });

  const load = async () => {
    const { data } = await supabase.from("vehicle_expenses").select("*")
      .eq("vehicle_id", vehicleId).order("expense_date", { ascending: false }).limit(300);
    setRows((data ?? []) as VehicleExpense[]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [vehicleId]);

  const add = async () => {
    const amount = parseFloat(form.amount.replace(",", "."));
    if (Number.isNaN(amount)) {
      toast({ title: "Montant invalide", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("vehicle_expenses").insert({
      vehicle_id: vehicleId,
      category: form.category,
      expense_date: form.expense_date,
      amount,
      quantity: form.quantity ? parseFloat(form.quantity.replace(",", ".")) : null,
      quantity_unit: form.category === "carburant" ? "L/kWh" : null,
      notes: form.notes || null,
    } as never);
    if (error) {
      toast({ title: "Enregistrement impossible", description: error.message, variant: "destructive" });
      return;
    }
    setForm({ ...form, amount: "", quantity: "", notes: "" });
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("vehicle_expenses").delete().eq("id", id);
    load();
  };

  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  const year = new Date().getFullYear().toString();
  const totalYear = rows.filter((r) => r.expense_date.startsWith(year))
    .reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dépenses</CardTitle>
          <CardDescription>
            Total {year} : {totalYear.toFixed(2)} € · Total enregistré : {total.toFixed(2)} €
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>Catégorie</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={form.expense_date}
              onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
          </div>
          <div>
            <Label>Montant (€)</Label>
            <Input value={form.amount} inputMode="decimal"
              onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          {form.category === "carburant" && (
            <div>
              <Label>Quantité (L ou kWh)</Label>
              <Input value={form.quantity} inputMode="decimal"
                onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
          )}
          <div className="sm:col-span-2">
            <Label>Note</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex items-end">
            <Button onClick={add} className="w-full">Ajouter</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Historique</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 && <p className="text-sm text-muted-foreground">Aucune dépense.</p>}
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
              <span>
                {new Date(r.expense_date).toLocaleDateString("fr-FR")} —{" "}
                {CATEGORIES.find((c) => c.v === r.category)?.l ?? r.category} —{" "}
                <strong>{Number(r.amount).toFixed(2)} €</strong>
                {r.notes && <span className="text-muted-foreground"> · {r.notes}</span>}
              </span>
              <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
