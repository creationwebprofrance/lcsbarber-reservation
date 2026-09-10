import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Car, RefreshCw } from "lucide-react";
import { NO_VISUAL_LABEL } from "@/lib/vehicle";
import { carImagesQuery } from "@/lib/vehicle-normalize";

/** Clé publique CarImages : prévue par le fournisseur pour être posée dans la page.
 *  Le secret CarImages n'est jamais utilisé côté navigateur. */
const CARIMAGES_PUBLIC_KEY = "ci_e25b639e546150fc36255c516969e58d6717a91dc749c41ef40f4794";
const LOADER_SRC = "https://carimagesapi.com/assets/js/carimages.js";

interface Props {
  make?: string | null;
  model?: string | null;
  year?: number | string | null;
  /** carrosserie attendue, utilisée seulement pour les journaux et le contrôle */
  expectedBody?: string | null;
  height?: string;
}

type State = "idle" | "loading" | "ready" | "failed";

export const Vehicle3D = ({ make, model, year, expectedBody, height = "16rem" }: Props) => {
  const [state, setState] = useState<State>("idle");
  const [attempt, setAttempt] = useState(0);
  const timer = useRef<number | null>(null);
  const query = carImagesQuery(make, model, year);

  const log = useCallback((payload: Record<string, unknown>) => {
    // journal technique uniquement, jamais affiché à l'utilisateur
    console.info("[carimages]", { ...payload, expected_body: expectedBody ?? "unknown" });
  }, [expectedBody]);

  useEffect(() => {
    if (!query) return;
    setState("loading");
    log({ step: "request", ...query, original_model: model });

    let cancelled = false;
    let script = document.querySelector<HTMLScriptElement>("script[data-carimages]");

    const done = (ok: boolean, reason?: string) => {
      if (cancelled) return;
      if (!ok) log({ step: "error", reason });
      setState(ok ? "ready" : "failed");
    };

    if (script?.dataset.loaded === "true") {
      done(true);
    } else {
      if (!script) {
        script = document.createElement("script");
        script.src = LOADER_SRC;
        script.async = true;
        script.dataset.carimages = "true";
        script.setAttribute("data-api-key", CARIMAGES_PUBLIC_KEY);
        document.head.appendChild(script);
      }
      const onLoad = () => { script!.dataset.loaded = "true"; done(true); };
      const onError = () => done(false, "loader_unreachable");
      script.addEventListener("load", onLoad);
      script.addEventListener("error", onError);
      timer.current = window.setTimeout(() => done(false, "timeout"), 12000);
      return () => {
        cancelled = true;
        if (timer.current) window.clearTimeout(timer.current);
        script?.removeEventListener("load", onLoad);
        script?.removeEventListener("error", onError);
      };
    }
    return () => { cancelled = true; };
  }, [query?.make, query?.model, query?.year, attempt, log, model]); // eslint-disable-line react-hooks/exhaustive-deps

  const fallback = (
    <Card className="flex flex-col items-center justify-center gap-3 border-dashed" style={{ minHeight: height }}>
      <Car className="h-12 w-12 opacity-30" />
      <p className="text-sm text-muted-foreground">{NO_VISUAL_LABEL}</p>
      {query && (
        <Button variant="outline" size="sm" onClick={() => setAttempt((a) => a + 1)}>
          <RefreshCw className="mr-2 h-4 w-4" /> Chercher un visuel 3D
        </Button>
      )}
      {!query && (
        <p className="px-6 text-center text-xs text-muted-foreground">
          Renseigne la marque, le modèle et l'année pour afficher le véhicule.
        </p>
      )}
    </Card>
  );

  if (!query || state === "failed") return fallback;

  return (
    <Card className="relative overflow-hidden">
      {state === "ready" ? (
        // @ts-expect-error élément personnalisé fourni par le chargeur CarImages
        <model-viewer
          key={`${query.make}-${query.model}-${query.year}-${attempt}`}
          data-ci-make={query.make}
          data-ci-model={query.model}
          data-ci-year={query.year}
          data-ci-type="car"
          camera-controls
          auto-rotate
          onError={() => setState("failed")}
          style={{ width: "100%", height, background: "transparent" }}
        />
      ) : (
        <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
          Chargement du visuel…
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t p-3 text-xs text-muted-foreground">
        <Badge variant="outline">Visuel indicatif, non contractuel</Badge>
        <span>{`${query.make} ${query.model} ${query.year}`}</span>
      </div>
    </Card>
  );
};
