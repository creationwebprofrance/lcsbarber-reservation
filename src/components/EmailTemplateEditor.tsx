import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Eye } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface EmailTemplate {
  id: string;
  template_type: string;
  subject: string;
  html_content: string;
}

const TEMPLATE_TYPES = [
  { key: "booking_confirmation_client", label: "Confirmation de réservation" },
  { key: "welcome_client", label: "Bienvenue nouveau client" },
] as const;

export const EmailTemplateEditor = () => {
  const [templateType, setTemplateType] = useState<string>(TEMPLATE_TYPES[0].key);
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadTemplate();
  }, [templateType]);

  const loadTemplate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('template_type', templateType)
        .maybeSingle();

      if (error) throw error;
      setTemplate(data);
    } catch (error: any) {
      console.error("Error loading template:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger le template",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };


  const handleSave = async () => {
    if (!template) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('email_templates')
        .update({
          subject: template.subject,
          html_content: template.html_content
        })
        .eq('id', template.id);

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Le template a été mis à jour"
      });
    } catch (error: any) {
      console.error("Error saving template:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder le template",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const getPreviewHtml = () => {
    if (!template) return "";
    
    // Replace variables with example data
    return template.html_content
      .replace(/\{\{clientName\}\}/g, "Jean Dupont")
      .replace(/\{\{clientEmail\}\}/g, "jean.dupont@example.com")
      .replace(/\{\{clientPhone\}\}/g, "06 12 34 56 78")
      .replace(/\{\{clientAddress\}\}/g, "123 Rue de Paris, 75001 Paris")
      .replace(/\{\{serviceName\}\}/g, "Coupe Homme")
      .replace(/\{\{servicePrice\}\}/g, "30")
      .replace(/\{\{appointmentDate\}\}/g, "lundi 15 janvier 2024")
      .replace(/\{\{appointmentTime\}\}/g, "14:00")
      .replace(/\{\{totalPrice\}\}/g, "40")
      .replace(/\{\{travelFee\}\}/g, "10")
      .replace(/\{\{depositAmount\}\}/g, "20")
      .replace(/\{\{remainingAmount\}\}/g, "20")
      .replace(/\{\{#if travelFee\}\}/g, "")
      .replace(/\{\{\/if\}\}/g, "")
      .replace(/\{\{#if message\}\}/g, "<!--")
      .replace(/\{\{message\}\}/g, "");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!template) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">Aucun template trouvé</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Email de confirmation client</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Personnalisez le contenu de l'email de confirmation envoyé aux clients après validation de leur réservation.
          </p>
        </div>

        <Tabs defaultValue="edit" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="edit">Éditer</TabsTrigger>
            <TabsTrigger value="preview">Aperçu</TabsTrigger>
          </TabsList>
          
          <TabsContent value="edit" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Sujet de l'email</Label>
              <Input
                id="subject"
                value={template.subject}
                onChange={(e) => setTemplate({ ...template, subject: e.target.value })}
                placeholder="Sujet de l'email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="html_content">Contenu HTML</Label>
              <Textarea
                id="html_content"
                value={template.html_content}
                onChange={(e) => setTemplate({ ...template, html_content: e.target.value })}
                placeholder="Contenu HTML du template"
                className="font-mono text-sm min-h-[400px]"
              />
              <p className="text-xs text-muted-foreground">
                Variables disponibles : {"{{"} clientName {"}}"}, {"{{"} clientEmail {"}}"}, {"{{"} serviceName {"}}"}, {"{{"} appointmentDate {"}}"}, {"{{"} appointmentTime {"}}"}, {"{{"} totalPrice {"}}"}, {"{{"} travelFee {"}}"}, {"{{"} depositAmount {"}}"}, {"{{"} remainingAmount {"}}"}, {"{{"} message {"}}"}
              </p>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Sauvegarder
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="preview">
            <div className="border rounded-lg p-4 bg-background">
              <div className="mb-4 pb-4 border-b">
                <p className="text-sm text-muted-foreground mb-1">Sujet :</p>
                <p className="font-semibold">{template.subject}</p>
              </div>
              <iframe
                sandbox=""
                srcDoc={getPreviewHtml()}
                className="w-full min-h-[400px] border-0 rounded"
                title="Email template preview"
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
};