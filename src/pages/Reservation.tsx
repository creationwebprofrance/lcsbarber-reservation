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
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-b border-border/30">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
              </Button>
              <Link to="/">
                <img src={lcsBarberLogo} alt="LCS Barber" className="h-10 sm:h-12" />
              </Link>
            </div>
            <nav className="flex items-center gap-1 sm:gap-2">
              {user ? (
                <>
                  {isAdmin && (
                    <>
                      <Button asChild variant="ghost" size="sm" className="h-8 px-2 sm:px-3">
                        <Link to="/dashboard">
                          <BarChart className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Dashboard</span>
                        </Link>
                      </Button>
                      <Button asChild variant="ghost" size="sm" className="h-8 px-2 sm:px-3">
                        <Link to="/admin">
                          <Settings className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Admin</span>
                        </Link>
                      </Button>
                    </>
                  )}
                </>
              ) : (
                <Button asChild variant="ghost" size="sm" className="h-8 px-2 sm:px-3">
                  <Link to="/auth">
                    <LogIn className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Connexion</span>
                  </Link>
                </Button>
              )}
            </nav>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-3 sm:px-4 pt-24 pb-8 space-y-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl sm:text-5xl font-bold text-center mb-2">
            <span className="text-gradient">RÉSERVATION</span>
          </h1>
          <p className="text-center text-muted-foreground mb-8">
            Choisissez votre prestation et réservez votre créneau
          </p>
          <div className="glow-line mb-8" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <BookingTool />
        </motion.div>

        <div className="glow-line" />

        <motion.div
          className="space-y-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <ReviewForm />
          <ReviewsList />
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/30 py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} LCS Barber — Tous droits réservés
        </div>
      </footer>
    </div>
  );
}
