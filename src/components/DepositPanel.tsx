import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreditCard, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LatePolicy } from "./LatePolicy";
import { stripePromise } from "@/lib/stripe";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";

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
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const startPayment = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-deposit-payment", {
        body: {
          amount,
          email: email || undefined,
          description: `Acompte de ${amount}€ pour ton rendez-vous`,
          origin: window.location.origin,
          embedded: true,
        },
      });
      if (error || !data?.clientSecret) throw error ?? new Error("no client secret");
      sessionIdRef.current = data.sessionId;
      setClientSecret(data.clientSecret);
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

  const onComplete = useCallback(async () => {
    const id = sessionIdRef.current;
    if (!id) return;
    const { data } = await supabase.functions.invoke("verify-deposit-payment", {
      body: { sessionId: id },
    });
    if (data?.paid) {
      onReferenceChange(`Stripe ${id}`);
      onConfirmedChange(true);
      setClientSecret(null);
      toast({ title: "Acompte reçu", description: `Paiement de ${amount}€ confirmé.` });
    } else {
      toast({
        title: "Paiement non confirmé",
        description: "Le paiement n'a pas pu être vérifié. Réessaie.",
        variant: "destructive",
      });
    }
  }, [amount, onConfirmedChange, onReferenceChange, toast]);

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
      ) : clientSecret ? (
        <div className="rounded-lg bg-background p-2">
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{ clientSecret, onComplete }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
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
            Paiement sécurisé par Stripe — CB, Apple Pay, Google Pay, Link
          </p>
        </>
      )}

      <LatePolicy />

      <p className="text-xs text-muted-foreground">
        Ton rendez-vous est confirmé dès que le paiement de l'acompte est validé par Stripe.
      </p>
    </div>
  );
};
