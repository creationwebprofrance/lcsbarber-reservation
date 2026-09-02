import { AlertTriangle } from "lucide-react";
import { LATE_POLICY } from "@/lib/deposit";

export const LatePolicy = ({ className = "" }: { className?: string }) => (
  <div className={`rounded-lg border border-primary/30 bg-primary/5 p-4 ${className}`}>
    <div className="mb-2 flex items-center gap-2 text-primary">
      <AlertTriangle className="h-4 w-4" />
      <span className="text-sm font-semibold">Acompte & politique de retard</span>
    </div>
    <ul className="space-y-1.5 text-xs text-muted-foreground">
      {LATE_POLICY.lines.map((line) => (
        <li key={line} className="flex gap-2">
          <span className="text-primary">•</span>
          <span>{line}</span>
        </li>
      ))}
    </ul>
  </div>
);
