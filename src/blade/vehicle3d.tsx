import { useEffect, useRef, useState } from 'react';
import { carImagesQuery } from '@/lib/vehicle-normalize';
import { EmptyState, BladeButton, Icon } from './common';

/** Clé publique CarImages, identique à celle utilisée par LCSBARBER :
 *  prévue par le fournisseur pour être posée dans la page. */
const CARIMAGES_PUBLIC_KEY = 'ci_e25b639e546150fc36255c516969e58d6717a91dc749c41ef40f4794';
const LOADER_SRC = 'https://carimagesapi.com/assets/js/carimages.js';

type State = 'idle' | 'loading' | 'ready' | 'failed';

/** Visuel 3D du véhicule via l'API CarImages déjà connectée, au style BLADE. */
export function BladeVehicle3D({ make, model, year }: { make?: string | null; model?: string | null; year?: number | string | null }) {
  const [state, setState] = useState<State>('idle');
  const [attempt, setAttempt] = useState(0);
  const timer = useRef<number | null>(null);
  const query = carImagesQuery(make, model, year);

  useEffect(() => {
    if (!query) return;
    setState('loading');
    let cancelled = false;
    let script = document.querySelector<HTMLScriptElement>('script[data-carimages]');

    const done = (ok: boolean) => { if (!cancelled) setState(ok ? 'ready' : 'failed'); };

    if (script?.dataset.loaded === 'true') {
      done(true);
    } else {
      if (!script) {
        script = document.createElement('script');
        script.src = LOADER_SRC;
        script.async = true;
        script.dataset.carimages = 'true';
        script.setAttribute('data-api-key', CARIMAGES_PUBLIC_KEY);
        document.head.appendChild(script);
      }
      const onLoad = () => { script!.dataset.loaded = 'true'; done(true); };
      const onError = () => done(false);
      script.addEventListener('load', onLoad);
      script.addEventListener('error', onError);
      timer.current = window.setTimeout(() => done(false), 12000);
      return () => {
        cancelled = true;
        if (timer.current) window.clearTimeout(timer.current);
        script?.removeEventListener('load', onLoad);
        script?.removeEventListener('error', onError);
      };
    }
    return () => { cancelled = true; };
  }, [query?.make, query?.model, query?.year, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!query) {
    return <EmptyState compact icon="car" title="Visuel 3D indisponible" description="Renseignez la marque, le modèle et l’année du véhicule pour afficher le visuel." />;
  }
  if (state === 'failed') {
    return <EmptyState compact icon="car" title="Aucun visuel 3D trouvé" description="Le catalogue ne propose pas de visuel pour ce véhicule." action={<BladeButton onClick={() => setAttempt(a => a + 1)}><Icon name="car" />Réessayer</BladeButton>} />;
  }

  return (
    <div className="blade-vehicle-3d">
      {state === 'ready' ? (
        // @ts-expect-error élément personnalisé fourni par le chargeur CarImages
        <model-viewer
          key={`${query.make}-${query.model}-${query.year}-${attempt}`}
          data-ci-make={query.make}
          data-ci-model={query.model}
          data-ci-year={query.year}
          data-ci-type="car"
          camera-controls
          auto-rotate
          onError={() => setState('failed')}
          style={{ width: '100%', height: '320px', background: 'transparent' }}
        />
      ) : (
        <p role="status" className="blade-vehicle-3d-loading">Chargement du visuel…</p>
      )}
      <p className="blade-note">Visuel indicatif, non contractuel · {query.make} {query.model} {query.year}</p>
    </div>
  );
}
