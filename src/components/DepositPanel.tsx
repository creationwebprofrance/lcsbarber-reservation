import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard } from "lucide-react";
import { getRevolutLink, REVOLUT_BASE_URL } from "@/lib/deposit";
import { LatePolicy } from "./LatePolicy";

interface DepositPanelProps {
  amount: number;
  reference: string;
  onReferenceChange: (value: string) => void;
  confirmed: boolean;
  onConfirmedChange: (value: boolean) => void;
}

export const DepositPanel = ({
  amount,
  reference,
  onReferenceChange,
  confirmed,
  onConfirmedChange,
}: DepositPanelProps) => (
  <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">Acompte à régler</span>
      <span className="text-xl font-bold text-primary">{amount}€</span>
    </div>

    <Button
      type="button"
      size="lg"
      className="w-full gap-2"
      onClick={() => window.open(getRevolutLink(amount), "_blank", "noopener,noreferrer")}
    >
      <CreditCard className="h-4 w-4" />
      Payer {amount}€ via Revolut
    </Button>
    <p className="text-center text-xs text-muted-foreground">
      {REVOLUT_BASE_URL}
    </p>

    <div>
      <Label htmlFor="deposit-reference">Nom / référence utilisé pour le virement *</Label>
      <Input
        id="deposit-reference"
        value={reference}
        onChange={(e) => onReferenceChange(e.target.value)}
        className="mt-1"
        placeholder="Ex : Lucas D. — Revolut"
        maxLength={120}
      />
      <p className="mt-1 text-xs text-muted-foreground">
        Cela me permet de retrouver ton paiement et de valider le rendez-vous.
      </p>
    </div>

    <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-background p-3 text-sm">
      <input
        type="checkbox"
        checked={confirmed}
        onChange={(e) => onConfirmedChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-current"
      />
      <span>
        Je confirme avoir envoyé l'acompte de {amount}€ sur Revolut et j'accepte la politique de
        retard ci-dessous.
      </span>
    </label>

    <LatePolicy />

    <p className="text-xs text-muted-foreground">
      Ton rendez-vous passera en <strong>« en attente »</strong> jusqu'à ce que je vérifie la
      réception de l'acompte, puis tu recevras la confirmation définitive.
    </p>
  </div>
);
