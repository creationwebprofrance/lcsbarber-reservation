// Tableau détaillé « Ce que comprend chaque plan » de la page Tarifs.
// Chaque ligne doit refléter ce que le serveur fait respecter (blade_effective_plan) :
// - 20 réservations par mois en Découverte : blade-booking ;
// - acompte et pourboire par lien : blade_booking_deposit_links, blade_my_tip_links (Premium) ;
// - rappel la veille : blade-daily et send-booking-reminders (Pro) ;
// - relances : blade-relance (100 par mois en Pro, illimitées en Premium) ; fidélité : blade_loyalty_* ;
// - véhicule (Pro) et boutique (Premium) : écrans réservés par PlanGate ;
// - fidélité 50 clients en Pro, illimitée en Premium ; modèles Vitrine et Salon et pourboires : Premium
//   (supabase/staged/offres-premium) ;
// - trajet estimé : blade-trip ; mise en avant et badge : blade_public_providers (Premium).
import type { Language } from './preferences';

/** true : inclus ; false : non inclus ; texte : inclus avec cette précision. */
export type Cell = boolean | string;
export type FeatureRow = { label: string; hint?: string; free: Cell; pro: Cell; premium: Cell };
export type FeatureGroup = { title: string; rows: FeatureRow[] };
export type FeatureTable = { title: string; lead: string; included: string; excluded: string; groups: FeatureGroup[] };

const fr: FeatureTable = {
  title: 'Ce que comprend chaque plan',
  lead: 'Toutes les fonctionnalités, plan par plan.',
  included: 'Inclus', excluded: 'Non inclus',
  groups: [
    { title: 'Réservations et agenda', rows: [
      { label: 'Réservations en ligne', free: '20 par mois', pro: 'Illimitées', premium: 'Illimitées' },
      { label: 'Agenda, horaires de la semaine, congés et jours particuliers', free: true, pro: true, premium: true },
      { label: 'Prestations avec prix et durées', free: true, pro: true, premium: true },
      { label: 'Lieux proposés, questions et conditions à accepter avant de réserver', free: true, pro: true, premium: true },
      { label: 'Demandes de créneau des clients', free: true, pro: true, premium: true },
    ] },
    { title: 'Paiements', rows: [
      { label: 'Aucune commission sur tes prestations', free: true, pro: true, premium: true },
      { label: 'Acompte en ligne par ton lien Stripe ou Revolut', hint: 'Option activée par BLADE après vérification de ton lien', free: false, pro: true, premium: true },
      { label: 'Pourboires en ligne par ton lien Stripe ou Revolut', hint: 'Proposés au client jusqu’à 30 jours après son rendez-vous', free: false, pro: false, premium: true },
    ] },
    { title: 'Mails aux clients', rows: [
      { label: 'Mails de confirmation et d’annulation, au client et à toi', hint: 'Mails automatiques activés par BLADE à la validation de ton compte', free: true, pro: true, premium: true },
      { label: 'Modèles de mails personnalisables', free: true, pro: true, premium: true },
      { label: 'Rappel automatique la veille du rendez-vous', hint: 'Avec les mails automatiques activés par BLADE', free: false, pro: true, premium: true },
      { label: 'Relance des clients qui ne reviennent plus', hint: '1 relance par client tous les 7 jours ; au plus 200 mails par jour', free: false, pro: '100 par mois', premium: 'Illimitées' },
    ] },
    { title: 'Clients et fidélité', rows: [
      { label: 'Fichier clients : coordonnées, historique, impayés, blocage', free: true, pro: true, premium: true },
      { label: 'Avis clients sur ton profil', free: true, pro: true, premium: true },
      { label: 'Carte de fidélité à points, QR code et cartes NFC', free: false, pro: '50 clients', premium: 'Illimitée' },
    ] },
    { title: 'Visibilité', rows: [
      { label: 'Profil public et présence dans la recherche', hint: 'Présence dans la recherche activée par BLADE après vérification', free: true, pro: true, premium: true },
      { label: 'Personnalisation : logo, couverture, couleur et police', free: true, pro: true, premium: true },
      { label: 'Modèles de page', hint: 'Classique et Agenda pour tous ; Vitrine et Salon en Premium', free: '2', pro: '2', premium: '4' },
      { label: 'Galerie de réalisations', free: true, pro: true, premium: true },
      { label: 'Mise en avant dans les résultats de ta ville', free: false, pro: false, premium: true },
      { label: 'Badge « Pro vérifié »', free: false, pro: false, premium: true },
    ] },
    { title: 'Déplacements à domicile', rows: [
      { label: 'Suivi de ton véhicule : kilométrage, entretiens et coûts', free: false, pro: true, premium: true },
      { label: 'Suivi du trajet en direct à domicile', hint: 'Ton client reçoit un lien pour suivre ton arrivée quand tu pars', free: false, pro: false, premium: true },
    ] },
    { title: 'Outils', rows: [
      { label: 'Grille de prix et simulation de rentabilité', free: true, pro: true, premium: true },
      { label: 'Messages privés et chat entre coiffeurs', hint: 'Bientôt disponible', free: true, pro: true, premium: true },
      { label: 'Boutique en ligne pour vendre tes produits', hint: 'Bientôt disponible', free: false, pro: false, premium: true },
    ] },
  ],
};

const en: FeatureTable = {
  title: 'What each plan includes',
  lead: 'Every feature, plan by plan.',
  included: 'Included', excluded: 'Not included',
  groups: [
    { title: 'Bookings and calendar', rows: [
      { label: 'Online bookings', free: '20 per month', pro: 'Unlimited', premium: 'Unlimited' },
      { label: 'Calendar, weekly hours, days off and special days', free: true, pro: true, premium: true },
      { label: 'Services with prices and durations', free: true, pro: true, premium: true },
      { label: 'Offered places, questions and conditions to accept before booking', free: true, pro: true, premium: true },
      { label: 'Client slot requests', free: true, pro: true, premium: true },
    ] },
    { title: 'Payments', rows: [
      { label: 'No fee on your services', free: true, pro: true, premium: true },
      { label: 'Online deposit through your Stripe or Revolut link', hint: 'Enabled by BLADE once your link is checked', free: false, pro: true, premium: true },
      { label: 'Online tips through your Stripe or Revolut link', hint: 'Offered to the client up to 30 days after the appointment', free: false, pro: false, premium: true },
    ] },
    { title: 'Client emails', rows: [
      { label: 'Confirmation and cancellation emails, to the client and to you', hint: 'Automatic emails enabled by BLADE when your account is approved', free: true, pro: true, premium: true },
      { label: 'Customisable email templates', free: true, pro: true, premium: true },
      { label: 'Automatic reminder the day before', hint: 'With automatic emails enabled by BLADE', free: false, pro: true, premium: true },
      { label: 'Follow-up emails for clients who stopped coming', hint: '1 per client every 7 days; at most 200 emails a day', free: false, pro: '100 a month', premium: 'Unlimited' },
    ] },
    { title: 'Clients and loyalty', rows: [
      { label: 'Client file: contact details, history, unpaid amounts, blocking', free: true, pro: true, premium: true },
      { label: 'Client reviews on your profile', free: true, pro: true, premium: true },
      { label: 'Points loyalty card, QR code and NFC cards', free: false, pro: '50 clients', premium: 'Unlimited' },
    ] },
    { title: 'Visibility', rows: [
      { label: 'Public profile and listing in search', hint: 'Search listing enabled by BLADE after a check', free: true, pro: true, premium: true },
      { label: 'Customisation: logo, cover, colour and font', free: true, pro: true, premium: true },
      { label: 'Page layouts', hint: 'Classic and Agenda for everyone; Showcase and Salon in Premium', free: '2', pro: '2', premium: '4' },
      { label: 'Work gallery', free: true, pro: true, premium: true },
      { label: 'Featured in your city’s results', free: false, pro: false, premium: true },
      { label: '“Verified pro” badge', free: false, pro: false, premium: true },
    ] },
    { title: 'Home visits', rows: [
      { label: 'Vehicle tracking: mileage, servicing and costs', free: false, pro: true, premium: true },
      { label: 'Live travel tracking for home visits', hint: 'Your client gets a link to follow your arrival when you leave', free: false, pro: false, premium: true },
    ] },
    { title: 'Tools', rows: [
      { label: 'Price list and profitability simulation', free: true, pro: true, premium: true },
      { label: 'Private messages and barbers’ chat', hint: 'Coming soon', free: true, pro: true, premium: true },
      { label: 'Online shop to sell your products', hint: 'Coming soon', free: false, pro: false, premium: true },
    ] },
  ],
};

const es: FeatureTable = {
  title: 'Qué incluye cada plan',
  lead: 'Todas las funciones, plan por plan.',
  included: 'Incluido', excluded: 'No incluido',
  groups: [
    { title: 'Reservas y agenda', rows: [
      { label: 'Reservas online', free: '20 al mes', pro: 'Ilimitadas', premium: 'Ilimitadas' },
      { label: 'Agenda, horario semanal, vacaciones y días especiales', free: true, pro: true, premium: true },
      { label: 'Servicios con precios y duraciones', free: true, pro: true, premium: true },
      { label: 'Lugares, preguntas y condiciones antes de reservar', free: true, pro: true, premium: true },
      { label: 'Solicitudes de horario de los clientes', free: true, pro: true, premium: true },
    ] },
    { title: 'Pagos', rows: [
      { label: 'Sin comisión sobre tus servicios', free: true, pro: true, premium: true },
      { label: 'Anticipo online con tu enlace Stripe o Revolut', hint: 'Activado por BLADE tras verificar tu enlace', free: false, pro: true, premium: true },
      { label: 'Propinas online con tu enlace Stripe o Revolut', hint: 'Propuestas al cliente hasta 30 días después de la cita', free: false, pro: false, premium: true },
    ] },
    { title: 'E-mails a clientes', rows: [
      { label: 'E-mails de confirmación y cancelación, al cliente y a ti', hint: 'E-mails automáticos activados por BLADE al validar tu cuenta', free: true, pro: true, premium: true },
      { label: 'Plantillas de e-mail personalizables', free: true, pro: true, premium: true },
      { label: 'Recordatorio automático la víspera', hint: 'Con los e-mails automáticos activados por BLADE', free: false, pro: true, premium: true },
      { label: 'Recordatorio a clientes que ya no vuelven', hint: '1 por cliente cada 7 días; como máximo 200 e-mails al día', free: false, pro: '100 al mes', premium: 'Ilimitados' },
    ] },
    { title: 'Clientes y fidelidad', rows: [
      { label: 'Fichero de clientes: datos, historial, impagos, bloqueo', free: true, pro: true, premium: true },
      { label: 'Opiniones de clientes en tu perfil', free: true, pro: true, premium: true },
      { label: 'Tarjeta de fidelidad con puntos, QR y tarjetas NFC', free: false, pro: '50 clientes', premium: 'Ilimitada' },
    ] },
    { title: 'Visibilidad', rows: [
      { label: 'Perfil público y presencia en la búsqueda', hint: 'Presencia en la búsqueda activada por BLADE tras verificación', free: true, pro: true, premium: true },
      { label: 'Personalización: logo, portada, color y fuente', free: true, pro: true, premium: true },
      { label: 'Modelos de página', hint: 'Clásico y Agenda para todos; Escaparate y Salón en Premium', free: '2', pro: '2', premium: '4' },
      { label: 'Galería de trabajos', free: true, pro: true, premium: true },
      { label: 'Destacado en los resultados de tu ciudad', free: false, pro: false, premium: true },
      { label: 'Insignia «Pro verificado»', free: false, pro: false, premium: true },
    ] },
    { title: 'Desplazamientos a domicilio', rows: [
      { label: 'Seguimiento del vehículo: kilometraje, mantenimiento y costes', free: false, pro: true, premium: true },
      { label: 'Seguimiento del trayecto en directo a domicilio', hint: 'Tu cliente recibe un enlace para seguir tu llegada cuando sales', free: false, pro: false, premium: true },
    ] },
    { title: 'Herramientas', rows: [
      { label: 'Lista de precios y simulación de rentabilidad', free: true, pro: true, premium: true },
      { label: 'Mensajes privados y chat entre barberos', hint: 'Próximamente', free: true, pro: true, premium: true },
      { label: 'Tienda online para vender tus productos', hint: 'Próximamente', free: false, pro: false, premium: true },
    ] },
  ],
};

export const FEATURE_TABLES: Record<Language, FeatureTable> = { fr, en, es };
