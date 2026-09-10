import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Car } from "lucide-react";
import { NO_VISUAL_LABEL } from "@/lib/vehicle";

/** Clé publique CarImages : prévue par le fournisseur pour être posée dans la page. */
const CARIMAGES_PUBLIC_KEY = "ci_e25b639e546150fc36255c516969e58d6717a91dc749c41ef40f4794";
const LOADER_SRC = "https://carimagesapi.com/assets/js/carimages.js";

interface Props {
  make?: string | null;
  model?: string | null;
  year?: number | string | null;
  caption?: string;
}

/** Visualisation 3D CarImages. Elle n'attend que marque, modèle et année.
 *  Sans ces trois informations, on affiche une silhouette neutre. */
export const Vehicle3D = ({ make, model, year, caption }: Props) => {
  const [ready, setReady] = useState(false);
  const enabled = Boolean(make && model && year);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let script = document.querySelector<HTMLScriptElement>("script[data-carimages]");
    if (script?.dataset.loaded === "true") {
      setReady(true);
      return;
    }
    if (!script) {
      script = document.createElement("script");
      script.src = LOADER_SRC;
      script.async = true;
      script.dataset.carimages = "true";
      script.setAttribute("data-api-key", CARIMAGES_PUBLIC_KEY);
      document.head.appendChild(script);
    }
    const onLoad = () => {
      script!.dataset.loaded = "true";
      if (!cancelled) setReady(true);
    };
    const onError = () => !cancelled && setReady(false);
    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
    return () => {
      cancelled = true;
      script?.removeEventListener("load", onLoad);
      script?.removeEventListener("error", onError);
    };
  }, [enabled]);

  if (!enabled) {
    return (
      <Card className="flex h-64 flex-col items-center justify-center gap-3 border-dashed">
        <Car className="h-12 w-12 opacity-30" />
        <p className="text-sm text-muted-foreground">{NO_VISUAL_LABEL}</p>
        <p className="px-6 text-center text-xs text-muted-foreground">
          Renseigne la marque, le modèle et l'année pour afficher le véhicule.
        </p>
      </Card>
    );
  }

  const key = `${make}-${model}-${year}`;

  return (
    <Card className="relative overflow-hidden">
      {ready ? (
        // @ts-expect-error élément personnalisé fourni par le chargeur CarImages
        <model-viewer
          key={key}
          data-ci-make={make}
          data-ci-model={model}
          data-ci-year={String(year)}
          camera-controls
          auto-rotate
          style={{ width: "100%", height: "16rem", background: "transparent" }}
        />
      ) : (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Chargement du visuel…
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t p-3 text-xs text-muted-foreground">
        <Badge variant="outline">Visuel indicatif, non contractuel</Badge>
        <span>{caption ?? `Source : CarImages · ${make} ${model} ${year}`}</span>
      </div>
    </Card>
  );
};
