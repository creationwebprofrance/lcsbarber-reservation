import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, LogOut } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CarnavalAdmin } from "@/components/CarnavalAdmin";
import { EventsAdmin } from "@/components/EventsAdmin";
import { BookEventSectionAdmin } from "@/components/BookEventSectionAdmin";

const AdminEvenements = () => {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/auth'); return; }

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin');

      if (!roles || roles.length === 0) {
        toast({ title: "Accès refusé", description: "Vous n'avez pas les droits d'administration.", variant: "destructive" });
        navigate('/');
        return;
      }
      setIsAdmin(true);
      setLoading(false);
    };
    checkAuth();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;
  if (!isAdmin) return <div className="min-h-screen flex items-center justify-center">Accès refusé</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6" />
            Événements
          </h1>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>Dashboard</Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>Admin</Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/simulator')}>Simulation</Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>Accueil</Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="carnaval" className="space-y-6">
          <TabsList>
            <TabsTrigger value="carnaval">🎭 Carnaval</TabsTrigger>
            <TabsTrigger value="events">📅 Événements</TabsTrigger>
            <TabsTrigger value="book-section">📖 Section BOOK</TabsTrigger>
          </TabsList>

          <TabsContent value="carnaval">
            <CarnavalAdmin />
          </TabsContent>

          <TabsContent value="events">
            <EventsAdmin />
          </TabsContent>

          <TabsContent value="book-section">
            <BookEventSectionAdmin />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminEvenements;
