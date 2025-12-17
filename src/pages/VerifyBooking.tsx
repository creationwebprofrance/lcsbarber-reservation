import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function VerifyBooking() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMessage, setErrorMessage] = useState("");
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookingData, setBookingData] = useState<any>(null);

  useEffect(() => {
    const verifyBooking = async () => {
      const token = searchParams.get("token");
      
      if (!token) {
        setStatus("error");
        setErrorMessage("Lien de vérification invalide.");
        return;
      }

      try {
        // Call the secure function to create booking from pending
        const { data, error } = await supabase.rpc("create_booking_from_pending", {
          p_verification_token: token
        });

        if (error) {
          console.error("Verification error:", error);
          throw new Error(error.message);
        }

        const result = data as any;

        if (!result.success) {
          setStatus("error");
          setErrorMessage(result.error || "Le lien de vérification est invalide ou a expiré.");
          return;
        }

        // Success! Store booking ID and data
        setBookingId(result.booking_id);
        setBookingData(result.booking_data);
        setStatus("success");

        // Fetch service name
        const { data: serviceData } = await supabase
          .from('services')
          .select('name, price')
          .eq('id', result.booking_data.service_id)
          .single();

        // Send confirmation emails
        const emailData = {
          clientName: result.booking_data.client_name,
          clientEmail: result.booking_data.client_email,
          clientPhone: result.booking_data.client_phone,
          clientAddress: result.booking_data.client_address,
          serviceName: serviceData?.name || "Service",
          servicePrice: serviceData?.price || result.booking_data.total_price - (result.booking_data.travel_fee || 0),
          appointmentDate: result.booking_data.appointment_date,
          appointmentTime: result.booking_data.appointment_time,
          totalPrice: result.booking_data.total_price,
          travelFee: result.booking_data.travel_fee || 0,
          depositAmount: Math.round(result.booking_data.total_price * 0.5),
          message: result.booking_data.notes
        };

        const { error: emailError } = await supabase.functions.invoke('send-booking-emails', {
          body: emailData
        });

        if (emailError) {
          console.error("Error sending confirmation email:", emailError);
          // Don't fail the booking if email fails, just log it
        } else {
          console.log("Confirmation email sent successfully");
        }

        toast({
          title: "Rendez-vous confirmé !",
          description: "Votre réservation a été confirmée avec succès.",
        });

      } catch (error: any) {
        console.error("Error verifying booking:", error);
        setStatus("error");
        setErrorMessage(error.message || "Une erreur est survenue lors de la vérification.");
      }
    };

    verifyBooking();
  }, [searchParams, toast]);

  return (
    <div className="min-h-screen bg-gradient-secondary p-4 flex items-center justify-center">
      <Card className="max-w-2xl w-full bg-gradient-card shadow-card border-border/50 backdrop-blur-sm">
        <div className="p-8">
          {status === "verifying" && (
            <div className="text-center space-y-6">
              <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
              <h2 className="text-2xl font-bold">Vérification en cours...</h2>
              <p className="text-muted-foreground">
                Nous vérifions votre rendez-vous, veuillez patienter.
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="text-center space-y-6">
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-success/20">
                <CheckCircle className="h-12 w-12 text-success" />
              </div>
              <h2 className="text-3xl font-bold">Rendez-vous confirmé !</h2>
              <p className="text-lg text-muted-foreground">
                Votre email a été vérifié avec succès.
              </p>
              
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-6 space-y-3">
                <div className="flex items-center justify-center space-x-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Détails du rendez-vous</h3>
                </div>
                {bookingData && (
                  <div className="text-sm space-y-2">
                    <p><strong>Date :</strong> {bookingData.appointment_date}</p>
                    <p><strong>Heure :</strong> {bookingData.appointment_time}</p>
                    <p><strong>Prix total :</strong> {bookingData.total_price}€</p>
                  </div>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                Un email de confirmation vous a été envoyé avec tous les détails.
              </p>
              
              <Button 
                onClick={() => navigate("/")}
                className="bg-gradient-primary shadow-elegant hover:shadow-glow"
              >
                Retour à l'accueil
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="text-center space-y-6">
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-destructive/20">
                <XCircle className="h-12 w-12 text-destructive" />
              </div>
              <h2 className="text-3xl font-bold">Vérification échouée</h2>
              <p className="text-lg text-muted-foreground">
                {errorMessage}
              </p>
              
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
                <h3 className="font-semibold mb-2">Que faire ?</h3>
                <ul className="text-sm text-left space-y-2 list-disc list-inside">
                  <li>Vérifiez que vous avez cliqué sur le bon lien</li>
                  <li>Le lien de vérification expire après 24 heures</li>
                  <li>Vous pouvez créer une nouvelle réservation si nécessaire</li>
                </ul>
              </div>
              
              <Button 
                onClick={() => navigate("/")}
                variant="outline"
              >
                Retour à l'accueil
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}