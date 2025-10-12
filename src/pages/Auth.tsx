import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Scissors } from "lucide-react";

export const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [usePhone, setUsePhone] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/dashboard');
      }
    };
    checkUser();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });

        if (error) throw error;

        toast({
          title: "Email envoyé",
          description: "Vérifiez votre email pour réinitialiser votre mot de passe.",
        });
        setIsForgotPassword(false);
      } else if (usePhone) {
        if (!otpSent) {
          const { error } = await supabase.auth.signInWithOtp({
            phone,
          });

          if (error) throw error;

          setOtpSent(true);
          toast({
            title: "Code envoyé",
            description: "Entrez le code reçu par SMS.",
          });
        } else {
          const { error } = await supabase.auth.verifyOtp({
            phone,
            token: otp,
            type: 'sms',
          });

          if (error) throw error;

          toast({
            title: "Connexion réussie",
            description: "Bienvenue !",
          });
          navigate('/dashboard');
        }
      } else if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast({
          title: "Connexion réussie",
          description: "Bienvenue !",
        });
        navigate('/dashboard');
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) throw error;

        toast({
          title: "Inscription réussie",
          description: "Vérifiez votre email pour confirmer votre compte.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 bg-primary rounded-full flex items-center justify-center">
              <Scissors className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">
            {isForgotPassword 
              ? "Mot de passe oublié" 
              : isLogin 
                ? "Connexion" 
                : "Inscription"
            }
          </CardTitle>
          <CardDescription>
            {isForgotPassword
              ? "Entrez votre email pour réinitialiser votre mot de passe"
              : isLogin 
                ? "Connectez-vous à votre espace barbier" 
                : "Créez votre compte barbier"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {isForgotPassword ? (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            ) : usePhone ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone">Numéro de téléphone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+33612345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
                {otpSent && (
                  <div className="space-y-2">
                    <Label htmlFor="otp">Code de vérification</Label>
                    <Input
                      id="otp"
                      type="text"
                      placeholder="123456"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      required
                      maxLength={6}
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nom complet</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Votre nom complet"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="votre@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                {isLogin && (
                  <div className="text-right">
                    <Button
                      variant="link"
                      onClick={() => setIsForgotPassword(true)}
                      type="button"
                      className="text-sm px-0"
                    >
                      Mot de passe oublié ?
                    </Button>
                  </div>
                )}
              </>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading 
                ? "Chargement..." 
                : isForgotPassword 
                  ? "Envoyer le lien de réinitialisation"
                  : otpSent
                    ? "Vérifier le code"
                    : usePhone
                      ? "Envoyer le code"
                      : isLogin 
                        ? "Se connecter" 
                        : "S'inscrire"
              }
            </Button>
          </form>

          <div className="mt-6 space-y-3 text-center">
            {!isForgotPassword && (
              <Button
                variant="outline"
                onClick={() => {
                  setUsePhone(!usePhone);
                  setOtpSent(false);
                  setOtp("");
                }}
                type="button"
                className="w-full"
              >
                {usePhone ? "Utiliser l'email" : "Utiliser le téléphone"}
              </Button>
            )}
            
            <Button
              variant="ghost"
              onClick={() => {
                if (isForgotPassword) {
                  setIsForgotPassword(false);
                } else {
                  setIsLogin(!isLogin);
                }
                setUsePhone(false);
                setOtpSent(false);
                setOtp("");
              }}
              type="button"
            >
              {isForgotPassword
                ? "Retour à la connexion"
                : isLogin 
                  ? "Pas de compte ? Inscrivez-vous" 
                  : "Déjà un compte ? Connectez-vous"
              }
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};