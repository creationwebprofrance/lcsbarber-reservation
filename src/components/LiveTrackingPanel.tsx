import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Radio, Loader2, Navigation, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MAPBOX_PUBLIC_TOKEN } from "@/lib/mapbox";
import { formatDistance, formatTravelTime } from "@/lib/travel-calculator";

type Role = "client" | "barber";

interface LiveTrackingPanelProps {
  bookingId: string;
  role: Role;
  appointmentDate: string; // yyyy-MM-dd
  appointmentTime: string; // HH:mm[:ss]
  durationMinutes?: number;
  peerLabel?: string;
  /** Adresse saisie par le client (destination alternative pour le barber). */
  clientAddress?: string | null;
  /** Démarre le partage de position dès l'affichage (lien de suivi reçu par email). */
  autoStart?: boolean;
  /** Appelé une fois quand le barber démarre manuellement le suivi ("Je suis en route"). */
  onRouteStart?: (etaMinutes?: number) => void | Promise<void>;
}

interface Position {
  lng: number;
  lat: number;
  at: number;
}


const ROLE_COLOR: Record<Role, string> = {
  client: "#F4F1EA",
  barber: "#C58B52",
};

const ROLE_NAME: Record<Role, string> = {
  client: "Le client",
  barber: "LCS Barber",
};

/** Fenêtre automatique : 30 min avant le RDV → fin de la prestation. */
export const getTrackingWindow = (
  appointmentDate: string,
  appointmentTime: string,
  durationMinutes = 60
) => {
  const start = new Date(`${appointmentDate}T${appointmentTime.slice(0, 5)}:00`);
  return {
    from: new Date(start.getTime() - 30 * 60_000),
    to: new Date(start.getTime() + durationMinutes * 60_000),
  };
};

export const isTrackingWindowOpen = (
  appointmentDate: string,
  appointmentTime: string,
  durationMinutes = 60
) => {
  const { from, to } = getTrackingWindow(appointmentDate, appointmentTime, durationMinutes);
  const now = new Date();
  return now >= from && now <= to;
};

/** Le suivi manuel reste possible toute la journée du rendez-vous. */
export const isTrackingDay = (appointmentDate: string) => {
  const today = new Date();
  const d = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
  return d === appointmentDate;
};

export const LiveTrackingPanel = ({
  bookingId,
  role,
  appointmentDate,
  appointmentTime,
  durationMinutes = 60,
  peerLabel,
  clientAddress,
  autoStart,
  onRouteStart,
}: LiveTrackingPanelProps) => {
  const peerRole: Role = role === "client" ? "barber" : "client";
  const [active, setActive] = useState(false);
  const [myPos, setMyPos] = useState<Position | null>(null);
  const [peerPos, setPeerPos] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<{ duration: number; distance: number } | null>(null);
  const [destination, setDestination] = useState<"live" | "address">("live");
  const [addressPos, setAddressPos] = useState<Position | null>(null);

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const myMarker = useRef<mapboxgl.Marker | null>(null);
  const peerMarker = useRef<mapboxgl.Marker | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const fitted = useRef(false);
  const routeNotified = useRef(false);

  const windowOpen = useMemo(
    () => isTrackingWindowOpen(appointmentDate, appointmentTime, durationMinutes),
    [appointmentDate, appointmentTime, durationMinutes]
  );
  const sameDay = isTrackingDay(appointmentDate);
  const canChooseDestination = role === "barber" && !!clientAddress;

  // Démarrage automatique : fenêtre du RDV, lien de suivi, ou côté client le jour J
  useEffect(() => {
    if (windowOpen || autoStart || (role === "client" && sameDay)) setActive(true);
  }, [windowOpen, autoStart, role, sameDay]);

  // Demande explicite d'autorisation de localisation (déclenche le prompt navigateur)
  const requestLocation = useCallback(() => {
    setError(null);
    setActive(true);
    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas supportée par ton navigateur.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lng: pos.coords.longitude, lat: pos.coords.latitude, at: Date.now() };
        setMyPos(p);
        void channelRef.current?.track({ role, ...p });
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Localisation refusée. Autorise l'accès à ta position dans les réglages du navigateur, puis réessaie."
            : "Position indisponible — vérifie que la localisation est activée sur ton téléphone."
        );
      },
      { enableHighAccuracy: true, timeout: 20000 }
    );
  }, [role]);


  // Géocodage de l'adresse saisie par le client (destination alternative)
  useEffect(() => {
    if (!canChooseDestination || !clientAddress || addressPos) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            clientAddress
          )}.json?access_token=${MAPBOX_PUBLIC_TOKEN}&country=fr&limit=1`
        );
        const data = await res.json();
        const c = data.features?.[0]?.center;
        if (!cancelled && Array.isArray(c)) setAddressPos({ lng: c[0], lat: c[1], at: Date.now() });
      } catch (e) {
        console.error("Géocodage adresse client:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canChooseDestination, clientAddress, addressPos]);


  // Canal temps réel + géolocalisation continue
  useEffect(() => {
    if (!active) {
      setPeerPos(null);
      setMyPos(null);
      setRoute(null);
      return;
    }

    const channel = supabase.channel(`tracking:${bookingId}`, {
      config: { presence: { key: role } },
    });
    channelRef.current = channel;

    let subscribed = false;
    let lastPos: Position | null = null;

    const pushPos = (p: Position) => {
      lastPos = p;
      if (subscribed) void channel.track({ role, ...p });
    };

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, Array<Record<string, unknown>>>;
        const entry = state[peerRole]?.[0];
        if (entry && typeof entry.lng === "number" && typeof entry.lat === "number") {
          setPeerPos({ lng: entry.lng as number, lat: entry.lat as number, at: Number(entry.at) || Date.now() });
        } else {
          setPeerPos(null);
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          subscribed = true;
          // Envoie la dernière position connue même si elle est arrivée avant l'abonnement
          if (lastPos) void channel.track({ role, ...lastPos });
        }
      });

    let watchId: number | null = null;
    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas supportée par ton navigateur.");
    } else {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setError(null);
          const p = { lng: pos.coords.longitude, lat: pos.coords.latitude, at: Date.now() };
          setMyPos(p);
          pushPos(p);
        },
        (err) => {
          setError(
            err.code === err.PERMISSION_DENIED
              ? "Localisation refusée. Autorise l'accès à ta position dans les réglages du navigateur pour partager ta position."
              : "Position indisponible — vérifie que la localisation est activée sur ton téléphone."
          );
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
      );
    }

    // Ré-émission périodique : garde la présence à jour même sans nouveau point GPS
    const keepAlive = setInterval(() => {
      if (subscribed && lastPos) void channel.track({ role, ...lastPos, at: Date.now() });
    }, 15_000);

    return () => {
      clearInterval(keepAlive);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [active, bookingId, role, peerRole]);

  // Carte : s'initialise dès qu'on a une position (la mienne OU celle du peer)
  useEffect(() => {
    const anchor = myPos ?? peerPos;
    if (!active || !mapContainer.current || map.current || !anchor) return;
    mapboxgl.accessToken = MAPBOX_PUBLIC_TOKEN;
    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [anchor.lng, anchor.lat],
      zoom: 13,
    });
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      myMarker.current = null;
      peerMarker.current = null;
      fitted.current = false;
    };
  }, [active, myPos, peerPos]);


  // Marqueurs
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    if (myPos) {
      if (!myMarker.current) {
        myMarker.current = new mapboxgl.Marker({ color: ROLE_COLOR[role] })
          .setLngLat([myPos.lng, myPos.lat])
          .setPopup(new mapboxgl.Popup({ offset: 24 }).setText("Ta position"))
          .addTo(m);
      } else {
        myMarker.current.setLngLat([myPos.lng, myPos.lat]);
      }
    }

    if (peerPos) {
      if (!peerMarker.current) {
        peerMarker.current = new mapboxgl.Marker({ color: ROLE_COLOR[peerRole] })
          .setLngLat([peerPos.lng, peerPos.lat])
          .setPopup(new mapboxgl.Popup({ offset: 24 }).setText(peerLabel ?? ROLE_NAME[peerRole]))
          .addTo(m);
      } else {
        peerMarker.current.setLngLat([peerPos.lng, peerPos.lat]);
      }
    } else if (peerMarker.current) {
      peerMarker.current.remove();
      peerMarker.current = null;
    }

    if (myPos && peerPos && !fitted.current) {
      const bounds = new mapboxgl.LngLatBounds()
        .extend([myPos.lng, myPos.lat])
        .extend([peerPos.lng, peerPos.lat]);
      m.fitBounds(bounds, { padding: 70, maxZoom: 15 });
      fitted.current = true;
    } else if (!myPos && peerPos && !fitted.current) {
      // Pas de position perso (refusée) : on suit quand même le peer
      m.easeTo({ center: [peerPos.lng, peerPos.lat], zoom: 14 });
    }
  }, [myPos, peerPos, role, peerRole, peerLabel]);

  // Destination du trajet : position live du client ou adresse saisie
  const targetPos = useMemo(() => {
    if (canChooseDestination && destination === "address") return addressPos;
    return peerPos ?? (canChooseDestination ? addressPos : null);
  }, [canChooseDestination, destination, addressPos, peerPos]);

  // Trajet + ETA recalculés régulièrement
  const refreshRoute = useCallback(async () => {
    const m = map.current;
    if (!m || !myPos || !targetPos) return;
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${myPos.lng},${myPos.lat};${targetPos.lng},${targetPos.lat}?access_token=${MAPBOX_PUBLIC_TOKEN}&geometries=geojson&overview=full`;
      const res = await fetch(url);
      const data = await res.json();
      const r = data.routes?.[0];
      if (!r) return;
      setRoute({ duration: Math.ceil(r.duration / 60), distance: r.distance });

      const geojson = { type: "Feature", properties: {}, geometry: r.geometry } as GeoJSON.Feature;
      const src = m.getSource("live-route") as mapboxgl.GeoJSONSource | undefined;
      if (src) {
        src.setData(geojson);
      } else if (m.isStyleLoaded()) {
        m.addSource("live-route", { type: "geojson", data: geojson });
        m.addLayer({
          id: "live-route",
          type: "line",
          source: "live-route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#C58B52", "line-width": 4, "line-opacity": 0.9 },
        });
      }
    } catch (e) {
      console.error("Erreur itinéraire live:", e);
    }
  }, [myPos, targetPos]);

  useEffect(() => {
    if (!active || !myPos || !targetPos) return;
    refreshRoute();
    const id = setInterval(refreshRoute, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, !!myPos, targetPos?.lng, targetPos?.lat, destination]);


  if (!sameDay && !windowOpen) return null;

  return (
    <div className="mt-4 rounded-xl border border-border/50 bg-background/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radio className={`h-4 w-4 ${active ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
          <span className="text-sm font-medium">Suivi en direct</span>
          {active && peerPos && (
            <Badge variant="outline" className="border-primary/60 text-primary text-[10px]">
              {peerLabel ?? ROLE_NAME[peerRole]} en ligne
            </Badge>
          )}
          {active && !peerPos && (
            <Badge variant="secondary" className="text-[10px]">
              En attente de {peerLabel ?? ROLE_NAME[peerRole]}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant={active ? "outline" : "default"}
          onClick={() => {
            const next = !active;
            setActive(next);
            if (next && role === "barber" && onRouteStart && !routeNotified.current) {
              routeNotified.current = true;
              void onRouteStart(route?.duration);
            }
          }}
        >
          {active ? "Arrêter le suivi" : role === "barber" ? "Je suis en route" : "Partager ma position"}
        </Button>
      </div>

      {!active ? (
        <p className="text-xs text-muted-foreground">
          {role === "barber"
            ? "Active le suivi pour partager ta position en temps réel jusqu'à la fin de la prestation. Il se lance automatiquement 30 min avant le rendez-vous."
            : "Partage ta position pour suivre l'arrivée de LCS Barber en direct et lui indiquer où te rejoindre."}
        </p>
      ) : (
        <>
          {error && (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
              <p className="text-xs text-muted-foreground">{error}</p>
              <Button size="sm" className="h-7 text-xs gap-1.5" onClick={requestLocation}>
                <Navigation className="h-3.5 w-3.5" /> Autoriser ma localisation
              </Button>
            </div>
          )}
          {!myPos && !error && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Récupération de ta position...
              </p>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={requestLocation}>
                <Navigation className="h-3.5 w-3.5" /> Autoriser ma localisation
              </Button>
            </div>
          )}

          {canChooseDestination && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Trajet vers :</span>
              <Button
                size="sm"
                variant={destination === "address" ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setDestination("address")}
              >
                Adresse du client
              </Button>
              <Button
                size="sm"
                variant={destination === "live" ? "default" : "outline"}
                className="h-7 text-xs"
                disabled={!peerPos}
                onClick={() => setDestination("live")}
              >
                Position partagée
              </Button>
              {destination === "address" && clientAddress && (
                <span className="text-[11px] text-muted-foreground">{clientAddress}</span>
              )}
            </div>
          )}
          <div ref={mapContainer} className="h-64 w-full rounded-lg overflow-hidden bg-muted/30" />

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Navigation className="h-3.5 w-3.5 text-primary" />
              {route ? (
                <>
                  Arrivée estimée dans{" "}
                  <span className="text-primary font-semibold">{formatTravelTime(route.duration)}</span> (
                  {formatDistance(route.distance)})
                </>
              ) : (
                "En attente des deux positions..."
              )}
            </span>
            {peerPos && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Mise à jour il y a {Math.max(0, Math.round((Date.now() - peerPos.at) / 1000))} s
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Le suivi ne fonctionne que si cette page reste ouverte.
          </p>
        </>
      )}
    </div>
  );
};
