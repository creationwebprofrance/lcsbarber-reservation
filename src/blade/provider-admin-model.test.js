import { test, expect } from 'bun:test';
import { paymentLinksError, validatePaymentLink, proAccess, isInactive, needsDeposit, PAYMENT_OPTION_OFF } from './provider-admin-model';

const active = { status: 'active', opt_payment_links: true };

test('a provider not authorized by LCS Barber cannot save a payment link', () => {
  expect(paymentLinksError({ status: 'active', opt_payment_links: false }, 'https://revolut.me/lucas', '')).toBe(PAYMENT_OPTION_OFF);
  expect(paymentLinksError({ status: 'active', opt_payment_links: false }, '', 'https://buy.stripe.com/abc123')).toBe(PAYMENT_OPTION_OFF);
});

test('an unauthorized provider can still clear their links', () => {
  expect(paymentLinksError({ status: 'active', opt_payment_links: false }, '', '')).toBeNull();
});

test('a suspended or pending provider cannot change anything', () => {
  expect(paymentLinksError({ status: 'suspended', opt_payment_links: true }, 'https://revolut.me/lucas', '')).toBe('Compte prestataire non actif');
  expect(paymentLinksError({ status: 'pending', opt_payment_links: true }, '', '')).toBe('Compte prestataire non actif');
});

test('only real revolut.me and buy.stripe.com https links are accepted', () => {
  expect(paymentLinksError(active, 'https://revolut.me/lucas', 'https://buy.stripe.com/test_00g5kk')).toBeNull();
  expect(validatePaymentLink('revolut', 'http://revolut.me/lucas')).not.toBeNull();
  expect(validatePaymentLink('revolut', 'https://revolut.me.evil.com/lucas')).not.toBeNull();
  expect(validatePaymentLink('stripe', 'https://checkout.stripe.com/abc')).not.toBeNull();
  expect(validatePaymentLink('stripe', 'https://buy.stripe.com/abc?x=<script>')).not.toBeNull();
});

test('pro space opens only for active providers or the superadmin', () => {
  expect(proAccess({ status: 'active' }, false)).toBe('open');
  expect(proAccess({ status: 'pending' }, false)).toBe('pending');
  expect(proAccess({ status: 'suspended' }, false)).toBe('suspended');
  expect(proAccess(null, false)).toBe('none');
  expect(proAccess(null, true)).toBe('open');
});

test('a provider is inactive after more than one month (30 days) without activity', () => {
  const now = new Date('2026-11-12T12:00:00Z');
  expect(isInactive('2026-10-12T11:00:00Z', now)).toBe(true);
  expect(isInactive('2026-10-14T12:00:00Z', now)).toBe(false);
});

test('a booking paid by link stays pending until the provider confirms the deposit', () => {
  expect(needsDeposit({ status: 'pending', deposit_paid: false, provider_id: 'p' })).toBe(true);
  expect(needsDeposit({ status: 'confirmed', deposit_paid: true, provider_id: 'p' })).toBe(false);
  expect(needsDeposit({ status: 'pending', deposit_paid: false, provider_id: null })).toBe(false);
});
