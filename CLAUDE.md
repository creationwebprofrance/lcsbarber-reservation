# BLADE / LCS Barber : consignes pour Claude

Règles d'architecture : @AGENTS.md

## Le projet

- Site de production : https://blade-hairstyle.com (accueil BLADE : `/blade`). Hostinger le
  déploie automatiquement depuis `main`, 1 à 3 minutes après un push. **Un push sur `main` est
  donc une mise en ligne.**
- lcsbarber.com redirige en 301 vers blade-hairstyle.com (redirections hPanel ; la racine
  va vers `/blade`).
- Supabase : projet `qgtbedvpxpadpqxrkzzx`, partagé avec LCS Barber et ses vrais clients.
- Commandes :
  - tests : `npx -y bun@1.2.21 test src/blade`
  - types : `npx tsc --noEmit -p tsconfig.app.json`
  - build : `npx vite build`
  - syntaxe d'une fonction edge : `npx -y esbuild@0.24.0 --loader:.ts=ts <fichier>`
  - SQL (lecture) : `env -u SUPABASE_ACCESS_TOKEN node scripts/supabase-sql.mjs --query "..."`
  - déploiement des fonctions : `env -u SUPABASE_ACCESS_TOKEN node scripts/supabase-deploy.mjs <noms>`
- Le jeton Supabase se trouve dans la variable d'environnement Windows `SUPABASE_ACCESS_TOKEN`.
  Ne le demande jamais dans le chat et ne l'affiche jamais. Préfixe les scripts par
  `env -u SUPABASE_ACCESS_TOKEN` pour qu'ils relisent la valeur à jour.

## Règles absolues

- Ne modifie pas les données de production. Ne supprime aucun fichier ni aucune donnée.
- Demande l'accord explicite de l'utilisateur, pour chaque opération, avant de :
  pousser sur `main`, déployer une fonction, appliquer une migration, toucher à hPanel,
  à Stripe ou à la configuration d'authentification Supabase.
- N'active aucune API payante et ne crée aucun abonnement sans accord et sans annoncer le coût.
- Ne touche pas aux webhooks Stripe. Ne publie aucune clé. Ne lance aucun test intrusif
  contre la production.
- Ne modifie pas le design BLADE sans autorisation.
- Protège les données personnelles : aucun e-mail ni téléphone dans une URL, les journaux
  ou un service externe.

## Automatique : ce que tu fais sans attendre qu'on te le demande

Enchaîne ces étapes toi-même, puis présente le résultat d'ensemble. Seules les actions de la
liste « accord explicite » ci-dessus attendent une réponse.

1. **Après toute modification de code** : lance les tests, la vérification des types et le
   build. Corrige ce qui casse avant de rendre la main.
2. **Après une modification de `supabase/`, de l'authentification, du paiement ou de
   `public/.htaccess`** : fais relire le diff par le sous-agent `revue-securite`, corrige les
   failles critiques et élevées, et liste les autres.
3. **Quand un changement de schéma, de politique RLS, de fonction SQL ou de cron est
   nécessaire** : confie-le au sous-agent `migrations` (fichier dans `supabase/staged/`, retour
   arrière, test annulé). N'applique la migration qu'après l'accord de l'utilisateur.
4. **Une fois le travail terminé et vérifié** : commite (message en français, une ligne de
   résumé). Demande ensuite en une question s'il faut pousser, donc mettre en ligne.
5. **Après chaque push sur `main` ou chaque déploiement de fonction** : attends environ
   3 minutes, puis lance le sous-agent `verificateur` et résume son rapport.
6. **Pour une question de prix, de marché, de rentabilité ou de texte** : délègue au
   sous-agent `business`.

## Garder les sous-agents à jour

Les sous-agents sont définis dans `.claude/agents/`. Quand ton changement modifie l'un de ces
éléments, mets à jour le fichier concerné dans le même commit :

| Si tu ajoutes ou modifies… | Mets à jour |
|---|---|
| une page ou une route publique | `verificateur.md` (liste des pages) |
| une table, une fonction edge, un secret ou un cron | `revue-securite.md` et `migrations.md` |
| un domaine ou une origine CORS autorisée | `verificateur.md` et `revue-securite.md` |
| un en-tête de sécurité ou une règle `.htaccess` | `verificateur.md` et `revue-securite.md` |
| une offre ou un prix | rien : `business` lit les prix dans le code |

Dans les fichiers d'agents, renvoie vers le code (« lis `src/blade/...` ») plutôt que de
recopier des valeurs qui vieilliront. Quand un sous-agent se trompe (faux positif, page
oubliée), ajoute la règle qui l'aurait évité dans son fichier.
