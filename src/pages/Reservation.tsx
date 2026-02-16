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
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/70 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-6xl mx-auto px-5 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Link to="/">
              <img src={lcsBarberLogo} alt="LCS Barber" className="h-9 sm:h-11" />
            </Link>
          </div>
          <nav className="flex items-center gap-2">
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
          </nav>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-5 pt-24 pb-10 space-y-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-primary text-sm font-semibold mb-2 tracking-wide">RÉSERVATION</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
            Choisis ta coupe, <span className="text-primary">on s'occupe du reste.</span>
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            Sélectionne ta prestation et ton créneau. Confirmation par email.
          </p>
          <div className="stripe-line" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <BookingTool />
        </motion.div>

        <div className="stripe-line" />

        <motion.div
          className="space-y-8"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <ReviewForm />
          <ReviewsList />
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 mt-8">
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
