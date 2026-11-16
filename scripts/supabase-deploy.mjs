#!/usr/bin/env node
// Déploie une ou plusieurs fonctions edge Supabase depuis supabase/functions/<nom>.
//   node scripts/supabase-deploy.mjs blade-trip blade-booking
// Envoie le dossier de la fonction et le dossier _shared (importé par plusieurs fonctions).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT, api, verifyJwt } from './supabase-api.mjs';

const FN_DIR = join(ROOT, 'supabase/functions');
const list = (dir) => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? list(p) : [p]; });
const isCode = (p) => /\.(ts|js|mjs|json)$/.test(p) && !/_test\.ts$|\.test\.ts$/.test(p);

export async function deploy(name) {
  const dir = join(FN_DIR, name);
  if (!existsSync(join(dir, 'index.ts'))) throw new Error(`supabase/functions/${name}/index.ts introuvable`);
  const shared = join(FN_DIR, '_shared');
  const files = [...list(dir), ...(existsSync(shared) ? list(shared) : [])].filter(isCode);
  const form = new FormData();
  form.append('metadata', JSON.stringify({ name, entrypoint_path: `${name}/index.ts`, verify_jwt: verifyJwt(name) }));
  for (const f of files) form.append('file', new Blob([readFileSync(f)]), relative(FN_DIR, f).replace(/\\/g, '/'));
  const out = await api(`/functions/deploy?slug=${encodeURIComponent(name)}`, { method: 'POST', body: form });
  console.log(`Déployée : ${name} (version ${out?.version ?? '?'}, ${files.length} fichiers, verify_jwt=${verifyJwt(name)})`);
  return out;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('supabase-deploy.mjs')) {
  const names = process.argv.slice(2);
  if (!names.length) { console.log('Usage : node scripts/supabase-deploy.mjs <fonction> [autre-fonction…]'); process.exit(1); }
  try { for (const n of names) await deploy(n); }
  catch (e) { console.error(e instanceof Error ? e.message : e); process.exit(1); }
}
