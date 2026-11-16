import { assert, assertEquals } from 'jsr:@std/assert@1';
import { metersBetween, publicRoute, resolveSite, trimStart, type Pt } from './route.ts';

// ~1.11 km straight line north, 101 points (~11 m apart)
const line: Pt[] = Array.from({ length: 101 }, (_, i) => [2.35, 48.85 + i * 0.0001]);

Deno.test('route starts about 500 m after the departure point', () => {
  const r = trimStart(line, 500);
  assert(Math.abs(metersBetween(line[0], r[0]) - 500) < 1);
  assertEquals(r[r.length - 1], line[100]);
});
Deno.test('route shorter than 500 m reveals only the destination', () => {
  const r = trimStart(line.slice(0, 20), 500);
  assertEquals(r, [line[19], line[19]]);
});
Deno.test('public route never exceeds 400 points', () => {
  const zig: Pt[] = Array.from({ length: 5000 }, (_, i) => [2.35 + i * 0.0002, 48.85 + (i % 2) * 0.001]);
  const r = publicRoute(zig, 500, 400);
  assert(r.length <= 400 && r.length >= 2);
  assertEquals(r[r.length - 1], [Number(zig[4999][0].toFixed(6)), Number(zig[4999][1].toFixed(6))]);
});
Deno.test('email link site allow-list', () => {
  const fb = 'https://lcsbarber-reservation.lovable.app';
  assertEquals(resolveSite('https://lcsbarber-reservation.lovable.app/', fb), 'https://lcsbarber-reservation.lovable.app');
  assertEquals(resolveSite('https://id-preview--abc.lovable.app', fb), 'https://id-preview--abc.lovable.app');
  assertEquals(resolveSite('http://localhost:8080', fb), 'http://localhost:8080');
  assertEquals(resolveSite('https://evil.com', fb), fb);
  assertEquals(resolveSite('https://lovable.app.evil.com', fb), fb);
  assertEquals(resolveSite(undefined, fb), fb);
});
