#!/usr/bin/env node
/**
 * Applique un ou plusieurs fichiers SQL à la base Supabase.
 *
 * Usage :
 *   node apply_migration.js <fichier.sql> [autres.sql ...] [options]
 *
 * Options :
 *   --dry-run   Exécute tout puis ROLLBACK : valide la migration sans rien modifier.
 *   --no-tx     Exécute hors transaction (obligatoire pour CREATE INDEX CONCURRENTLY).
 *   --help      Affiche cette aide.
 *
 * Connexion (par ordre de priorité) :
 *   1. SUPABASE_DB_URL            URL complète (recommandé)
 *   2. DATABASE_URL               autre URL complète (compat. .env.example)
 *   3. SUPABASE_DB_HOST + SUPABASE_DB_PASSWORD
 *      [+ SUPABASE_DB_PORT, SUPABASE_DB_USER, SUPABASE_DB_NAME, SUPABASE_PROJECT_REF]
 *
 * Les variables sont lues dans l'environnement puis dans le fichier .env
 * à la racine du projet.
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const { Client } = require('pg');

const USAGE = `
Applique un ou plusieurs fichiers SQL à la base Supabase.

  node apply_migration.js <fichier.sql> [autres.sql ...] [options]

Options
  --dry-run   Exécute puis ROLLBACK (aucune modification persistée)
  --no-tx     Hors transaction (pour CREATE INDEX CONCURRENTLY)
  --help      Affiche cette aide

Connexion (.env à la racine, ou variables d'environnement)
  SUPABASE_DB_URL=postgresql://postgres.<ref>:<mdp>@aws-0-<region>.pooler.supabase.com:5432/postgres
`.trim();

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const files = [];
  const options = { dryRun: false, noTx: false, help: false };

  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--no-tx') options.noTx = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg.startsWith('-')) {
      throw new Error(`Option inconnue : ${arg}`);
    } else files.push(arg);
  }

  return { files, options };
}

// ---------------------------------------------------------------------------
// Connexion
// ---------------------------------------------------------------------------

function isLocal(host) {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(String(host || '').toLowerCase());
}

function resolveConnection() {
  const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (url) {
    const parsed = new URL(url);
    return {
      config: {
        connectionString: url,
        ssl: isLocal(parsed.hostname) ? false : { rejectUnauthorized: false },
      },
      target: {
        host: parsed.hostname,
        port: parsed.port || '5432',
        database: decodeURIComponent(parsed.pathname.replace(/^\//, '')) || 'postgres',
        user: decodeURIComponent(parsed.username),
      },
    };
  }

  const host = process.env.SUPABASE_DB_HOST;
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!host || !password) {
    throw new Error(
      'Connexion non configurée.\n' +
        'Renseignez SUPABASE_DB_URL dans .env, par exemple :\n' +
        '  SUPABASE_DB_URL=postgresql://postgres.<project-ref>:<mot-de-passe>@aws-0-<region>.pooler.supabase.com:5432/postgres\n' +
        '(le host db.<project-ref>.supabase.co est IPv6 uniquement ; le pooler est IPv4)'
    );
  }

  const projectRef = process.env.SUPABASE_PROJECT_REF;
  const user = process.env.SUPABASE_DB_USER || (projectRef ? `postgres.${projectRef}` : 'postgres');
  const port = Number(process.env.SUPABASE_DB_PORT || 5432);
  const database = process.env.SUPABASE_DB_NAME || 'postgres';

  return {
    config: {
      host,
      port,
      user,
      password,
      database,
      ssl: isLocal(host) ? false : { rejectUnauthorized: false },
    },
    target: { host, port, database, user },
  };
}

// ---------------------------------------------------------------------------
// Affichage des erreurs PostgreSQL
// ---------------------------------------------------------------------------

function printPgError(err, sql, file) {
  console.error(`\n❌ Échec : ${file}`);
  console.error(`   code    : ${err.code || '—'}`);
  console.error(`   message : ${err.message}`);
  if (err.detail) console.error(`   détail  : ${err.detail}`);
  if (err.hint) console.error(`   hint    : ${err.hint}`);

  if (err.position) {
    const pos = Number(err.position);
    const before = sql.slice(0, pos);
    const line = before.split('\n').length;
    const col = pos - before.lastIndexOf('\n');
    console.error(`   position: ligne ${line}, colonne ${col}`);

    const lines = sql.split('\n');
    const from = Math.max(0, line - 5);
    const to = Math.min(lines.length, line + 4);
    console.error('\n   ...');
    for (let i = from; i < to; i += 1) {
      const marker = i === line - 1 ? '>' : ' ';
      console.error(`   ${marker} ${String(i + 1).padStart(4)} | ${lines[i]}`);
    }
    console.error('   ...\n');
  }
}

// ---------------------------------------------------------------------------
// Programme principal
// ---------------------------------------------------------------------------

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`\n❌ ${err.message}\n\n${USAGE}`);
    process.exit(1);
  }

  const { files, options } = parsed;

  if (options.help || files.length === 0) {
    console.log(USAGE);
    process.exit(files.length === 0 && !options.help ? 1 : 0);
  }

  // Lecture préalable de tous les fichiers : on échoue avant de toucher la base.
  const scripts = files.map((file) => {
    const absolute = path.resolve(process.cwd(), file);
    if (!fs.existsSync(absolute)) {
      console.error(`\n❌ Fichier introuvable : ${file}`);
      process.exit(1);
    }
    const sql = fs.readFileSync(absolute, 'utf8');
    if (!sql.trim()) {
      console.error(`\n❌ Fichier vide : ${file}`);
      process.exit(1);
    }
    return { file, sql };
  });

  let connection;
  try {
    connection = resolveConnection();
  } catch (err) {
    console.error(`\n❌ ${err.message}`);
    process.exit(1);
  }

  const { config, target } = connection;
  const client = new Client({ ...config, application_name: 'zero-mata-migrate', connectionTimeoutMillis: 15000 });

  console.log('→ Cible    :', `${target.user}@${target.host}:${target.port}/${target.database}`);
  console.log('→ Mode     :', options.dryRun ? 'DRY-RUN (rollback à la fin)' : options.noTx ? 'SANS transaction' : 'transactionnel');
  console.log('→ Fichiers :', scripts.map((s) => s.file).join(', '));

  try {
    await client.connect();
  } catch (err) {
    console.error(`\n❌ Connexion impossible : ${err.message}`);
    process.exit(1);
  }

  const startedAt = Date.now();
  let current = null;

  try {
    await client.query("SET statement_timeout = '180s'");
    if (!options.noTx) await client.query('BEGIN');

    for (const script of scripts) {
      current = script;
      const size = `${Math.round(script.sql.length / 1024)} Ko`;
      const t0 = Date.now();
      const result = await client.query(script.sql);
      const ms = Date.now() - t0;
      console.log(`   ✓ ${script.file} (${size}, ${ms} ms)`);

      // Si le dernier statement renvoie des lignes (ex. requête de contrôle), on l'affiche.
      if (Array.isArray(result) && result.length > 0) {
        const last = result[result.length - 1];
        if (last && Array.isArray(last.rows) && last.rows.length > 0) {
          console.log('   ↳ résultat :', JSON.stringify(last.rows).slice(0, 1000));
        }
      }
    }

    if (options.noTx) {
      console.log('\n✅ Succès (sans transaction)');
    } else if (options.dryRun) {
      await client.query('ROLLBACK');
      console.log('\n✅ DRY-RUN réussi — ROLLBACK effectué, aucune modification persistée');
    } else {
      await client.query('COMMIT');
      console.log('\n✅ Migration(s) appliquée(s)');
      try {
        await client.query("NOTIFY pgrst, 'reload schema'");
        console.log('   ↳ cache de schéma PostgREST rechargé');
      } catch {
        // non bloquant
      }
    }

    console.log(`   durée totale : ${((Date.now() - startedAt) / 1000).toFixed(1)} s`);
  } catch (err) {
    if (!options.noTx) {
      try {
        await client.query('ROLLBACK');
        console.log('\n↩︎ ROLLBACK effectué — aucune modification persistée');
      } catch {
        // la connexion est peut-être déjà perdue
      }
    }
    printPgError(err, current ? current.sql : '', current ? current.file : '—');
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error('\n❌ Erreur inattendue :', err.message);
  process.exit(1);
});
