import { describe, expect, test } from 'bun:test';
import { slotsForDate, bookableSlots, quote, depositFor, initialStatus, travelFee, DEFAULT_PRICING as P } from '../../supabase/functions/_shared/blade-booking-rules.ts';

const rules = [
  { day_of_week: 4, start_time: '22:00:00', end_time: '00:00:00', is_available: true, mode: 'domicile' },
  { day_of_week: 4, start_time: '10:00:00', end_time: '11:00:00', is_available: true, mode: 'deplacement' },
];
describe('BLADE booking rules', () => {
  test('evening range up to midnight includes 23:30 and respects the mode', () => {
    expect(slotsForDate(rules, [], 'domicile', '2026-11-12')).toEqual(['22:00', '22:30', '23:00', '23:30']);
    expect(slotsForDate(rules, [], 'deplacement', '2026-11-12')).toEqual(['10:00', '10:30']);
  });
  test('a closed day override blocks the mode, a timed override replaces weekly hours', () => {
    expect(slotsForDate(rules, [{ date: '2026-11-12', start_time: null, end_time: null, is_available: false, mode: 'both' }], 'domicile', '2026-11-12')).toEqual([]);
    expect(slotsForDate(rules, [{ date: '2026-11-12', start_time: '14:00', end_time: '15:00', is_available: true, mode: 'domicile' }], 'domicile', '2026-11-12')).toEqual(['14:00', '14:30']);
  });
  test('taken and past slots are not bookable', () => {
    expect(bookableSlots(['10:00', '10:30', '11:00'], ['10:30:00'], '2026-11-12', '2026-11-12', 10 * 60 + 15)).toEqual(['11:00']);
  });
  test('"le client se déplace" uses 10/15/20 € without travel fee and refuses other services', () => {
    expect(quote({ name: 'Coupe classique', price: 20 }, 'domicile', '2026-11-15', '14:00', '2026-11-12', P, 60).total).toBe(15);
    expect(quote({ name: 'Coupe enfant', price: 15 }, 'domicile', '2026-11-13', '14:00', '2026-11-12', P)).toBeNull();
  });
  test('travel mode adds Sunday 10 €, late hour and travel fees', () => {
    const q = quote({ name: 'Coupe + barbe', price: 25 }, 'deplacement', '2026-11-15', '20:00', '2026-11-12', P, 45);
    expect([q.sunday, q.hourly, q.travel, q.total]).toEqual([10, 5, 20, 60]);
  });
  test('travel under 20 minutes is free', () => { expect(travelFee(19, P)).toBe(0); });
  test('deposit is half the total with 10 € minimum under 20 €', () => { expect(depositFor(15)).toBe(10); expect(depositFor(25)).toBe(12.5); });
  test('booking stays pending only when the provider can collect a deposit by link', () => {
    expect(initialStatus({ opt_payment_links: true, revolut_url: 'https://revolut.me/x', stripe_link_url: null })).toBe('pending');
    expect(initialStatus({ opt_payment_links: true, revolut_url: null, stripe_link_url: null })).toBe('confirmed');
    expect(initialStatus({ opt_payment_links: false, revolut_url: 'https://revolut.me/x', stripe_link_url: null })).toBe('confirmed');
  });
});
