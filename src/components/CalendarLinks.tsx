import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Download, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CalendarLinksProps {
  bookingId: string;
  onClose?: () => void;
}

export const CalendarLinks = ({ bookingId, onClose }: CalendarLinksProps) => {
  const [calendarData, setCalendarData] = useState<{
    googleCalendarUrl: string;
    icsDownloadUrl: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateCalendarLinks();
  }, [bookingId]);

  const generateCalendarLinks = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-calendar-event', {
        body: { bookingId }
      });

      if (error) throw error;

      setCalendarData(data);
    } catch (error) {
      console.error('Error generating calendar links:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadICS = () => {
    if (!calendarData) return;

    const link = document.createElement('a');
    link.href = calendarData.icsDownloadUrl;
    link.download = 'rendez-vous-lcs-style.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Génération des liens calendrier...</p>
        </CardContent>
      </Card>
    );
  }

  if (!calendarData) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Ajouter à votre calendrier
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          N'oubliez pas votre rendez-vous ! Ajoutez-le à votre calendrier :
        </p>

        <div className="space-y-2">
          <Button
            onClick={() => window.open(calendarData.googleCalendarUrl, '_blank')}
            variant="outline"
            className="w-full"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Ajouter à Google Calendar
          </Button>

          <Button
            onClick={downloadICS}
            variant="outline"
            className="w-full"
          >
            <Download className="h-4 w-4 mr-2" />
            Télécharger le fichier .ics (iPhone, Outlook...)
          </Button>
        </div>

        {onClose && (
          <Button onClick={onClose} variant="ghost" className="w-full mt-4">
            Fermer
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
