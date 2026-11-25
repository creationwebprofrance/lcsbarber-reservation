import { describe, expect, test } from 'bun:test';
import { daySummary, emptyWeek, rangeError, rulesFromWeek, weekError, weekFromRules } from './hours-model';

describe('horaires du prestataire', () => {
  test('aller-retour semaine ↔ lignes', () => {
    const rules = [{ day_of_week: 2, start_time: '14:00:00', end_time: '19:00:00', mode: 'both' }, { day_of_week: 2, start_time: '09:00', end_time: '12:00', mode: 'domicile' }];
    const week = weekFromRules(rules);
    expect(week[2].map(r => r.start_time)).toEqual(['09:00', '14:00']);
    expect(rulesFromWeek(week)).toEqual([{ day_of_week: 2, start_time: '09:00', end_time: '12:00', mode: 'domicile' }, { day_of_week: 2, start_time: '14:00', end_time: '19:00', mode: 'both' }]);
  });
  test('mode inconnu ramené à both, jour invalide ignoré', () => {
    const week = weekFromRules([{ day_of_week: 9, start_time: '09:00', end_time: '10:00', mode: 'x' }, { day_of_week: 0, start_time: '09:00', end_time: '10:00', mode: 'x' }]);
    expect(week[0][0].mode).toBe('both');
    expect(rulesFromWeek(week).length).toBe(1);
  });
  test('plages invalides', () => {
    expect(rangeError({ start_time: '10:00', end_time: '09:00', mode: 'both' })).not.toBe('');
    expect(rangeError({ start_time: '10:00', end_time: '10:15', mode: 'both' })).not.toBe('');
    expect(rangeError({ start_time: '', end_time: '10:00', mode: 'both' })).not.toBe('');
    expect(rangeError({ start_time: '09:17', end_time: '10:00', mode: 'both' })).toContain('demi-heure');
    expect(rangeError({ start_time: '20:00', end_time: '00:00', mode: 'both' })).toBe('');
  });
  test('chevauchement refusé sauf publics différents', () => {
    const w = emptyWeek();
    w[1] = [{ start_time: '09:00', end_time: '12:00', mode: 'both' }, { start_time: '11:00', end_time: '13:00', mode: 'domicile' }];
    expect(weekError(w)).toContain('chevauchent');
    w[1] = [{ start_time: '09:00', end_time: '12:00', mode: 'deplacement' }, { start_time: '11:00', end_time: '13:00', mode: 'domicile' }];
    expect(weekError(w)).toBe('');
  });
  test('résumé', () => {
    expect(daySummary([])).toBe('Fermé');
    expect(daySummary([{ start_time: '09:00', end_time: '12:00', mode: 'both' }])).toBe('09:00–12:00');
  });
});
