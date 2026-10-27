## Réalisation et vérifications
1. Ajouter les blocs sous la carte, les traductions BLADE, les thèmes et les animations sans changer la composition validée.
2. Préparer les relations sécurisées des réalisations, médias, réactions et conversations, puis les écrans de publication, galerie, lecteur et Messages.
3. Relier l’assistant aux sources publiques autorisées et à une FAQ de repli ; reprendre l’avatar du PDF, sans générer de photos pour la galerie.
4. Vérifier à 390, 768 et 1440 px : clavier, focus, retours du lecteur, pause/son, mouvements réduits, langues, thèmes et absence de débordement. Après activation, vérifier publication réelle, retrait du fil, réactions persistantes et refus d’accès entre comptes. Ne pas envoyer de messages de test à de vrais prestataires.

## Détails techniques
- Conserver l’isolation `/blade` et regrouper les accès métier dans la couche BLADE existante. Ajouter un dictionnaire FR/EN/ES et des préférences propres à BLADE ; couleurs et thèmes via les tokens, pas de traduction du texte par remplacement du DOM.
- Réutiliser les identifiants prestataires et services existants, sans attribuer automatiquement les anciennes données à Lucas. Exposer une fiche publique minimale et une galerie paginée, ordonnée de manière stable avec rotation entre prestataires.
- Stockage privé pour originaux et miniatures ; accès public aux seuls médias publiés et prêts via un service validant leur visibilité. Contrôler propriété, type réel, taille, durée et état de traitement côté serveur. Limites initiales proposées : images JPEG/PNG/WebP jusqu’à 10 Mo ; vidéos MP4/WebM jusqu’à 50 Mo et 60 secondes, à confirmer contre les capacités du stockage avant activation. Aucun fichier en traitement ne devient public.
- Réactions : identité authentifiée ou jeton visiteur émis et validé côté serveur, contrainte d’unicité, actions idempotentes et limitation de fréquence. Ne pas considérer un simple identifiant fourni par le navigateur comme une autorisation.
- Messages : droits de lecture/écriture et mises à jour en temps réel limités aux participants ; expéditeur dérivé de la session, aucun accès automatique aux fiches clients ou au planning privé.
- Assistant : clé uniquement côté serveur, sources publiques sélectionnées, limites de requêtes/contexte et budget configurable. Aucun outil d’action métier ; refus explicite des demandes privées. L’usage IA peut consommer des crédits Lovable.
- Ajouter des tests ciblés pour publication/visibilité/propriété, unicité des réactions, droits des conversations et sélection du service. Tester avec les services réels après activation, jamais avec un faux stockage pour simuler un succès.

## Ce qui attend l’acceptation du brouillon
Les nouvelles relations sont **préparées dans le brouillon et ne s’appliquent qu’à son acceptation**. La création du stockage et l’activation des services de médias, réactions et assistant nécessitent ensuite une autorisation ; rien ne sera déployé ni publié automatiquement pendant ce travail.

Les données prestataires existantes attendent déjà leur rattachement vérifié. Sans ce rattachement, les publications associées ne seront pas exposées. Aucun transfert massif de données, aucune modification des paiements et aucun e-mail réel ne sont inclus.

L’aperçu pourra montrer les nouveaux blocs et préférences ; les nouveaux enregistrements, téléversements, réactions, conversations et réponses IA ne pourront être vérifiés en conditions réelles qu’après acceptation et activation. Les états d’indisponibilité seront explicites, pas présentés comme des résultats vides confirmés.