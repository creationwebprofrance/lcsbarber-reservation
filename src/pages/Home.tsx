import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { Settings, BarChart, LogIn, Calendar, Scissors, Star, Clock, MapPin, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import lcsBarberLogo from "@/assets/lcs-barber-logo.png";


const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  }),
};

export default function Home() {
  const { user, isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/70 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-6xl mx-auto px-5 py-3 flex justify-between items-center">
          <Link to="/" className="shrink-0">
            <img src={lcsBarberLogo} alt="LCS Barber" className="h-11 sm:h-13" />
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            {user && isAdmin && (
              <>
                <Button asChild variant="ghost" size="sm" className="text-xs">
                  <Link to="/dashboard">
                    <BarChart className="h-4 w-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="text-xs">
                  <Link to="/admin">
                    <Settings className="h-4 w-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Admin</span>
                  </Link>
                </Button>
              </>
            )}
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
      <section className="relative min-h-[85vh] sm:min-h-[90vh] flex items-center">
        <div className="absolute inset-0 bg-gradient-to-br from-secondary via-background to-background" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)', backgroundSize: '32px 32px' }} />

        <div className="relative z-10 max-w-6xl mx-auto px-5 w-full py-24 sm:py-32">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0} className="mb-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 inline-block">
              <img src={lcsBarberLogo} alt="LCS Barber" className="h-28 sm:h-40 md:h-48" />
            </div>
          </motion.div>

          <motion.h1
            className="text-4xl sm:text-5xl md:text-7xl font-bold text-foreground mb-4 leading-tight"
            initial="hidden" animate="visible" variants={fadeUp} custom={1}
          >
            Ton style,<br />
            <span className="text-primary">notre expertise.</span>
          </motion.h1>

          <motion.p
            className="text-base sm:text-lg text-muted-foreground max-w-md mb-8"
            initial="hidden" animate="visible" variants={fadeUp} custom={2}
          >
            Coupes afro & européennes. Service pro, ambiance cool. À domicile ou en salon.
          </motion.p>

          <motion.div
            className="flex flex-wrap gap-3"
            initial="hidden" animate="visible" variants={fadeUp} custom={3}
          >
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-elegant">
              <Link to="/reservation">
                <Calendar className="h-4 w-4 mr-2" />
                Prendre rendez-vous
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-border/60 hover:bg-card">
              <a href="#services">
                Nos services
                <ArrowRight className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Barber stripe divider */}
      <div className="stripe-line" />

      {/* Services */}
      <section id="services" className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-5">
          <motion.div
            className="mb-14"
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} custom={0}
          >
            <p className="text-primary text-sm font-semibold mb-2 tracking-wide">CE QU'ON FAIT</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Des coupes qui parlent<br className="hidden sm:block" /> pour vous.
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Scissors, title: "Coupes Afro", desc: "Dégradé, taper, fade, box cut, waves — on maîtrise tous les styles.", tag: "Spécialité" },
              { icon: Scissors, title: "Coupes Européennes", desc: "Undercut, pompadour, crew cut, textured crop — toujours propre.", tag: "Classique" },
              { icon: Star, title: "Barbe & Finitions", desc: "Taille de barbe, rasage, tracé net — le souci du détail.", tag: "Détails" },
            ].map((s, i) => (
              <motion.div
                key={s.title}
                className="bg-card border border-border/50 rounded-xl p-7 hover:border-primary/30 transition-all duration-300 group"
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} custom={i}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <s.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-accent bg-accent/10 px-2.5 py-1 rounded-full">
                    {s.tag}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
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
              { icon: MapPin, value: "À domicile", label: "On vient chez toi" },
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
          <img src={lcsBarberLogo} alt="LCS Barber" className="h-8 opacity-50" />
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} LCS Barber — Tous droits réservés
          </p>
        </div>
      </footer>
    </div>
  );
}
