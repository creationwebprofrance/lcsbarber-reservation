import LegalLayout from "./LegalLayout";

// Projet à faire relire par un juriste avant de servir de base contractuelle.
// Les règles décrites ici suivent le code : supabase/functions/blade-subscription/index.ts
// (essai, codes promo, portail Stripe) et src/blade/pricing.tsx (plans et prix).
export default function CGVAbonnement() {
  return (
    <LegalLayout title="Conditions générales de l'abonnement BLADE">
      <p>Version du 24 novembre 2026.</p>

      <section>
        <h2>1. Objet et parties</h2>
        <p>
          Les présentes conditions régissent les abonnements payants à la plateforme BLADE
          (blade-hairstyle.com), proposés aux coiffeurs et barbiers professionnels (le
          « Professionnel »). BLADE est éditée par Lucas Chipan, entrepreneur individuel,
          Imp. des Hirondelles Prolongée, 95380 Puiseux-en-France (« BLADE »), immatriculation en
          cours. Contact : lucas.chipan97@gmail.com.
        </p>
        <p>
          Elles ne s'appliquent pas aux réservations passées par les clients auprès des
          Professionnels : chaque Professionnel est seul responsable de ses prestations, de ses
          prix et de ses propres conditions envers ses clients.
        </p>
      </section>

      <section>
        <h2>2. Acceptation</h2>
        <p>
          Le Professionnel accepte les présentes conditions en souscrivant un abonnement. Il
          déclare agir dans le cadre de son activité professionnelle. Les conditions applicables
          sont celles en vigueur au jour de la souscription ou du dernier renouvellement.
        </p>
      </section>

      <section>
        <h2>3. Plans et contenu</h2>
        <p>
          Le plan Découverte est gratuit et limité à 20 réservations par mois. Les plans payants
          Pro et Premium, leur contenu et leurs prix sont décrits sur la page Tarifs
          (blade-hairstyle.com/blade/tarifs), qui fait partie des présentes conditions. Les
          fonctionnalités peuvent évoluer pour améliorer le service, sans réduire de façon
          importante le contenu d'un plan en cours de période.
        </p>
        <p>
          BLADE ne prélève aucune commission sur les prestations. Les acomptes payés par les
          clients sont versés directement sur le lien de paiement du Professionnel (Stripe ou
          Revolut) : BLADE ne détient jamais ces fonds.
        </p>
      </section>

      <section>
        <h2>4. Prix et facturation</h2>
        <p>
          Les prix sont indiqués en euros. TVA non applicable, article 293 B du Code général des
          impôts. L'abonnement est payable d'avance, par carte bancaire, via le prestataire de
          paiement Stripe :
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>mensuel : prélevé chaque mois à la date anniversaire de la souscription ;</li>
          <li>annuel : payé en une fois pour douze mois, avec une réduction de 10 % par rapport au
            prix mensuel.</li>
        </ul>
        <p>
          Les factures sont disponibles dans l'espace de gestion de l'abonnement. Un code
          promotionnel peut être saisi au moment du paiement, aux conditions propres à chaque
          offre.
        </p>
      </section>

      <section>
        <h2>5. Essai gratuit</h2>
        <p>
          Le plan Pro mensuel ou annuel comprend un essai gratuit de 30 jours, une seule fois par
          Professionnel. Le moyen de paiement est demandé à la souscription. Sauf résiliation
          avant la fin de l'essai, le premier paiement est prélevé automatiquement à son terme.
        </p>
      </section>

      <section>
        <h2>6. Durée, renouvellement et résiliation</h2>
        <p>
          L'abonnement est sans engagement au-delà de la période en cours. Il se renouvelle
          automatiquement par périodes successives d'un mois ou d'un an, selon la formule choisie.
        </p>
        <p>
          Le Professionnel peut résilier à tout moment depuis la page Abonnement de son espace
          pro. La résiliation prend effet à la fin de la période déjà payée : le plan reste actif
          jusque-là, puis le compte repasse au plan Découverte. Les sommes versées pour la période
          en cours ne sont pas remboursées, y compris pour une formule annuelle, sauf erreur de
          facturation imputable à BLADE.
        </p>
      </section>

      <section>
        <h2>7. Absence de droit de rétractation</h2>
        <p>
          L'abonnement est souscrit par un professionnel pour les besoins de son activité : le
          droit de rétractation prévu par le Code de la consommation ne s'applique pas. L'essai
          gratuit permet d'évaluer le service avant tout paiement.
        </p>
      </section>

      <section>
        <h2>8. Défaut de paiement</h2>
        <p>
          En cas d'échec de paiement, Stripe effectue de nouvelles tentatives et le Professionnel
          est invité à mettre à jour sa carte. Si le paiement n'aboutit pas, l'abonnement est
          interrompu et le compte repasse au plan Découverte. Les données du compte sont
          conservées.
        </p>
      </section>

      <section>
        <h2>9. Évolution des prix</h2>
        <p>
          BLADE peut modifier ses prix. Le nouveau prix est communiqué par e-mail au moins
          30 jours à l'avance et ne s'applique qu'à partir du renouvellement suivant. Le
          Professionnel qui le refuse peut résilier avant cette date. Les prix accordés dans le
          cadre d'une offre limitée sont maintenus selon les conditions de cette offre.
        </p>
      </section>

      <section>
        <h2>10. Obligations du Professionnel</h2>
        <p>
          Le Professionnel fournit des informations exactes sur son identité, son activité, ses
          prix et ses liens de paiement. Il exerce légalement son activité, respecte la
          réglementation applicable à ses prestations et publie uniquement des photos et textes
          dont il détient les droits. Il garde ses identifiants confidentiels.
        </p>
      </section>

      <section>
        <h2>11. Suspension</h2>
        <p>
          BLADE peut suspendre un compte en cas de manquement grave aux présentes conditions,
          notamment fraude, informations fausses, contenu illicite ou comportement abusif envers
          les clients, après avoir informé le Professionnel sauf urgence. En cas de manquement
          grave, la période en cours n'est pas remboursée.
        </p>
      </section>

      <section>
        <h2>12. Disponibilité et responsabilité</h2>
        <p>
          BLADE met en œuvre les moyens raisonnables pour assurer l'accès au service, sans
          garantir une disponibilité permanente : des interruptions peuvent survenir pour
          maintenance ou en cas de panne d'un prestataire technique. BLADE est tenue d'une
          obligation de moyens. Elle n'est pas responsable des prestations réalisées par le
          Professionnel, des relations entre le Professionnel et ses clients, ni des paiements
          effectués sur les liens du Professionnel. Sauf faute lourde ou dolosive, la
          responsabilité de BLADE est limitée au montant payé par le Professionnel au cours des
          douze derniers mois.
        </p>
      </section>

      <section>
        <h2>13. Données personnelles</h2>
        <p>
          Les données du Professionnel sont traitées selon la politique de confidentialité du
          site. Pour les données de ses propres clients (nom, coordonnées, rendez-vous, points de
          fidélité), le Professionnel est responsable du traitement et BLADE agit comme
          sous-traitant au sens de l'article 28 du RGPD : BLADE ne les traite que pour fournir le
          service, les protège, ne les communique pas à d'autres professionnels, n'utilise que
          des sous-traitants situés ou hébergeant dans l'Union européenne ou offrant des
          garanties appropriées (Supabase, Hostinger, Resend, Stripe), aide le Professionnel à
          répondre aux demandes de ses clients et supprime ou restitue ces données à la fin du
          contrat, à sa demande.
        </p>
      </section>

      <section>
        <h2>14. Modification des conditions</h2>
        <p>
          BLADE peut modifier les présentes conditions. Le Professionnel est informé par e-mail
          au moins 30 jours avant leur entrée en vigueur. S'il les refuse, il peut résilier avant
          cette date.
        </p>
      </section>

      <section>
        <h2>15. Droit applicable et litiges</h2>
        <p>
          Les présentes conditions sont soumises au droit français. Les parties recherchent
          d'abord une solution amiable en écrivant à lucas.chipan97@gmail.com. À défaut d'accord
          dans un délai de 30 jours, le litige est porté devant les tribunaux compétents du
          ressort de Pontoise.
        </p>
      </section>
    </LegalLayout>
  );
}
