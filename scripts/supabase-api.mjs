// Outils Supabase sans CLI (l'exécutable officiel est bloqué sur certains PC Windows).
// Passe par l'API de gestion Supabase avec une clé personnelle rangée dans la variable
// d'environnement SUPABASE_ACCESS_TOKEN (jamais écrite dans le code ni affichée).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/** Identifiant du projet, lu dans supabase/config.toml. */
export function projectRef() {
  const m = /^project_id\s*=\s*"([^"]+)"/m.exec(readFileSync(join(ROOT, 'supabase/config.toml'), 'utf8'));
  if (!m) throw new Error('project_id introuvable dans supabase/config.toml');
  return m[1];
}

/** Clé d'accès : variable du processus, sinon variable utilisateur Windows (sans redémarrage). */
export function accessToken() {
  let t = process.env.SUPABASE_ACCESS_TOKEN;
  if (!t && process.platform === 'win32') {
    try {
      const out = execFileSync('reg', ['query', 'HKCU\\Environment', '/v', 'SUPABASE_ACCESS_TOKEN'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      t = /SUPABASE_ACCESS_TOKEN\s+REG_\w+\s+(\S+)/.exec(out)?.[1];
    } catch { /* variable absente */ }
  }
  if (!t) throw new Error('SUPABASE_ACCESS_TOKEN manquant. Crée une clé sur https://supabase.com/dashboard/account/tokens et range-la dans tes variables d’environnement.');
  return t;
}

export async function api(path, init = {}) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef()}${path}`, {
    ...init, headers: { Authorization: `Bearer ${accessToken()}`, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let body; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) throw new Error(`API Supabase ${res.status} : ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  return body;
}

/** Exécute du SQL sur la base du projet. */
export const runSql = (query) => api('/database/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });

/** verify_jwt d'une fonction, lu dans supabase/config.toml (true par défaut, comme la CLI). */
export function verifyJwt(name) {
  const toml = readFileSync(join(ROOT, 'supabase/config.toml'), 'utf8');
  const block = new RegExp(`\\[functions\\.${name.replace(/[-]/g, '\\-')}\\]([^\\[]*)`).exec(toml)?.[1] ?? '';
  const m = /verify_jwt\s*=\s*(true|false)/.exec(block);
  return m ? m[1] === 'true' : true;
}
