import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight, Home, MapPin, Search, CalendarCheck, Scissors, BadgeCheck, Bell } from 'lucide-react';
import { SiteNav, SiteFooter } from './site-nav';
import { CITIES, DEPARTMENTS, cityBySlug, citiesInDept } from './seo';

const search = (mode: 'Chez vous' | 'Près de vous', q: string) => `/blade/client?${new URLSearchParams({ mode, q })}`;

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="bl-landing bl2 blade-app">
    <a href="#bl-main" className="blade-skip">Aller au contenu</a>
    <SiteNav />
    <main id="bl-main" className="bl2-main bl-city">{children}</main>
    <SiteFooter />
  </div>;
}

// Page « Barber à domicile à {ville} » (référencement local Île-de-France).
export function CityPage() {
  const { ville } = useParams();
  const city = cityBySlug(ville);
  if (!city) return <Navigate to="/blade/barber" replace />;
  const neighbours = [...citiesInDept(city.dept), ...(city.dept === '75' ? [] : citiesInDept('75'))].filter(c => c.slug !== city.slug).slice(0, 8);
  return <Shell>
    <nav className="bl-city-crumbs" aria-label="Fil d’Ariane"><Link to="/blade">Accueil</Link><span aria-hidden="true">/</span><Link to="/blade/barber">Île-de-France</Link><span aria-hidden="true">/</span><span aria-current="page">{city.name}</span></nav>
    <section className="bl-city-hero">
      <p className="blade-pricing-eyebrow">{city.deptName} ({city.dept})</p>
      <h1>Barber à domicile à {city.name}</h1>
      <p>Dégradé, coupe, taille de barbe : réserve un barber qui se déplace chez toi à {city.name}, ou trouve un barber près de chez toi. Tu vois ses réalisations et ses prix avant de réserver.</p>
      <div className="bl-city-actions">
        <Link className="bl3-btn bl3-btn-solid" to={search('Chez vous', city.name)}><Home size={18} aria-hidden="true" />Un barber chez moi</Link>
        <Link className="bl3-btn bl3-btn-ghost" to={search('Près de vous', city.name)}><MapPin size={18} aria-hidden="true" />Près de chez moi</Link>
      </div>
    </section>

    <section className="bl-city-block" aria-labelledby="city-how">
      <h2 id="city-how">Comment ça marche</h2>
      <ol className="bl-city-steps">
        <li><Search size={22} aria-hidden="true" /><strong>Cherche</strong><span>Indique {city.name} et choisis « chez moi » ou « près de chez moi ».</span></li>
        <li><Scissors size={22} aria-hidden="true" /><strong>Choisis</strong><span>Compare les profils, les réalisations en vidéo et les prix affichés.</span></li>
        <li><CalendarCheck size={22} aria-hidden="true" /><strong>Réserve</strong><span>Prends ton créneau en ligne et reçois une confirmation.</span></li>
      </ol>
    </section>

    <section className="bl-city-block" aria-labelledby="city-why">
      <h2 id="city-why">Pourquoi réserver sur BLADE à {city.name}</h2>
      <ul className="bl-city-why">
        <li><BadgeCheck size={20} aria-hidden="true" /><span><strong>Des barbers indépendants</strong> qui viennent chez toi ou te reçoivent près de chez toi.</span></li>
        <li><Scissors size={20} aria-hidden="true" /><span><strong>Le prix avant de réserver</strong>, frais de déplacement compris pour le domicile.</span></li>
        <li><Bell size={20} aria-hidden="true" /><span><strong>Confirmation et rappel</strong> de ton rendez-vous, et carte de fidélité chez les barbers qui la proposent.</span></li>
      </ul>
    </section>

    {neighbours.length > 0 && <section className="bl-city-block" aria-labelledby="city-near">
      <h2 id="city-near">Barbers dans les villes proches</h2>
      <ul className="bl-city-links">{neighbours.map(c => <li key={c.slug}><Link to={`/blade/barber/${c.slug}`}>Barber à {c.name}</Link></li>)}</ul>
    </section>}

    <section className="bl-city-pro">
      <div><h2>Tu es barber à {city.name} ?</h2><p>Crée ton profil gratuitement et reçois des réservations de clients près de chez toi.</p></div>
      <Link className="bl3-btn bl3-btn-solid" to="/blade/tarifs">Voir les offres <ArrowRight size={18} aria-hidden="true" /></Link>
    </section>
  </Shell>;
}

export function CitiesIndex() {
  const depts = Object.keys(DEPARTMENTS).sort((a, b) => (a === '75' ? -1 : b === '75' ? 1 : a.localeCompare(b)));
  return <Shell>
    <section className="bl-city-hero">
      <p className="blade-pricing-eyebrow">Île-de-France</p>
      <h1>Barbers à domicile en Île-de-France</h1>
      <p>Choisis ta ville pour trouver un barber qui se déplace chez toi ou près de chez toi.</p>
    </section>
    <div className="bl-city-depts">
      {depts.map(d => <section key={d} className="bl-city-block"><h2>{DEPARTMENTS[d]} ({d})</h2><ul className="bl-city-links">{CITIES.filter(c => c.dept === d).map(c => <li key={c.slug}><Link to={`/blade/barber/${c.slug}`}>{c.name}</Link></li>)}</ul></section>)}
    </div>
  </Shell>;
}
