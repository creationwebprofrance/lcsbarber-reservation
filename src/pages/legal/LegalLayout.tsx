import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ReactNode } from "react";

export default function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-5 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" /> Retour à l'accueil
        </Link>
        <h1 className="font-display text-3xl sm:text-4xl mb-8">{title}</h1>
        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground [&_h2]:text-foreground [&_h2]:font-semibold [&_h2]:text-lg [&_h2]:mb-2 [&_strong]:text-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}
