import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { Settings, BarChart, LogIn, Calendar, Scissors, Star, Clock, MapPin, ArrowRight, Calculator, PartyPopper } from "lucide-react";
import { motion } from "framer-motion";
import lcsBarberLogo from "@/assets/lcs-barber-logo.png";
import veryBadCampAsset from "@/assets/very-bad-camp.png.asset.json";
import BarberPole3D from "@/components/BarberPole3D";
import { supabase } from "@/integrations/supabase/client";


const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  }),
};

export default function Home() {
  const { user, isAdmin } = useAuth();
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
                LCS STYLE — BARBER ATELIER
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
                Coupes afro & européennes, barbe soignée. Réserve ton créneau en quelques secondes — je viens chez toi.
              </motion.p>


              <motion.div
                className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start"
                initial="hidden" animate="visible" variants={fadeUp} custom={3}
              >
                <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-elegant w-full sm:w-auto">
                  <Link to="/reservation">
                    <Calendar className="h-4 w-4 mr-2" />
                    Prendre rendez-vous
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-border/60 hover:bg-card w-full sm:w-auto">
                  <a href="#services">
                    Mes services
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </a>
                </Button>
                {hasActiveEvent ? (
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex-1 sm:flex-none">
                      <Link to="/evenements">
                        <PartyPopper className="h-4 w-4 mr-2" />
                        Prochain événement
                      </Link>
                    </Button>
                    <Link to="/evenements" className="relative shrink-0 group">
                      <img
                        src={veryBadCampAsset.url}
                        alt="Very Bad Camp — événement en cours"
                        className="h-14 sm:h-16 w-auto drop-shadow-[0_0_12px_rgba(0,153,255,0.35)] transition-transform group-hover:scale-105"
                      />
                      <span className="absolute -top-2 -right-2 bg-accent text-accent-foreground text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shadow-md animate-pulse">
                        En cours
                      </span>
                    </Link>
                  </div>
                ) : (
                  <Button size="lg" disabled className="opacity-50 cursor-not-allowed w-full sm:w-auto">
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

      {/* BOOK Événementiel CTA - moved above services */}
      <section className="py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-5 text-center">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} custom={0}
          >
            <p className="text-primary text-sm font-semibold mb-2 tracking-wide">{bookSection.label}</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
              {bookSection.title}
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              {bookSection.description}
            </p>
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-elegant px-8">
              <Link to={bookSection.buttonLink}>
                <ArrowRight className="h-4 w-4 mr-2" />
                {bookSection.buttonText}
              </Link>
            </Button>
          </motion.div>
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

      <div className="stripe-line" />

      {/* CTA */}
      <section className="py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-5 text-center">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} custom={0}
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">
              Prêt pour ta prochaine <span className="text-primary">coupe</span> ?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Réserve ton créneau en quelques clics. Simple, rapide, efficace.
            </p>
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-elegant px-8">
              <Link to="/reservation">
                <Calendar className="h-4 w-4 mr-2" />
                Réserver maintenant
              </Link>
            </Button>
          </motion.div>
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
