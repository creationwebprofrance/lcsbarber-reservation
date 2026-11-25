import { Link, useParams, useSearchParams } from 'react-router-dom';
import { BladeButton, EmptyState } from './common';
import { usePublicPage } from './customization-data';
import { ProviderProfileView } from './brand';

/** Public provider profile, outside account guards so it can be shared. */
export function PublicProviderProfile() {
  const { id } = useParams();
  // ?modele=agenda|vitrine|salon : aperçu d’un modèle de page sans l’enregistrer.
  const [params] = useSearchParams();
  const valid = /^[0-9a-f-]{36}$/i.test(id ?? '');
  const state = usePublicPage(valid ? id! : '00000000-0000-0000-0000-000000000000');
  return <div className="blade-app"><main className="blade-main">
    <BladeButton asChild><Link to="/blade">BLADE</Link></BladeButton>
    {state.loading ? <p role="status">Chargement…</p> : !state.data ? <EmptyState icon="user" title="Profil introuvable" description="Ce professionnel n’existe pas ou n’est plus actif." /> : <ProviderProfileView data={state.data} layout={params.get('modele') ?? undefined} />}
  </main></div>;
}
