import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, MailCheck } from "lucide-react";
import lcsBarberLogo from "@/assets/lcs-barber-logo.png";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/auth" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Connexion
          </Link>
          <img src={lcsBarberLogo} alt="LCS Barber" className="h-9" />
        </div>

        <Card className="border-border/60">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Mot de passe oublié</CardTitle>
            <CardDescription>
              {sent
                ? "Lien envoyé, vérifie ta boîte mail"
                : "Entre ton email, je t'envoie un lien pour créer un nouveau mot de passe"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sent ? (
              <div className="space-y-4 text-center">
                <MailCheck className="h-10 w-10 mx-auto text-primary" />
                <p className="text-sm text-muted-foreground">
                  Un email a été envoyé à <span className="text-foreground font-medium">{email}</span>.
                  Clique sur le lien pour définir ton nouveau mot de passe. Pense à regarder dans les spams.
                </p>
                <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
                  Renvoyer un lien
                </Button>
                <Button asChild className="w-full">
                  <Link to="/auth">Retour à la connexion</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="toi@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Envoi..." : "Envoyer le lien"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
