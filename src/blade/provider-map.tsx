import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { geocodeProviderCity } from './data';
export function ProviderCityMap({ cities }: {cities:{city:string;count:number}[]}) {
  const ref=useRef<HTMLDivElement>(null);const [unavailable,setUnavailable]=useState(false);
  useEffect(()=>{if(!ref.current||!cities.length)return;const map=L.map(ref.current).setView([46.6,2.5],5);let alive=true;const tiles=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);tiles.on('tileerror',()=>alive&&setUnavailable(true));
    Promise.all(cities.map(async c=>{const point=await geocodeProviderCity(c.city);return point?{...c,...point}:null;})).then(points=>{if(!alive)return;const valid=points.filter((p):p is NonNullable<typeof p>=>p!==null);if(!valid.length){setUnavailable(true);return;}const bounds=L.latLngBounds([]);for(const p of valid){const label=document.createElement('span');label.textContent=`${p.city} · ${p.count} visites`;L.circleMarker([p.lat,p.lng],{radius:8,className:'blade-provider-map-marker'}).addTo(map).bindTooltip(label);bounds.extend([p.lat,p.lng]);}map.fitBounds(bounds,{padding:[30,30],maxZoom:11});}).catch(()=>alive&&setUnavailable(true));return()=>{alive=false;map.remove();};
  },[cities]);return <><div ref={ref} className="blade-provider-map" aria-label="Carte des villes fréquentées"/>{unavailable&&<p className="blade-note">Carte indisponible ; le classement reste accessible ci-dessous.</p>}</>;
}