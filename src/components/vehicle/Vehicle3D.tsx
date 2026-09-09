import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Car } from "lucide-react";
import { NO_VISUAL_LABEL } from "@/lib/vehicle";

interface Props {
  modelUrl: string | null;
  fallback?: boolean;
  watermarked?: boolean;
  caption?: string;
}

/** Visualisation 3D optionnelle. Aucun visuel inventé : si rien n'est disponible,
 *  on affiche une silhouette neutre et le libellé exact demandé. */
export const Vehicle3D = ({ modelUrl, fallback, watermarked, caption }: Props) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!modelUrl) return;
    let cancelled = false;
    // Chargement paresseux via CDN : le moteur 3D n'est téléchargé que si un modèle existe
    const SRC = "https://unpkg.com/@google/model-viewer@4.0.0/dist/model-viewer.min.js";
    if (customElements.get("model-viewer")) {
      setReady(true);
      return;
    }
    let script = document.querySelector<HTMLScriptElement>(`script[data-model-viewer]`);
    if (!script) {
      script = document.createElement("script");
      script.type = "module";
      script.src = SRC;
      script.dataset.modelViewer = "true";
      document.head.appendChild(script);
    }
    const onLoad = () => !cancelled && setReady(true);
    const onError = () => !cancelled && setReady(false);
    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
    return () => {
      cancelled = true;
      script?.removeEventListener("load", onLoad);
      script?.removeEventListener("error", onError);
    };
  }, [modelUrl]);

  if (!modelUrl) {
    return (
      <Card className="flex h-64 flex-col items-center justify-center gap-3 border-dashed">
        <Car className="h-12 w-12 opacity-30" />
        <p className="text-sm text-muted-foreground">{NO_VISUAL_LABEL}</p>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden">
      {ready ? (
        // @ts-expect-error élément personnalisé fourni par model-viewer
        <model-viewer
          src={modelUrl}
          camera-controls
          auto-rotate
          disable-pan
          shadow-intensity="1"
          style={{ width: "100%", height: "16rem", background: "transparent" }}
        />
      ) : (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Chargement du visuel…
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t p-3 text-xs text-muted-foreground">
        {fallback && <Badge variant="outline">Visuel approchant, non contractuel</Badge>}
        {watermarked && <Badge variant="outline">Filigrane du fournisseur conservé</Badge>}
        <span>{caption ?? "Source : CarImages"}</span>
      </div>
    </Card>
  );
};
