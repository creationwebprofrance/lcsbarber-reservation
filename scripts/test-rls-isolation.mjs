// Test d'isolation RLS en production, sans rien enregistrer.
// Tout tourne dans un seul bloc DO qui se termine TOUJOURS par RAISE EXCEPTION :
// Postgres annule alors toute la transaction (faux compte, politiques, écritures).
// Les résultats remontent dans le message de l'exception.
import { readFileSync } from 'node:fs';
// Usage : node scripts/test-rls-isolation.mjs   (depuis la racine du dépôt)
const repo = (process.argv[2] ?? process.cwd()).replace(/\\/g, '/');
const { runSql } = await import(`file:///${repo}/scripts/supabase-api.mjs`);

const policies = readFileSync(`${repo}/supabase/staged/p0/02_rls_provider_isolation.sql`, 'utf8')
  .split('\n').filter(l => !/^\s*(--|BEGIN;|COMMIT;)/.test(l) && l.trim()).join('\n');
if (policies.includes('$p$')) throw new Error('quote');

const sql = `
DO $t$
DECLARE
  r text := '';
  lcs uuid; lcs_provider uuid;
  x uuid := gen_random_uuid(); px uuid := gen_random_uuid();
  tbls text[] := array['bookings','clients','services','prestations','pricing_settings','email_templates','client_merges'];
  t text; n int; who uuid; label text; phase int;
BEGIN
  SELECT user_id, id INTO lcs, lcs_provider FROM public.blade_providers LIMIT 1;
  r := r || 'total(service_role):';
  FOREACH t IN ARRAY tbls LOOP EXECUTE format('select count(*) from public.%I', t) INTO n; r := r || ' ' || t || '=' || n; END LOOP;

  -- Faux prestataire X : admin (comme le serait un 2e prestataire) avec son propre espace actif.
  INSERT INTO auth.users(id, instance_id, aud, role, email) VALUES (x, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-test-' || x || '@example.invalid');
  INSERT INTO public.user_roles(user_id, role) VALUES (x, 'admin');
  INSERT INTO public.blade_providers(id, user_id, status) VALUES (px, x, 'active');

  FOR phase IN 1..2 LOOP
    IF phase = 2 THEN
      EXECUTE $p$${policies}$p$;
      r := r || E'\\n--- APRES politiques 02';
    ELSE
      r := r || E'\\n--- AVANT (politiques actuelles)';
    END IF;
    FOREACH who IN ARRAY array[lcs, x] LOOP
      label := CASE WHEN who = lcs THEN 'LCS' ELSE 'X(autre admin)' END;
      PERFORM set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
      EXECUTE 'set local role authenticated';
      r := r || E'\\n' || label || ' voit:';
      FOREACH t IN ARRAY tbls LOOP EXECUTE format('select count(*) from public.%I', t) INTO n; r := r || ' ' || t || '=' || n; END LOOP;
      IF who = x THEN
        UPDATE public.bookings SET notes = notes WHERE provider_id = lcs_provider; GET DIAGNOSTICS n = ROW_COUNT;
        r := r || ' | X modifie resas LCS=' || n;
        BEGIN
          INSERT INTO public.pricing_settings(provider_id, setting_key, setting_value) VALUES (lcs_provider, 'rls_test', 0);
          r := r || ' | X ecrit tarif LCS=OUI';
        EXCEPTION WHEN others THEN r := r || ' | X ecrit tarif LCS=refuse(' || left(SQLERRM, 40) || ')';
        END;
      END IF;
      EXECUTE 'reset role';
    END LOOP;
  END LOOP;
  RAISE EXCEPTION 'RESULTATS_RLS%', E'\\n' || r;
END
$t$;`;

try { await runSql(sql); console.log('ATTENTION : aucune exception, la transaction n’a pas été annulée'); }
catch (e) {
  const m = String(e.message);
  const i = m.indexOf('RESULTATS_RLS');
  console.log(i >= 0 ? m.slice(i + 13).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/"}$/, '') : 'ERREUR : ' + m.slice(0, 600));
}
