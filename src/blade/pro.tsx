import { useEffect, useRef, useState } from 'react';
import { ProfessionalRequests } from './requests';
import { LiveServices, LiveReviews, LiveAvailability, LiveProCard, LiveMyBookings, LiveAdminBookings, LiveClients, LiveDayAgenda, RatingSummary } from './live';
import { Link } from 'react-router-dom';
import { PageHeading, Section, MetricCard, EmptyState, BladeButton, Icon, PeriodFilter, ResponsiveList, Calendar, Tabs, LocalMap, LocalField, LocalForm, KeyValues, DisabledAction, SearchField, Modal, StatePreview, ArrowRight, Plus, Check } from './common';
import { useServices, usePricingRules, fmtPrice } from './data';
import { calculatePricing, getTimeSupplementText } from '@/lib/pricing';

const appointmentFields = [{label:'Client'},{label:'Prestation',options:[]},{label:'Date',kind:'date'},{label:'Horaire',kind:'time'},{label:'Durée (minutes)',kind:'number'},{label:'Lieu',options:['Chez le professionnel','À domicile']},{label:'Notes',kind:'textarea',full:true}];
const serviceFields = [{label:'Nom de la prestation'},{label:'Durée (minutes)',kind:'number'},{label:'Prix (€)',kind:'number'},{label:'Lieu',options:['Chez le professionnel','À domicile','Les deux']},{label:'Modalités',kind:'textarea',full:true},{label:'Contraintes',kind:'textarea',full:true}];
export function Daily() { const date = new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});return <><PageHeading pro title="Votre journée" description={date} action={<BladeButton asChild><Link to="/blade/pro/agenda"><Icon name="calendar"/>Ouvrir l’agenda</Link></BladeButton>}/><div className="blade-metrics"><MetricCard title="Rendez-vous" icon="calendar" unit="rdv" period="Aujourd’hui" definition="Rendez-vous planifiés pour la journée selon leur statut."/><MetricCard title="Recettes prévues" unit="€" period="Aujourd’hui" definition="Prestations planifiées. Frais de déplacement isolés."/><MetricCard title="Encaissé" icon="card" unit="€" period="Aujourd’hui" definition="Encaissements moins remboursements, sans compter deux fois acompte et solde. Frais de paiement séparés."/><MetricCard title="Solde à encaisser" icon="coins" unit="€" period="Aujourd’hui" definition="Montant dû moins les paiements déjà affectés."/></div><Section title="Planning du jour" action={<Link className="blade-text-link" to="/blade/pro/agenda">Agenda <ArrowRight size={16}/></Link>}><LiveAdminBookings days={0} title="Aucun rendez-vous aujourd’hui"/></Section><Section title="Demandes de créneau"><ProfessionalRequests/></Section><Section title="Vos avis"><RatingSummary/><LiveReviews/></Section><Section title="À traiter"><div className="blade-action-grid">{[{label:'Demandes',to:'/blade/pro/agenda',icon:'calendar'},{label:'Acomptes',to:'/blade/pro/paiements',icon:'coins'},{label:'Relances',to:'/blade/pro/relances',icon:'bell'}].map(x=><Link key={x.label} to={x.to}><Icon name={x.icon}/><span>{x.label}</span><strong>—</strong><ArrowRight size={16}/></Link>)}</div></Section><StatePreview/></>; }
export function Agenda() { const [view,setView]=useState('Mois');const [modal,setModal]=useState(false);return <><PageHeading pro title="Agenda" description="Vos disponibilités et rendez-vous" action={<BladeButton variant="default" onClick={()=>setModal(true)}><Plus size={18}/>Ajouter</BladeButton>}/><div className="blade-toolbar"><Tabs options={['Jour','Semaine','Mois']} value={view} onChange={setView}/><PeriodFilter/></div><Calendar pro view={view}/><Section title="Gérer une journée"><LiveDayAgenda/></Section><Section title="Demandes de créneau"><ProfessionalRequests/></Section><Section title="30 prochains jours"><LiveAdminBookings days={30} title="Aucun rendez-vous à venir"/></Section>{modal&&<Modal title="Ajouter à l’agenda" onClose={()=>setModal(false)}><LocalForm fields={appointmentFields}/></Modal>}</>; }
export function Performance() { const [period,setPeriod]=useState('Ce mois');return <><PageHeading pro title="Performance" description="Comprendre votre activité" action={<DisabledAction icon="chart" reason="Aucune donnée à exporter.">Exporter</DisabledAction>}/><div className="blade-toolbar blade-filter-bar"><PeriodFilter onChange={setPeriod}/><LocalField label="Prestation" options={[]}/><LocalField label="Lieu" options={['Tous les lieux','Chez le professionnel','À domicile']}/></div><div className="blade-metrics"><MetricCard title="Recettes réalisées" unit="€" period={period} definition="Recettes des prestations terminées. Frais de déplacement exclus de cet indicateur et présentés séparément."/><MetricCard title="Panier moyen" unit="€/prestation" period={period} definition="Recettes des prestations terminées divisées par le nombre de prestations terminées, hors frais de déplacement."/><MetricCard title="Remplissage" unit="%" period={period} icon="calendar" definition="Minutes réservées divisées par les minutes ouvertes. Fermetures, annulations et absences distinguées."/><MetricCard title="Clients récurrents" unit="%" period={period} icon="users" definition="Clients servis avec une visite terminée antérieure divisés par les clients servis sur la période."/></div><Section title="Évolution des recettes"><div className="blade-chart-empty"><span className="blade-chart-unit">€</span><EmptyState icon="chart" title="Aucune donnée à comparer" description="Les tendances nécessitent des périodes équivalentes renseignées."/></div></Section><div className="blade-two-columns"><Section title="Recettes par heure"><KeyValues labels={['Prestations (€/h)','Prestations avec trajet (€/h)']}/><p className="blade-note">Recettes / temps de prestation ; une vue distincte inclut le trajet.</p></Section><Section title="Recettes par prestation"><ResponsiveList columns={['Prestation','Recettes (€)']} title="Aucune prestation terminée" icon="scissors"/></Section></div><Section title="Suivi de l’activité"><KeyValues labels={['Tendances','Annulations','Absences','Temps de déplacement','Contribution après coûts']}/><p className="blade-note">Contribution : recettes moins coûts saisis et affectés, et non bénéfice net comptable. Aucune comparaison sans données suffisantes.</p></Section></>; }
export function Travel() { return <><PageHeading pro title="Déplacements" description="Votre zone et vos trajets professionnels"/><div className="blade-two-columns"><Section title="Zone d’intervention"><LocalField label="Zone"/><LocalMap/></Section><Section title="Votre tournée"><EmptyState icon="pin" title="Aucun déplacement prévu" description="Aucun trajet ni itinéraire disponible."/><KeyValues labels={['Distance (km)','Temps de trajet','Frais de déplacement (€)','Coûts saisis (€)','Coûts estimés (€)']}/></Section></div><Section title="Affectation des trajets"><LocalField label="Usage" options={['Professionnel','Personnel']}/><ResponsiveList columns={['Date','Usage','Distance','Frais','Coût saisi','Estimation']} title="Aucun trajet enregistré" icon="car"/></Section></>; }
export function Vehicle() {const [modal,setModal]=useState('');return <><PageHeading pro title="Véhicule" description="Votre véhicule et ses coûts" action={<BladeButton onClick={()=>setModal('Fiche véhicule')}><Plus size={18}/>Renseigner</BladeButton>}/><Section title="Fiche véhicule"><div className="blade-two-columns"><EmptyState icon="car" title="Aucun véhicule renseigné"/><KeyValues labels={['Marque','Modèle','Énergie','Kilométrage (km)','Consommation (L ou kWh/100 km)','Coût énergie (€/L ou €/kWh)']}/></div></Section><Section title="Dépenses et estimations"><div className="blade-toolbar"><LocalField label="Usage" options={['Professionnel','Personnel']}/><LocalField label="Nature" options={['Dépenses saisies','Estimations']}/></div><KeyValues labels={['Énergie (€)','Assurance (€)','Entretien (€)','Stationnement (€)','Péages (€)','Dépenses saisies professionnelles (€)','Dépenses saisies personnelles (€)','Coût énergie estimé (€)']}/><details className="blade-explanation"><summary>Estimation des coûts d’énergie</summary><p>Carburant : km × litres/100 km × prix/litre. Électrique : km × kWh/100 km × prix/kWh. Sans consommation ni prix renseignés : —.</p></details></Section><Section title="Historique d’entretien" action={<BladeButton onClick={()=>setModal('Entretien')}><Plus size={18}/>Ajouter</BladeButton>}><ResponsiveList columns={['Date','Type','Kilométrage','Montant','Note']} title="Aucun entretien renseigné" icon="car"/></Section><Section title="Échéances" action={<BladeButton onClick={()=>setModal('Échéance')}><Plus size={18}/>Définir</BladeButton>}><EmptyState icon="calendar" title="Aucune échéance définie" description="Les dates et seuils sont définis par le professionnel, sans barème automatique." compact/></Section>{modal&&<Modal title={modal} onClose={()=>setModal('')}><LocalForm fields={modal==='Fiche véhicule'?[{label:'Marque'},{label:'Modèle'},{label:'Énergie',options:['Essence','Diesel','Hybride','Électrique','Autre']},{label:'Kilométrage (km)',kind:'number'},{label:'Consommation (L ou kWh/100 km)',kind:'number'},{label:'Coût énergie (€/L ou €/kWh)',kind:'number'},{label:'Assurance (€)',kind:'number'},{label:'Entretien (€)',kind:'number'},{label:'Stationnement (€)',kind:'number'},{label:'Péages (€)',kind:'number'}]:modal==='Entretien'?[{label:'Date',kind:'date'},{label:'Type'},{label:'Kilométrage (km)',kind:'number'},{label:'Montant (€)',kind:'number'},{label:'Note',kind:'textarea',full:true}]:[{label:'Type d’entretien'},{label:'Date',kind:'date'},{label:'Seuil kilométrique (km)',kind:'number'}]}/>{modal==='Entretien'&&<DisabledAction icon="car" reason="Aucun transfert de fichier dans cette phase.">Joindre un justificatif</DisabledAction>}</Modal>}</>; }
export function Clients() {const [modal,setModal]=useState(false);return <><PageHeading pro title="Clients" description="Votre relation client" action={<BladeButton onClick={()=>setModal(true)}><Icon name="user"/>Fiche client</BladeButton>}/><div className="blade-toolbar"><LocalField label="Segment" options={['Tous','À revoir','Sans prochaine réservation','Occasionnels','Demandes en attente']}/></div><LiveClients/><div className="blade-center"><BladeButton asChild><Link to="/blade/pro/relances">Préparer une relance <ArrowRight size={16}/></Link></BladeButton></div>{modal&&<Modal title="Fiche client" onClose={()=>setModal(false)}><KeyValues labels={['Identité','Coordonnées','Dernière visite','Prochaine réservation','Fréquence habituelle']}/><LocalForm fields={[{label:'Préférences',kind:'textarea',full:true},{label:'Notes',kind:'textarea',full:true}]}/><Section title="Historique"><EmptyState icon="users" title="Aucune visite" compact/></Section><DisabledAction icon="message" reason="Aucun client sélectionné ni service connecté.">Contacter</DisabledAction></Modal>}</>; }
export function Reminders() {const [tab,setTab]=useState('Préparation');return <><PageHeading pro title="Relances" description="Préparer la prochaine visite"/><Tabs options={['Préparation','Suivi']} value={tab} onChange={setTab}/>{tab==='Préparation'?<div className="blade-two-columns"><Section title="Destinataires"><LocalField label="Segment" options={['Clients à revoir','Sans prochaine réservation','Occasionnels','Demandes en attente']}/><LocalField label="Priorité" options={['À définir','Prioritaire','Non prioritaire']}/><LocalField label="Période du segment" kind="number" hint="Période à définir en jours."/><EmptyState icon="users" title="Aucun destinataire" compact/></Section><Section title="Modèle de message"><LocalField label="Canal" options={['E-mail','Message']}/><LocalField label="Message personnalisable" kind="textarea"/><LocalField label="Fréquence maximale" kind="number" hint="Limite à définir par le professionnel."/><KeyValues labels={['Préférences de contact','Consentement','Contrôle des destinataires','Prévention des doublons']}/><DisabledAction icon="message" reason="Aucun destinataire ni service d’envoi connecté.">Envoyer</DisabledAction></Section></div>:<Section title="Suivi des relances"><LocalField label="État" options={['Préparée','Prête','Envoyée','Réponse','Nouvelle réservation']}/><ResponsiveList columns={['Destinataire','État','Réponse','Nouvelle réservation']} title="Aucune relance" icon="bell"/><KeyValues labels={['Retour après relance']}/><p className="blade-note">Une réservation observée après relance ne prouve pas une causalité. La fenêtre de suivi reste à définir.</p></Section>}</>; }
export function Services() {const [modal,setModal]=useState(false);return <><PageHeading pro title="Prestations" description="Votre catalogue de prestations" action={<BladeButton variant="default" onClick={()=>setModal(true)}><Plus size={18}/>Ajouter une prestation</BladeButton>}/><LiveServices/>{modal&&<Modal title="Nouvelle prestation" onClose={()=>setModal(false)}><LocalForm fields={serviceFields}/></Modal>}</>; }
export function Revenue() {const [period,setPeriod]=useState('Ce mois');return <><PageHeading pro title="Revenus" description="Recettes, encaissements et frais" action={<DisabledAction icon="coins" reason="Aucune donnée à exporter.">Exporter</DisabledAction>}/><PeriodFilter onChange={setPeriod}/><div className="blade-metrics blade-metrics-five">{[{title:'Réalisé',definition:'Prestations terminées, frais de déplacement isolés.'},{title:'Encaissé',definition:'Encaissements moins remboursements ; acompte et solde non comptés deux fois.'},{title:'Remboursements',definition:'Montants effectivement remboursés sur la période.'},{title:'Frais',definition:'Frais de paiement et autres coûts affectés, présentés séparément.'},{title:'Solde dû',definition:'Montants dus moins paiements affectés.'}].map(m=><MetricCard key={m.title} {...m} unit="€" period={period}/>)}</div><Section title="Détail des revenus"><ResponsiveList columns={['Date','Prestation','Réalisé','Encaissé','Frais','Solde']} title="Aucun revenu à afficher" icon="coins"/></Section><Section title="Après coûts"><KeyValues labels={['Frais de déplacement (€)','Coûts saisis et affectés (€)','Contribution après coûts (€)']}/><p className="blade-note">La contribution après coûts n’est pas un bénéfice net comptable.</p></Section></>; }
export function Payments() {const [mode,setMode]=useState('Montant fixe');return <><PageHeading pro title="Paiements et acomptes" description="Les modalités de paiement de votre activité"/><section className="blade-connection"><div className="blade-connection-icon"><Icon name="card" size={24}/></div><div><h2>Stripe</h2><p>Non configuré</p></div><DisabledAction reason="Connexion Stripe indisponible dans cette phase.">Activer avec Stripe</DisabledAction></section><Section title="Acompte optionnel"><Tabs options={['Montant fixe','Pourcentage']} value={mode} onChange={setMode}/><LocalForm fields={[{label:mode==='Montant fixe'?'Montant (€)':'Pourcentage (%)',kind:'number'},{label:'Minimum (€)',kind:'number'},{label:'Maximum (€)',kind:'number'}]}/><p className="blade-note">Un seul mode d’acompte à la fois. Aucun seuil prédéfini.</p></Section><div className="blade-two-columns"><Section title="Conditions"><LocalForm fields={[{label:'Conditions de paiement',kind:'textarea',full:true},{label:'Politique d’annulation',kind:'textarea',full:true},{label:'Politique de remboursement',kind:'textarea',full:true}]}/></Section><Section title="Droits de gestion"><KeyValues labels={['Compte du professionnel','Statut de paiement','Droits de remboursement','Droits de modification']}/><p className="blade-note">Activation conditionnée à un statut de paiement valide lors d’une future connexion.</p></Section></div><Section title="Journal des actions"><ResponsiveList columns={['Date','Action','Compte','État']} title="Aucune action de paiement" icon="card"/></Section></>; }
export function ProProfile() {return <><PageHeading pro title="Profil et réglages" description="Votre identité professionnelle"/><Section title="Identité et activité"><LocalForm fields={[{label:'Prénom'},{label:'Nom'},{label:'Nom de l’activité'},{label:'E-mail',kind:'email'},{label:'Téléphone',kind:'tel'},{label:'Présentation',kind:'textarea',full:true}]}/></Section><Section title="Photos"><EmptyState icon="scissors" title="Aucune photo" compact/><DisabledAction icon="scissors" reason="Aucun transfert de fichier dans cette phase.">Ajouter une photo</DisabledAction></Section><div className="blade-two-columns"><Section title="Disponibilités"><LocalForm fields={[{label:'Jour',options:['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche']},{label:'Lieu',options:['À domicile','Chez le professionnel','Les deux']},{label:'Début',kind:'time'},{label:'Fin',kind:'time'}]}/><Link className="blade-text-link" to="/blade/pro/agenda">Ouvrir l’agenda <ArrowRight size={16}/></Link></Section><Section title="Zone d’intervention"><LocalForm fields={[{label:'Zone'},{label:'Adresse'},{label:'Conditions de déplacement',kind:'textarea',full:true}]}/></Section></div><Section title="Notifications et préférences"><LocalForm fields={[{label:'Canal préféré',options:['E-mail','Message']},{label:'Préférences',kind:'textarea',full:true}]}><label className="blade-checkbox"><input type="checkbox"/>Notifications de rendez-vous</label><label className="blade-checkbox"><input type="checkbox"/>Notifications de paiement</label><label className="blade-checkbox"><input type="checkbox"/>Rappels et relances</label></LocalForm></Section></>; }

type CatalogPhoto = { id: string; url: string; name: string; title: string; serviceId: string; description: string; visibility: string; cover: boolean };
const catalogFormats = ['image/jpeg', 'image/png', 'image/webp'];
export function Catalogue() {
  const { data: services } = useServices();
  const [photos, setPhotos] = useState<CatalogPhoto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<string[]>([]);
  useEffect(() => () => { urlsRef.current.forEach(u => URL.revokeObjectURL(u)); }, []);
  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const rejected: string[] = [];
    const added: CatalogPhoto[] = [];
    for (const file of Array.from(list)) {
      if (!catalogFormats.includes(file.type)) { rejected.push(file.name); continue; }
      const url = URL.createObjectURL(file);
      urlsRef.current.push(url);
      added.push({ id: crypto.randomUUID(), url, name: file.name, title: '', serviceId: '', description: '', visibility: 'Brouillon', cover: false });
    }
    if (added.length) { setPhotos(p => [...p, ...added]); setSelectedId(added[0].id); }
    setError(rejected.length ? `Format non accepté : ${rejected.join(', ')}. Formats acceptés : JPEG, PNG et WebP.` : '');
  };
  const selected = photos.find(p => p.id === selectedId) ?? null;
  const update = (id: string, patch: Partial<CatalogPhoto>) => setPhotos(p => p.map(x => x.id === id ? { ...x, ...patch } : x));
  const removePhoto = (id: string) => { const target = photos.find(p => p.id === id); if (target) URL.revokeObjectURL(target.url); setPhotos(p => p.filter(x => x.id !== id)); if (selectedId === id) setSelectedId(null); };
  const move = (id: string, dir: -1 | 1) => setPhotos(p => { const i = p.findIndex(x => x.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= p.length) return p; const next = [...p]; [next[i], next[j]] = [next[j], next[i]]; return next; });
  const setCover = (id: string) => setPhotos(p => p.map(x => ({ ...x, cover: x.id === id })));
  const visible = filter ? photos.filter(p => p.serviceId === filter) : photos;
  return <>
    <PageHeading pro title="Catalogue" description="Présentez vos réalisations à vos futurs clients." action={<BladeButton variant="default" onClick={() => inputRef.current?.click()}><Plus size={18}/>Ajouter des photos</BladeButton>} />
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
    <p className="blade-note">Les photos restent dans cette session de navigation : un rechargement de la page les efface. Aucun téléversement vers un serveur dans cette phase.</p>
    {error && <p className="blade-form-error" role="alert">{error}</p>}
    <div className={`blade-dropzone${dragging ? ' dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}>
      {photos.length === 0
        ? <EmptyState icon="image" title="Ajoutez vos premières réalisations" description="Glissez vos photos ici ou sélectionnez des fichiers. Formats acceptés : JPEG, PNG et WebP." action={<BladeButton variant="default" onClick={() => inputRef.current?.click()}>Choisir des photos</BladeButton>} />
        : visible.length === 0
          ? <EmptyState icon="image" title="Aucune photo pour cette prestation" compact />
          : <div className="blade-catalog-grid">{visible.map(p => <figure key={p.id} className={`blade-catalog-item${selectedId === p.id ? ' selected' : ''}`}><button type="button" onClick={() => setSelectedId(p.id)} aria-label={`Sélectionner ${p.title || p.name}`}><img src={p.url} alt={p.title || p.name} />{p.cover && <span className="blade-cover-badge">Couverture</span>}</button><figcaption>{p.title || p.name}</figcaption></figure>)}</div>}
    </div>
    {photos.length > 0 && <div className="blade-toolbar"><div className="blade-field"><label htmlFor="blade-catalog-filter">Filtrer par prestation</label><select id="blade-catalog-filter" value={filter} onChange={e => setFilter(e.target.value)}><option value="">Toutes les prestations</option>{(services ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div></div>}
    {selected && <Section title="Détails de la photo">
      <div className="blade-catalog-details">
        <img src={selected.url} alt="" className="blade-catalog-preview" />
        <div className="blade-fields">
          <div className="blade-field"><label htmlFor="blade-photo-title">Titre</label><input id="blade-photo-title" value={selected.title} placeholder="Nom de la réalisation" onChange={e => update(selected.id, { title: e.target.value })} /></div>
          <div className="blade-field"><label htmlFor="blade-photo-service">Prestation associée</label><select id="blade-photo-service" value={selected.serviceId} onChange={e => update(selected.id, { serviceId: e.target.value })}><option value="">Sélectionner une prestation</option>{(services ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>{!services?.length && <small>Aucune prestation disponible.</small>}</div>
          <div className="blade-field blade-field-full"><label htmlFor="blade-photo-desc">Description</label><textarea id="blade-photo-desc" value={selected.description} placeholder="Ajoutez une description (optionnel)." onChange={e => update(selected.id, { description: e.target.value })} /></div>
          <div className="blade-field"><label htmlFor="blade-photo-visibility">Visibilité</label><select id="blade-photo-visibility" value={selected.visibility} onChange={e => update(selected.id, { visibility: e.target.value })}><option>Brouillon</option><option>Visible sur le profil public</option></select><small>Simulée localement dans cette phase.</small></div>
        </div>
      </div>
      <div className="blade-inline">
        <BladeButton onClick={() => setCover(selected.id)} disabled={selected.cover}><Check size={16}/>Choisir comme couverture</BladeButton>
        <BladeButton onClick={() => move(selected.id, -1)} disabled={photos.indexOf(selected) === 0}>Monter</BladeButton>
        <BladeButton onClick={() => move(selected.id, 1)} disabled={photos.indexOf(selected) === photos.length - 1}>Descendre</BladeButton>
        <BladeButton onClick={() => removePhoto(selected.id)}>Retirer</BladeButton>
      </div>
      <p className="blade-note">Associez chaque photo à une prestation pour enrichir votre profil public. Publiez uniquement les photos autorisées par vos clients.</p>
    </Section>}
  </>;
}

export function Simulation() {
  const { data: services } = useServices();
  const { data: rules } = usePricingRules();
  const [serviceId, setServiceId] = useState('');
  const [mode, setMode] = useState('Chez le professionnel');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [address, setAddress] = useState('');
  const [minutes, setMinutes] = useState('');
  const [modal, setModal] = useState(false);
  const service = services?.find(s => s.id === serviceId) ?? null;
  const travelMinutes = Number(minutes);
  const travelValid = minutes.trim() !== '' && Number.isFinite(travelMinutes) && travelMinutes >= 0;
  const travelFees = mode === 'Chez le client' && rules && travelValid
    ? travelMinutes <= rules.travel_free_minutes ? 0 : Math.ceil((travelMinutes - rules.travel_free_minutes) / rules.travel_interval_minutes) * rules.travel_fee_per_interval
    : 0;
  const missing: string[] = [];
  if (!service) missing.push('la prestation');
  if (!date) missing.push('la date');
  if (!time) missing.push('l’heure');
  if (mode === 'Chez le client' && !travelValid) missing.push('le temps de trajet');
  const hourlySettings = rules ? { earlyHourThreshold: rules.early_hour_threshold, earlyHourFee: rules.early_hour_fee, lateHourThreshold: rules.late_hour_threshold, lateHourFee: rules.late_hour_fee, sameDayFee: rules.same_day_fee, sundayFee: rules.sunday_fee } : undefined;
  const result = service && rules && missing.length === 0
    ? calculatePricing(service.price, time, travelFees, hourlySettings, new Date(`${date}T12:00:00`))
    : null;
  const timeMotif = time && hourlySettings ? getTimeSupplementText(time, hourlySettings) : null;
  const reset = () => { setServiceId(''); setMode('Chez le professionnel'); setDate(''); setTime(''); setAddress(''); setMinutes(''); };
  return <>
    <PageHeading pro title="Simulation" description="Estimez le prix d’un rendez-vous selon vos règles tarifaires." action={<BladeButton onClick={reset}>Remettre à zéro</BladeButton>} />
    <div className="blade-two-columns">
      <Section title="Le rendez-vous">
        <div className="blade-fields">
          <div className="blade-field blade-field-full"><label htmlFor="blade-sim-service">Prestation</label><select id="blade-sim-service" value={serviceId} onChange={e => setServiceId(e.target.value)}><option value="">Sélectionner une prestation</option>{(services ?? []).map(s => <option key={s.id} value={s.id}>{s.name} — {fmtPrice(s.price)}</option>)}</select></div>
          <div className="blade-field blade-field-full"><label htmlFor="blade-sim-mode">Mode</label><select id="blade-sim-mode" value={mode} onChange={e => setMode(e.target.value)}><option>Chez le professionnel</option><option>Chez le client</option></select></div>
          <div className="blade-field"><label htmlFor="blade-sim-date">Date du rendez-vous</label><input id="blade-sim-date" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="blade-field"><label htmlFor="blade-sim-time">Heure du rendez-vous</label><input id="blade-sim-time" type="time" value={time} onChange={e => setTime(e.target.value)} /></div>
          {mode === 'Chez le client' && <>
            <div className="blade-field blade-field-full"><label htmlFor="blade-sim-address">Adresse du client</label><input id="blade-sim-address" value={address} onChange={e => setAddress(e.target.value)} /></div>
            <div className="blade-field blade-field-full"><label htmlFor="blade-sim-minutes">Temps de trajet aller (minutes)</label><input id="blade-sim-minutes" type="number" min="0" value={minutes} onChange={e => setMinutes(e.target.value)} /><small>Aucun calcul d’itinéraire connecté : renseignez la durée vous-même.</small></div>
          </>}
        </div>
      </Section>
      <Section title="Estimation">
        {!result ? <EmptyState icon="calculator" title="Estimation incomplète" description={missing.length ? `Renseignez ${missing.join(', ')}.` : 'Renseignez les champs du rendez-vous.'} compact /> : <>
          <div className="blade-price-breakdown">
            <div className="blade-price-row"><div>Prix de base<small>{service!.name}</small></div><strong>{fmtPrice(result.basePrice)}</strong></div>
            {result.hasTimeSupplement && <div className="blade-price-row"><div>Supplément horaire<small>{timeMotif ?? 'Horaire décalé'}</small></div><strong>+{fmtPrice(result.supplement)}</strong></div>}
            {result.hasSameDayFee && <div className="blade-price-row"><div>Supplément jour même<small>Réservation le jour même</small></div><strong>+{fmtPrice(result.sameDayFee)}</strong></div>}
            {result.hasSundayFee && <div className="blade-price-row"><div>Supplément dimanche<small>Prestation un dimanche</small></div><strong>+{fmtPrice(result.sundayFee)}</strong></div>}
            {mode === 'Chez le client' && <div className="blade-price-row"><div>Frais de déplacement<small>{travelMinutes} min de trajet{rules ? `, ${rules.travel_free_minutes} min incluses` : ''}</small></div><strong>{result.hasTravelFees ? `+${fmtPrice(result.travelFees)}` : 'Inclus'}</strong></div>}
            <div className="blade-price-total"><span>Total estimé</span><strong>{fmtPrice(result.totalPrice)}</strong></div>
          </div>
          <div className="blade-inline"><BladeButton variant="default" onClick={() => setModal(true)}>Préparer un rendez-vous</BladeButton></div>
        </>}
      </Section>
    </div>
    {modal && result && service && <Modal title="Préparer un rendez-vous" onClose={() => setModal(false)}>
      <div className="blade-fields">
        <div className="blade-field"><label htmlFor="blade-prep-service">Prestation</label><input id="blade-prep-service" value={service.name} readOnly /></div>
        <div className="blade-field"><label htmlFor="blade-prep-mode">Mode</label><input id="blade-prep-mode" value={mode} readOnly /></div>
        <div className="blade-field"><label htmlFor="blade-prep-date">Date</label><input id="blade-prep-date" value={date} readOnly /></div>
        <div className="blade-field"><label htmlFor="blade-prep-time">Heure</label><input id="blade-prep-time" value={time} readOnly /></div>
        {mode === 'Chez le client' && <div className="blade-field blade-field-full"><label htmlFor="blade-prep-address">Adresse du client</label><input id="blade-prep-address" value={address} readOnly /></div>}
        <div className="blade-field"><label htmlFor="blade-prep-total">Total estimé</label><input id="blade-prep-total" value={fmtPrice(result.totalPrice)} readOnly /></div>
      </div>
      <DisabledAction icon="calendar" reason="Aucune réservation ni paiement n’est créé dans cette phase.">Créer la réservation</DisabledAction>
    </Modal>}
  </>;
}

export function Settings() {
  return <>
    <PageHeading pro title="Paramètres" description="Les réglages de votre espace professionnel" />
    <Section title="Notifications"><LocalForm fields={[{ label: 'Canal préféré', options: ['E-mail', 'Message'] }]}><label className="blade-checkbox"><input type="checkbox" />Notifications de rendez-vous</label><label className="blade-checkbox"><input type="checkbox" />Notifications de paiement</label><label className="blade-checkbox"><input type="checkbox" />Rappels et relances</label></LocalForm></Section>
    <Section title="Compte"><p className="blade-note">Votre identité, vos disponibilités et votre zone d’intervention se gèrent depuis votre profil.</p><BladeButton asChild><Link to="/blade/pro/profil"><Icon name="user" />Ouvrir mon profil</Link></BladeButton></Section>
  </>;
}
