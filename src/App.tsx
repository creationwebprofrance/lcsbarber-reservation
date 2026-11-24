import { Toaster } from "@/components/ui/toaster";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import { ThemeProvider } from "next-themes";
import ScrollToTop from "./components/ScrollToTop";

// Pages hors de /blade : compte (connexion, mot de passe) et pages légales.
// Les anciennes adresses du site LCS Barber renvoient vers BLADE, pour que les liens déjà envoyés restent utiles.
const NotFound = lazy(() => import("./pages/NotFound"));
const MentionsLegales = lazy(() => import("./pages/legal/MentionsLegales"));
const CGV = lazy(() => import("./pages/legal/CGV"));
const CGVAbonnement = lazy(() => import("./pages/legal/CGVAbonnement"));
const Confidentialite = lazy(() => import("./pages/legal/Confidentialite"));
const Retractation = lazy(() => import("./pages/legal/Retractation"));
const Auth = lazy(() => import("./pages/Auth").then(m => ({ default: m.Auth })));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));

/** Anciennes adresses LCS Barber → page BLADE équivalente (rechargement complet : BLADE a sa propre application). */
const LEGACY_REDIRECTS: Record<string, string> = {
  "/lcsbarber": "/blade",
  "/reservation": "/blade",
  "/simulator": "/blade",
  "/carnaval": "/blade",
  "/evenements": "/blade",
  "/catalogue": "/blade",
  "/mes-rendez-vous": "/blade/client/rendez-vous",
  "/dashboard": "/blade/pro",
  "/admin": "/blade/pro",
  "/admin/vehicules": "/blade/pro/vehicule",
  "/admin-evenements": "/blade/pro",
};

function LegacyRedirect({ to }: { to: string }) {
  useEffect(() => { window.location.replace(to); }, [to]);
  return null;
}

/** Titre d'onglet des pages de compte ; les pages légales posent le leur (LegalLayout). */
function AccountTitle() {
  useEffect(() => {
    if (document.title.includes("BLADE")) return;
    document.title = "BLADE — Mon compte";
  }, []);
  return null;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="lcs-theme">
    <Toaster />
    <BrowserRouter>
      <ScrollToTop />
      <AccountTitle />
      <Suspense fallback={<div style={{ minHeight: "100vh" }} />}>
        <Routes>
          {Object.entries(LEGACY_REDIRECTS).map(([from, to]) => (
            <Route key={from} path={from} element={<LegacyRedirect to={to} />} />
          ))}
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/mentions-legales" element={<MentionsLegales />} />
          <Route path="/cgv" element={<CGV />} />
          <Route path="/cgv-abonnement" element={<CGVAbonnement />} />
          <Route path="/politique-de-confidentialite" element={<Confidentialite />} />
          <Route path="/droit-de-retractation" element={<Retractation />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </ThemeProvider>
);

export default App;
