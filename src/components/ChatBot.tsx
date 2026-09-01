import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
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

const EMOTION_MOTION: Record<Emotion, { animate: Record<string, unknown>; transition: Record<string, unknown> }> = {
  happy: {
    animate: { y: [0, -5, 0], rotate: [0, 1.5, 0, -1.5, 0], scale: 1 },
    transition: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
  },
  excited: {
    animate: { y: [0, -10, 0], rotate: [-4, 4, -4], scale: [1, 1.05, 1] },
    transition: { duration: 0.9, repeat: Infinity, ease: "easeInOut" },
  },
  thinking: {
    animate: { y: [0, -2, 0], rotate: [-2, -2, -2], scale: 1 },
    transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut" },
  },
  wave: {
    animate: { y: [0, -6, 0], rotate: [0, 6, -6, 0], scale: 1 },
    transition: { duration: 1.6, repeat: Infinity, ease: "easeInOut" },
  },
};

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Comment réserver ?",
  "Quels sont tes tarifs ?",
  "J'ai oublié mon mot de passe",
  "Aucun créneau ne s'affiche",
];

const GREETING: Message = {
  role: "assistant",
  content: "Salut ! Moi c'est Léo, l'assistant de LCS Barber. Une question sur les prestations, les tarifs ou ta réservation ? Je suis là.",
};

function BotAvatar({ emotion, className }: { emotion: Emotion; className?: string }) {
  const m = EMOTION_MOTION[emotion];
  return (
    <div className={cn("relative", className)}>
      <div className="absolute inset-0 rounded-full bg-primary/25 blur-xl" aria-hidden />
      <AnimatePresence mode="wait">
        <motion.img
          key={emotion}
          src={BOT_IMAGES[emotion]}
          alt="Léo, l'assistant LCS Barber"
          width={128}
          height={128}
          loading="lazy"
          className="relative h-full w-full object-contain drop-shadow-[0_6px_18px_hsl(var(--primary)/0.35)]"
          initial={{ opacity: 0, scale: 0.85 }}
          exit={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, ...m.animate }}
          transition={{ opacity: { duration: 0.25 }, ...m.transition }}
        />
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
