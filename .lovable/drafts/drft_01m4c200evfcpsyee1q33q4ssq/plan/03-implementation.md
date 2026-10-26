## Protection et reprise des données
1. Documenter les comptages, totaux et droits actuels ; préparer une sauvegarde contrôlée des éléments concernés et une procédure de retour arrière avant toute reprise.
2. Ajouter un rattachement stable au prestataire, des liens client/rendez-vous et une ville normalisée distincte de l’adresse complète. Conserver les identifiants et propriétaires existants.
3. Proposer une liste de rattachement fondée sur des preuves. **Faire confirmer toute attribution en masse avant de l’exécuter.** Les lignes ambiguës restent non attribuées.
4. Sécuriser lectures, sauvegardes, fonctions d’envoi et fichiers par identité authentifiée. Une adresse email seule ne donne aucun droit.

## Compatibilité et règles de calcul
- Garder les écrans LCSBARBER existants compatibles et l’entrée BLADE isolée.
- Corriger l’enregistrement des prix en distinguant valeur saisie et valeur enregistrée.
- Utiliser le même périmètre `confirmed/completed` pour les mois et le total annuel, ajouter les prestations manuelles distinctes et exclure les doublons liés à un rendez-vous. Le résultat est un CA de réservations/prestations, pas un relevé d’encaissements.
- Pour les visites, retenir les rendez-vous terminés et identifier les anciens confirmés passés utilisés comme approximation ; exclure les annulations et rendez-vous futurs.
- Ne jamais écraser une adresse lors d’une correction de ville.

## Détails techniques
- Centraliser l’accès BLADE aux données et inclure l’identifiant prestataire dans les filtres et les clés de cache. Les droits reposent sur `user_roles` et les relations de propriété vérifiées.
- Préparer une migration additive et rejouable dans ce brouillon, avec permissions serveur et protection des nouvelles relations. Aucune modification du schéma partagé n’est exécutée depuis le brouillon.
- Préparer les fonctions serveur hors des emplacements déployés automatiquement. Toute activation sur le service partagé sera annoncée et autorisée séparément.
- Réutiliser les moteurs tarifaires et d’entretien, les modèles d’email et les composants utiles sans importer globalement l’application LCSBARBER dans BLADE.

## Vérifications et limites de livraison
Tester les règles de prix, l’égalité total annuel/somme mensuelle, l’absence de doublons, les correspondances clients et les échéances d’entretien. Vérifier les six onglets sur téléphone, tablette et ordinateur et les écrans LCSBARBER touchés.

Après acceptation du brouillon et activation autorisée : vérifier avec le compte Lucas les lectures et sauvegardes après rechargement, puis l’isolation depuis un autre compte et par appels directs. Aucun email réel ne sera envoyé lors des tests.

**Les nouvelles protections et relations s’appliquent à l’acceptation du brouillon, pas maintenant.** La persistance utilisant ces relations ne peut pas être vérifiée ici avant cette acceptation ; aucun faux jeu de données ne masquera cette limite. La livraison précisera les fichiers modifiés, les effets sur LCSBARBER, les lignes non attribuées et les vérifications restant à faire. Aucune publication automatique.