import { PageHeading, Section, DisabledAction, Icon } from './common';
import { PlanGate } from './plan';

/**
 * Boutique en ligne des prestataires — EN DÉVELOPPEMENT.
 * Aperçu seulement : aucun produit n'est enregistré, aucune vente ni paiement n'est possible.
 */
export const SHOP_ACTIVE = false;

const PLANNED = [
  ['Tes produits en vitrine', 'Cire, huile à barbe, shampoing, accessoires : photo, prix et stock pour chaque produit.'],
  ['Vente sur ta fiche BLADE', 'Tes clients achètent depuis ta fiche publique ou ajoutent un produit à leur rendez-vous.'],
  ['Paiement sur ton propre lien', 'Comme pour les acomptes : l’argent arrive directement chez toi, sans commission BLADE.'],
  ['Retrait ou livraison', 'Remise lors de la prestation, retrait au salon ou envoi par la poste.'],
  ['Suivi des ventes', 'Commandes, stock restant et chiffre d’affaires produits dans ton dashboard.'],
] as const;

const SAMPLE = [
  { name: 'Cire coiffante mate', price: '14 €', stock: '12 en stock' },
  { name: 'Huile à barbe', price: '18 €', stock: '8 en stock' },
  { name: 'Spray sel de mer', price: '12 €', stock: 'Rupture' },
];

function ShopBody() {
  return <>
    <PageHeading pro title="Boutique" description="Vends tes produits en ligne à tes clients." action={<span className="blade-dev-badge" role="status">En développement</span>} />
    <div className="blade-dev-notice" role="note">
      <Icon name="settings" />
      <div><strong>Fonctionnalité en cours de développement</strong><p>La boutique n’est pas encore ouverte : tu peux voir à quoi elle ressemblera, mais aucun produit ne peut être ajouté ni vendu pour l’instant.</p></div>
    </div>
    <Section title="Ce qui arrive">
      <ul className="blade-dev-list">{PLANNED.map(([t, d]) => <li key={t}><Icon name="shop" /><div><strong>{t}</strong><span>{d}</span></div></li>)}</ul>
    </Section>
    <Section title="Aperçu de tes produits" action={<DisabledAction icon="shop" reason="Bientôt disponible : la boutique est en développement.">Ajouter un produit</DisabledAction>}>
      <div className="blade-dev-preview" aria-label="Exemple de boutique (données fictives)">
        {SAMPLE.map(p => <article key={p.name}><div className="blade-dev-thumb" aria-hidden="true"><Icon name="shop" /></div><h3>{p.name}</h3><p><strong>{p.price}</strong> · {p.stock}</p></article>)}
      </div>
      <p className="blade-note">Exemple fictif, pour illustrer la future boutique.</p>
    </Section>
  </>;
}

export function ProShop() {
  return <PlanGate need="premium" feature="La boutique en ligne"><ShopBody /></PlanGate>;
}
