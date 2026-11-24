import LegalLayout from "./LegalLayout";

export default function MentionsLegales() {
  return (
    <LegalLayout title="Mentions légales">
      <section>
        <h2>Éditeur du site</h2>
        <p>
          Lucas Chipan, entrepreneur individuel, éditeur de la plateforme BLADE
          (blade-hairstyle.com) et exploitant de LCS Barber, activité de coiffure à domicile et en
          déplacement.
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
          Immatriculation en cours : le numéro SIRET sera indiqué sur cette page dès son
          attribution. TVA non applicable, article 293 B du Code général des impôts.
        </p>
      </section>

      <section>
        <h2>Le service BLADE</h2>
        <p>
          BLADE est une plateforme qui permet de trouver des coiffeurs et barbiers indépendants et
          de réserver leurs prestations. Chaque professionnel inscrit exerce sous sa propre
          responsabilité : il fixe ses prix, réalise ses prestations et reçoit directement ses
          acomptes. Pour les prestations de LCS Barber, les conditions générales de vente du site
          s'appliquent.
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
          Les marques BLADE et LCS Barber, ainsi que les textes, logos et éléments graphiques du
          site, appartiennent à Lucas Chipan. Les photographies et textes publiés par les
          professionnels sur leur profil restent leur propriété. Toute reproduction sans
          autorisation écrite est interdite.
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
