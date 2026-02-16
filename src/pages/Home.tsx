import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { Settings, BarChart, LogIn, Calendar, Scissors, Star, Clock, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import lcsBarberLogo from "@/assets/lcs-barber-logo.png";
import heroImage from "@/assets/hero-barber.jpg";

const services = [
  { icon: Scissors, title: "Coupes Afro", desc: "Dégradé, taper, fade, box cut, waves et plus encore" },
  { icon: Scissors, title: "Coupes Européennes", desc: "Undercut, pompadour, crew cut, slick back, textured crop" },
  { icon: Star, title: "Barbe & Finitions", desc: "Taille de barbe, rasage, tracé et finitions soignées" },
];

const stats = [
  { value: "500+", label: "Clients satisfaits" },
  { value: "5★", label: "Note moyenne" },
  { value: "7j/7", label: "Disponibilité" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.15, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  }),
};

export default function Home() {
  const { user, isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-b border-border/30">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <Link to="/">
              <img src={lcsBarberLogo} alt="LCS Barber" className="h-12 sm:h-14" />
            </Link>
            <nav className="flex items-center gap-2">
              {user ? (
                <>
                  {isAdmin && (
                    <>
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/dashboard">
                          <BarChart className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Dashboard</span>
                        </Link>
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/admin">
                          <Settings className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Admin</span>
                        </Link>
                      </Button>
                    </>
                  )}
                </>
              ) : (
                <Button asChild variant="ghost" size="sm">
                  <Link to="/auth">
                    <LogIn className="h-4 w-4 mr-2" />
                    Connexion
                  </Link>
                </Button>
              )}
              <Button asChild size="sm" className="bg-primary hover:bg-primary/90">
                <Link to="/reservation">
                  <Calendar className="h-4 w-4 mr-2" />
                  Réserver
                </Link>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImage} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'var(--gradient-hero)' }} />
        </div>

        <div className="relative z-10 container mx-auto px-4 text-center pt-20">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
            <img src={lcsBarberLogo} alt="LCS Barber" className="h-28 sm:h-36 md:h-44 mx-auto mb-8 drop-shadow-2xl" />
          </motion.div>

          <motion.h1
            className="text-5xl sm:text-6xl md:text-8xl font-bold tracking-wider text-foreground mb-4"
            initial="hidden" animate="visible" variants={fadeUp} custom={1}
          >
            L'ART DU <span className="text-gradient">STYLE</span>
          </motion.h1>

          <motion.p
            className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto mb-10 font-light"
            initial="hidden" animate="visible" variants={fadeUp} custom={2}
          >
            Expertise en coupes afro & européennes. Un savoir-faire unique pour un style qui vous ressemble.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial="hidden" animate="visible" variants={fadeUp} custom={3}
          >
            <Button asChild size="lg" className="text-lg px-10 py-6 bg-primary hover:bg-primary/90 shadow-elegant">
              <Link to="/reservation">
                <Calendar className="mr-2 h-5 w-5" />
                Prendre rendez-vous
              </Link>
            </Button>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2">
            <div className="w-1 h-2 rounded-full bg-primary" />
          </div>
        </motion.div>
      </section>

      {/* Glow divider */}
      <div className="glow-line" />

      {/* Stats */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                className="text-center"
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} custom={i}
              >
                <div className="text-3xl sm:text-4xl font-bold text-gradient">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="glow-line" />

      {/* Services */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.h2
            className="text-4xl sm:text-5xl font-bold text-center mb-16 text-foreground"
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} custom={0}
          >
            NOS <span className="text-gradient">SERVICES</span>
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {services.map((service, i) => (
              <motion.div
                key={service.title}
                className="glass-card p-8 text-center group hover:border-primary/30 transition-all duration-500"
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} custom={i}
                whileHover={{ y: -4 }}
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5 group-hover:bg-primary/20 transition-colors">
                  <service.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-3">{service.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{service.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="glow-line" />

      {/* Features */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { icon: Clock, title: "Réservation rapide", desc: "Choisissez votre créneau en quelques clics" },
              { icon: MapPin, title: "Service à domicile", desc: "On se déplace chez vous dans toute la région" },
              { icon: Star, title: "Qualité garantie", desc: "Des finitions impeccables à chaque visite" },
            ].map((feat, i) => (
              <motion.div
                key={feat.title}
                className="flex flex-col items-center text-center"
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} custom={i}
              >
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                  <feat.icon className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">{feat.title}</h3>
                <p className="text-sm text-muted-foreground">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="glow-line" />

      {/* CTA */}
      <section className="py-24">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} custom={0}
          >
            <h2 className="text-4xl sm:text-6xl font-bold text-foreground mb-6">
              PRÊT POUR UN <span className="text-gradient">NOUVEAU STYLE</span> ?
            </h2>
            <p className="text-muted-foreground text-lg mb-10 max-w-lg mx-auto">
              Réservez votre créneau maintenant et laissez-nous sublimer votre style.
            </p>
            <Button asChild size="lg" className="text-lg px-12 py-7 bg-primary hover:bg-primary/90 shadow-elegant">
              <Link to="/reservation">
                <Calendar className="mr-2 h-5 w-5" />
                Réserver maintenant
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} LCS Barber — Tous droits réservés
        </div>
      </footer>
    </div>
  );
}
