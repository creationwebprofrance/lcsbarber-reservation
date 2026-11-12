import { useEffect } from 'react';
import { ProChat } from './chat';
import { BrowserRouter, Navigate, Routes, Route, useLocation, Link } from 'react-router-dom';
import { ClientLayout, ProLayout, EmptyState, BladeButton } from './common';
import { ClientSearch, ProfessionalProfile, Appointments, Messages, ClientProfile } from './client';
import { Reserve, Recap, Confirmation } from './booking';
import { Daily, Agenda, Performance, Travel, Vehicle, Clients, Reminders, Services, Revenue, Payments, ProProfile, Catalogue, Simulation, Settings } from './pro';
import { Landing, DemoLogin } from './landing';
import { ProviderDashboard, ProviderPrices, ProviderClients, ProviderEmails, ProviderServices, ProviderVehicle } from './provider';
import './blade.css';
import { BladePreferences } from './preferences';
import { BladeAssistant } from './assistant';
import { PrivateMessages } from './private-messages';
import { PublicProviderProfile } from './public-profile';
import { Superadmin } from './superadmin';
import { ProviderPayments } from './provider-payments';
import { BecomeProvider } from './become-provider';
function RouteEffects() { const location = useLocation(); useEffect(()=> { window.scrollTo(0,0); document.title='BLADE — Espaces client et professionnel';const description=document.querySelector('meta[name="description"]'); description?.setAttribute('content','BLADE : interfaces de réservation et de suivi professionnel.');const icon=document.querySelector<HTMLLinkElement>('link[rel="icon"]');if(icon)icon.href='/blade/favicon.png';for(const property of ['og:title','og:description'])document.querySelector(`meta[property="${property}"]`)?.setAttribute('content',property==='og:title'?'BLADE':'Espaces client et professionnel BLADE');document.querySelector('meta[property="og:image"]')?.remove();document.querySelector('meta[name="twitter:image"]')?.remove(); },[location.pathname]);return null; }
export default function BladeApp() { return <BladePreferences><BrowserRouter><RouteEffects/><Routes><Route path="/blade/profil/:id" element={<PublicProviderProfile/>}/><Route path="/blade" element={<Landing/>}/><Route path="/blade/connexion" element={<DemoLogin/>}/><Route path="/blade/devenir-pro" element={<BecomeProvider/>}/><Route path="/blade/client" element={<ClientLayout/>}><Route index element={<ClientSearch/>}/><Route path="profil-professionnel" element={<ProfessionalProfile/>}/><Route path="reserver" element={<Reserve/>}/><Route path="recapitulatif" element={<Recap/>}/><Route path="confirmation" element={<Confirmation/>}/><Route path="rendez-vous" element={<Appointments/>}/><Route path="messages" element={<Messages/>}/><Route path="profil" element={<ClientProfile/>}/><Route path="*" element={<EmptyState title="Page introuvable" action={<BladeButton asChild><Link to="/blade/client">Recherche</Link></BladeButton>}/>}/></Route><Route path="/blade/pro" element={<ProLayout/>}><Route index element={<ProviderDashboard/>}/><Route path="prix" element={<ProviderPrices/>}/><Route path="clients" element={<ProviderClients/>}/><Route path="emails" element={<ProviderEmails/>}/><Route path="prestations" element={<ProviderServices/>}/><Route path="vehicule" element={<ProviderVehicle/>}/><Route path="chat" element={<ProChat/>}/><Route path="messages" element={<PrivateMessages/>}/><Route path="profil" element={<ProProfile/>}/><Route path="agenda" element={<Agenda/>}/><Route path="paiements" element={<ProviderPayments/>}/><Route path="superadmin" element={<Superadmin/>}/><Route path="*" element={<Navigate to="/blade/pro" replace/>}/></Route><Route path="*" element={<Navigate to="/blade" replace/>}/></Routes><BladeAssistant/></BrowserRouter></BladePreferences>; }
