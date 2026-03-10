import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import lcsBarberLogo from "@/assets/lcs-barber-logo.png";
import EventSection from "@/components/EventSection";
import EventBookingCard from "@/components/EventBookingCard";

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
  excluded_services?: string | null;
}

export default function Evenements() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("events")
      .select("*")
      .eq("is_active", true)
      .order("start_date", { ascending: true })
      .then(({ data }) => {
        setEvents((data as EventData[]) || []);
        setLoading(false);
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
          <Button asChild variant="outline" size="sm">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Retour
            </Link>
          </Button>
        </div>
      </header>

      <div className="pt-32 sm:pt-36">
        {/* Events Section */}
        <section className="py-16 sm:py-20">
          <div className="max-w-4xl mx-auto px-5">
            <motion.div
              className="mb-10"
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              variants={fadeUp} custom={0}
            >
              <p className="text-primary text-sm font-semibold mb-2 tracking-wide">ÉVÉNEMENTS</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
                Nos événements
              </h2>
            </motion.div>

            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Chargement...</div>
            ) : events.length > 0 ? (
              <div className="space-y-6">
                {events.map((event) => (
                  <EventBookingCard key={event.id} event={event} />
                ))}
              </div>
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
