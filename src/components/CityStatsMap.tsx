import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MapPin, Pencil, Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface CityStats {
  city: string;
  count: number;
  lat?: number;
  lng?: number;
}

interface CityStatsMapProps {
  cityStats: CityStats[];
  onCityUpdated: () => void;
}

export function CityStatsMap({ cityStats, onCityUpdated }: CityStatsMapProps) {
  const [editingCity, setEditingCity] = useState<string | null>(null);
  const [newCityName, setNewCityName] = useState("");
  const [geocodedCities, setGeocodedCities] = useState<CityStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapToken, setMapToken] = useState<string | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const { toast } = useToast();

  // Fetch Mapbox token from edge function
  useEffect(() => {
    const fetchMapToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-mapbox-token");
        if (error) throw error;
        setMapToken(data.token);
      } catch (error) {
        console.error("Error fetching Mapbox token:", error);
      }
    };
    fetchMapToken();
  }, []);

  // Geocode cities
  useEffect(() => {
    const geocodeCities = async () => {
      if (!cityStats.length) return;
      setLoading(true);
      
      const results: CityStats[] = [];
      for (const stat of cityStats) {
        try {
          const { data, error } = await supabase.functions.invoke("geocode-city", {
            body: { city: stat.city }
          });
          if (!error && data && !data.error) {
            results.push({ ...stat, lat: data.lat, lng: data.lng });
          } else {
            results.push(stat);
          }
        } catch {
          results.push(stat);
        }
      }
      
      setGeocodedCities(results);
      setLoading(false);
    };
    
    geocodeCities();
  }, [cityStats]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapToken || !geocodedCities.length) return;

    const validCities = geocodedCities.filter(c => c.lat && c.lng);
    if (!validCities.length) return;

    mapboxgl.accessToken = mapToken;

    if (map.current) {
      // Clear existing markers
      markers.current.forEach(m => m.remove());
      markers.current = [];
    } else {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [validCities[0].lng!, validCities[0].lat!],
        zoom: 5
      });

      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    }

    // Add markers for each city
    validCities.forEach((city) => {
      if (city.lat && city.lng) {
        const el = document.createElement("div");
        el.className = "city-marker";
        el.innerHTML = `
          <div style="
            background: hsl(var(--primary));
            color: white;
            padding: 4px 8px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            white-space: nowrap;
          ">
            <span>${city.city}</span>
            <span style="background: white; color: hsl(var(--primary)); padding: 2px 6px; border-radius: 10px; font-size: 10px;">${city.count}</span>
          </div>
        `;

        const marker = new mapboxgl.Marker(el)
          .setLngLat([city.lng, city.lat])
          .addTo(map.current!);
        
        markers.current.push(marker);
      }
    });

    // Fit bounds to show all markers
    if (validCities.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      validCities.forEach(city => {
        if (city.lat && city.lng) {
          bounds.extend([city.lng, city.lat]);
        }
      });
      map.current.fitBounds(bounds, { padding: 50 });
    }

    return () => {
      markers.current.forEach(m => m.remove());
      markers.current = [];
    };
  }, [mapToken, geocodedCities]);

  const handleEditCity = (city: string) => {
    setEditingCity(city);
    setNewCityName(city);
  };

  const handleCancelEdit = () => {
    setEditingCity(null);
    setNewCityName("");
  };

  const handleSaveCity = async (oldCity: string) => {
    if (!newCityName.trim() || newCityName === oldCity) {
      handleCancelEdit();
      return;
    }

    try {
      // Update all bookings with the old city name to the new city name
      // Escape SQL LIKE wildcards in user input to avoid unintended matches
      const escapedCity = oldCity.replace(/[\\%_]/g, "\\$&");
      const { error } = await supabase
        .from("bookings")
        .update({ client_address: newCityName })
        .ilike("client_address", `%${escapedCity}%`);

      if (error) throw error;

      toast({
        title: "Ville modifiée",
        description: `"${oldCity}" a été renommée en "${newCityName}".`,
      });

      setEditingCity(null);
      setNewCityName("");
      onCityUpdated();
    } catch (error) {
      console.error("Erreur modification ville:", error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier le nom de la ville.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium">Top Villes</CardTitle>
        <MapPin className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Map */}
        {mapToken && geocodedCities.some(c => c.lat && c.lng) ? (
          <div 
            ref={mapContainer} 
            className="h-[300px] rounded-lg overflow-hidden border"
          />
        ) : loading ? (
          <div className="h-[300px] rounded-lg border flex items-center justify-center bg-muted/20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="h-[300px] rounded-lg border flex items-center justify-center bg-muted/20">
            <p className="text-muted-foreground text-sm">Carte non disponible</p>
          </div>
        )}

        {/* City list */}
        {cityStats.length > 0 ? (
          <div className="space-y-3">
            {cityStats.map((stat, index) => (
              <div key={stat.city} className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium">
                    {index + 1}
                  </span>
                  {editingCity === stat.city ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={newCityName}
                        onChange={(e) => setNewCityName(e.target.value)}
                        className="h-8 flex-1"
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-600"
                        onClick={() => handleSaveCity(stat.city)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600"
                        onClick={handleCancelEdit}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium">{stat.city}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleEditCity(stat.city)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
                {editingCity !== stat.city && (
                  <Badge variant="secondary">
                    {stat.count} réservation{stat.count > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Aucune donnée de ville disponible</p>
        )}
      </CardContent>
    </Card>
  );
}
