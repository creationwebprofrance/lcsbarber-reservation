import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, Calendar } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center max-w-md space-y-6">
        <p className="font-display text-7xl tracking-widest text-primary">404</p>
        <h1 className="text-2xl font-semibold text-foreground">Cette page n'existe pas</h1>
        <p className="text-muted-foreground">
          Le lien est peut-être erroné ou la page a été déplacée.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link to="/"><Home className="h-4 w-4 mr-2" /> Accueil</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/reservation"><Calendar className="h-4 w-4 mr-2" /> Prendre rendez-vous</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
