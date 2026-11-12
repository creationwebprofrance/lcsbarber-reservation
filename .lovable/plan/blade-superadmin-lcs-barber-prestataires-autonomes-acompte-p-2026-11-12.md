# BLADE : superadmin LCS Barber, prestataires autonomes, acompte par lien et emails automatiques

## Ce que tu obtiens

**Toi (LCS Barber) = superadmin**
- Une nouvelle page « Superadmin » dans l'espace pro BLADE, visible uniquement par ton compte.
- Liste de tous les prestataires : nom, email, date d'inscription, statut (en attente, actif, suspendu), nombre de clients et de rendez-vous.
- Liste de tous les clients de BLADE, avec le prestataire auquel ils sont rattachés.
- Pour chaque prestataire, 4 interrupteurs :
  - Acompte par lien (Revolut ou Stripe)
  - Emails automatiques
  - Visible dans la recherche
  - Compte suspendu
- Un bouton « Valider » pour activer un nouveau prestataire inscrit.

**Chaque prestataire gère son compte lui-même**
- Il s'inscrit, puis attend ta validation (message « Compte en attente de validation »).
- Une fois validé : il modifie son profil, ses prestations et prix, ses disponibilités, et ses liens de paiement.
- Il ne voit que ses propres clients et rendez-vous, jamais ceux des autres.
- S'il est suspendu : il ne peut plus rien modifier et son profil disparaît de la recherche.

**Acompte par lien**
- Dans Paiements, le prestataire autorisé colle son lien Revolut (revolut.me/...) et/ou son lien de paiement Stripe (buy.stripe.com/...).
- Le client voit le bouton « Payer l'acompte » qui ouvre ce lien.
- Le rendez-vous reste « en attente » jusqu'à ce que le prestataire clique « Acompte reçu ». Il passe alors « confirmé ».
- Sans ton autorisation, la section est grisée avec l'explication « Option non activée par LCS Barber ».
- Ton paiement Stripe actuel sur LCS Barber ne change pas.

**Emails automatiques BLADE** (seulement si l'option est activée pour le prestataire)
- Confirmation du rendez-vous : au client et au prestataire.
- Annulation : au client et au prestataire.
- Rappel la veille : au client.
- Nouvelle demande de créneau ou nouveau message : au prestataire.
- Envoyés avec ton service d'emails actuel, aux couleurs BLADE (noir et blanc).

## Étapes

1. Appliquer les 5 changements de base de données BLADE déjà prêts (demandes de créneaux, avis, espace pro, messagerie pro, communauté).
2. Ajouter le rôle superadmin (attribué à ton compte), le statut et les options de chaque prestataire, les liens de paiement et le suivi « acompte reçu ».
3. Construire la page Superadmin, l'écran « en attente de validation », la section liens de paiement et le bouton « Acompte reçu ».
4. Mettre en route les emails automatiques et le rappel de la veille.
5. Tests sur les règles : un prestataire non autorisé ne peut pas enregistrer de lien, un suspendu ne peut rien modifier, un prestataire ne voit pas les clients d'un autre, seul le superadmin change les options.

## Ce qui ne change pas
- Le site LCS Barber actuel, ses réservations, son acompte Stripe et ses emails.
- Tes 189 réservations et 80 clients ne sont pas rattachés automatiquement à ton compte prestataire BLADE. On le fera dans une étape séparée, après sauvegarde et avec ton accord.

## Détails techniques
- Rôle : nouvelle valeur `superadmin` dans l'enum `app_role`, insérée dans `user_roles` pour l'UUID vérifié da0b2f45-…; fonction `is_superadmin()` SECURITY DEFINER. Rien n'est stocké dans le profil.
- `blade_providers` : ajout de `status` (pending/active/suspended), `display_name`, `email`, `opt_payment_links`, `opt_auto_emails`, `opt_searchable`, `revolut_url`, `stripe_link_url`, `updated_at`. La politique de lecture et `blade_owns_provider()` ne dépendent plus du rôle admin mais de `status='active'`. Inscription : RPC `blade_register_provider()` qui crée la ligne en `pending`.
- Seul le superadmin modifie `status` et `opt_*` (RPC `blade_admin_set_provider`) ; le prestataire modifie ses liens via `blade_update_own_provider`, qui refuse si `opt_payment_links=false`, si suspendu, ou si l'URL n'est pas sur `revolut.me` / `buy.stripe.com` (https uniquement).
- Lecture globale : RPC `blade_admin_overview()` (prestataires + clients + compteurs), réservée au superadmin.
- `bookings` : colonnes `deposit_link_provider` et `deposit_received_at` ; RPC `blade_mark_deposit_received(booking_id)` par le prestataire propriétaire → `status='confirmed'`.
- Emails : une Edge Function `blade-notify` (validation Zod, JWT vérifié, propriétaire ou client du rdv, `opt_auto_emails` vérifié côté serveur, HTML échappé), appelée après création/annulation/demande/message ; rappel via la fonction existante de rappels, filtrée sur les rdv BLADE. Les sources préparées dans le brouillon (`blade-send-template`, `blade-notify-reply`, `create-slot-request`) sont reprises.
- Code front : `src/blade/superadmin.tsx`, extensions de `data.ts`, `pro.tsx` (Paiements, Profil), `client.tsx` (bouton payer l'acompte), garde de route superadmin. AGENTS.md mis à jour (règles « admin-only » remplacées).
- Tests : `provider-admin-model.test.js` pour les règles d'options et la validation des liens.
