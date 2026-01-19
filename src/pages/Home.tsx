import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { Settings, BarChart, LogIn, Calendar, Scissors, Construction } from "lucide-react";
import lcsBarberLogo from "@/assets/lcs-barber-logo.png";

const afroStyles = [
  { name: "Dégradé haut", description: "Fondu progressif sur le haut de la tête" },
  { name: "Dégradé bas", description: "Fondu progressif sur les côtés bas" },
  { name: "Taper", description: "Transition douce et naturelle" },
  { name: "Fade", description: "Dégradé prononcé à la peau" },
  { name: "Box cut", description: "Coupe carrée traditionnelle" },
  { name: "Waves", description: "Coupe avec motifs ondulés" },
];

const europeanStyles = [
  { name: "Dégradé classique", description: "Coupe moderne et élégante" },
  { name: "Undercut", description: "Côtés courts, dessus long" },
  { name: "Pompadour", description: "Style rétro volumineux" },
  { name: "Crew cut", description: "Coupe courte militaire" },
  { name: "Slick back", description: "Cheveux plaqués en arrière" },
  { name: "Textured crop", description: "Coupe texturée moderne" },
];

function StyleCard({ name, description }: { name: string; description: string }) {
  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer">
      <CardContent className="p-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Construction className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">En développement</span>
        </div>
        <h3 className="font-semibold text-foreground">{name}</h3>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const { user, isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      {/* Header avec navigation */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex justify-between items-center">
            <Link to="/">
              <img src={lcsBarberLogo} alt="LCS Barber" className="h-14 sm:h-16 md:h-20 cursor-pointer" />
            </Link>
            <div className="flex items-center gap-1 sm:gap-2">
              {user ? (
                <>
                  {isAdmin && (
                    <>
                      <Button asChild variant="outline" size="sm" className="h-8 px-2 sm:px-3">
                        <Link to="/dashboard">
                          <BarChart className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Dashboard</span>
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm" className="h-8 px-2 sm:px-3">
                        <Link to="/admin">
                          <Settings className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Admin</span>
                        </Link>
                      </Button>
                    </>
                  )}
                </>
              ) : (
                <Button asChild variant="outline" size="sm" className="h-8 px-2 sm:px-3">
                  <Link to="/auth">
                    <LogIn className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Connexion</span>
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-12">
        {/* Hero Section */}
        <section className="text-center py-8">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Bienvenue chez <span className="text-primary">LCS Barber</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Votre salon de coiffure spécialisé dans les coupes afro et européennes. 
            Réservez votre rendez-vous en quelques clics.
          </p>
          <Button asChild size="lg" className="text-lg px-8 py-6">
            <Link to="/reservation">
              <Calendar className="mr-2 h-5 w-5" />
              Réserver maintenant
            </Link>
          </Button>
        </section>

        {/* Section Coupes Afro */}
        <section>
          <Card className="overflow-hidden">
            <CardHeader className="bg-primary/10 border-b">
              <CardTitle className="flex items-center gap-3 text-2xl">
                <Scissors className="h-6 w-6 text-primary" />
                Coupes Afro
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {afroStyles.map((style) => (
                  <StyleCard key={style.name} {...style} />
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section Coupes Européennes */}
        <section>
          <Card className="overflow-hidden">
            <CardHeader className="bg-accent/10 border-b">
              <CardTitle className="flex items-center gap-3 text-2xl">
                <Scissors className="h-6 w-6 text-accent" />
                Coupes Européennes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {europeanStyles.map((style) => (
                  <StyleCard key={style.name} {...style} />
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* CTA Réservation */}
        <section className="text-center py-8 bg-card rounded-lg border shadow-sm">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Prêt pour une nouvelle coupe ?
          </h2>
          <p className="text-muted-foreground mb-6">
            Réservez votre créneau en ligne et profitez de nos services professionnels.
          </p>
          <Button asChild size="lg" variant="default">
            <Link to="/reservation">
              <Calendar className="mr-2 h-5 w-5" />
              Accéder aux réservations
            </Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
