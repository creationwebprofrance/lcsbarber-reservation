import { z } from 'zod';

// Enable only after accepting the staged schema and authorizing server deployment.
export const SLOT_REQUESTS_ACTIVE = false;
export const SEARCH_VIEWS = ['Carte', 'Liste'];
export const canRequestSlot = (loading: boolean, error: string | null, count: number) => !loading && !error && count === 0;
export const slotRequestSchema = z.object({
  request_id: z.string().uuid(),
  client_name: z.string().trim().min(2).max(100),
  client_email: z.string().trim().email().max(255),
  mode: z.enum(['domicile', 'deplacement']),
  requested_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d = new Date(`${v}T12:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v; }, 'Date invalide'),
  requested_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  message: z.string().trim().max(1000).default(''),
});
export type SlotRequestInput = z.infer<typeof slotRequestSchema>;