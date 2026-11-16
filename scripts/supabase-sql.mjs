#!/usr/bin/env node
// Applique un fichier SQL (ex. une migration) ou une requête sur la base Supabase du projet.
//   node scripts/supabase-sql.mjs supabase/migrations/20261117_xxx.sql
//   node scripts/supabase-sql.mjs --query "select count(*) from blade_trips"
// Une migration appliquée ici est aussi enregistrée dans l'historique Supabase,
// pour que l'historique reste cohérent avec le dossier supabase/migrations.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { runSql } from './supabase-api.mjs';

const args = process.argv.slice(2);
const qi = args.indexOf('--query');
try {
  if (qi >= 0) {
    console.log(JSON.stringify(await runSql(args[qi + 1]), null, 2));
  } else if (args[0]) {
    const file = args[0];
    const sql = readFileSync(file, 'utf8');
    const version = /^(\d{14})/.exec(basename(file))?.[1];
    if (version) {
      const done = await runSql(`select 1 from supabase_migrations.schema_migrations where version = '${version}'`);
      if (Array.isArray(done) && done.length) { console.log(`Déjà appliquée : ${basename(file)}`); process.exit(0); }
    }
    await runSql(sql);
    if (version) {
      const name = basename(file, '.sql').slice(15).replace(/'/g, "''");
      await runSql(`insert into supabase_migrations.schema_migrations(version, name) values ('${version}', '${name}') on conflict do nothing`);
    }
    console.log(`Appliquée : ${basename(file)}`);
  } else {
    console.log('Usage : node scripts/supabase-sql.mjs <fichier.sql> | --query "<sql>"');
    process.exit(1);
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
