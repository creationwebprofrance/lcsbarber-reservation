import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

interface Review {
  id: string;
  client_name: string;
  rating: number;
  comment: string | null;
}

const SPEED = 0.5; // px per frame — vitesse moyenne

export const ReviewsCarousel = () => {
  const { t } = useLanguage();
  const [reviews, setReviews] = useState<Review[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const draggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const halfWidthRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    supabase
      .from("public_reviews")
      .select("id, client_name, rating, comment")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setReviews(data || []));
  }, []);

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (track) halfWidthRef.current = track.scrollWidth / 2;
  }, []);

  useEffect(() => {
    if (reviews.length === 0) return;
    measure();
    window.addEventListener("resize", measure);

    let raf: number;
    const tick = () => {
      if (!draggingRef.current && halfWidthRef.current > 0) {
        offsetRef.current -= SPEED; // défile de droite à gauche
      }
      // boucle infinie
      if (offsetRef.current <= -halfWidthRef.current) offsetRef.current += halfWidthRef.current;
      if (offsetRef.current > 0) offsetRef.current -= halfWidthRef.current;
      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [reviews, measure]);

  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    dragStartOffsetRef.current = offsetRef.current;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    offsetRef.current = dragStartOffsetRef.current + (e.clientX - dragStartXRef.current);
  };

  const endDrag = () => {
    draggingRef.current = false;
    setIsDragging(false);
    // le rAF reprend le défilement automatique tout seul
  };

  if (reviews.length === 0) return null;

  const items = [...reviews, ...reviews]; // duplication pour boucle infinie

  return (
    <section className="py-14 sm:py-20 overflow-hidden">
      <div className="max-w-6xl mx-auto px-5 mb-8">
        <p className="text-primary text-sm font-semibold mb-2 tracking-wide">{t("stats.reviews").toUpperCase()}</p>
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
          {t("reviews.title")}
        </h2>
      </div>

      <div
        className={`select-none touch-pan-y ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
      >
        <div ref={trackRef} className="flex gap-4 w-max will-change-transform pl-5">
          {items.map((review, i) => (
            <div
              key={`${review.id}-${i}`}
              className="w-[280px] sm:w-[340px] shrink-0 bg-card border border-border/50 rounded-2xl p-6 flex flex-col"
            >
              <div className="flex gap-1 mb-3">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star
                    key={s}
                    className={`h-4 w-4 ${s < review.rating ? "fill-primary text-primary" : "text-muted-foreground/30"}`}
                  />
                ))}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1 line-clamp-4">
                {review.comment || t("reviews.noComment")}
              </p>
              <p className="mt-4 text-sm font-semibold text-foreground">{review.client_name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
