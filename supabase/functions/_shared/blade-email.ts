// Shared BLADE email helpers: black & white layout, HTML escaping, Resend delivery.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const BLADE_SENDER = 'BLADE <noreply@lookware.fr>';
export const BLADE_SITE = 'https://lcsbarber-reservation.lovable.app/blade';

export const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));

export function frDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
}

export function layout(title: string, bodyHtml: string, cta?: { label: string; url: string }) {
  const button = cta ? `<p style="margin:28px 0 8px"><a href="${esc(cta.url)}" style="background:#0a0a0a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block">${esc(cta.label)}</a></p>` : '';
  return `<!doctype html><html><body style="margin:0;background:#f4f4f4;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#171717">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e5e5e5;border-radius:16px" cellspacing="0" cellpadding="0">
<tr><td style="padding:22px 28px;border-bottom:1px solid #e5e5e5;font-weight:800;letter-spacing:4px;font-size:18px">BLADE</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${esc(title)}</h1>
<div style="font-size:15px;line-height:1.6;color:#262626">${bodyHtml}</div>${button}
</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #e5e5e5;font-size:12px;color:#737373">Email automatique envoyé par BLADE. Merci de ne pas répondre directement.</td></tr>
</table></td></tr></table></body></html>`;
}

export function detailRows(rows: [string, string][]) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;margin:16px 0;border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#737373;width:40%">${esc(k)}</td><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-weight:600">${esc(v)}</td></tr>`).join('')}</table>`;
}

export async function sendEmail(to: string[], subject: string, html: string, idempotencyKey?: string, replyTo?: string): Promise<boolean> {
  const key = Deno.env.get('RESEND_API_KEY');
  const recipients = [...new Set(to.filter(Boolean).map(e => e.toLowerCase()))];
  if (!key || !recipients.length) return false;
  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey.slice(0, 256);
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers,
    body: JSON.stringify({ from: BLADE_SENDER, to: recipients, subject: subject.slice(0, 150), html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  }).catch(() => null);
  if (!r?.ok) { console.error('Resend failed', r?.status, await r?.text().catch(() => '')); return false; }
  return true;
}

export async function superadminEmails(db: SupabaseClient): Promise<string[]> {
  const { data } = await db.from('user_roles').select('user_id').eq('role', 'superadmin');
  const out: string[] = [];
  for (const row of data ?? []) {
    const { data: u } = await db.auth.admin.getUserById(row.user_id);
    if (u?.user?.email) out.push(u.user.email);
  }
  return out;
}
