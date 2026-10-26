# Intégrer vos données dans BLADE

Le PDF devient le cahier des charges de l’espace professionnel : **Dashboard, Prix, Clients, Emails, Prestations, Mon véhicule**, sans rubrique supplémentaire Catalogue ou Simulation. Le logo original et la palette espresso sont conservés.

## Ce qui a été vérifié
- Le compte Lucas existe et correspond à son profil et à son rôle administrateur.
- BLADE utilise déjà la même base que LCSBARBER : aucune copie globale n’est nécessaire.
- La base contient 5 services, 9 paramètres tarifaires, 80 clients, 189 réservations, 32 fusions, 3 modèles d’email et 2 véhicules appartenant au compte Lucas. Aucune prestation manuelle n’est actuellement enregistrée.
- Les tables métier n’ont pas de rattachement prestataire, sauf les véhicules. Les droits actuels donnent aux administrateurs un accès global : ils ne suffisent pas pour isoler plusieurs prestataires.

**Important :** ces comptages prouvent l’existence des données, pas leur propriété. Les anciennes lignes sans provenance vérifiable seront signalées, jamais attribuées automatiquement à Lucas.

## Les six onglets
- **Dashboard** : carte et classement des villes fréquentées, sélection de période et chiffre d’affaires mensuel avec année sélectionnable. Aucun indicateur supplémentaire.
- **Prix** : prix des services, frais de déplacement et suppléments horaires ; sauvegarde explicite, valeurs réellement enregistrées, sans modification des anciens rendez-vous ni notification automatique.
- **Clients** : recherche, coordonnées, historique, impayés, blocage et fusions conservées, y compris les clients sans rendez-vous.
- **Emails** : types existants, édition du sujet et du contenu, aperçu isolé, sauvegarde et confirmation des destinataires avant tout envoi manuel. Aucun email réel pendant les travaux ou les tests.
- **Prestations** : services proposés et prestations réalisées dans deux vues du même onglet. Archivage des services utilisés et liens vers client/rendez-vous lorsqu’ils sont vérifiés.
- **Mon véhicule** : sélection parmi les véhicules existants, kilométrage, entretiens réalisés et prochaines échéances calculées à partir des règles enregistrées. Données manquantes indiquées « À renseigner », sans ajout de carburant ou GPS.