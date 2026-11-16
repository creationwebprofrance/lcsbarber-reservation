import { describe, expect, test } from 'bun:test';
import { MAX_ESTIMATED_PROGRESS, cumulative, estimatedProgress, etaMs, haversine, minutesLeft, pointAt } from './trip-model';

const route = [[2.35, 48.85], [2.36, 48.85], [2.36, 48.86]];
const trip = (over = {}) => ({ status: 'en_route', started_at: '2026-11-16T10:00:00.000Z', duration_s: 1200, delay_min: 0, ...over });
const at = (min) => Date.parse('2026-11-16T10:00:00.000Z') + min * 60000;

describe('trajet estimé', () => {
  test('la distance entre deux points connus est réaliste', () => {
    const d = haversine([2.35, 48.85], [2.36, 48.85]);
    expect(d).toBeGreaterThan(700); expect(d).toBeLessThan(760);
  });
  test('le point à mi-chemin est sur le tracé, au bon endroit', () => {
    const cum = cumulative(route); const half = cum[cum.length - 1] / 2;
    const { point } = pointAt(route, 0.5, cum);
    const fromStart = haversine(route[0], [point[0], route[0][1]]) + haversine([point[0], route[0][1]], point);
    expect(Math.abs(fromStart - half)).toBeLessThan(5);
    expect(pointAt(route, 0).point).toEqual(route[0]);
    expect(pointAt(route, 1).point[1]).toBeCloseTo(48.86, 6);
  });
  test('l’avancement suit le temps et les retards, sans jamais annoncer l’arrivée tout seul', () => {
    expect(estimatedProgress(trip(), at(0))).toBe(0);
    expect(estimatedProgress(trip(), at(10))).toBeCloseTo(0.5, 5);
    expect(estimatedProgress(trip({ delay_min: 20 }), at(20))).toBeCloseTo(0.5, 5);
    expect(estimatedProgress(trip(), at(60))).toBe(MAX_ESTIMATED_PROGRESS);
    expect(estimatedProgress(trip({ status: 'arrived' }), at(5))).toBe(1);
  });
  test('heure d’arrivée et minutes restantes', () => {
    expect(etaMs(trip({ delay_min: 10 }))).toBe(at(30));
    expect(minutesLeft(trip(), at(5))).toBe(15);
    expect(minutesLeft(trip(), at(45))).toBe(0);
    expect(minutesLeft(trip({ status: 'arrived' }), at(5))).toBe(0);
  });
});
