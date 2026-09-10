import LegalLayout from "./LegalLayout";

export default function MentionsLegales() {
  return (
    <LegalLayout title="Mentions légales">
      <section>
        <h2>Éditeur du site</h2>
        <p>
          LCS Barber — entreprise individuelle de coiffure à domicile et en déplacement.
          <br />
          Adresse : Imp. des Hirondelles Prolongée, 95380 Puiseux-en-France, France.
          <br />
          Contact : lucas.chipan97@gmail.com
          <br />
          Responsable de la publication : Lucas Chipan.
        </p>
      </section>

      <section>
        <h2>Immatriculation</h2>
        <p>
          Numéro SIRET : à compléter. TVA non applicable, article 293 B du Code général des impôts
          (sous réserve du régime réellement applicable).
        </p>
      </section>

      <section>
        <h2>Hébergement</h2>
        <p>
          Le site est hébergé par Hostinger International Ltd., 61 Lordou Vironos Street, 6023
          Larnaca, Chypre. Les données applicatives sont hébergées par Supabase (Union européenne).
        </p>
      </section>

      <section>
        <h2>Propriété intellectuelle</h2>
        <p>
          L'ensemble des contenus du site (textes, photographies de réalisations, logo, éléments
          graphiques) est la propriété de LCS Barber. Toute reproduction sans autorisation écrite
          est interdite.
        </p>
      </section>

      <section>
        <h2>Litiges</h2>
        <p>
          Le présent site est soumis au droit français. En cas de litige, une solution amiable sera
          recherchée avant toute action judiciaire.
        </p>
      </section>
    </LegalLayout>
  );
}
