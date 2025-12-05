import { BookingTool } from "@/components/BookingTool";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { Settings, BarChart, LogIn } from "lucide-react";
import { ReviewsList } from "@/components/ReviewsList";
import { ReviewForm } from "@/components/ReviewForm";

export default function Index() {
  const { user, isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      {/* Header avec navigation */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-xl sm:text-2xl font-bold">LCS Style ⭐</h1>
            <div className="flex items-center gap-1 sm:gap-2">
              {user ? (
                <>
                  {isAdmin && (
                    <>
                      <Button asChild variant="outline" size="sm" className="h-8 px-2 sm:px-3">
                        <Link to="/dashboard">
                          <BarChart className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Dashboard</span>
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm" className="h-8 px-2 sm:px-3">
                        <Link to="/admin">
                          <Settings className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Admin</span>
                        </Link>
                      </Button>
                    </>
                  )}
                </>
              ) : (
                <Button asChild variant="outline" size="sm" className="h-8 px-2 sm:px-3">
                  <Link to="/auth">
                    <LogIn className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Connexion</span>
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 space-y-8 sm:space-y-12">
        <BookingTool />
        
        <div className="space-y-8">
          <ReviewForm />
          <ReviewsList />
        </div>
      </div>
    </div>
  );
}
