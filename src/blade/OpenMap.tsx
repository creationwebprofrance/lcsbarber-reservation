import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Plus, Minus, LocateFixed } from 'lucide-react';

// OpenStreetMap's verified town centre, not the professional's exact address.
const townCentre: L.LatLngTuple = [49.0597512, 2.5009544];

export function OpenMap() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, { zoomControl: false, scrollWheelZoom: false }).setView(townCentre, 13);
    mapRef.current = map;
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    });
    let loaded = false;
    tiles.on('tileload', () => { loaded = true; setStatus('ready'); });
    tiles.on('tileerror', () => { if (!loaded) setStatus('error'); });
    tiles.addTo(map);
    const marker = L.marker(townCentre, {
      icon: L.divIcon({ className: 'blade-osm-marker', html: '<span aria-hidden="true">✂</span>', iconSize: [44, 44], iconAnchor: [22, 22] }),
      title: 'LCS Barber — secteur de Puiseux-en-France',
    }).addTo(map);
    marker.bindPopup('LCS Barber · Puiseux-en-France<br>Repère du centre-ville, pas l’adresse exacte.');
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(container.current);
    return () => { resize.disconnect(); map.remove(); mapRef.current = null; };
  }, []);

  return <div className="blade-local-map blade-open-map">
    <div ref={container} className="blade-osm-canvas" role="region" aria-label="Carte OpenStreetMap du secteur de LCS Barber à Puiseux-en-France" />
    <div className="blade-osm-controls">
      <Button variant="outline" className="blade-button" aria-label="Zoom avant" title="Zoom avant" onClick={() => mapRef.current?.zoomIn()}><Plus size={18} /></Button>
      <Button variant="outline" className="blade-button" aria-label="Zoom arrière" title="Zoom arrière" onClick={() => mapRef.current?.zoomOut()}><Minus size={18} /></Button>
      <Button variant="outline" className="blade-button" aria-label="Recentrer sur Puiseux-en-France" title="Recentrer" onClick={() => mapRef.current?.setView(townCentre, 13)}><LocateFixed size={18} /></Button>
    </div>
    {status !== 'ready' && <p className="blade-osm-status" role="status">{status === 'loading' ? 'Chargement de la carte…' : 'Carte indisponible. Vérifiez votre connexion.'}</p>}
    <Link className="blade-osm-profile" to="/blade/client/profil-professionnel"><strong>LCS Barber</strong><span>Puiseux-en-France · Voir le profil →</span><small>Repère du centre-ville, adresse exacte non localisée.</small></Link>
  </div>;
}