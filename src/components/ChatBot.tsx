import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import botHappy from "@/assets/bot/bot-happy.png";
import botExcited from "@/assets/bot/bot-excited.png";
import botThinking from "@/assets/bot/bot-thinking.png";
import botWave from "@/assets/bot/bot-wave.png";

type Emotion = "happy" | "excited" | "thinking" | "wave";

const BOT_IMAGES: Record<Emotion, string> = {
  happy: botHappy,
  excited: botExcited,
  thinking: botThinking,
  wave: botWave,
};

/** Respiration / flottement permanent — le "souffle" de Léo */
const BREATH: Record<Emotion, { animate: Record<string, unknown>; transition: Record<string, unknown> }> = {
  happy: {
    animate: { y: [0, -4, 0, -2, 0], scaleY: [1, 1.03, 1, 1.02, 1], scaleX: [1, 0.985, 1, 0.99, 1] },
    transition: { duration: 3.2, repeat: Infinity, ease: "easeInOut" },
  },
  excited: {
    animate: { y: [0, -9, 0], scaleY: [1, 1.06, 0.95, 1], scaleX: [1, 0.95, 1.05, 1] },
    transition: { duration: 0.75, repeat: Infinity, ease: "easeInOut" },
  },
  thinking: {
    animate: { y: [0, -2, 0], scaleY: [1, 1.02, 1], scaleX: [1, 0.99, 1] },
    transition: { duration: 2.6, repeat: Infinity, ease: "easeInOut" },
  },
  wave: {
    animate: { y: [0, -6, 0], scaleY: [1, 1.04, 1], scaleX: [1, 0.98, 1] },
    transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
  },
};

/** Petits gestes aléatoires joués par-dessus la respiration */
const IDLE_GESTURES = [
  { rotate: [0, -9, 7, -4, 0], transition: { duration: 1.1, ease: "easeInOut" } }, // secoue la tête
  { y: [0, -16, 2, 0], scaleY: [1, 1.1, 0.9, 1], transition: { duration: 0.8, ease: "easeOut" } }, // petit saut
  { rotate: [0, 12, 12, 0], x: [0, 4, 4, 0], transition: { duration: 1.4, ease: "easeInOut" } }, // penche la tête
  { scale: [1, 1.12, 0.96, 1], transition: { duration: 0.65, ease: "easeInOut" } }, // s'étire
  { x: [0, -6, 6, -3, 0], transition: { duration: 0.9, ease: "easeInOut" } }, // se dandine
];

function BotAvatar({
  emotion,
  className,
  interactive = true,
}: {
  emotion: Emotion;
  className?: string;
  interactive?: boolean;
}) {
  const breath = BREATH[emotion];
  const gesture = useAnimationControls();
  const [blink, setBlink] = useState(false);

  // Léo suit le curseur du regard
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const tiltX = useSpring(useTransform(mx, [-1, 1], [7, -7]), { stiffness: 120, damping: 14 });
  const tiltY = useSpring(useTransform(my, [-1, 1], [-9, 9]), { stiffness: 120, damping: 14 });
  const shiftX = useSpring(useTransform(my, [-1, 1], [-3, 3]), { stiffness: 120, damping: 14 });

  useEffect(() => {
    if (!interactive) return;
    const onMove = (e: MouseEvent) => {
      mx.set((e.clientX / window.innerWidth) * 2 - 1);
      my.set((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [interactive, mx, my]);

  // Gestes spontanés
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      const delay = 2600 + Math.random() * 4200;
      timer = setTimeout(() => {
        if (cancelled) return;
        const g = IDLE_GESTURES[Math.floor(Math.random() * IDLE_GESTURES.length)];
        gesture.start(g as never);
        loop();
      }, delay);
    };
    loop();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [gesture]);

  // Clignement des yeux
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(() => {
        if (cancelled) return;
        setBlink(true);
        setTimeout(() => !cancelled && setBlink(false), 120);
        loop();
      }, 2200 + Math.random() * 3500);
    };
    loop();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className={cn("relative", className)}>
      {/* Halo qui pulse comme un cœur */}
      <motion.div
        className="absolute inset-0 rounded-full bg-primary/25 blur-xl"
        animate={{ opacity: [0.45, 0.85, 0.45], scale: [0.9, 1.08, 0.9] }}
        transition={{ duration: emotion === "excited" ? 1 : 2.6, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />
      {/* Ombre au sol */}
      <motion.div
        className="absolute inset-x-[18%] bottom-0 h-1.5 rounded-full bg-black/50 blur-[3px]"
        animate={{ scaleX: [1, 0.78, 1], opacity: [0.5, 0.28, 0.5] }}
        transition={breath.transition}
        aria-hidden
      />

      {/* Couche 1 : gestes spontanés */}
      <motion.div animate={gesture} className="relative h-full w-full">
        {/* Couche 2 : suivi du curseur */}
        <motion.div style={{ rotate: tiltX, x: shiftX, rotateY: tiltY }} className="h-full w-full">
          {/* Couche 3 : respiration + expression */}
          <AnimatePresence mode="wait">
            <motion.img
              key={emotion}
              src={BOT_IMAGES[emotion]}
              alt="Léo, l'assistant LCS Barber"
              width={128}
              height={128}
              loading="lazy"
              className="relative h-full w-full origin-bottom object-contain drop-shadow-[0_6px_18px_hsl(var(--primary)/0.35)]"
              initial={{ opacity: 0, scale: 0.8, rotate: -8 }}
              exit={{ opacity: 0, scale: 0.8, rotate: 8 }}
              animate={{ opacity: 1, ...breath.animate }}
              transition={{ opacity: { duration: 0.25 }, ...breath.transition }}
            />
          </AnimatePresence>
        </motion.div>
      </motion.div>

      {/* Clignement : voile rapide sur la zone des yeux */}
      <motion.div
        className="pointer-events-none absolute inset-x-[22%] top-[32%] h-[9%] rounded-full bg-[#0B0B0B]"
        animate={{ opacity: blink ? 0.85 : 0, scaleY: blink ? 1 : 0.2 }}
        transition={{ duration: 0.09 }}
        aria-hidden
      />

      {/* Étincelles quand il est enthousiaste */}
      <AnimatePresence>
        {emotion === "excited" &&
          [0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="pointer-events-none absolute h-1 w-1 rounded-full bg-primary"
              style={{ left: `${18 + i * 30}%`, top: "8%" }}
              initial={{ opacity: 0, y: 6, scale: 0.5 }}
              animate={{ opacity: [0, 1, 0], y: [-2, -16], scale: [0.5, 1.2, 0.4] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.25 }}
              aria-hidden
            />
          ))}
      </AnimatePresence>
    </div>
  );
}


export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [emotion, setEmotion] = useState<Emotion>("wave");
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) {
      setEmotion("wave");
      const t = setTimeout(() => inputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setEmotion("thinking");

    try {
      const { data, error } = await supabase.functions.invoke("chat-assistant", {
        body: { messages: next.map((m) => ({ role: m.role, content: m.content })) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setEmotion((data?.emotion as Emotion) ?? "happy");
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (e) {
      console.error(e);
      setEmotion("thinking");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Oups, je n'arrive pas à répondre pour le moment. Réessaie dans un instant, ou écris directement à Lucas.",
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  return (
    <>
      {/* Bouton flottant */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="launcher"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir l'assistant LCS Barber"
            initial={{ opacity: 0, scale: 0.7, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7, y: 20 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            className="fixed bottom-5 right-5 z-50 flex h-16 w-16 items-center justify-center rounded-full border border-primary/40 bg-card shadow-elegant"
          >
            <BotAvatar emotion="happy" className="h-14 w-14" />
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-primary" />
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Fenêtre de chat */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed bottom-4 right-4 left-4 z-50 flex max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-elegant sm:left-auto sm:w-[380px]"
          >
            {/* En-tête */}
            <div className="flex items-center gap-3 border-b border-border/60 bg-gradient-card px-4 py-3">
              <BotAvatar emotion={emotion} className="h-12 w-12 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg leading-none text-foreground">LÉO</p>
                <p className="truncate text-xs text-muted-foreground">
                  {loading ? "Réfléchit..." : "Assistant LCS Barber — en ligne"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Fermer l'assistant"
                className="h-8 w-8 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                      m.role === "user"
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm bg-secondary text-secondary-foreground",
                    )}
                  >
                    {m.content}
                  </div>
                </motion.div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-secondary px-3.5 py-3">
                    {[0, 1, 2].map((d) => (
                      <motion.span
                        key={d}
                        className="h-1.5 w-1.5 rounded-full bg-primary"
                        animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                        transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {messages.length === 1 && !loading && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border border-primary/40 px-3 py-1.5 text-xs text-primary transition-colors hover:bg-primary/10"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Saisie */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-2 border-t border-border/60 bg-background/60 px-3 py-3"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pose ta question..."
                maxLength={500}
                className="h-10 flex-1 rounded-full border border-border bg-input px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              <Button type="submit" size="icon" disabled={loading || !input.trim()} className="h-10 w-10 shrink-0 rounded-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
