import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Settings, Calendar as CalendarIcon, Users, Star, Clock, Euro, Mail, Scissors, Image as ImageIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientStats } from "@/components/ClientStats";
import { ReviewsList } from "@/components/ReviewsList";
import { CalendarSlotsManager } from "@/components/CalendarSlotsManager";
import { PricingSettings } from "@/components/PricingSettings";
import { BookingsCalendar } from "@/components/BookingsCalendar";
import { EmailTemplateEditor } from "@/components/EmailTemplateEditor";
import { PrestationsAdmin } from "@/components/PrestationsAdmin";
import { CatalogueAdmin } from "@/components/CatalogueAdmin";

export const Admin = () => {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }

      setUser(session.user);

      // Check if user is admin using user_roles table
      const { data: roles, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin');

      if (roleError || !roles || roles.length === 0) {
        toast({
          title: "Accès refusé",
          description: "Vous n'avez pas les droits d'administration.",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error('Auth error:', error);
      navigate('/auth');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Chargement...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Accès refusé</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Administration
          </h1>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>Dashboard</Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/simulator')}>Simulation</Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin-evenements')}>Événements</Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/vehicules')}>Mon véhicule</Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>Accueil</Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="bookings" className="space-y-6">
          <div className="overflow-x-auto -mx-4 px-4 pb-2">
            <TabsList className="inline-flex w-max gap-1 p-1">
              <TabsTrigger value="bookings" className="flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium">
                <CalendarIcon className="h-4 w-4 shrink-0" />
                <span>Réservations</span>
              </TabsTrigger>
              <TabsTrigger value="pricing" className="flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium">
                <Euro className="h-4 w-4 shrink-0" />
                <span>Prix</span>
              </TabsTrigger>
              <TabsTrigger value="timeslots" className="flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium">
                <Clock className="h-4 w-4 shrink-0" />
                <span>Créneaux</span>
              </TabsTrigger>
              <TabsTrigger value="clients" className="flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium">
                <Users className="h-4 w-4 shrink-0" />
                <span>Clients &amp; utilisateurs</span>
              </TabsTrigger>
              <TabsTrigger value="reviews" className="flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium">
                <Star className="h-4 w-4 shrink-0" />
                <span>Avis</span>
              </TabsTrigger>
              <TabsTrigger value="emails" className="flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium">
                <Mail className="h-4 w-4 shrink-0" />
                <span>Emails</span>
              </TabsTrigger>
              <TabsTrigger value="prestations" className="flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium">
                <Scissors className="h-4 w-4 shrink-0" />
                <span>Prestations</span>
              </TabsTrigger>
              <TabsTrigger value="catalogue" className="flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium">
                <ImageIcon className="h-4 w-4 shrink-0" />
                <span>Catalogue</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="bookings">
            <BookingsCalendar />
          </TabsContent>

          <TabsContent value="pricing">
            <PricingSettings />
          </TabsContent>

          <TabsContent value="timeslots">
            <CalendarSlotsManager />
          </TabsContent>


          <TabsContent value="clients">
            <ClientStats />
          </TabsContent>

          <TabsContent value="reviews">
            <ReviewsList />
          </TabsContent>

          <TabsContent value="emails">
            <EmailTemplateEditor />
          </TabsContent>

          <TabsContent value="prestations">
            <PrestationsAdmin />
          </TabsContent>

          <TabsContent value="catalogue">
            <CatalogueAdmin />
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
};