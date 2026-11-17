// Vraie carte de l'Île-de-France (contours officiels des 8 départements), sans noms de villes.
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MAPBOX_PUBLIC_TOKEN } from '@/lib/mapbox';

type Ring = [number, number][];
type Geo = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };
type FC = { features: { properties: { kind: 'region' | 'dep'; code?: string }; geometry: Geo }[] };

const outerRings = (g: Geo): Ring[] => g.type === 'Polygon' ? [g.coordinates[0]] : g.coordinates.map(p => p[0]);
const centroid = (ring: Ring): L.LatLngTuple => { let x = 0, y = 0; for (const [lng, lat] of ring) { x += lng; y += lat; } return [y / ring.length, x / ring.length]; };

export default function IdfMap() {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const dark = document.documentElement.dataset.bladeTheme === 'dark';
    const map = L.map(el, { zoomControl: false, attributionControl: true, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false, zoomSnap: 0.25 });
    map.attributionControl.setPrefix(false);
    map.setView([48.71, 2.5], 8);
    const style = dark ? 'dark-v11' : 'light-v11';
    const tiles = L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/${style}/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_PUBLIC_TOKEN}`, {
      tileSize: 512, zoomOffset: -1, attribution: '© Mapbox © OpenStreetMap · Contours IGN/INSEE',
    }).addTo(map);
    let failed = 0;
    tiles.on('tileerror', () => { if (++failed === 3) { map.removeLayer(tiles); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap · Contours IGN/INSEE' }).addTo(map).bringToBack(); } });

    let alive = true;
    fetch('/blade/idf.geojson').then(r => r.json()).then((fc: FC) => {
      if (!alive) return;
      const region = fc.features.find(f => f.properties.kind === 'region');
      if (!region) return;
      const rings = outerRings(region.geometry).map(r => r.map(([lng, lat]) => [lat, lng] as L.LatLngTuple));
      // Voile autour de la région pour la faire ressortir.
      const world: L.LatLngTuple[] = [[85, -180], [85, 180], [-85, 180], [-85, -180]];
      L.polygon([world, ...rings], { stroke: false, fillColor: dark ? '#0d0806' : '#f4efe9', fillOpacity: 0.8, interactive: false }).addTo(map);
      for (const f of fc.features.filter(f => f.properties.kind === 'dep')) {
        L.geoJSON(f.geometry as GeoJSON.Geometry, { interactive: false, style: { color: '#8a5a3c', weight: 1.2, opacity: 0.7, dashArray: '4 5', fillColor: '#a8743f', fillOpacity: 0.12 } }).addTo(map);
        const c = centroid(outerRings(f.geometry)[0]);
        L.marker(c, { interactive: false, keyboard: false, icon: L.divIcon({ className: 'bl-idf-live', html: `<span class="bl-idf-live-pulse" style="animation-delay:${(Math.random() * 2).toFixed(2)}s"></span><span class="bl-idf-live-dot"></span>`, iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(map);
      }
      L.polygon(rings, { color: '#4a2f22', weight: 3.5, opacity: 0.95, fill: false, interactive: false }).addTo(map);
      const fit = () => { map.invalidateSize(); map.fitBounds(L.latLngBounds(rings.flat()), { padding: [34, 34] }); };
      fit();
      const ro = new ResizeObserver(fit); ro.observe(el);
      map.once('unload', () => ro.disconnect());
    }).catch(() => { /* la carte reste sans contours */ });
    return () => { alive = false; map.remove(); };
  }, []);
  return <div ref={box} className="bl-idf-leaflet" />;
}
