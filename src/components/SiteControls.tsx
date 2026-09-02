import { useTheme } from "next-themes";
import { Moon, Sun, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";

export const SiteControls = ({ className = "" }: { className?: string }) => {
  const { theme, setTheme } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const isDark = theme !== "light";

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs font-semibold uppercase tracking-wide"
        onClick={() => setLang(lang === "fr" ? "en" : "fr")}
        aria-label={t("lang.label")}
        title={t("lang.label")}
      >
        <Languages className="h-4 w-4 mr-1" />
        {lang === "fr" ? "FR" : "EN"}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-label={isDark ? t("theme.light") : t("theme.dark")}
        title={isDark ? t("theme.light") : t("theme.dark")}
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    </div>
  );
};

export default SiteControls;
