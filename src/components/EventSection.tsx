import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

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
  { name: "MJTX", logo: mjtxLogo, description: "Booking / Événementiel / Concert / Production / Édition / Consulting", bgClass: "bg-white", hasGallery: false },
  { name: "Empire Club", logo: empireClubLogo, description: "Best Caribbean Club in Paris – La plus grande destination caribéenne d'Île-de-France", bgClass: "bg-black", hasGallery: true },
  { name: "Ice Event", logo: iceEventsLogo, description: "L'élégance glacée de la vie nocturne parisienne", bgClass: "bg-white", hasGallery: true },
  { name: "Carnaval de Bordeaux", logo: carnavalLogo, description: "Événement de 4 jours à Bordeaux", bgClass: "bg-[#1a1a2e]", hasGallery: false },
  { name: "OG Event", logo: ogEventLogo, description: "Rookie 2025 – Événementiel", bgClass: "bg-black", hasGallery: false },
];

interface ArtistImage {
  id: string;
  image_url: string;
  display_order: number;
}

interface Artist {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  display_order: number;
  images: ArtistImage[];
}

// Append Supabase Storage image transform params for smaller thumbnails
const thumbUrl = (url: string, width = 300) => {
  if (!url) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}width=${width}&resize=contain`;
};

export default function EventSection() {
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [artists, setArtists] = useState<Artist[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: artistsData } = await supabase
        .from("artists")
        .select("*")
        .order("display_order", { ascending: true });

      const { data: imagesData } = await supabase
        .from("artist_images")
        .select("*")
        .order("display_order", { ascending: true });

      setArtists(
        (artistsData || []).map((a: any) => ({
          ...a,
          images: (imagesData || []).filter((img: any) => img.artist_id === a.id),
        }))
      );
    };
    load();
  }, []);

  return (
    <>
      {/* Organizations & Collaborations */}
      <section className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-5">
          <motion.div className="mb-14" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <p className="text-primary text-sm font-semibold mb-2 tracking-wide">BOOK ÉVÉNEMENTIEL</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Organisations &<br className="hidden sm:block" /> Collaborations
            </h2>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
            {organizations.map((org, i) => (
              <motion.button
                key={org.name}
                onClick={() => setSelectedOrg(org)}
                className={`${org.bgClass} rounded-xl p-5 sm:p-6 flex items-center justify-center aspect-square border border-border/50 hover:border-primary/40 transition-all duration-300 hover:scale-[1.03] hover:shadow-lg group cursor-pointer`}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} custom={i}
              >
                <img src={org.logo} alt={org.name} className="max-h-20 sm:max-h-24 w-auto object-contain group-hover:scale-105 transition-transform" />
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
          <motion.div className="mb-14" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <p className="text-primary text-sm font-semibold mb-2 tracking-wide">ARTISTES</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Ils nous font<br className="hidden sm:block" /> confiance.
            </h2>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5">
            {artists.map((artist, i) => (
              <motion.button
                key={artist.id}
                onClick={() => setSelectedArtist(artist)}
                className="group cursor-pointer text-left"
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} custom={i}
              >
                <div className="aspect-[3/4] rounded-xl bg-muted border border-border/50 group-hover:border-primary/40 transition-all duration-300 flex items-center justify-center mb-3 overflow-hidden group-hover:shadow-lg">
                  {artist.photo_url ? (
                    <img src={thumbUrl(artist.photo_url, 300)} alt={artist.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-muted-foreground text-center px-3">Photo à venir</span>
                  )}
                </div>
                <h4 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors flex items-center gap-1">
                  {artist.name}
                  <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h4>
              </motion.button>
            ))}
          </div>

          {artists.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">Aucun artiste pour le moment.</div>
          )}
        </div>
      </section>

      {/* Artist Detail Dialog */}
      <Dialog open={!!selectedArtist} onOpenChange={() => setSelectedArtist(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">{selectedArtist?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedArtist && selectedArtist.images.length > 0 ? (
              <div className={`grid ${selectedArtist.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
                {selectedArtist.images.map((img, idx) => (
                  <div key={img.id} className={`rounded-lg overflow-hidden ${idx === 0 && selectedArtist.images.length > 1 ? 'col-span-2 aspect-[4/3]' : 'aspect-square'}`}>
                    <img src={img.image_url} alt={selectedArtist.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            ) : selectedArtist?.photo_url ? (
              <div className="aspect-[4/3] rounded-lg overflow-hidden">
                <img src={selectedArtist.photo_url} alt={selectedArtist.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              </div>
            ) : null}
            <p className="text-muted-foreground leading-relaxed">{selectedArtist?.description}</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
