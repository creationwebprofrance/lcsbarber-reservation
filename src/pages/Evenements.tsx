import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Clock, Euro } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import lcsBarberLogo from "@/assets/lcs-barber-logo.png";
import EventSection from "@/components/EventSection";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  }),
};

interface EventData {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  start_date: string;
  end_date: string;
  start_hour: string;
  end_hour: string;
  prix_coupe_classique: number;
  prix_coupe_barbe: number;
  prix_barbe: number;
  prix_contours: number;
}

export default function Evenements() {
  const [activeEvent, setActiveEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("events")
      .select("*")
      .eq("is_active", true)
      .order("start_date", { ascending: true })
      .limit(1)
      .then(({ data }) => {
        setActiveEvent(data && data.length > 0 ? data[0] as EventData : null);
        setLoading(false);
      });
  }, []);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/70 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-6xl mx-auto px-5 py-3 flex justify-between items-center">
          <Link to="/" className="shrink-0">
            <img src={lcsBarberLogo} alt="LCS Barber" className="h-20 sm:h-24" />
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Retour
            </Link>
          </Button>
        </div>
      </header>

      <div className="pt-32 sm:pt-36">
        {/* Upcoming Event Section */}
        <section className="py-16 sm:py-20">
          <div className="max-w-4xl mx-auto px-5">
            <motion.div
              className="mb-10"
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              variants={fadeUp} custom={0}
            >
              <p className="text-primary text-sm font-semibold mb-2 tracking-wide">PROCHAIN ÉVÉNEMENT</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
                Événement spécial
              </h2>
            </motion.div>

            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Chargement...</div>
            ) : activeEvent ? (
              <motion.div
                className="bg-card border border-border/50 rounded-2xl p-8 sm:p-10 relative overflow-hidden"
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} custom={1}
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">🎉 Actif</Badge>
                <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">{activeEvent.name}</h3>
                {activeEvent.description && (
                  <p className="text-muted-foreground mb-6">{activeEvent.description}</p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                  <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-4">
                    <Calendar className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Dates</p>
                      <p className="text-sm font-semibold text-foreground">
                        {formatDate(activeEvent.start_date)} — {formatDate(activeEvent.end_date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-4">
                    <Clock className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Horaires</p>
                      <p className="text-sm font-semibold text-foreground">
                        {activeEvent.start_hour.slice(0, 5)} — {activeEvent.end_hour.slice(0, 5)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-4">
                    <Euro className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">À partir de</p>
                      <p className="text-sm font-semibold text-foreground">
                        {Math.min(
                          activeEvent.prix_coupe_classique,
                          activeEvent.prix_coupe_barbe,
                          activeEvent.prix_barbe,
                          activeEvent.prix_contours
                        ).toFixed(0)}€
                      </p>
                    </div>
                  </div>
                </div>

                {/* Prices grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Coupe classique", price: activeEvent.prix_coupe_classique },
                    { label: "Coupe + barbe", price: activeEvent.prix_coupe_barbe },
                    { label: "Barbe", price: activeEvent.prix_barbe },
                    { label: "Contours", price: activeEvent.prix_contours },
                  ].map((item) => (
                    <div key={item.label} className="bg-background border border-border/50 rounded-xl p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                      <p className="text-xl font-bold text-foreground">{item.price}€</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                className="bg-card border border-border/50 rounded-2xl p-10 sm:p-14 text-center"
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} custom={1}
              >
                <div className="text-4xl mb-4">🎭</div>
                <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3">
                  Prochain événement à venir
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Restez connectés — un nouvel événement spécial sera bientôt annoncé. Suivez-nous pour ne rien manquer !
                </p>
              </motion.div>
            )}
          </div>
        </section>

        <div className="stripe-line" />

        {/* Organizations & Artists */}
        <EventSection />

        <div className="stripe-line" />

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
    </div>
  );
}
