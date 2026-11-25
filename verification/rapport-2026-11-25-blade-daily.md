# Contrôle du premier appel de blade-daily avec x-cron-secret — 2026-11-25

Contrôle automatique (tâche planifiée), fait par Argus en lecture SQL uniquement
(`scripts/supabase-sql.mjs --query`), à 10:14 UTC. Aucun appel HTTP à la fonction, aucune
modification. Aucun secret ni JWT lu ou affiché (`decrypted_secret` non sélectionné, valeurs masquées).

## Verdict : NON CONFIRMÉ (ni OK, ni 401, ni 503)

Les deux réponses HTTP enregistrées à 07:00 UTC sont des **expirations de pg_net à 5 000 ms**,
sans code HTTP ni corps. On ne peut donc pas lire le `{"reminders":…,"inactivity":…}` attendu,
ni écarter formellement un 401 ou un 503.

## Détails

| Contrôle | Résultat | État |
|---|---|---|
| cron.job_run_details, jobid 2 (blade-daily) | runid 19933, `succeeded`, « 1 row », 07:00:00.21 → 07:00:00.33 UTC : la requête a bien été mise en file | OK |
| net._http_response 06:59–07:10 UTC | 2 lignes (id 9515 et 9516), créées à 07:00:00.33, `status_code` nul, contenu vide, « Timeout of 5000 ms reached » (4,8 s et 4,9 s de requête/réponse) | **indéterminé** |
| Laquelle est blade-daily ? | Impossible à dire : à 07:00 partent aussi send-booking-reminders (jobid 3, `*/30`). Les deux ont expiré | indéterminé |
| Effets en base 06:59–07:15 UTC | 0 rendez-vous avec `blade_reminder_sent_at`, 0 pro avec `inactivity_notified_at` (aucun rappel n'a jamais été marqué envoyé avant non plus) | sans conclusion |
| cron.job_run_details, jobid 6 (blade-purge-old-trips) | Première exécution : runid 19925, `succeeded`, « 1 row », 03:15:00 UTC | OK |
| cron.job jobid 2 | actif, `0 7 * * *`, x-cron-secret présent, aucun « eyJ » | OK |

## Pourquoi l'expiration n'est pas propre à blade-daily

net._http_response (rétention : 04:30 → 10:00 UTC, 13 lignes) montre que send-booking-reminders
expire aussi à 5 s à 04:30, 05:00, 05:30, 06:00, 06:30, 08:00 et 08:30, puis répond 200 à 07:30,
09:00, 09:30 et 10:00. Les commandes des jobs 2 et 3 ne fixent pas `timeout_milliseconds` : la valeur
par défaut de pg_net (5 s) s'applique, et le démarrage à froid de la fonction suffit à la dépasser.
L'expiration ne coupe pas la fonction côté serveur : elle a pu s'exécuter normalement.

Indice (non une preuve) : un 401 ou un 503 est renvoyé avant tout accès à la base
(`supabase/functions/blade-daily/index.ts:12-24`), donc plus vite qu'un traitement complet ;
mais un démarrage à froid peut à lui seul dépasser 5 s, ce qui empêche de conclure.

## Pour trancher (à décider par le chef d'orchestre, avec l'utilisateur)

1. Lire les journaux de la fonction edge blade-daily du 2026-11-25 vers 07:00 UTC (tableau de bord
   Supabase ou `query_logs`), en lecture seule : code de réponse 200, 401 ou 503.
2. Ou attendre l'appel du 2026-11-26 à 07:00 UTC et le lire avant midi UTC (rétention courte),
   sachant qu'il risque d'expirer de la même façon.
3. Correction durable proposée (migration, donc Dédale puis Cerbère, et accord de l'utilisateur) :
   ajouter `timeout_milliseconds := 30000` aux `net.http_post` des jobs 2 et 3, pour que le statut
   et le corps de la réponse soient enregistrés.

En cas de 401 ou 503 confirmé : le retour arrière est décrit dans
`supabase/staged/blade-daily-secret/01_blade_daily_cron_secret.rollback.sql` (redéployer d'abord
l'ancienne fonction, puis appliquer le fichier), **uniquement avec l'accord de l'utilisateur**.

## Résumé
- Job blade-daily lancé à 07:00 UTC (succeeded) ; purge lancée à 03:15 UTC (succeeded).
- Réponse HTTP de blade-daily : expiration pg_net à 5 s, statut inconnu ; aucun rappel marqué envoyé.
- Le message de Cerbère « blade-daily-secret : OK à appliquer » reste ouvert.
