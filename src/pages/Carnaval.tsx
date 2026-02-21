import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar as CalendarIcon, Clock, Scissors, Check, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import lcsBarberLogo from "@/assets/lcs-barber-logo.png";
import { TimeSlotSelector } from "@/components/TimeSlotSelector";

// Prix spéciaux Carnaval — override par nom de service
const CARNAVAL_PRICE_OVERRIDES: Record<string, number> = {
  "Barbe uniquement": 20,
};
// Services exclus du Carnaval
const CARNAVAL_EXCLUDED_SERVICES = ["Coupe enfant"];

const CARNAVAL_START = new Date(2026, 1, 28); // Feb 28
const CARNAVAL_END = new Date(2026, 2, 1);   // March 1

const bookingFormSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères").max(100).regex(/^[a-zA-ZÀ-ÿ\s'-]+$/),
  email: z.string().trim().email("Email invalide").max(255).toLowerCase(),
  phone: z.string().trim().min(10, "Téléphone invalide").max(20).regex(/^[0-9\s+()-]+$/),
  address: z.string().trim().min(5, "Adresse trop courte").max(500),
  message: z.string().trim().max(1000).optional(),
});

interface Service {
  id: string;
  name: string;
  price: number;
  description?: string;
}

function CarnivalServiceSelector({ selectedService, onServiceSelect }: { selectedService: Service | null; onServiceSelect: (s: Service) => void }) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("services").select("*").eq("is_active", true).order("name");
      const filtered = (data || [])
        .filter((s: any) => !CARNAVAL_EXCLUDED_SERVICES.includes(s.name))
        .map((s: any) => ({
          ...s,
          price: CARNAVAL_PRICE_OVERRIDES[s.name] ?? s.price,
        }));
      setServices(filtered);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="text-center py-8">Chargement...</div>;

  return (
    <div>
      <div className="mb-4 sm:mb-6 text-center">
        <h2 className="text-xl sm:text-2xl font-bold mb-2 text-orange-100">Choisis ta prestation 🎭</h2>
        <p className="text-sm text-orange-200/60">Prix spéciaux Carnaval de Bordeaux</p>
      </div>
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => {
          const isSelected = selectedService?.id === s.id;
          return (
            <Card
              key={s.id}
              className="relative cursor-pointer transition-all border-2 hover:shadow-lg"
              style={{
                borderColor: isSelected ? "hsl(30 100% 50%)" : "hsla(20, 30%, 25%, 0.4)",
                background: isSelected ? "hsla(25, 80%, 50%, 0.1)" : "transparent",
              }}
              onClick={() => onServiceSelect(s)}
            >
              <div className="p-4 sm:p-6">
                {isSelected && (
                  <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: "linear-gradient(135deg, hsl(30 100% 50%), hsl(0 80% 50%))" }}>
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
                <div className="mb-2 pr-6">
                  <h3 className="text-base sm:text-lg font-semibold text-orange-100">{s.name}</h3>
                  {s.description && <p className="text-xs text-orange-200/50">{s.description}</p>}
                </div>
                <div className="text-xl sm:text-2xl font-bold" style={{ color: "hsl(30 100% 60%)" }}>
                  {s.price}€
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function Carnaval() {
  const [step, setStep] = useState(1);
  const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", address: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const { toast } = useToast();

  const handleServiceSelect = (s: Service) => {
    setService(s);
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDateSelect = (d: Date | undefined) => {
    if (!d) return;
    setDate(d);
    setStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleTimeSelect = (t: string) => {
    setTime(t);
    setStep(4);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) setErrors({ ...errors, [field]: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      bookingFormSchema.parse(formData);
      setErrors({});
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        err.issues.forEach((i) => { if (i.path[0]) newErrors[i.path[0].toString()] = i.message; });
        setErrors(newErrors);
      }
      return;
    }

    if (!service || !date || !time) return;
    setIsSubmitting(true);

    try {
      const validated = bookingFormSchema.parse(formData);
      // No travel fee, no same-day fee, no Sunday fee — just base price
      const totalPrice = service.price;

      const { data: result, error } = await supabase.functions.invoke("create-booking", {
        body: {
          service_id: service.id,
          appointment_date: format(date, "yyyy-MM-dd"),
          appointment_time: time,
          client_name: validated.name,
          client_email: validated.email,
          client_phone: validated.phone,
          client_address: validated.address,
          total_price: totalPrice,
          travel_fee: 0,
          notes: `[Carnaval de Bordeaux] ${validated.message || ""}`.trim(),
          deposit_paid: true,
        },
      });

      if (error || !result?.success) throw new Error(result?.error || error?.message);

      await supabase.functions.invoke("send-booking-emails", {
        body: {
          clientName: validated.name,
          clientEmail: validated.email,
          clientPhone: validated.phone,
          clientAddress: validated.address,
          serviceName: `🎭 Carnaval — ${service.name}`,
          servicePrice: service.price,
          appointmentDate: format(date, "EEEE d MMMM yyyy", { locale: fr }),
          appointmentTime: time,
          totalPrice,
          travelFee: 0,
          message: validated.message || "",
        },
      });

      toast({ title: "🎉 Rendez-vous confirmé !", description: "Un email de confirmation vous a été envoyé." });
      setIsConfirmed(true);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message || "Erreur lors de la réservation.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCarnavalDate = (d: Date) => {
    const day = d.getTime();
    return day >= CARNAVAL_START.getTime() && day <= CARNAVAL_END.getTime();
  };

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, hsl(25 95% 10%), hsl(0 70% 12%))" }}>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b" style={{ background: "hsla(15, 80%, 8%, 0.85)", borderColor: "hsla(20, 80%, 30%, 0.3)" }}>
        <div className="max-w-6xl mx-auto px-5 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-orange-300 hover:text-orange-100 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Link to="/">
              <img src={lcsBarberLogo} alt="LCS Barber" className="h-9 sm:h-11" />
            </Link>
          </div>
          <Badge className="text-xs font-bold" style={{ background: "linear-gradient(135deg, hsl(30 100% 50%), hsl(0 80% 50%))", color: "white", border: "none" }}>
            🎭 Carnaval de Bordeaux
          </Badge>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-5 pt-24 pb-10 space-y-8">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center">
          <div className="text-5xl mb-3">🎭</div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2" style={{ background: "linear-gradient(135deg, hsl(35 100% 60%), hsl(0 80% 55%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Carnaval de Bordeaux
          </h1>
          <p className="text-orange-200/70 text-sm mb-2">
            Réserve ta coupe spéciale carnaval — du 28 février au 1er mars 2026
          </p>
          <p className="text-orange-300/50 text-xs">
            🎉 Sans frais de déplacement, sans supplément jour même ni dimanche
          </p>
          <div className="mt-4 h-[2px] mx-auto max-w-xs" style={{ background: "linear-gradient(90deg, transparent, hsl(30 100% 50%), hsl(0 80% 50%), transparent)" }} />
        </motion.div>

        {/* Steps */}
        {!isConfirmed && (
          <div className="flex justify-center gap-2">
            {[
              { n: 1, icon: Scissors, label: "Prestation" },
              { n: 2, icon: CalendarIcon, label: "Date" },
              { n: 3, icon: Clock, label: "Heure" },
              { n: 4, icon: CheckCircle, label: "Infos" },
            ].map((s, i) => (
              <div key={s.n} className="flex items-center">
                <div
                  className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full transition-all"
                  style={{
                    background: step > s.n
                      ? "hsl(152 60% 45%)"
                      : step === s.n
                      ? "linear-gradient(135deg, hsl(30 100% 50%), hsl(0 80% 50%))"
                      : "hsla(20, 20%, 20%, 0.5)",
                    color: step >= s.n ? "white" : "hsla(20, 20%, 60%, 0.6)",
                    boxShadow: step === s.n ? "0 0 20px hsla(20, 100%, 50%, 0.3)" : "none",
                  }}
                >
                  <s.icon className="h-4 w-4" />
                </div>
                <span className="ml-2 hidden lg:block text-sm font-medium" style={{ color: step === s.n ? "hsl(30 100% 70%)" : "hsla(20, 20%, 60%, 0.6)" }}>
                  {s.label}
                </span>
                {i < 3 && <div className="mx-2 sm:mx-4 h-px w-4 sm:w-8" style={{ background: "hsla(20, 80%, 40%, 0.3)" }} />}
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        <Card className="border-0 shadow-2xl" style={{ background: "linear-gradient(160deg, hsla(20, 30%, 12%, 0.95), hsla(0, 20%, 8%, 0.95))", borderColor: "hsla(20, 80%, 30%, 0.2)" }}>
          <div className="p-4 sm:p-6">
            {/* Step 1: Service */}
            {!isConfirmed && step === 1 && (
              <CarnivalServiceSelector selectedService={service} onServiceSelect={handleServiceSelect} />
            )}

            {/* Step 2: Calendar */}
            {!isConfirmed && step === 2 && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="text-orange-300 hover:text-orange-100">
                    <ArrowLeft className="mr-1 h-4 w-4" /> Retour
                  </Button>
                  <h2 className="text-lg font-semibold text-orange-100">Choisis ta date</h2>
                  <div className="w-16" />
                </div>
                <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={handleDateSelect}
                    locale={fr}
                    defaultMonth={CARNAVAL_START}
                    disabled={(d) => !isCarnavalDate(d)}
                    className="pointer-events-auto rounded-xl border p-3"
                    style={{ borderColor: "hsla(20, 80%, 30%, 0.3)" }}
                  />
                </div>
                <p className="text-center text-orange-300/50 text-xs mt-3">
                  Seules les dates du Carnaval (28 fév – 1er mars) sont disponibles
                </p>
              </div>
            )}

            {/* Step 3: Time */}
            {!isConfirmed && step === 3 && date && (
              <TimeSlotSelector
                selectedDate={date}
                selectedTime={time}
                onTimeSelect={handleTimeSelect}
                onBack={() => setStep(2)}
              />
            )}

            {/* Step 4: Form */}
            {!isConfirmed && step === 4 && service && date && time && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={() => setStep(3)} className="text-orange-300 hover:text-orange-100">
                    <ArrowLeft className="mr-1 h-4 w-4" /> Retour
                  </Button>
                  <h2 className="text-lg font-semibold text-orange-100">Tes informations</h2>
                  <div className="w-16" />
                </div>

                {/* Recap */}
                <Card className="mb-6 border p-4" style={{ background: "hsla(25, 80%, 50%, 0.08)", borderColor: "hsla(25, 80%, 50%, 0.2)" }}>
                  <h3 className="mb-3 font-medium text-orange-400 flex items-center gap-2">
                    🎭 Récapitulatif Carnaval
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Scissors className="h-3.5 w-3.5 text-orange-400" />
                      <span className="text-orange-100">{service.name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-orange-200/70">
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        <span>{format(date, "d MMMM yyyy", { locale: fr })}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{time}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between font-semibold pt-3 mt-3" style={{ borderTop: "1px solid hsla(25, 80%, 50%, 0.2)" }}>
                    <span className="text-orange-200">Total</span>
                    <span className="text-xl" style={{ color: "hsl(30 100% 60%)" }}>{service.price}€</span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: "hsla(152, 60%, 55%, 0.8)" }}>
                    ✅ Aucun frais supplémentaire — offre Carnaval
                  </p>
                </Card>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name" className="text-orange-200">Nom complet *</Label>
                    <Input id="name" value={formData.name} onChange={(e) => handleInputChange("name", e.target.value)} className={`mt-1 ${errors.name ? "border-destructive" : ""}`} placeholder="Votre nom" />
                    {errors.name && <p className="mt-1 text-sm text-destructive">{errors.name}</p>}
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-orange-200">Email *</Label>
                    <Input id="email" type="email" value={formData.email} onChange={(e) => handleInputChange("email", e.target.value)} className={`mt-1 ${errors.email ? "border-destructive" : ""}`} placeholder="votre@email.com" />
                    {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email}</p>}
                  </div>
                  <div>
                    <Label htmlFor="phone" className="text-orange-200">Téléphone *</Label>
                    <Input id="phone" type="tel" value={formData.phone} onChange={(e) => handleInputChange("phone", e.target.value)} className={`mt-1 ${errors.phone ? "border-destructive" : ""}`} placeholder="06 12 34 56 78" />
                    {errors.phone && <p className="mt-1 text-sm text-destructive">{errors.phone}</p>}
                  </div>
                  <div>
                    <Label htmlFor="address" className="text-orange-200">Adresse *</Label>
                    <Input id="address" value={formData.address} onChange={(e) => handleInputChange("address", e.target.value)} className={`mt-1 ${errors.address ? "border-destructive" : ""}`} placeholder="Votre adresse à Bordeaux" />
                    {errors.address && <p className="mt-1 text-sm text-destructive">{errors.address}</p>}
                  </div>
                  <div>
                    <Label htmlFor="message" className="text-orange-200">Message (optionnel)</Label>
                    <Textarea id="message" value={formData.message} onChange={(e) => handleInputChange("message", e.target.value)} className="mt-1" placeholder="Style souhaité pour le carnaval..." rows={3} />
                  </div>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full text-white font-bold text-base h-12 border-0"
                    style={{ background: "linear-gradient(135deg, hsl(30 100% 50%), hsl(0 80% 50%))", boxShadow: "0 0 30px hsla(20, 100%, 50%, 0.3)" }}
                  >
                    {isSubmitting ? "Réservation en cours..." : "🎭 Confirmer ma réservation Carnaval"}
                  </Button>
                </form>
              </div>
            )}

            {/* Confirmed */}
            {isConfirmed && (
              <div className="text-center space-y-6 py-8">
                <div className="text-6xl">🎉</div>
                <h2 className="text-2xl font-bold text-orange-100">Rendez-vous Carnaval confirmé !</h2>
                <p className="text-orange-200/70">
                  Un email de confirmation t'a été envoyé. Prépare-toi pour le Carnaval de Bordeaux !
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button variant="outline" onClick={() => { setIsConfirmed(false); setStep(1); setService(null); setDate(undefined); setTime(null); setFormData({ name: "", email: "", phone: "", address: "", message: "" }); }}>
                    Autre réservation
                  </Button>
                  <Button asChild style={{ background: "linear-gradient(135deg, hsl(30 100% 50%), hsl(0 80% 50%))", color: "white", border: "none" }}>
                    <Link to="/">Retour à l'accueil</Link>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Footer */}
      <footer className="py-8 mt-8" style={{ borderTop: "1px solid hsla(20, 80%, 30%, 0.2)" }}>
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <img src={lcsBarberLogo} alt="LCS Barber" className="h-8 opacity-50" />
          <p className="text-xs" style={{ color: "hsla(20, 20%, 60%, 0.5)" }}>
            © {new Date().getFullYear()} LCS Barber — Carnaval de Bordeaux 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
