import { test, expect } from 'bun:test';
import { cityVisits, positiveInterval, revenueByMonth, serviceSchema } from './provider-model';
import { computeDue } from '../lib/vehicle';
test('annual revenue equals twelve months and ignores pending/cancelled bookings', () => {
  const b = [{ id:'a',appointment_date:'2026-01-02',total_price:10.10,status:'confirmed' },{ id:'b',appointment_date:'2026-02-02',total_price:20.20,status:'completed' },{ id:'c',appointment_date:'2026-02-03',total_price:90,status:'pending' },{ id:'d',appointment_date:'2026-02-04',total_price:80,status:'cancelled' }];
  const r = revenueByMonth(b,[],2026); expect(r.total).toBe(30.30); expect(r.months[0].revenue).toBe(10.10); expect(r.months[1].revenue).toBe(20.20); expect(Math.round(r.months.reduce((n,m)=>n+m.revenue,0)*100)).toBe(3030);
});
test('a linked realization cannot count a booking twice', () => { expect(revenueByMonth([{id:'a',appointment_date:'2026-01-02',total_price:20,status:'confirmed'}],[{id:'x',prestation_date:'2026-01-02',amount:20,booking_id:'a'},{id:'y',prestation_date:'2026-01-03',amount:15,booking_id:null}],2026).total).toBe(35); });
test('cities exclude future and cancelled visits and identify confirmed historical proxies', () => { const b = ['completed','confirmed','cancelled'].map((status,i)=>({id:String(i),appointment_date:'2026-01-02',total_price:20,status,client_address:'1 rue X, 95380 Louvres'})); b.push({...b[0],id:'future',appointment_date:'2026-12-01'}); expect(cityVisits(b,'2026-01-01','2026-12-31','2026-10-26')).toEqual([{city:'Louvres',count:2,proxy:1}]); });
test('a travel interval of zero is rejected', () => { expect(positiveInterval.safeParse(0).success).toBe(false); expect(positiveInterval.safeParse(20).success).toBe(true); });
test('services reject negative prices and require positive duration', () => { const s={name:'Coupe',description:null,price:20,duration_minutes:30,is_active:true};expect(serviceSchema.safeParse({...s,price:-1}).success).toBe(false);expect(serviceSchema.safeParse({...s,duration_minutes:0}).success).toBe(false); });
test('recording maintenance moves its next threshold using the existing interval', () => { const rule={id:'r',operation:'Vidange',reference_odometer:10000,interval_km:15000};expect(computeDue(rule,[],12000,false).dueKm).toBe(25000);expect(computeDue(rule,[{rule_id:'r',operation:'Vidange',event_date:'2026-10-26',odometer:25000}],25000,false).dueKm).toBe(40000); });
test('missing maintenance references do not invent an odometer or date', () => { const r=computeDue({id:'r',operation:'Vidange',interval_km:15000},[],null,false); expect(r.dueKm).toBe(null);expect(r.dueDate).toBe(null);expect(r.status).toBe('unknown'); });

import { clientStats } from './provider-model';
test('régularité et panier moyen des clients', () => {
  const today = '2026-11-26';
  const b = (id, date, price, status = 'confirmed') => ({ client_id: id, appointment_date: date, total_price: price, status });
  const list = [
    b('r', '2026-11-20', 30), b('r', '2026-10-15', 20), b('r', '2026-09-01', 25), b('r', '2026-12-10', 99), b('r', '2026-11-01', 50, 'cancelled'),
    b('n', '2026-11-10', 18),
    b('o', '2026-09-01', 20), b('o', '2025-01-01', 40),
    b('x', '2026-05-01', 30),
    b('p', '2026-11-25', 30, 'pending'),
  ];
  const r = clientStats({ id: 'r' }, list, today);
  expect(r).toEqual({ visits: 3, lastVisit: '2026-11-20', spent: 75, avgBasket: 25, tier: 'regulier' });
  expect(clientStats({ id: 'n' }, list, today).tier).toBe('nouveau');
  expect(clientStats({ id: 'o' }, list, today)).toMatchObject({ tier: 'occasionnel', avgBasket: 30 });
  expect(clientStats({ id: 'x' }, list, today).tier).toBe('a_relancer');
  expect(clientStats({ id: 'p' }, list, today)).toMatchObject({ tier: 'jamais', visits: 0, avgBasket: null });
  // Réservation sans client_id : rattachée par e-mail, sans tenir compte de la casse.
  expect(clientStats({ id: 'z', email: 'A@b.fr' }, [{ client_id: null, client_email: ' a@B.fr', appointment_date: '2026-11-01', total_price: 12, status: 'completed' }], today)).toMatchObject({ visits: 1, avgBasket: 12, tier: 'nouveau' });
});
