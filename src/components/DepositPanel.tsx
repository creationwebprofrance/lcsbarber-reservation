import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LatePolicy } from "./LatePolicy";

interface DepositPanelProps {
  amount: number;
  reference: string;
  onReferenceChange: (value: string) => void;
  confirmed: boolean;
  onConfirmedChange: (value: boolean) => void;
  email?: string;
}

export const DepositPanel = ({
  amount,
  reference,
  onReferenceChange,
  confirmed,
  onConfirmedChange,
  email,
}: DepositPanelProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  const verify = async (id: string, silent = false) => {
    const { data, error } = await supabase.functions.invoke("verify-deposit-payment", {
      body: { sessionId: id },
    });
    if (error) return false;
    if (data?.paid) {
      onReferenceChange(`Stripe ${id}`);
      onConfirmedChange(true);
      if (pollRef.current) window.clearInterval(pollRef.current);
      setChecking(false);
      toast({ title: "Acompte reçu", description: `Paiement de ${amount}€ confirmé.` });
      return true;
    }
    if (!silent) {
      toast({
        title: "Paiement non détecté",
        description: "Termine le paiement dans l'onglet Stripe, puis réessaie.",
        variant: "destructive",
      });
    }
    return false;
  };

  const startPayment = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-deposit-payment", {
        body: {
          amount,
          email: email || undefined,
          description: `Acompte de ${amount}€ pour ton rendez-vous`,
          origin: window.location.origin,
        },
      });
      if (error || !data?.url) throw error ?? new Error("no url");

      setSessionId(data.sessionId);
      window.open(data.url, "_blank", "noopener,noreferrer");
      setChecking(true);

      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = window.setInterval(() => {
        verify(data.sessionId, true);
      }, 4000);
    } catch (e) {
      console.error(e);
      toast({
        title: "Erreur",
        description: "Impossible d'ouvrir le paiement sécurisé. Réessaie dans un instant.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Acompte à régler</span>
        <span className="text-xl font-bold text-primary">{amount}€</span>
      </div>

      {confirmed && reference ? (
        <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <span>Acompte de {amount}€ payé par carte. Ton rendez-vous peut être validé.</span>
        </div>
      ) : (
        <>
          <Button
            type="button"
            size="lg"
            className="w-full gap-2"
            onClick={startPayment}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            Payer {amount}€ par carte
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Paiement sécurisé par Stripe — CB, Apple Pay, Google Pay
          </p>

          {sessionId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => verify(sessionId)}
            >
              {checking && <Loader2 className="h-3 w-3 animate-spin" />}
              J'ai payé — vérifier le paiement
            </Button>
          )}
        </>
      )}

      <LatePolicy />

      <p className="text-xs text-muted-foreground">
        Ton rendez-vous est confirmé dès que le paiement de l'acompte est validé par Stripe.
      </p>
    </div>
  );
};
