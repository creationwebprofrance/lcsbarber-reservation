// Simulation de trajet à partir de l'adresse saisie par le visiteur (démo publique).
// Géocodage et itinéraire avec trafic via Mapbox (clé publique du site), OSRM en secours.
import { MAPBOX_PUBLIC_TOKEN } from '@/lib/mapbox';
import type { LngLat } from './trip-model';

export type SimRoute = { route: LngLat[]; times: number[]; distance_m: number; duration_s: number; dest: LngLat; label: string; traffic: boolean };
export type Place = { label: string; center: LngLat };

const PARIS: LngLat = [2.3522, 48.8566];

/** Suggestions d'adresses en France (proches de Paris en priorité). */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim(); if (q.length < 3) return [];
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?country=fr&language=fr&limit=5&types=address,poi,place,postcode,neighborhood&proximity=${PARIS.join(',')}&access_token=${MAPBOX_PUBLIC_TOKEN}`;
  try {
    const r = await fetch(url, { signal }); if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    return (j.features ?? []).map((f: { place_name: string; center: LngLat }) => ({ label: f.place_name, center: f.center }));
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    // Secours : Nominatim (OpenStreetMap)
    const n = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=fr&limit=5&q=${encodeURIComponent(q)}`, { signal, headers: { 'Accept-Language': 'fr' } });
    const arr = n.ok ? await n.json() : [];
    return arr.map((p: { display_name: string; lon: string; lat: string }) => ({ label: p.display_name, center: [Number(p.lon), Number(p.lat)] as LngLat }));
  }
}

/** Point de départ simulé à environ `km` kilomètres de la destination, dans une direction au hasard. */
export function simulatedOrigin(dest: LngLat, km = 3.5, angle = Math.random() * 2 * Math.PI): LngLat {
  const dLat = (km / 111.32) * Math.cos(angle);
  const dLng = (km / (111.32 * Math.cos((dest[1] * Math.PI) / 180))) * Math.sin(angle);
  return [dest[0] + dLng, dest[1] + dLat];
}

const cumTimes = (durations: number[]) => { const t = [0]; durations.forEach((d, i) => t.push(t[i] + d)); return t; };

/** Itinéraire en voiture entre deux points, avec la durée de chaque tronçon. */
export async function routeBetween(from: LngLat, to: LngLat, signal?: AbortSignal): Promise<Omit<SimRoute, 'dest' | 'label'>> {
  try {
    const r = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${from.join(',')};${to.join(',')}?geometries=geojson&overview=full&annotations=duration&access_token=${MAPBOX_PUBLIC_TOKEN}`, { signal });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json(); const route = j.routes?.[0];
    if (!route) throw new Error('no route');
    return { route: route.geometry.coordinates, times: cumTimes(route.legs[0].annotation.duration), distance_m: route.distance, duration_s: route.duration, traffic: true };
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${from.join(',')};${to.join(',')}?geometries=geojson&overview=full&annotations=duration`, { signal });
    const j = r.ok ? await r.json() : null; const route = j?.routes?.[0];
    if (!route) throw new Error('Itinéraire introuvable pour cette adresse.');
    const TRAFFIC = 1.45; // OSRM ne connaît pas le trafic : estimation pour une ville dense
    const times = cumTimes(route.legs[0].annotation.duration.map((d: number) => d * TRAFFIC));
    return { route: route.geometry.coordinates, times, distance_m: route.distance, duration_s: times[times.length - 1], traffic: false };
  }
}

/** Simule le trajet d'un professionnel qui part à ~3,5 km de l'adresse choisie. */
export async function simulateTo(place: Place, signal?: AbortSignal): Promise<SimRoute> {
  let lastError: unknown;
  for (const km of [3.5, 2.5, 4.5]) {
    try {
      const r = await routeBetween(simulatedOrigin(place.center, km), place.center, signal);
      if (r.route.length >= 2 && r.distance_m > 500) return { ...r, dest: r.route[r.route.length - 1], label: place.label };
    } catch (e) { if ((e as Error).name === 'AbortError') throw e; lastError = e; }
  }
  throw lastError instanceof Error ? lastError : new Error('Itinéraire introuvable pour cette adresse.');
}
