import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Loader2, X } from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { formatDistance, formatTravelTime } from "@/lib/travel-calculator";

const MAPBOX_TOKEN = 'pk.eyJ1IjoibGNoaXBhbiIsImEiOiJjbWZtOHc1dG4wZDdzMmlzN3hmeDRldnhzIn0.lK1A8wh63mIkudWk8h7f6Q';

interface BookingRouteMapProps {
  mode: "domicile" | "deplacement";
}

// "LCS Barber se déplace" : le barber part de la gare de Louvres
// "Le client se déplace" : rendez-vous à côté du domicile
const FIXED_POINT = {
  domicile: {
    label: "Le rendez-vous",
    address: "Imp. des Hirondelles Prolongée, 95380 Puiseux-en-France",
    geocodeQuery: "Imp. des Hirondelles Prolongée, 95380 Puiseux-en-France",
  },
  deplacement: {
    label: "LCS Barber (départ)",
    address: "Gare de Louvres, 95380 Louvres",
    geocodeQuery: "Gare de Louvres, 95380 Louvres",
  },
} as const;

const geocode = async (query: string): Promise<[number, number] | null> => {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=FR&limit=1`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.features?.length) return null;
  return data.features[0].center as [number, number];
};

export const BookingRouteMap = ({ mode }: BookingRouteMapProps) => {
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ duration: number; distance: number } | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  const fixedPoint = FIXED_POINT[mode];

  const shareLocation = () => {
    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas supportée par ton navigateur.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPosition([pos.coords.longitude, pos.coords.latitude]);
        setLocating(false);
      },
      () => {
        setError("Impossible d'accéder à ta position. Vérifie les autorisations du navigateur.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Initialise la carte et trace l'itinéraire une fois la position connue
  useEffect(() => {
    if (!userPosition || !mapContainer.current || map.current) return;

    let cancelled = false;

    const init = async () => {
      const fixedCoords = await geocode(fixedPoint.geocodeQuery);
      if (cancelled || !fixedCoords || !mapContainer.current) return;

      mapboxgl.accessToken = MAPBOX_TOKEN;
      const m = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [
          (userPosition[0] + fixedCoords[0]) / 2,
          (userPosition[1] + fixedCoords[1]) / 2,
        ],
        zoom: 11,
      });
      map.current = m;

      m.on("load", async () => {
        if (cancelled) return;

        // Marqueurs : position du client + point fixe
        new mapboxgl.Marker({ color: "#F4F1EA" })
          .setLngLat(userPosition)
          .setPopup(new mapboxgl.Popup({ offset: 25 }).setText("Ta position"))
          .addTo(m);

        new mapboxgl.Marker({ color: "#C58B52" })
          .setLngLat(fixedCoords)
          .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(fixedPoint.label))
          .addTo(m);

        // Itinéraire
        try {
          const dirUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${userPosition[0]},${userPosition[1]};${fixedCoords[0]},${fixedCoords[1]}?access_token=${MAPBOX_TOKEN}&geometries=geojson`;
          const res = await fetch(dirUrl);
          const data = await res.json();
          const route = data.routes?.[0];
          if (!route) return;

          m.addSource("route", {
            type: "geojson",
            data: { type: "Feature", properties: {}, geometry: route.geometry },
          });
          m.addLayer({
            id: "route",
            type: "line",
            source: "route",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#C58B52", "line-width": 4, "line-opacity": 0.9 },
          });

          const bounds = new mapboxgl.LngLatBounds();
          route.geometry.coordinates.forEach((c: [number, number]) => bounds.extend(c));
          m.fitBounds(bounds, { padding: 60 });

          setRouteInfo({
            duration: Math.ceil(route.duration / 60),
            distance: route.distance,
          });
        } catch (e) {
          console.error("Erreur itinéraire:", e);
        }
      });
    };

    init();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPosition]);

  // Reset à chaque changement de mode
  useEffect(() => {
    setUserPosition(null);
    setDeclined(false);
    setError(null);
    setRouteInfo(null);
  }, [mode]);

  if (declined) return null;

  return (
    <div className="mt-6 rounded-xl border border-border/50 bg-background/40 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <MapPin className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">Voir le trajet sur la carte</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Partage ta position pour afficher le trajet{" "}
            {mode === "domicile"
              ? `jusqu'au rendez-vous (${fixedPoint.address})`
              : `que fera LCS Barber depuis la gare de Louvres jusqu'à chez toi`}
            .
          </p>
        </div>
      </div>

      {!userPosition ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={shareLocation} disabled={locating} className="gap-2">
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
            {locating ? "Localisation..." : "Partager ma position"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDeclined(true)}>
            <X className="h-4 w-4 mr-1" />
            Non merci
          </Button>
          {error && <p className="w-full text-xs text-destructive">{error}</p>}
        </div>
      ) : (
        <>
          <div ref={mapContainer} className="h-64 sm:h-72 w-full rounded-lg overflow-hidden" />
          {routeInfo && (
            <p className="text-xs text-muted-foreground">
              Trajet estimé :{" "}
              <span className="text-primary font-semibold">{formatTravelTime(routeInfo.duration)}</span>
              {" "}({formatDistance(routeInfo.distance)}) — {fixedPoint.label} : {fixedPoint.address}
            </p>
          )}
        </>
      )}
    </div>
  );
};
