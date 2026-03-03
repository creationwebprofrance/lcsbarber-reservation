import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import mjtxLogo from "@/assets/partners/mjtx.png";
import empireClubLogo from "@/assets/partners/empire-club.png";
import iceEventsLogo from "@/assets/partners/ice-events.png";
import carnavalLogo from "@/assets/partners/carnaval-bordeaux.png";
import ogEventLogo from "@/assets/partners/og-event.png";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  }),
};

interface Organization {
  name: string;
  logo: string;
  description: string;
  bgClass: string;
  hasGallery: boolean;
}

const organizations: Organization[] = [
  {
    name: "MJTX",
    logo: mjtxLogo,
    description: "Booking / Événementiel / Concert / Production / Édition / Consulting",
    bgClass: "bg-white",
    hasGallery: false,
  },
  {
    name: "Empire Club",
    logo: empireClubLogo,
    description: "Best Caribbean Club in Paris – La plus grande destination caribéenne d'Île-de-France",
    bgClass: "bg-black",
    hasGallery: true,
  },
  {
    name: "Ice Event",
    logo: iceEventsLogo,
    description: "L'élégance glacée de la vie nocturne parisienne",
    bgClass: "bg-white",
    hasGallery: true,
  },
  {
    name: "Carnaval de Bordeaux",
    logo: carnavalLogo,
    description: "Événement de 4 jours à Bordeaux",
    bgClass: "bg-[#1a1a2e]",
    hasGallery: false,
  },
  {
    name: "OG Event",
    logo: ogEventLogo,
    description: "Rookie 2025 – Événementiel",
    bgClass: "bg-black",
    hasGallery: false,
  },
];

interface Artist {
  name: string;
  description: string;
}

const artists: Artist[] = [
  { name: "Jixels", description: "Gestion backstage complète — coupe et préparation avant le show pour un rendu scénique impeccable. Tenue longue durée adaptée aux conditions live." },
  { name: "BRG Hollywood", description: "Styling sur mesure avant tournage — adaptation aux projecteurs et caméras. Coupe pensée pour valoriser l'image à l'écran." },
  { name: "Dcamp", description: "Prestation événementielle — coupe et finitions dans un contexte high-energy. Gestion du timing serré avec un résultat toujours propre." },
  { name: "Le Juh", description: "Collaboration backstage lors d'événements live — coupe express et précise. Adaptation aux contraintes de planning et d'espace." },
  { name: "Lewismelo", description: "Prestation coiffure en coulisses avant passage sur scène. Soin du détail pour un look qui tient du début à la fin du set." },
  { name: "Aknose", description: "Mise en forme et styling avant showcase — gestion des finitions de dernière minute. Expertise en coupe adaptée aux performances live." },
  { name: "Cocotteland", description: "Coiffure backstage festival — ambiance décontractée mais résultat pro. Adaptation au style unique de l'artiste pour chaque événement." },
  { name: "Dy Nice", description: "Prestation coiffure pré-événement — dégradé et finitions soignées. Expérience backstage avec gestion des imprévus et du timing." },
  { name: "Tency", description: "Styling complet avant scène — coupe, contours et mise en forme. Résultat pensé pour durer sous les projecteurs." },
  { name: "Young Chang", description: "Collaboration événementielle — coupe signature et finitions impeccables. Adaptation au style de l'artiste et aux conditions backstage." },
];

export default function EventSection() {
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);

  return (
    <>
      {/* Organizations & Collaborations */}
      <section className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-5">
          <motion.div
            className="mb-14"
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} custom={0}
          >
            <p className="text-primary text-sm font-semibold mb-2 tracking-wide">BOOK ÉVÉNEMENTIEL</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Organisations &<br className="hidden sm:block" /> Collaborations
            </h2>
          </motion.div>

          {/* Logo Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
            {organizations.map((org, i) => (
              <motion.button
                key={org.name}
                onClick={() => setSelectedOrg(org)}
                className={`${org.bgClass} rounded-xl p-5 sm:p-6 flex items-center justify-center aspect-square border border-border/50 hover:border-primary/40 transition-all duration-300 hover:scale-[1.03] hover:shadow-lg group cursor-pointer`}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} custom={i}
              >
                <img
                  src={org.logo}
                  alt={org.name}
                  className="max-h-20 sm:max-h-24 w-auto object-contain group-hover:scale-105 transition-transform"
                />
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* Organization Detail Dialog */}
      <Dialog open={!!selectedOrg} onOpenChange={() => setSelectedOrg(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <img src={selectedOrg?.logo} alt={selectedOrg?.name} className="h-10 w-10 object-contain rounded" />
              {selectedOrg?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">{selectedOrg?.description}</p>
            {selectedOrg?.hasGallery && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">📸 Galerie</h4>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="aspect-square rounded-lg bg-muted flex items-center justify-center">
                      <span className="text-xs text-muted-foreground text-center px-2">Photos en cours de traitement</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="stripe-line" />

      {/* Artists Section */}
      <section className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-5">
          <motion.div
            className="mb-14"
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} custom={0}
          >
            <p className="text-primary text-sm font-semibold mb-2 tracking-wide">ARTISTES</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Ils nous font<br className="hidden sm:block" /> confiance.
            </h2>
          </motion.div>

          {/* Artist Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5">
            {artists.map((artist, i) => (
              <motion.button
                key={artist.name}
                onClick={() => setSelectedArtist(artist)}
                className="group cursor-pointer text-left"
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} custom={i}
              >
                <div className="aspect-[3/4] rounded-xl bg-muted border border-border/50 group-hover:border-primary/40 transition-all duration-300 flex items-center justify-center mb-3 overflow-hidden group-hover:shadow-lg">
                  <span className="text-xs text-muted-foreground text-center px-3">Photos en cours de traitement</span>
                </div>
                <h4 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors flex items-center gap-1">
                  {artist.name}
                  <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h4>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* Artist Detail Dialog */}
      <Dialog open={!!selectedArtist} onOpenChange={() => setSelectedArtist(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">{selectedArtist?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">{selectedArtist?.description}</p>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">📸 Photos de prestation</h4>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="aspect-square rounded-lg bg-muted flex items-center justify-center">
                    <span className="text-xs text-muted-foreground text-center px-2">Photos en cours de traitement</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
