import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Reservation from "./pages/Reservation";
import Dashboard from "./pages/Dashboard";
import Simulator from "./pages/Simulator";
import Carnaval from "./pages/Carnaval";
import Evenements from "./pages/Evenements";
import Catalogue from "./pages/Catalogue";
import MesRendezVous from "./pages/MesRendezVous";
import AdminEvenements from "./pages/AdminEvenements";
import NotFound from "./pages/NotFound";
import { Auth } from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import { Admin } from "./pages/Admin";
import { AuthProvider } from "./hooks/useAuth";
import RequireAuth from "./components/RequireAuth";
import ScrollToTop from "./components/ScrollToTop";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/reservation" element={<RequireAuth><Reservation /></RequireAuth>} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/simulator" element={<Simulator />} />
            <Route path="/carnaval" element={<Carnaval />} />
            <Route path="/evenements" element={<Evenements />} />
            <Route path="/catalogue" element={<Catalogue />} />
            <Route path="/mes-rendez-vous" element={<RequireAuth><MesRendezVous /></RequireAuth>} />
            <Route path="/admin-evenements" element={<AdminEvenements />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
