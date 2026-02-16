import { BookingTool } from "@/components/BookingTool";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { Settings, BarChart, LogIn, ArrowLeft } from "lucide-react";
import { ReviewsList } from "@/components/ReviewsList";
import { ReviewForm } from "@/components/ReviewForm";
import { motion } from "framer-motion";
import lcsBarberLogo from "@/assets/lcs-barber-logo.png";

export default function Index() {
  const { user, isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/40 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Link to="/">
              <img src={lcsBarberLogo} alt="LCS Barber" className="h-10 sm:h-12" />
            </Link>
          </div>
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
          </nav>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-28 pb-12 space-y-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-4 font-medium" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Réservation
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold text-foreground mb-4">
            Prenez <span className="text-gold-gradient italic font-light">Rendez-vous</span>
          </h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 300 }}>
            Sélectionnez votre prestation et choisissez le créneau qui vous convient.
          </p>
          <div className="gold-line mt-8" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          <BookingTool />
        </motion.div>

        <div className="gold-line" />

        <motion.div
          className="space-y-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <ReviewForm />
          <ReviewsList />
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/50 py-10 mt-8">
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
