# BLADE — livraison du prototype

## Périmètre

Interfaces et navigation locale uniquement dans le brouillon blade-dev, sous `/blade/client` et `/blade/pro`. Sept pages métier clientes, un profil de compte et onze pages professionnelles. Aucune publication, fusion, migration, connexion ou modification des services de production effectuée.

Les règles écrites des pages 1–7 du PDF priment. Le logo noir original est conservé, avec zone blanche dans l’espace professionnel. Les données métier sont absentes : listes vides, indicateurs « — », aucune réservation ou réussite de paiement simulée. Les champs et menus fonctionnent en mémoire ; les actions connecter, payer, envoyer, enregistrer et exporter restent désactivées avec une explication.

## Fichiers

- `src/main.tsx` : sélection exacte de la frontière `/blade`, imports dynamiques séparés ; LCSBARBER et sa feuille de style ne sont pas importés dans BLADE.
- `src/blade/model.ts` : routes et fonctions locales de calendrier et validation.
- `src/blade/common.tsx` : logo, en-tête, états du prénom, navigation adaptée, formulaires, modales et états vides.
- `src/blade/client.tsx` : sept pages clientes et profil de compte.
- `src/blade/pro.tsx` : onze pages professionnelles.
- `src/blade/BladeApp.tsx` : application et routeur indépendants, titre et favicon.
- `src/blade/blade.css` : présentation isolée, responsive, focus et réduction des mouvements.
- `src/blade/model.test.js` : cinq tests locaux.
- `src/blade/assets/logo-black.asset.json`, `logo-white.asset.json` : références des logos fournis.
- `public/blade/logo-black.png`, `logo-white.png` : logos locaux ; le rendu utilise le noir original.
- `public/blade/favicon.png` : original conservé en proportions sur un canevas carré blanc.
- `src/blade/VERIFICATION.md` : présent compte rendu.
- `AGENTS.md`, `roadmap.md` : consignes d’isolation et suivi du brouillon.

## Vérifications exécutées

- **95 combinaisons page/largeur réussies** : 19 routes à 320, 390, 768, 1024 et 1440 px, Chromium.
- Aucun débordement horizontal ; logo et emplacement « Bonjour, [Prénom] » présents sur chaque page ; un seul système de navigation principal visible par format.
- Mobile : contenu en une colonne, navigation basse ; tablette compacte ; ordinateur : navigation cliente haute et professionnelle latérale.
- Prénom long tronqué à 320 px sans masquer l’avatar ; replis « Mon compte » et « Se connecter » vérifiés.
- Modale Ajouter : saisie locale, erreur numérique, sauvegarde désactivée, fermeture Échap et restauration du focus vérifiées.
- Navigation Plus vers Véhicule et lien de profil du menu vérifiés.
- Validation locale de l’e-mail, lien clavier « Aller au contenu », focus visible et réduction des animations vérifiés.
- Chargement d’exemple explicitement identifié et terminé automatiquement, sans requête.
- **Aucune requête fetch/XHR/WebSocket de service**, aucun import de l’application, du CSS ou des providers LCSBARBER dans BLADE, aucun cookie ni écriture localStorage/sessionStorage pendant ces tests.
- Routes `/`, `/reservation` et `/blade-other` : entrée historique LCSBARBER conservée ; requêtes externes bloquées volontairement durant ce contrôle pour ne pas contacter ses services. Ce contrôle ne constitue pas un test métier du backend LCSBARBER.
- **5 tests unitaires réussis**, 18 assertions : frontière de route, inventaire, valeurs vides, validations et calendrier.
- Dernier build automatique observé : **build OK**, aucune erreur de typage restante.
- Captures inspectées sur client/pro, mobile/ordinateur, nom long et modale ; contraste du prénom au survol corrigé, logos et définitions rendus accessibles par des cibles de 44 px.

Les scripts, captures et résultats détaillés sont temporaires sous `/tmp/browser/blade/`. Aucun test n’a authentifié de compte ou interrogé une API métier. Les contrôles ont été réalisés en Chromium ; aucun test matériel iOS/Android n’est revendiqué.