import { createContext, useContext, useEffect, useState } from "react";

export type Lang = "fr" | "en";

const translations = {
  fr: {
    "nav.login": "Connexion",
    "nav.book": "Réserver",
    "hero.tagline": "LCS BARBER — BARBER ATELIER",
    "hero.title1": "Ton style.",
    "hero.title2": "Ton créneau.",
    "hero.title3": "Ta coupe.",
    "hero.subtitle":
      "Coupes afro & européennes, barbe soignée. Réserve ton créneau en quelques secondes.",
    "hero.hours": "De 10h à 20h (frais hors horaire)",
    "hero.cta": "Prendre rendez-vous",
    "hero.event": "Prochain événement",
    "catalogue.label": "CATALOGUE",
    "catalogue.title": "Mes coupes & mes prestations",
    "catalogue.cardTitle": "Catalogue de coupes",
    "catalogue.cardText":
      "Découvre mes réalisations — fades, afro, européennes, barbe soignée — et choisis ton style avant de réserver.",
    "catalogue.cardCta": "Voir le catalogue",
    "stats.onAppointment": "Sur RDV",
    "stats.onTime": "Toujours à l'heure",
    "stats.clientTravels": "Le client se déplace",
    "stats.reviews": "Avis clients",
    "footer.rights": "Tous droits réservés",
    "theme.light": "Mode clair",
    "theme.dark": "Mode sombre",
    "lang.label": "Langue",
  },
  en: {
    "nav.login": "Sign in",
    "nav.book": "Book",
    "hero.tagline": "LCS BARBER — BARBER ATELIER",
    "hero.title1": "Your style.",
    "hero.title2": "Your slot.",
    "hero.title3": "Your cut.",
    "hero.subtitle":
      "Afro & European cuts, sharp beard trims. Book your slot in seconds.",
    "hero.hours": "From 10am to 8pm (out-of-hours fee)",
    "hero.cta": "Book an appointment",
    "hero.event": "Next event",
    "catalogue.label": "CATALOGUE",
    "catalogue.title": "My cuts & my services",
    "catalogue.cardTitle": "Haircut catalogue",
    "catalogue.cardText":
      "Browse my work — fades, afro, European cuts, sharp beards — and pick your style before booking.",
    "catalogue.cardCta": "View the catalogue",
    "stats.onAppointment": "By appointment",
    "stats.onTime": "Always on time",
    "stats.clientTravels": "Client travels",
    "stats.reviews": "Client reviews",
    "footer.rights": "All rights reserved",
    "theme.light": "Light mode",
    "theme.dark": "Dark mode",
    "lang.label": "Language",
  },
} satisfies Record<Lang, Record<string, string>>;

export type TranslationKey = keyof (typeof translations)["fr"];

interface LanguageContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "fr",
  setLang: () => {},
  t: (k) => k,
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "fr";
    const stored = window.localStorage.getItem("lcs-lang");
    return stored === "en" ? "en" : "fr";
  });

  useEffect(() => {
    window.localStorage.setItem("lcs-lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => setLangState(l);
  const t = (key: TranslationKey) => translations[lang][key] ?? translations.fr[key] ?? key;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
