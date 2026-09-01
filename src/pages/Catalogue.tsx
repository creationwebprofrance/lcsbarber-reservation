import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import lcsBarberLogo from "@/assets/lcs-barber-logo.png";

interface Haircut {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
}

const thumbUrl = (url: string, width = 500) => {
  if (!url) return url;
  return `${url}${url.includes("?") ? "&" : "?"}width=${width}&resize=contain`;
};

export default function Catalogue() {
  const [haircuts, setHaircuts] = useState<Haircut[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Haircut | null>(null);

  useEffect(() => {
    supabase
      .from("haircuts")
      .select("id, title, description, image_url")
      .order("display_order", { ascending: true })
      .then(({ data }) => {
        setHaircuts((data as Haircut[]) || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/70 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-6xl mx-auto px-5 py-3 flex justify-between items-center">
          <Link to="/" className="shrink-0">
            <img src={lcsBarberLogo} alt="LCS Barber" className="h-16 sm:h-20" />
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Retour
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 pt-32 pb-20">
        <p className="text-primary text-sm font-semibold mb-2 tracking-wide">CATALOGUE</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">Mes coupes</h1>
        <p className="text-muted-foreground mb-10 max-w-lg">
          Une sélection de réalisations — inspire-toi et choisis ton style avant de réserver.
        </p>

        {loading ? (
          <p className="text-muted-foreground">Chargement...</p>
        ) : haircuts.length === 0 ? (
          <p className="text-muted-foreground">Le catalogue arrive très bientôt.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {haircuts.map((h, i) => (
              <motion.button
                key={h.id}
                onClick={() => setSelected(h)}
                className="group text-left"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (i % 8) * 0.05 }}
              >
                <div className="aspect-[3/4] overflow-hidden rounded-xl border border-border/50 bg-card">
                  <img
                    src={thumbUrl(h.image_url)}
                    alt={h.title}
                    loading="lazy"
                    width={500}
                    height={666}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">{h.title}</p>
              </motion.button>
            ))}
          </div>
        )}

        <div className="mt-14 text-center">
          <Button asChild size="lg" className="font-semibold px-8">
            <Link to="/reservation">
              <Calendar className="h-4 w-4 mr-2" /> Réserver ma coupe
            </Link>
          </Button>
        </div>
      </main>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <div className="space-y-4">
              <img
                src={selected.image_url}
                alt={selected.title}
                className="w-full rounded-lg object-cover max-h-[70vh]"
              />
              <div>
                <h2 className="text-xl font-bold text-foreground">{selected.title}</h2>
                {selected.description && (
                  <p className="text-sm text-muted-foreground mt-1">{selected.description}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
