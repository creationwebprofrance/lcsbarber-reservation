import { describe, expect, test } from 'bun:test';
import { SEARCH_VIEWS, canRequestSlot, slotRequestSchema } from './request-model';

describe('BLADE search and slot requests', () => {
  test('only Carte then Liste, with Carte as the initial view', () => {
    expect(SEARCH_VIEWS).toEqual(['Carte', 'Liste']);
    expect(SEARCH_VIEWS[0]).toBe('Carte');
  });
  test('a request is offered only after a successful load with no slots', () => {
    expect(canRequestSlot(false, null, 0)).toBe(true);
    expect(canRequestSlot(false, null, 1)).toBe(false);
    expect(canRequestSlot(true, null, 0)).toBe(false);
    expect(canRequestSlot(false, 'Failed', 0)).toBe(false);
  });
  const input = { request_id:'11111111-1111-4111-8111-111111111111', client_name:'Test Client', client_email:'test@example.com', mode:'deplacement', requested_date:'2026-11-12', requested_time:'14:30', message:'' };
  test('both requested location modes are accepted', () => {
    expect(slotRequestSchema.safeParse(input).success).toBe(true);
    expect(slotRequestSchema.safeParse({...input, mode:'domicile'}).success).toBe(true);
    expect(slotRequestSchema.safeParse({...input, mode:'other'}).success).toBe(false);
  });
  test('a request needs contact details, a real date and time', () => {
    for (const patch of [{client_name:''},{client_email:'invalid'},{requested_date:'2026-02-30'},{requested_time:'24:30'},{requested_time:''}]) {
      expect(slotRequestSchema.safeParse({...input,...patch}).success).toBe(false);
    }
  });
});