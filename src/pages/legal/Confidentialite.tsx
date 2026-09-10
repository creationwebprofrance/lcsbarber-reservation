import LegalLayout from "./LegalLayout";

export default function Confidentialite() {
  return (
    <LegalLayout title="Politique de confidentialité">
      <section>
        <h2>Responsable du traitement</h2>
        <p>
          LCS Barber, Imp. des Hirondelles Prolongée, 95380 Puiseux-en-France —
          lucas.chipan97@gmail.com.
        </p>
      </section>

      <section>
        <h2>Données collectées</h2>
        <p>
          Compte client : nom, adresse électronique, mot de passe chiffré. Réservation : téléphone,
          adresse de la prestation, historique des rendez-vous, montants et statut de paiement.
          Suivi de trajet : position GPS partagée volontairement, uniquement pendant le trajet, et
          jamais enregistrée en base.
        </p>
      </section>

      <section>
        <h2>Finalités et bases légales</h2>
        <p>
          Gestion des rendez-vous et exécution de la prestation (exécution du contrat), envoi des
          courriels de confirmation, rappel et suivi (exécution du contrat), obligations comptables
          (obligation légale), amélioration du service et avis clients (intérêt légitime).
        </p>
      </section>

      <section>
        <h2>Destinataires</h2>
        <p>
          Supabase (hébergement et base de données), Stripe (paiement des acomptes), Resend (envoi
          des courriels), Mapbox (calcul d'itinéraire). Aucune donnée n'est vendue ni cédée à des
          fins publicitaires.
        </p>
      </section>

      <section>
        <h2>Durée de conservation</h2>
        <p>
          Compte client : jusqu'à la demande de suppression. Historique des rendez-vous et pièces
          comptables : 10 ans conformément aux obligations légales. Positions GPS : effacées dès la
          fin du trajet.
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
