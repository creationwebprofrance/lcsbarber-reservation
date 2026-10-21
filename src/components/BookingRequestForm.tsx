import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const BookingRequestForm = ({ mode }: { mode?: "domicile" | "deplacement" }) => {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      setEmail(u.email ?? "");
      setName((u.user_metadata?.full_name as string) || (u.user_metadata?.name as string) || "");
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2 || !email.includes("@")) {
      toast({ title: "Indique ton nom et ton email", variant: "destructive" });
      return;
    }
    setSending(true);
    const { data, error } = await supabase.functions.invoke("create-booking-request", {
      body: {
        client_name: name, client_email: email, client_phone: phone || null, mode: mode ?? null,
        preferred_date: date || null, preferred_time: time || null, message: message || null,
      },
    });
    setSending(false);
    if (error || !data?.success) {
      toast({ title: "Envoi impossible", description: data?.error || "Réessaie dans un instant.", variant: "destructive" });
      return;
    }
    setSent(true);
  };

  if (sent) {
    return <p className="text-primary font-medium">Demande envoyée ✔ Je te recontacte rapidement pour confirmer.</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-3 text-left">
      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label htmlFor="rq-name">Nom</Label><Input id="rq-name" value={name} onChange={e => setName(e.target.value)} maxLength={100} required /></div>
        <div><Label htmlFor="rq-email">Email</Label><Input id="rq-email" type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={255} required /></div>
        <div><Label htmlFor="rq-phone">Téléphone</Label><Input id="rq-phone" value={phone} onChange={e => setPhone(e.target.value)} maxLength={20} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label htmlFor="rq-date">Date souhaitée</Label><Input id="rq-date" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><Label htmlFor="rq-time">Heure</Label><Input id="rq-time" type="time" value={time} onChange={e => setTime(e.target.value)} /></div>
        </div>
      </div>
      <div><Label htmlFor="rq-msg">Message (prestation, précisions…)</Label><Textarea id="rq-msg" value={message} onChange={e => setMessage(e.target.value)} maxLength={1000} rows={3} /></div>
      <Button type="submit" disabled={sending} className="w-full">{sending ? "Envoi…" : "Envoyer ma demande de réservation"}</Button>
    </form>
  );
};
