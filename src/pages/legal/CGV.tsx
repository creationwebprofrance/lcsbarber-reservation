import LegalLayout from "./LegalLayout";

export default function CGV() {
  return (
    <LegalLayout title="Conditions générales de vente">
      <section>
        <h2>1. Objet</h2>
        <p>
          Les présentes conditions régissent les prestations de coiffure proposées par LCS Barber,
          réservées via le site, que le client se déplace ou que LCS Barber se déplace chez le
          client.
        </p>
      </section>

      <section>
        <h2>2. Réservation</h2>
        <p>
          La réservation s'effectue en ligne après création d'un compte. Elle est confirmée par
          courriel. Le client s'engage à fournir des informations exactes (nom, téléphone, adresse
          lorsque le déplacement est demandé).
        </p>
      </section>

      <section>
        <h2>3. Prix et frais</h2>
        <p>
          Les prix sont indiqués en euros toutes taxes comprises et affichés avant validation.
          Peuvent s'ajouter, selon le cas : des frais de déplacement calculés selon la distance, un
          supplément hors horaires (en dehors de 10h–20h), un supplément dimanche et un supplément
          pour réservation le jour même. Le détail est toujours affiché dans le récapitulatif avant
          paiement.
        </p>
      </section>

      <section>
        <h2>4. Acompte et paiement</h2>
        <p>
          Un acompte peut être demandé au moment de la réservation, réglé en ligne par carte via
          Stripe. Le solde est réglé sur place à l'issue de la prestation. L'acompte est déduit du
          montant total.
        </p>
      </section>

      <section>
        <h2>5. Annulation, retard et absence</h2>
        <p>
          Toute annulation doit être signalée au plus tôt. En cas de retard prévisible, le client
          doit prévenir au moins 1 heure à l'avance. Au-delà de 20 minutes de retard non annoncé,
          la prestation peut être annulée et l'acompte conservé à titre d'indemnité. Si LCS Barber
          ne peut honorer le rendez-vous, l'acompte est intégralement remboursé.
        </p>
      </section>

      <section>
        <h2>6. Responsabilité</h2>
        <p>
          Le client informe LCS Barber de toute allergie ou sensibilité cutanée avant la prestation.
          LCS Barber ne saurait être tenu responsable des conséquences d'une information non
          communiquée.
        </p>
      </section>

      <section>
        <h2>7. Réclamations</h2>
        <p>
          Toute réclamation peut être adressée à lucas.chipan97@gmail.com. À défaut d'accord
          amiable, le client peut recourir gratuitement à un médiateur de la consommation.
        </p>
      </section>
    </LegalLayout>
  );
}
