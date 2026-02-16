import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { Settings, BarChart, LogIn, Calendar, Scissors, Star, Clock, MapPin, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import lcsBarberLogo from "@/assets/lcs-barber-logo.png";
import heroImage from "@/assets/hero-barber.jpg";

const fadeIn = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  }),
};

export default function Home() {
  const { user, isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Minimal Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/40 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="shrink-0">
            <img src={lcsBarberLogo} alt="LCS Barber" className="h-12 sm:h-14" />
          </Link>
          <nav className="flex items-center gap-3">
            {user && isAdmin && (
              <>
                <Link to="/dashboard" className="text-muted-foreground hover:text-foreground text-xs uppercase tracking-[0.15em] transition-colors font-medium hidden sm:block">
                  Dashboard
                </Link>
                <Link to="/admin" className="text-muted-foreground hover:text-foreground text-xs uppercase tracking-[0.15em] transition-colors font-medium hidden sm:block">
                  Admin
                </Link>
              </>
            )}
            {!user && (
              <Link to="/auth" className="text-muted-foreground hover:text-foreground text-xs uppercase tracking-[0.15em] transition-colors font-medium">
                Connexion
              </Link>
            )}
            <Link to="/reservation" className="btn-premium px-6 py-2.5 rounded-sm inline-flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              Réserver
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero — Full-screen immersive */}
      <section className="relative h-screen flex items-end justify-center pb-24 sm:pb-32">
        <div className="absolute inset-0">
          <img src={heroImage} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'var(--gradient-hero)' }} />
        </div>

        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={0}>
            <img src={lcsBarberLogo} alt="LCS Barber" className="h-24 sm:h-32 md:h-40 mx-auto mb-10 drop-shadow-2xl" />
          </motion.div>

          <motion.p
            className="text-xs sm:text-sm uppercase tracking-[0.3em] text-primary mb-6 font-medium"
            initial="hidden" animate="visible" variants={fadeIn} custom={1}
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            Barbershop Premium
          </motion.p>

          <motion.h1
            className="text-5xl sm:text-6xl md:text-8xl font-semibold text-foreground mb-6 leading-[0.95]"
            initial="hidden" animate="visible" variants={fadeIn} custom={2}
          >
            L'Excellence<br />
            <span className="text-gold-gradient italic font-light">au Service du Style</span>
          </motion.h1>

          <motion.p
            className="text-base sm:text-lg text-muted-foreground max-w-lg mx-auto mb-12 leading-relaxed"
            initial="hidden" animate="visible" variants={fadeIn} custom={3}
            style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 300 }}
          >
            Coupes afro & européennes d'exception.<br className="hidden sm:block" />
            Un savoir-faire unique, une expérience sur mesure.
          </motion.p>

          <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={4}>
            <Link to="/reservation" className="btn-premium px-10 py-4 rounded-sm inline-flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4" />
              Prendre Rendez-vous
            </Link>
          </motion.div>
        </div>

        {/* Scroll hint */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-muted-foreground"
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
        >
          <ChevronDown className="h-5 w-5" />
        </motion.div>
      </section>

      {/* Gold line */}
      <div className="gold-line" />

      {/* Savoir-faire section */}
      <section className="py-28 sm:py-36">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            className="text-center mb-20"
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeIn} custom={0}
          >
            <p className="text-xs uppercase tracking-[0.3em] text-primary mb-4 font-medium" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Nos prestations
            </p>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-semibold text-foreground">
              Un Art, <span className="text-gold-gradient italic font-light">Trois Expertises</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Scissors, title: "Coupes Afro", desc: "Dégradé, taper fade, box cut, waves — chaque coupe est sculptée avec précision." },
              { icon: Scissors, title: "Coupes Européennes", desc: "Undercut, pompadour, textured crop — des techniques maîtrisées pour un style impeccable." },
              { icon: Star, title: "Barbe & Finitions", desc: "Taille, rasage, tracé — une attention méticuleuse portée à chaque détail." },
            ].map((service, i) => (
              <motion.div
                key={service.title}
                className="glass-card p-10 group hover:border-primary/20 transition-all duration-700"
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeIn} custom={i}
                whileHover={{ y: -6, transition: { duration: 0.4 } }}
              >
                <service.icon className="h-6 w-6 text-primary mb-6" strokeWidth={1.5} />
                <h3 className="text-2xl sm:text-3xl text-foreground mb-4">{service.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-sm" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 300 }}>
                  {service.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="gold-line" />

      {/* Why us — minimalist */}
      <section className="py-28 sm:py-36">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid sm:grid-cols-3 gap-16 sm:gap-12">
            {[
              { icon: Clock, value: "Sur RDV", label: "Ponctualité garantie" },
              { icon: MapPin, value: "À domicile", label: "On vient à vous" },
              { icon: Star, value: "5 étoiles", label: "Satisfaction client" },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                className="text-center"
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeIn} custom={i}
              >
                <item.icon className="h-5 w-5 text-primary mx-auto mb-4" strokeWidth={1.5} />
                <div className="text-3xl sm:text-4xl text-gold-gradient font-semibold mb-2">{item.value}</div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  {item.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="gold-line" />

      {/* CTA */}
      <section className="py-28 sm:py-40">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeIn} custom={0}
          >
            <p className="text-xs uppercase tracking-[0.3em] text-primary mb-6 font-medium" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Prêt ?
            </p>
            <h2 className="text-4xl sm:text-5xl md:text-7xl font-semibold text-foreground mb-8 leading-[0.95]">
              Votre Prochain<br />
              <span className="text-gold-gradient italic font-light">Style Commence Ici</span>
            </h2>
            <Link to="/reservation" className="btn-premium px-12 py-4 rounded-sm inline-flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4" />
              Réserver Maintenant
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-10">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <img src={lcsBarberLogo} alt="LCS Barber" className="h-10 mx-auto mb-4 opacity-60" />
          <p className="text-xs text-muted-foreground tracking-widest uppercase" style={{ fontFamily: "'Outfit', sans-serif" }}>
            © {new Date().getFullYear()} LCS Barber — Tous droits réservés
          </p>
        </div>
      </footer>
    </div>
  );
}
