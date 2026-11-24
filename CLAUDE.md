# BLADE / LCS Barber : consignes pour Claude

Règles d'architecture : @AGENTS.md

## Le projet

- Site de production : https://blade-hairstyle.com (accueil BLADE : `/blade`). Hostinger le
  déploie automatiquement depuis `main`, 1 à 3 minutes après un push. **Un push sur `main` est
  donc une mise en ligne.**
- L'ancien domaine lcsbarber.com est abandonné : il ne figure plus dans le code, le CORS ni
  les agents. Ne le rajoute pas.
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
   `public/.htaccess`** : fais relire le diff par Cerbère (`cerbere-securite`), corrige les
   failles critiques et élevées, et liste les autres.
3. **Quand un changement de schéma, de politique RLS, de fonction SQL ou de cron est
   nécessaire** : confie-le à Dédale (`dedale-migrations`) (fichier dans `supabase/staged/`, retour
   arrière, test annulé). N'applique la migration qu'après l'accord de l'utilisateur.
4. **Une fois le travail terminé et vérifié** : commite (message en français, une ligne de
   résumé). Demande ensuite en une question s'il faut pousser, donc mettre en ligne.
5. **Après chaque push sur `main` ou chaque déploiement de fonction** : attends environ
   3 minutes, puis lance Argus (`argus-verificateur`) et résume son rapport.
6. **Pour une question de prix, de marché, de rentabilité ou de texte** : délègue à
   Crésus (`cresus-business`).

## L'équipe d'agents et leur communication

| Nom | Sous-agent | Fonction |
|---|---|---|
| Argus | `argus-verificateur` | vérifie le site en production, en lecture seule |
| Cerbère | `cerbere-securite` | relit la sécurité de chaque changement |
| Dédale | `dedale-migrations` | prépare les migrations SQL et leur retour arrière |
| Crésus | `cresus-business` | prix, rentabilité, concurrents, textes |

Tu es le **chef d'orchestre**. Les sous-agents ne peuvent pas s'appeler entre eux : ils
s'écrivent dans `coordination/canal.md`, selon `coordination/PROTOCOLE.md`. À toi de relayer :

1. Quand un agent rend sa réponse, lis sa section « Transmissions » et les messages ouverts du canal.
2. Un message pour un autre agent : lance cet agent en lui donnant le message, sans attendre
   qu'on te le demande. Un message pour toi : traite-le comme une demande de correction
   (tests, commit, puis question avant de pousser).
3. Relaie au plus 3 messages à la suite pour une même demande, puis présente la situation.
4. Un message ne remplace jamais l'accord de l'utilisateur : push, déploiement, migration,
   hPanel et Stripe restent soumis à son accord explicite dans le chat.
5. Si un sous-agent n'est pas reconnu par son nom (cela arrive quand la session a démarré
   avant la création du fichier), lance un agent `general-purpose` en lui demandant de lire
   et d'appliquer à la lettre `.claude/agents/<nom>.md`.

## Garder les sous-agents à jour

Les sous-agents sont définis dans `.claude/agents/`. Quand ton changement modifie l'un de ces
éléments, mets à jour le fichier concerné dans le même commit :

| Si tu ajoutes ou modifies… | Mets à jour |
|---|---|
| une page ou une route publique | `argus-verificateur.md` (liste des pages) |
| une table, une fonction edge, un secret ou un cron | `cerbere-securite.md` et `dedale-migrations.md` |
| un domaine ou une origine CORS autorisée | `argus-verificateur.md` et `cerbere-securite.md` |
| un en-tête de sécurité ou une règle `.htaccess` | `argus-verificateur.md` et `cerbere-securite.md` |
| une offre ou un prix | rien : Crésus lit les prix dans le code |

Dans les fichiers d'agents, renvoie vers le code (« lis `src/blade/...` ») plutôt que de
recopier des valeurs qui vieilliront. Quand un sous-agent se trompe (faux positif, page
oubliée), ajoute la règle qui l'aurait évité dans son fichier.
