import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
const Home = lazy(() => import("./pages/Home"));
const Reservation = lazy(() => import("./pages/Reservation"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Simulator = lazy(() => import("./pages/Simulator"));
const Carnaval = lazy(() => import("./pages/Carnaval"));
const Evenements = lazy(() => import("./pages/Evenements"));
const Catalogue = lazy(() => import("./pages/Catalogue"));
const MesRendezVous = lazy(() => import("./pages/MesRendezVous"));
const AdminEvenements = lazy(() => import("./pages/AdminEvenements"));
const NotFound = lazy(() => import("./pages/NotFound"));
const MentionsLegales = lazy(() => import("./pages/legal/MentionsLegales"));
const CGV = lazy(() => import("./pages/legal/CGV"));
const CGVAbonnement = lazy(() => import("./pages/legal/CGVAbonnement"));
const Confidentialite = lazy(() => import("./pages/legal/Confidentialite"));
const Retractation = lazy(() => import("./pages/legal/Retractation"));
const Auth = lazy(() => import("./pages/Auth").then(m => ({ default: m.Auth })));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Admin = lazy(() => import("./pages/Admin").then(m => ({ default: m.Admin })));
const AdminVehicules = lazy(() => import("./pages/AdminVehicules"));
import { AuthProvider } from "./hooks/useAuth";
import { LanguageProvider } from "./hooks/useLanguage";
import { ThemeProvider } from "next-themes";
import RequireAuth from "./components/RequireAuth";
import ScrollToTop from "./components/ScrollToTop";
import ChatBot from "./components/ChatBot";

const queryClient = new QueryClient();

/** index.html carries BLADE metadata; the LCS Barber pages keep their own tab title. */
function LcsTitle() {
  useEffect(() => { document.title = "LCS Barber ⭐ - Réservez votre rendez-vous en ligne"; }, []);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="lcs-theme">
    <LanguageProvider>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <LcsTitle />

          <Suspense fallback={<div style={{ minHeight: "100vh" }} />}>
          <Routes>
            <Route path="/" element={<Navigate to="/lcsbarber" replace />} />
            <Route path="/lcsbarber" element={<Home />} />
            <Route path="/reservation" element={<RequireAuth><Reservation /></RequireAuth>} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/vehicules" element={<AdminVehicules />} />
            <Route path="/simulator" element={<Simulator />} />
            <Route path="/carnaval" element={<Carnaval />} />
            <Route path="/evenements" element={<Evenements />} />
            <Route path="/catalogue" element={<Catalogue />} />
            <Route path="/mes-rendez-vous" element={<RequireAuth><MesRendezVous /></RequireAuth>} />
            <Route path="/admin-evenements" element={<AdminEvenements />} />
            <Route path="/mentions-legales" element={<MentionsLegales />} />
            <Route path="/cgv" element={<CGV />} />
            <Route path="/cgv-abonnement" element={<CGVAbonnement />} />
            <Route path="/politique-de-confidentialite" element={<Confidentialite />} />
            <Route path="/droit-de-retractation" element={<Retractation />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          <ChatBot />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
    </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>

);

export default App;
