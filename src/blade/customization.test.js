import { describe, expect, test } from 'bun:test';
import { stepsFor, allowedModes, checkAnswers, quote, DEFAULT_PRICING as P } from '../../supabase/functions/_shared/blade-booking-rules.ts';
import { brandVars, readableOn, nextReward, pointsForAmount, codeFromScan, moveItem, toggleSection, parseOptions } from './customization-model.ts';

describe('Provider booking page settings', () => {
  test('step order follows the provider choice, e.g. date before the prestation', () => {
    expect(stepsFor('service', 'both')).toEqual(['service', 'place', 'date', 'time', 'recap']);
    expect(stepsFor('place', 'both')).toEqual(['place', 'service', 'date', 'time', 'recap']);
    expect(stepsFor('date', 'both')).toEqual(['place', 'date', 'time', 'service', 'recap']);
  });
  test('a provider offering only one place skips the place step', () => {
    expect(allowedModes('domicile')).toEqual(['domicile']);
    expect(allowedModes('both')).toEqual(['domicile', 'deplacement']);
    expect(stepsFor('date', 'deplacement')).toEqual(['date', 'time', 'service', 'recap']);
  });
  const questions = [
    { id: 'q-hair', label: 'Type de cheveux', type: 'choice', required: true, options: ['Lisses', 'Bouclés'] },
    { id: 'q-allergy', label: 'Allergies ?', type: 'yesno', required: false },
  ];
  test('a required question must be answered and choices must match', () => {
    expect(checkAnswers(questions, {}).error).toContain('Type de cheveux');
    expect(checkAnswers(questions, { 'q-hair': 'Crépus' }).error).toContain('invalide');
    expect(checkAnswers(questions, { 'q-hair': 'Bouclés', 'q-allergy': 'Peut-être' }).error).toContain('invalide');
    expect(checkAnswers(questions, { 'q-hair': ' Bouclés ', 'q-allergy': 'Non' }).rows).toEqual([
      { id: 'q-hair', label: 'Type de cheveux', answer: 'Bouclés' }, { id: 'q-allergy', label: 'Allergies ?', answer: 'Non' }]);
  });
  test('other providers use their catalogue price when the client comes to them', () => {
    expect(quote({ name: 'Tresses', price: 45 }, 'domicile', '2026-11-12', '14:00', '2026-11-01', P, 0, null).total).toBe(45);
    expect(quote({ name: 'Tresses', price: 45 }, 'domicile', '2026-11-12', '14:00', '2026-11-01', P)).toBeNull();
  });
});

describe('Provider profile look', () => {
  test('the accent color becomes the primary color, with readable text', () => {
    expect(brandVars('#0A0A0A', 'classique')['--primary']).toBe('0 0% 4%');
    expect(brandVars('#0A0A0A', 'classique')['--primary-foreground']).toBe('0 0% 100%');
    expect(readableOn('#F5D90A')).toBe('dark');
    expect(brandVars('#F5D90A', 'urbaine')['--blade-brand-heading']).toContain('Bebas Neue');
  });
  test('sections can be hidden and reordered', () => {
    expect(moveItem(['services', 'gallery', 'reviews'], 2, -1)).toEqual(['services', 'reviews', 'gallery']);
    expect(toggleSection(['services', 'gallery'], 'gallery')).toEqual(['services']);
    expect(parseOptions('Court, Long, Court, ')).toEqual(['Court', 'Long']);
  });
});

describe('Loyalty card', () => {
  const rewards = [{ id: 'r-b', label: 'Coupe offerte', points: 10 }, { id: 'r-a', label: 'Soin', points: 5 }];
  test('next reward is the cheapest one not reached yet', () => {
    expect(nextReward(3, rewards)).toEqual({ reward: rewards[1], missing: 2, pct: 60 });
    expect(nextReward(7, rewards)?.reward.label).toBe('Coupe offerte');
    expect(nextReward(10, rewards)).toBeNull();
  });
  test('points per euro are rounded down like the server', () => {
    expect(pointsForAmount(19.99, 1)).toBe(19);
    expect(pointsForAmount(25, 0.5)).toBe(12);
    expect(pointsForAmount(0, 1)).toBe(0);
  });
  test('a scanned QR link or pasted code opens the card', () => {
    const code = 'a'.repeat(32) + 'b'.repeat(32);
    expect(codeFromScan(`https://x.app/blade/pro/fidelite?carte=${code}`)).toBe(code);
    expect(codeFromScan(code.toUpperCase())).toBe(code);
    expect(codeFromScan('bonjour')).toBeNull();
  });
});
