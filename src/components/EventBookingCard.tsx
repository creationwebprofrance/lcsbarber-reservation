import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { TimeSlotSelector } from "@/components/TimeSlotSelector";

const bookingFormSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères").max(100).regex(/^[a-zA-ZÀ-ÿ\s'-]+$/),
  email: z.string().trim().email("Email invalide").max(255).toLowerCase(),
  phone: z.string().trim().min(10, "Téléphone invalide").max(20).regex(/^[0-9\s+()-]+$/),
  message: z.string().trim().max(1000).optional(),
});

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

interface Service {
  id: string;
  name: string;
  price: number;
  description?: string;
}

function EventServiceSelector({
  selectedService,
  onServiceSelect,
  event,
}: {
  selectedService: Service | null;
  onServiceSelect: (s: Service) => void;
  event: EventData;
}) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const priceOverrides: Record<string, number> = {};
  if (event.prix_coupe_classique) priceOverrides["Coupe classique"] = event.prix_coupe_classique;
  if (event.prix_coupe_barbe) priceOverrides["Coupe + barbe"] = event.prix_coupe_barbe;
  if (event.prix_barbe) priceOverrides["Barbe uniquement"] = event.prix_barbe;
  if (event.prix_contours) priceOverrides["Contours"] = event.prix_contours;

  const excludedServices = event.excluded_services
    ? event.excluded_services.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("services").select("*").eq("is_active", true).order("name");
      const filtered = (data || [])
        .filter((s: any) => !excludedServices.includes(s.name))
        .map((s: any) => ({
          ...s,
          price: priceOverrides[s.name] ?? s.price,
        }));
      setServices(filtered);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="text-center py-8 text-primary/70">Chargement...</div>;

  return (
    <div>
      <div className="mb-4 sm:mb-6 text-center">
        <h2 className="text-xl sm:text-2xl font-bold mb-2 text-primary-foreground">Choisis ta prestation ✂️</h2>
        <p className="text-sm text-muted-foreground">Prix spéciaux {event.name}</p>
      </div>
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => {
          const isSelected = selectedService?.id === s.id;
          return (
            <Card
              key={s.id}
              className={`relative cursor-pointer transition-all border-2 hover:shadow-lg ${
                isSelected ? "border-primary bg-primary/10" : "border-border/40 bg-transparent"
              }`}
              onClick={() => onServiceSelect(s)}
            >
              <div className="p-4 sm:p-6">
                {isSelected && (
                  <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
                <div className="mb-2 pr-6">
                  <h3 className="text-base sm:text-lg font-semibold text-foreground">{s.name}</h3>
                  {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                </div>
                <div className="text-xl sm:text-2xl font-bold text-primary">
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

export default function EventBookingCard({ event }: { event: EventData }) {
  const [step, setStep] = useState(0); // 0 = info, 1-4 = booking steps
  const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const { toast } = useToast();

  const startDate = new Date(event.start_date + "T00:00:00");
  const endDate = new Date(event.end_date + "T00:00:00");

  const formatDisplayDate = (d: string) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  const handleServiceSelect = (s: Service) => {
    setService(s);
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDateSelect = (d: Date) => {
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
      const totalPrice = service.price;

      const { data: result, error } = await supabase.functions.invoke("create-booking", {
        body: {
          service_id: service.id,
          appointment_date: format(date, "yyyy-MM-dd"),
          appointment_time: time,
          client_name: validated.name,
          client_email: validated.email,
          client_phone: validated.phone,
          client_address: "",
          total_price: totalPrice,
          travel_fee: 0,
          notes: `[${event.name}] ${validated.message || ""}`.trim(),
          deposit_paid: true,
        },
      });

      if (error || !result?.success) throw new Error(result?.error || error?.message);

      await supabase.functions.invoke("send-booking-emails", {
        body: {
          clientName: validated.name,
          clientEmail: validated.email,
          clientPhone: validated.phone,
          clientAddress: "",
          clientPostalCode: "",
          clientCity: "",
          serviceName: `🎉 ${event.name} — ${service.name}`,
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

  const generateEventDays = () => {
    const days: Date[] = [];
    const d = new Date(startDate);
    while (d <= endDate) {
      days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return days;
  };

  const generateCustomSlots = () => {
    const slots: string[] = [];
    const [startH, startM] = event.start_hour.slice(0, 5).split(":").map(Number);
    const [endH, endM] = event.end_hour.slice(0, 5).split(":").map(Number);
    const startMin = startH * 60 + (startM || 0);
    const endMin = endH * 60 + (endM || 0);
    for (let m = startMin; m <= endMin; m += 30) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      slots.push(`${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`);
    }
    return slots;
  };

  const minPrice = Math.min(
    event.prix_coupe_classique || Infinity,
    event.prix_coupe_barbe || Infinity,
    event.prix_barbe || Infinity,
    event.prix_contours || Infinity
  );

  // Info view (step 0)
  if (step === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <Card className="border border-primary/20 bg-card overflow-hidden">
          <div className="relative p-8 sm:p-10">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
              🎉 Événement actif
            </Badge>
            
            <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">{event.name}</h3>
            {event.description && (
              <p className="text-muted-foreground mb-6">{event.description}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-4">
                <CalendarIcon className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Dates</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatDisplayDate(event.start_date)} — {formatDisplayDate(event.end_date)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-4">
                <Clock className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Horaires</p>
                  <p className="text-sm font-semibold text-foreground">
                    {event.start_hour.slice(0, 5)} — {event.end_hour.slice(0, 5)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-4">
                <Scissors className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">À partir de</p>
                  <p className="text-sm font-semibold text-foreground">
                    {minPrice === Infinity ? "—" : `${minPrice.toFixed(0)}€`}
                  </p>
                </div>
              </div>
            </div>

            {/* Price grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              {[
                { label: "Coupe classique", price: event.prix_coupe_classique },
                { label: "Coupe + barbe", price: event.prix_coupe_barbe },
                { label: "Barbe", price: event.prix_barbe },
                { label: "Contours", price: event.prix_contours },
              ].map((item) => (
                <div key={item.label} className="bg-background border border-border/50 rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                  <p className="text-xl font-bold text-foreground">{item.price}€</p>
                </div>
              ))}
            </div>

            <Button
              onClick={() => setStep(1)}
              className="w-full h-12 text-base font-bold"
              size="lg"
            >
              🎉 Réserver pour {event.name}
            </Button>
          </div>
        </Card>
      </motion.div>
    );
  }

  // Booking flow (steps 1-4)
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border border-primary/20 bg-card overflow-hidden">
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(step === 1 ? 0 : step - 1)}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Retour
            </Button>
            <Badge className="bg-primary/10 text-primary border-primary/20">
              🎉 {event.name}
            </Badge>
          </div>

          {/* Steps indicator */}
          {!isConfirmed && (
            <div className="flex justify-center gap-2 mb-6">
              {[
                { n: 1, icon: Scissors, label: "Prestation" },
                { n: 2, icon: CalendarIcon, label: "Date" },
                { n: 3, icon: Clock, label: "Heure" },
                { n: 4, icon: CheckCircle, label: "Infos" },
              ].map((s, i) => (
                <div key={s.n} className="flex items-center">
                  <div
                    className={`flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full transition-all ${
                      step > s.n
                        ? "bg-green-500 text-white"
                        : step === s.n
                        ? "bg-primary text-primary-foreground shadow-lg"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <s.icon className="h-4 w-4" />
                  </div>
                  <span className={`ml-2 hidden lg:block text-sm font-medium ${
                    step === s.n ? "text-primary" : "text-muted-foreground"
                  }`}>
                    {s.label}
                  </span>
                  {i < 3 && <div className="mx-2 sm:mx-4 h-px w-4 sm:w-8 bg-border" />}
                </div>
              ))}
            </div>
          )}

          {/* Step 1: Service */}
          {!isConfirmed && step === 1 && (
            <EventServiceSelector selectedService={service} onServiceSelect={handleServiceSelect} event={event} />
          )}

          {/* Step 2: Date */}
          {!isConfirmed && step === 2 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground text-center mb-4">Choisis ta date</h2>
              <div className="flex justify-center">
                <div className="grid grid-cols-5 gap-2 sm:gap-3">
                  {generateEventDays().map((day) => {
                    const isSelected = date && format(date, "yyyy-MM-dd") === format(day, "yyyy-MM-dd");
                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        onClick={() => handleDateSelect(day)}
                        className={`flex flex-col items-center justify-center rounded-xl p-3 sm:p-4 transition-all border-2 ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-lg"
                            : "bg-muted/50 text-foreground border-border/40 hover:border-primary/40"
                        }`}
                        style={{ minWidth: "70px" }}
                      >
                        <span className="text-xs font-medium opacity-70">
                          {format(day, "EEE", { locale: fr })}
                        </span>
                        <span className="text-2xl font-bold">{format(day, "d")}</span>
                        <span className="text-xs opacity-70">
                          {format(day, "MMM", { locale: fr })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="text-center text-muted-foreground text-xs mt-3">
                Du {formatDisplayDate(event.start_date)} au {formatDisplayDate(event.end_date)}
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
              hideSupplements
              customSlots={generateCustomSlots()}
            />
          )}

          {/* Step 4: Form */}
          {!isConfirmed && step === 4 && service && date && time && (
            <div>
              <h2 className="text-lg font-semibold text-foreground text-center mb-4">Tes informations</h2>

              {/* Recap */}
              <Card className="mb-6 border border-primary/20 p-4 bg-primary/5">
                <h3 className="mb-3 font-medium text-primary flex items-center gap-2">
                  🎉 Récapitulatif — {event.name}
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Scissors className="h-3.5 w-3.5 text-primary" />
                    <span className="text-foreground">{service.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-muted-foreground">
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
                <div className="flex items-center justify-between font-semibold pt-3 mt-3 border-t border-primary/20">
                  <span className="text-muted-foreground">Total</span>
                  <span className="text-xl text-primary">{service.price}€</span>
                </div>
                <p className="text-xs mt-1 text-green-500">
                  ✅ Aucun frais supplémentaire — offre événement
                </p>
              </Card>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-foreground">Nom complet *</Label>
                  <Input id="name" value={formData.name} onChange={(e) => handleInputChange("name", e.target.value)} className={`mt-1 ${errors.name ? "border-destructive" : ""}`} placeholder="Votre nom" />
                  {errors.name && <p className="mt-1 text-sm text-destructive">{errors.name}</p>}
                </div>
                <div>
                  <Label htmlFor="email" className="text-foreground">Email *</Label>
                  <Input id="email" type="email" value={formData.email} onChange={(e) => handleInputChange("email", e.target.value)} className={`mt-1 ${errors.email ? "border-destructive" : ""}`} placeholder="votre@email.com" />
                  {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email}</p>}
                </div>
                <div>
                  <Label htmlFor="phone" className="text-foreground">Téléphone *</Label>
                  <Input id="phone" type="tel" value={formData.phone} onChange={(e) => handleInputChange("phone", e.target.value)} className={`mt-1 ${errors.phone ? "border-destructive" : ""}`} placeholder="06 12 34 56 78" />
                  {errors.phone && <p className="mt-1 text-sm text-destructive">{errors.phone}</p>}
                </div>
                <div>
                  <Label htmlFor="message" className="text-foreground">Message (optionnel)</Label>
                  <Textarea id="message" value={formData.message} onChange={(e) => handleInputChange("message", e.target.value)} className="mt-1" placeholder="Style souhaité, précisions..." rows={3} />
                </div>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full font-bold text-base h-12"
                >
                  {isSubmitting ? "Réservation en cours..." : `🎉 Confirmer ma réservation — ${event.name}`}
                </Button>
              </form>
            </div>
          )}

          {/* Confirmed */}
          {isConfirmed && (
            <div className="text-center space-y-6 py-8">
              <div className="text-6xl">🎉</div>
              <h2 className="text-2xl font-bold text-foreground">Rendez-vous confirmé !</h2>
              <p className="text-muted-foreground">
                Un email de confirmation t'a été envoyé. À bientôt pour {event.name} !
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="outline" onClick={() => { setIsConfirmed(false); setStep(0); setService(null); setDate(undefined); setTime(null); setFormData({ name: "", email: "", phone: "", message: "" }); }}>
                  Autre réservation
                </Button>
                <Button asChild>
                  <Link to="/">Retour à l'accueil</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
