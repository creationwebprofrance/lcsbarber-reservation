# Base de données et fonctions serveur sans crédits Lovable

Ces scripts parlent directement à l'API Supabase du projet (l'exécutable `supabase` est bloqué
par la protection Windows sur ce PC). Ils lisent la clé personnelle dans la variable
d'environnement `SUPABASE_ACCESS_TOKEN` : elle n'est jamais écrite dans le code.

## Changer la base de données

1. Écrire la migration dans `supabase/migrations/AAAAMMJJHHMMSS_description.sql`.
2. L'appliquer :

   ```bash
   npm run db:sql -- supabase/migrations/AAAAMMJJHHMMSS_description.sql
   ```

   La migration est aussi enregistrée dans l'historique Supabase ; la relancer ne fait rien.

Requête ponctuelle (lecture) : `npm run db:sql -- --query "select count(*) from blade_trips"`

## Déployer une fonction serveur

```bash
npm run fn:deploy -- blade-trip
```

Envoie `supabase/functions/<nom>/` et `supabase/functions/_shared/`, avec le réglage
`verify_jwt` de `supabase/config.toml`.

Après une migration, régénérer les types du navigateur si besoin
(`src/integrations/supabase/types.ts`).

## Clé d'accès

Créée sur https://supabase.com/dashboard/account/tokens, rangée avec :

```powershell
[Environment]::SetEnvironmentVariable('SUPABASE_ACCESS_TOKEN', '<clé>', 'User')
```

Pour la révoquer : supprimer la clé sur la même page Supabase.
