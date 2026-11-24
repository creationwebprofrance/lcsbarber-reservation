import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calculator } from 'lucide-react';
import { SiteNav, SiteFooter } from './site-nav';

const PLANS = [{ id: 'free', label: 'Découverte (0 €)', price: 0 }, { id: 'pro', label: 'Pro (19,90 €)', price: 19.9 }, { id: 'premium', label: 'Premium (39,90 €)', price: 39.9 }];
const eur = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eur2 = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Num({ label, value, onChange, suffix, step = 1, hint }: { label: string; value: number; onChange: (n: number) => void; suffix?: string; step?: number; hint?: string }) {
  const id = useId();
  return <div className="bl-tool-field">
    <label htmlFor={id}>{label}</label>
    <div className="bl-tool-input"><input id={id} type="number" inputMode="decimal" min={0} step={step} value={Number.isFinite(value) ? value : ''} onChange={e => onChange(e.target.value === '' ? 0 : Number(e.target.value))} />{suffix && <span>{suffix}</span>}</div>
    {hint && <small>{hint}</small>}
  </div>;
}

// Calculateur gratuit pour les barbers indépendants (revenu net et prix conseillé).
export function BarberCalculator() {
  const [price, setPrice] = useState(25);
  const [perWeek, setPerWeek] = useState(30);
  const [weeks, setWeeks] = useState(46);
  const [minutes, setMinutes] = useState(40);
  const [homeShare, setHomeShare] = useState(50);
  const [travelMin, setTravelMin] = useState(20);
  const [travelCost, setTravelCost] = useState(4);
  const [otherCosts, setOtherCosts] = useState(80);
  const [plan, setPlan] = useState('pro');
  const [rate, setRate] = useState(21.2);
  const [target, setTarget] = useState(2500);
  const planId = useId();

  const perMonth = perWeek * weeks / 12;
  const revenue = price * perMonth;
  const social = revenue * rate / 100;
  const homeVisits = perMonth * homeShare / 100;
  const travel = homeVisits * travelCost;
  const subscription = PLANS.find(p => p.id === plan)?.price ?? 0;
  const costs = travel + otherCosts + subscription;
  const net = revenue - social - costs;
  const hours = (perMonth * minutes + homeVisits * travelMin) / 60;
  const perHour = hours > 0 ? net / hours : 0;
  const neededPrice = perMonth > 0 && rate < 100 ? (target + costs) / (perMonth * (1 - rate / 100)) : 0;
  const advised = Math.ceil(neededPrice * 2) / 2;

  return <div className="bl-landing bl2 blade-app">
    <a href="#bl-main" className="blade-skip">Aller au contenu</a>
    <SiteNav />
    <main id="bl-main" className="bl2-main bl-city bl-tool">
      <section className="bl-city-hero">
        <p className="blade-pricing-eyebrow"><Calculator size={14} aria-hidden="true" /> Outil gratuit pour les barbers</p>
        <h1>Combien tu gagnes vraiment, et à quel prix couper ?</h1>
        <p>Renseigne ton activité : le calcul se fait en direct, rien n’est enregistré. Les résultats sont des estimations par mois.</p>
      </section>

      <div className="bl-tool-grid">
        <form className="bl-tool-form" onSubmit={e => e.preventDefault()}>
          <fieldset><legend>Ton activité</legend>
            <Num label="Prix moyen d’une prestation" value={price} onChange={setPrice} suffix="€" step={0.5} />
            <Num label="Prestations par semaine" value={perWeek} onChange={setPerWeek} />
            <Num label="Semaines travaillées par an" value={weeks} onChange={setWeeks} hint="52 moins tes congés." />
            <Num label="Durée moyenne d’une prestation" value={minutes} onChange={setMinutes} suffix="min" step={5} />
          </fieldset>
          <fieldset><legend>À domicile</legend>
            <Num label="Part des prestations à domicile" value={homeShare} onChange={setHomeShare} suffix="%" step={5} />
            <Num label="Temps de trajet moyen par déplacement" value={travelMin} onChange={setTravelMin} suffix="min" step={5} />
            <Num label="Coût moyen d’un déplacement" value={travelCost} onChange={setTravelCost} suffix="€" step={0.5} hint="Carburant, Navigo, parking…" />
          </fieldset>
          <fieldset><legend>Charges</legend>
            <Num label="Autres frais par mois" value={otherCosts} onChange={setOtherCosts} suffix="€" step={5} hint="Matériel, produits, téléphone, assurance…" />
            <div className="bl-tool-field"><label htmlFor={planId}>Abonnement BLADE</label><select id={planId} value={plan} onChange={e => setPlan(e.target.value)}>{PLANS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></div>
            <Num label="Taux de cotisations sociales" value={rate} onChange={setRate} suffix="%" step={0.1} hint="Micro-entreprise, prestation artisanale : vérifie ton taux exact sur autoentrepreneur.urssaf.fr." />
          </fieldset>
        </form>

        <aside className="bl-tool-results" aria-live="polite">
          <h2>Ton mois en un coup d’œil</h2>
          <dl>
            <div><dt>Chiffre d’affaires</dt><dd>{eur(revenue)}</dd></div>
            <div><dt>Cotisations sociales</dt><dd>− {eur(social)}</dd></div>
            <div><dt>Déplacements</dt><dd>− {eur(travel)}</dd></div>
            <div><dt>Autres frais et abonnement</dt><dd>− {eur(otherCosts + subscription)}</dd></div>
            <div className="bl-tool-net"><dt>Revenu net estimé</dt><dd>{eur(net)}</dd></div>
            <div><dt>Par heure travaillée (trajets compris)</dt><dd>{eur2(perHour)}</dd></div>
          </dl>
          <div className="bl-tool-target">
            <h3>Le bon prix pour ton objectif</h3>
            <Num label="Revenu net visé par mois" value={target} onChange={setTarget} suffix="€" step={50} />
            <p>Avec ton rythme actuel, il te faut un prix moyen d’environ <strong>{eur2(advised)}</strong> par prestation.</p>
          </div>
          <p className="bl-tool-note">Estimation indicative, hors impôt sur le revenu et hors versement libératoire. Vérifie aussi le plafond de chiffre d’affaires de la micro-entreprise sur urssaf.fr.</p>
          <Link className="bl3-btn bl3-btn-solid" to="/blade/tarifs">Voir les offres BLADE <ArrowRight size={18} aria-hidden="true" /></Link>
        </aside>
      </div>
    </main>
    <SiteFooter />
  </div>;
}
