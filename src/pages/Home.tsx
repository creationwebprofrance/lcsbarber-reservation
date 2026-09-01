import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { LogIn, Calendar, Scissors, Star, Clock, MapPin, ArrowRight, PartyPopper } from "lucide-react";
import { motion } from "framer-motion";
import lcsBarberLogo from "@/assets/lcs-barber-logo.png";
import veryBadCampAsset from "@/assets/very-bad-camp.png.asset.json";
import BarberPole3D from "@/components/BarberPole3D";
import { UserMenu } from "@/components/UserMenu";
import { supabase } from "@/integrations/supabase/client";


const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  }),
};

export default function Home() {
  const { user } = useAuth();
  const [hasActiveEvent, setHasActiveEvent] = useState(false);
  const [bookSection, setBookSection] = useState({
    label: "BOOK ÉVÉNEMENTIEL",
    title: "Événements, artistes & collaborations",
    description: "Découvrez mes partenaires, les artistes qui me font confiance et mes prestations événementielles.",
    buttonText: "Voir mes prestations",
    buttonLink: "/evenements",
  });

  useEffect(() => {
    supabase
      .from("events")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .then(({ data }) => setHasActiveEvent(!!(data && data.length > 0)));

    supabase
      .from("carnaval_settings")
      .select("setting_key, setting_value")
      .like("setting_key", "book_event_%")
      .then(({ data }) => {
        if (data && data.length > 0) {
          const map: Record<string, string> = {};
          data.forEach((r) => (map[r.setting_key] = r.setting_value));
          setBookSection({
            label: map.book_event_label || "BOOK ÉVÉNEMENTIEL",
            title: map.book_event_title || "Événements, artistes & collaborations",
            description: map.book_event_description || "",
            buttonText: map.book_event_button_text || "Voir mes prestations",
            buttonLink: map.book_event_button_link || "/evenements",
          });
        }
      });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/70 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-6xl mx-auto px-5 py-3 flex justify-between items-center">
          <Link to="/" className="shrink-0">
            <img src={lcsBarberLogo} alt="LCS Barber" className="h-20 sm:h-24" />
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            {!user && (
              <Button asChild variant="ghost" size="sm" className="text-xs">
                <Link to="/auth">
                  <LogIn className="h-4 w-4 mr-1.5" />
                  Connexion
                </Link>
              </Button>
            )}
            <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs">
              <Link to="/reservation">
                <Calendar className="h-4 w-4 mr-1.5" />
                Réserver
              </Link>
            </Button>
            {user && <UserMenu />}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-[100svh] sm:min-h-[90vh] flex items-center">
        <div className="absolute inset-0 bg-gradient-to-br from-secondary via-background to-background" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)', backgroundSize: '32px 32px' }} />

        <div className="relative z-10 max-w-6xl mx-auto px-5 w-full py-20 sm:py-32">
          <div className="flex flex-col-reverse lg:flex-row items-center gap-2 sm:gap-4 lg:gap-6">
            {/* Left: text content */}
            <div className="flex-1 text-center lg:text-left">
              <motion.p
                className="font-stencil text-primary text-sm sm:text-base mb-4 tracking-[0.25em]"
                initial="hidden" animate="visible" variants={fadeUp} custom={0}
              >
                LCS BARBER — BARBER ATELIER
              </motion.p>
              <motion.h1
                className="text-4xl sm:text-6xl md:text-7xl font-bold text-foreground mb-5 sm:mb-6 leading-[0.95] tracking-tight"
                initial="hidden" animate="visible" variants={fadeUp} custom={1}
              >
                Ton style.<br />
                Ton créneau.<br />
                <span className="text-accent-gradient">Ta coupe.</span>
              </motion.h1>

              <motion.p
                className="text-sm sm:text-lg text-muted-foreground max-w-md mb-6 sm:mb-9 mx-auto lg:mx-0 leading-relaxed"
                initial="hidden" animate="visible" variants={fadeUp} custom={2}
              >
                Coupes afro & européennes, barbe soignée. Réserve ton créneau en quelques secondes.
              </motion.p>

              <motion.span
                className="inline-flex items-center justify-center lg:justify-start gap-1.5 text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-3"
                initial="hidden" animate="visible" variants={fadeUp} custom={3}
              >
                <Clock className="h-3 w-3 text-primary" />
                De 10h à 20h (frais hors horaire)
              </motion.span>

              <motion.div
                className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start"
                initial="hidden" animate="visible" variants={fadeUp} custom={4}
              >
                <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-elegant flex-1">
                  <Link to="/reservation">
                    <Calendar className="h-4 w-4 mr-2" />
                    Prendre rendez-vous
                  </Link>
                </Button>
                {hasActiveEvent ? (
                  <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold flex-1">
                    <Link to="/evenements">
                      <PartyPopper className="h-4 w-4 mr-2" />
                      Prochain événement
                    </Link>
                  </Button>
                ) : (
                  <Button size="lg" disabled className="opacity-50 cursor-not-allowed flex-1">
                    <PartyPopper className="h-4 w-4 mr-2" />
                    Prochain événement
                  </Button>
                )}
              </motion.div>
            </div>

            {/* Right: 3D Barber Pole */}
            <motion.div
              className="w-full max-w-[200px] sm:max-w-xs lg:max-w-md lg:flex-1"
              initial="hidden" animate="visible" variants={fadeUp} custom={0}
            >
              <BarberPole3D />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Barber stripe divider */}
      <div className="stripe-line" />

      {/* Catalogue : coupes & prestations événementielles */}
      <section className="py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-5">
          <motion.div
            className="text-center mb-10"
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} custom={0}
          >
            <p className="text-primary text-sm font-semibold mb-2 tracking-wide">CATALOGUE</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              Mes coupes & mes prestations
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-5">
            <motion.div
              className="bg-card border border-border/50 rounded-2xl p-7 flex flex-col"
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              variants={fadeUp} custom={1}
            >
              <Scissors className="h-6 w-6 text-primary mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">Catalogue de coupes</h3>
              <p className="text-sm text-muted-foreground mb-6 flex-1">
                Découvre mes réalisations — fades, afro, européennes, barbe soignée — et choisis
                ton style avant de réserver.
              </p>
              <Button asChild className="w-full font-semibold">
                <Link to="/catalogue">
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Voir le catalogue
                </Link>
              </Button>
            </motion.div>

            <motion.div
              className="bg-card border border-border/50 rounded-2xl p-7 flex flex-col"
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              variants={fadeUp} custom={2}
            >
              <PartyPopper className="h-6 w-6 text-primary mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">{bookSection.title}</h3>
              <p className="text-sm text-muted-foreground mb-6 flex-1">
                {bookSection.description}
              </p>
              <Button asChild variant="outline" className="w-full font-semibold border-border/60">
                <Link to={bookSection.buttonLink}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  {bookSection.buttonText}
                </Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      <div className="stripe-line" />

      {/* Quick stats */}
      <section className="py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-5">
          <div className="grid grid-cols-3 gap-6">
            {[
              { icon: Clock, value: "Sur RDV", label: "Toujours à l'heure" },
              { icon: MapPin, value: "À domicile", label: "Je viens chez toi" },
              { icon: Star, value: "5/5", label: "Avis clients" },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                className="text-center"
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} custom={i}
              >
                <item.icon className="h-5 w-5 text-primary mx-auto mb-3" />
                <div className="text-2xl sm:text-3xl font-bold text-foreground mb-1">{item.value}</div>
                <div className="text-xs text-muted-foreground">{item.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>


      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <img src={lcsBarberLogo} alt="LCS Barber" className="h-12 opacity-60" />
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} LCS Barber — Tous droits réservés
          </p>
        </div>
      </footer>
    </div>
  );
}
