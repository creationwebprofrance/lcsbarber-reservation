import LegalLayout from "./LegalLayout";

// Chaque phrase doit correspondre au code : relue par Cerbère le 24/11/2026
// (supabase/functions/blade-trip, blade-subscription, cartes, connexion Google). L'assistant de
// discussion de l'ancien site LCS Barber a été retiré ; celui de BLADE est désactivé (ASSISTANT_ACTIVE).
export default function Confidentialite() {
  return (
    <LegalLayout title="Politique de confidentialité">
      <section>
        <h2>Responsable du traitement</h2>
        <p>
          Lucas Chipan, entrepreneur individuel, éditeur de BLADE et exploitant de LCS Barber,
          Imp. des Hirondelles Prolongée, 95380 Puiseux-en-France — lucas.chipan97@gmail.com.
        </p>
        <p>
          Pour les données de leurs propres clients, les professionnels inscrits sur BLADE sont
          responsables du traitement ; BLADE agit alors comme sous-traitant pour leur compte.
        </p>
      </section>

      <section>
        <h2>Données collectées</h2>
        <p>
          Compte : nom, adresse électronique, mot de passe chiffré. Connexion avec Google : nous
          recevons votre nom et votre adresse électronique. Réservation : téléphone, adresse de la
          prestation, historique des rendez-vous, montants et statut de paiement.
        </p>
        <p>
          Suivi de trajet (prestations à domicile) : le professionnel partage sa position une seule
          fois, au départ. Nous calculons un itinéraire estimé jusqu'au lieu du rendez-vous et
          enregistrons cet itinéraire (sans ses 500 premiers mètres), les coordonnées du lieu de la
          prestation, la durée, la distance et l'heure d'arrivée estimée. Il n'y a pas de suivi GPS
          continu. Le lien de suivi envoyé au client est lisible par toute personne qui le possède :
          ne le partagez pas.
        </p>
      </section>

      <section>
        <h2>Finalités et bases légales</h2>
        <p>
          Gestion des rendez-vous et exécution de la prestation (exécution du contrat), envoi des
          courriels de confirmation, rappel et suivi (exécution du contrat), abonnements des
          professionnels (exécution du contrat), obligations comptables (obligation légale),
          amélioration du service et avis clients (intérêt légitime).
        </p>
      </section>

      <section>
        <h2>Destinataires et sous-traitants</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Hostinger : hébergement du site.</li>
          <li>Supabase : base de données et serveurs applicatifs (Union européenne).</li>
          <li>Stripe : paiement des acomptes et des abonnements des professionnels.</li>
          <li>Resend : envoi des courriels.</li>
          <li>
            Mapbox : reçoit l'adresse de la prestation et le point de départ du professionnel pour
            calculer le trajet, et affiche certaines cartes.
          </li>
          <li>
            OpenStreetMap : fonds de carte et recherche d'adresse. Ces services voient votre adresse
            IP quand une carte s'affiche.
          </li>
          <li>Google : connexion avec Google et polices de caractères (votre adresse IP).</li>
        </ul>
        <p>
          Certains de ces prestataires peuvent traiter des données hors de l'Union européenne,
          avec des garanties appropriées (clauses contractuelles types de la Commission
          européenne). Aucune donnée n'est vendue ni cédée à des fins publicitaires.
        </p>
      </section>

      <section>
        <h2>Durée de conservation</h2>
        <p>
          Compte : jusqu'à la demande de suppression. Historique des rendez-vous et pièces
          comptables : 10 ans conformément aux obligations légales. Trajet estimé : supprimé
          automatiquement 7 jours après le rendez-vous.
        </p>
      </section>

      <section>
        <h2>Vos droits</h2>
        <p>
          Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation,
          d'opposition et de portabilité. Écrivez à lucas.chipan97@gmail.com. Vous pouvez également
          saisir la CNIL (www.cnil.fr).
        </p>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>
          Le site utilise uniquement des cookies nécessaires au fonctionnement (session de
          connexion, préférences de langue et de thème). Aucun cookie publicitaire ou de mesure
          d'audience tierce n'est déposé.
        </p>
      </section>
    </LegalLayout>
  );
}
