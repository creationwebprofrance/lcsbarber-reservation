import { loadStripe } from "@stripe/stripe-js";

// Clé publiable Stripe (publique par nature, safe côté client)
export const STRIPE_PUBLISHABLE_KEY =
  "pk_live_51RucPlHx2LD3gj0WxPHaCCJJZzFUOXTFguf06DM4nagtzkW5BhQK1ZaGHADAMOjy9P1RPL9b03xYY6NwGEHVjwTj004Lvq9g8L";

export const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
