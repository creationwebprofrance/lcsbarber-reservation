import { describe, expect, test } from 'bun:test';
import { bladeRoutes, isBladePath, monthCells, validateLocalValue } from './model';

describe('BLADE isolation and empty interface rules', () => {
  test('only the /blade boundary selects the isolated application', () => {
    expect(isBladePath('/blade')).toBe(true);
    expect(isBladePath('/blade/pro/paiements')).toBe(true);
    expect(isBladePath('/blade-other')).toBe(false);
    expect(isBladePath('/reservation')).toBe(false);
    expect(isBladePath('/')).toBe(false);
  });
  test('all seven client pages, client account and eleven pro pages exist', () => {
    expect(bladeRoutes.filter(path => path.startsWith('/blade/client'))).toHaveLength(8);
    expect(bladeRoutes.filter(path => path.startsWith('/blade/pro'))).toHaveLength(11);
    expect(new Set(bladeRoutes).size).toBe(19);
    expect(bladeRoutes).toContain('/blade/client/confirmation');
    expect(bladeRoutes).toContain('/blade/pro/vehicule');
  });
  test('empty form values remain empty without invented defaults', () => {
    expect(validateLocalValue('', 'email')).toBe('');
    expect(validateLocalValue('', 'number')).toBe('');
  });
  test('local invalid email and negative numeric values are rejected', () => {
    expect(validateLocalValue('invalid', 'email')).not.toBe('');
    expect(validateLocalValue('-1', 'number')).not.toBe('');
    expect(validateLocalValue('12', 'number')).toBe('');
  });
  test('calendar uses actual requested month without invented availability', () => {
    const dates = monthCells(new Date(2026, 9, 7));
    expect(dates.slice(0, 4)).toEqual([null, null, null, 1]);
    expect(dates.filter(value => value !== null)).toHaveLength(31);
    expect(dates.at(-1)).toBe(null);
  });
});