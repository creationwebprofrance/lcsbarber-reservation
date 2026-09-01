import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar, LogOut, Settings, BarChart, Calculator, PartyPopper } from "lucide-react";

export function UserMenu() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const email = user.email ?? "";
  const name = (user.user_metadata?.full_name as string | undefined) || email.split("@")[0] || "?";
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Mon profil"
          className="rounded-full ring-2 ring-primary/30 hover:ring-primary transition-all focus:outline-none"
        >
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/15 text-primary font-semibold text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="font-semibold truncate">{name}</p>
          <p className="text-xs text-muted-foreground font-normal truncate">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/mes-rendez-vous">
            <Calendar className="h-4 w-4 mr-2" /> Mes rendez-vous
          </Link>
        </DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuItem asChild>
              <Link to="/dashboard">
                <BarChart className="h-4 w-4 mr-2" /> Dashboard
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/admin">
                <Settings className="h-4 w-4 mr-2" /> Admin
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/simulator">
                <Calculator className="h-4 w-4 mr-2" /> Simulation
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/admin-evenements">
                <PartyPopper className="h-4 w-4 mr-2" /> Événements
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4 mr-2" /> Déconnexion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
