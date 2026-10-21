### Détails techniques
- Conserver l’isolation `/blade` et les parcours LCSBARBER existants.
- Préparer une table dédiée `slot_requests` avec date de création, permissions de lecture administrateur uniquement, validation et limitation des demandes côté serveur.
- Préparer les notifications via Resend, après stockage, sans exposer les clés ni utiliser un simple lien mail comme formulaire.
- Stager la migration additive sans modifier la base partagée ; ne déployer aucun service depuis ce brouillon.
- Tester les vues exclusives, les règles de validation et l’affichage sur téléphone, tablette et ordinateur. La réception réelle et l’e-mail resteront non vérifiables avant activation.