import { BookingTool } from "@/components/BookingTool";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { Settings, BarChart, LogIn } from "lucide-react";

export default function Index() {
  const { user, isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      {/* Header avec navigation */}
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">LCS Style ⭐</h1>
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  {isAdmin && (
                    <>
                      <Button asChild variant="outline" size="sm">
                        <Link to="/dashboard">
                          <BarChart className="h-4 w-4 mr-2" />
                          Dashboard
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link to="/admin">
                          <Settings className="h-4 w-4 mr-2" />
                          Admin
                        </Link>
                      </Button>
                    </>
                  )}
                </>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link to="/auth">
                    <LogIn className="h-4 w-4 mr-2" />
                    Connexion
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <BookingTool />
      </div>
    </div>
  );
}
