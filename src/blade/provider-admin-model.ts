// Pure rules for BLADE provider accounts, superadmin options and deposit links.
// The database enforces the same rules; these mirror them for instant feedback.
export type ProviderStatus = 'pending' | 'active' | 'suspended';
export type ProviderAccount = {
  id: string; status: ProviderStatus; display_name: string | null; email: string | null;
  opt_payment_links: boolean; opt_auto_emails: boolean; opt_searchable: boolean;
  revolut_url: string | null; stripe_link_url: string | null; created_at: string;
};

export const REVOLUT_LINK = /^https:\/\/(www\.)?revolut\.me\/[A-Za-z0-9._-]{1,64}(\/[A-Za-z0-9._-]{1,32})?\/?$/;
export const STRIPE_LINK = /^https:\/\/buy\.stripe\.com\/[A-Za-z0-9_]{1,128}$/;
export const INACTIVITY_DAYS = 30;
export const PAYMENT_OPTION_OFF = 'Option non activée par LCS Barber';

export const providerStatusLabel: Record<ProviderStatus, string> = { pending: 'En attente', active: 'Actif', suspended: 'Suspendu' };

export function validatePaymentLink(kind: 'revolut' | 'stripe', value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (kind === 'revolut') return REVOLUT_LINK.test(v) ? null : 'Lien Revolut invalide : il doit commencer par https://revolut.me/';
  return STRIPE_LINK.test(v) ? null : 'Lien Stripe invalide : il doit commencer par https://buy.stripe.com/';
}

/** Returns the reason a provider cannot save these links, or null when allowed. */
export function paymentLinksError(p: Pick<ProviderAccount, 'status' | 'opt_payment_links'>, revolut: string, stripe: string): string | null {
  if (p.status !== 'active') return 'Compte prestataire non actif';
  const hasLink = Boolean(revolut.trim() || stripe.trim());
  if (hasLink && !p.opt_payment_links) return PAYMENT_OPTION_OFF;
  return validatePaymentLink('revolut', revolut) ?? validatePaymentLink('stripe', stripe);
}

/** Pro space access: only active providers (or the superadmin) can use the tools. */
export function proAccess(p: Pick<ProviderAccount, 'status'> | null, isSuperadmin: boolean): 'open' | 'pending' | 'suspended' | 'none' {
  if (isSuperadmin) return 'open';
  if (!p) return 'none';
  return p.status === 'active' ? 'open' : p.status;
}

export function isInactive(lastActiveAt: string | Date, now: Date = new Date()): boolean {
  return now.getTime() - new Date(lastActiveAt).getTime() > INACTIVITY_DAYS * 24 * 3600 * 1000;
}

/** Bookings for which a client can still pay the deposit by link. */
export function needsDeposit(b: { status: string; deposit_paid?: boolean | null; provider_id?: string | null }): boolean {
  return Boolean(b.provider_id) && b.status === 'pending' && !b.deposit_paid;
}
