import LegalLayout from "./LegalLayout";

export default function Retractation() {
  return (
    <LegalLayout title="Droit de rétractation">
      <section>
        <h2>Principe</h2>
        <p>
          Pour les contrats conclus à distance, le consommateur dispose en principe d'un délai de 14
          jours pour se rétracter, conformément à l'article L221-18 du Code de la consommation.
        </p>
      </section>

      <section>
        <h2>Exception applicable aux rendez-vous</h2>
        <p>
          Conformément à l'article L221-28, 12° du Code de la consommation, le droit de rétractation
          ne s'applique pas aux prestations de services de soins personnels fournies à une date ou
          une période déterminée. Les rendez-vous de coiffure réservés pour un créneau précis
          entrent dans cette exception.
        </p>
      </section>

      <section>
        <h2>Annulation d'un rendez-vous</h2>
        <p>
          Vous pouvez néanmoins annuler ou déplacer votre rendez-vous en nous prévenant au plus tôt
          à lucas.chipan97@gmail.com ou par téléphone. En cas d'annulation raisonnablement
          anticipée, l'acompte versé est remboursé ou reporté sur un nouveau créneau.
        </p>
      </section>

      <section>
        <h2>Formulaire de rétractation</h2>
        <p>
          Lorsque le droit de rétractation s'applique, adressez-nous une déclaration dénuée
          d'ambiguïté mentionnant : vos nom et adresse, la prestation concernée, la date de
          réservation et la date de votre demande.
        </p>
      </section>
    </LegalLayout>
  );
}
