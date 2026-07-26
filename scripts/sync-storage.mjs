/**
 * Puni lokalni Supabase storage slikama.
 *
 * Migracije prave bucket-e, seed puni tabele — ali fajlovi (slike vježbi,
 * avatari, blog objave) žive izvan baze i moraju se prenijeti posebno.
 *
 * Dva izvora, ovim redom:
 *
 *   1. src/assets/seed-storage/<bucket>/  — slike u repou. Rade bez interneta i
 *      bez pristupa cloud projektu. Ovdje stoje slike vježbi, jer su bezlične i
 *      čine glavninu onoga što se vidi na ekranu.
 *
 *   2. Produkcijski Supabase — za bucket-e kojih nema u repou. Avatari i blog
 *      objave su lične fotografije i NE idu u javni repo, pa se povlače odavde.
 *      Ako projekat spava ili nema interneta, ovaj korak se preskače uz
 *      upozorenje — aplikacija i dalje radi, samo bez tih slika.
 *
 * Pokretanje:  npm run db:storage
 *
 * VAŽNO: "supabase db reset" briše i storage, ne samo tabele. Zato
 * "npm run db:reset" radi oboje.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SEED_DIR = join(ROOT, 'src/assets/seed-storage');
const BUCKETS = ['exercices-pictures', 'profile-pictures', 'blog'];
const LOCAL_URL = process.env.SUPABASE_LOCAL_URL ?? 'http://127.0.0.1:54321';

const MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  avif: 'image/avif', gif: 'image/gif', mp4: 'video/mp4', mov: 'video/quicktime'
};
const mimeOf = name => MIME[name.split('.').pop().toLowerCase()] ?? 'application/octet-stream';

// Ključ lokalnog stacka nije tajna i mijenja se od verzije do verzije CLI-ja,
// pa se čita iz "supabase status" umjesto da se prepisuje ručno.
function localServiceKey() {
  if (process.env.SUPABASE_LOCAL_SERVICE_KEY) return process.env.SUPABASE_LOCAL_SERVICE_KEY;
  try {
    const s = JSON.parse(execSync('npx supabase status -o json', {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
    }));
    return s.SERVICE_ROLE_KEY;
  } catch {
    return null;
  }
}

const key = localServiceKey();
if (!key) {
  console.error('Ne mogu dobiti ključ lokalnog Supabasea. Je li pokrenut?  npm run db:start');
  process.exit(1);
}

const local = createClient(LOCAL_URL, key);

function cloudClient() {
  try {
    const src = readFileSync(join(ROOT, 'src/environments/env.prod.ts'), 'utf8');
    const url = src.match(/supabaseUrl:\s*'([^']+)'/)?.[1];
    const anon = src.match(/supabaseKey:\s*'([^']+)'/)?.[1];
    return url && anon ? createClient(url, anon) : null;
  } catch {
    return null;
  }
}

let copied = 0, skipped = 0;

async function put(bucket, path, body, contentType) {
  const { error } = await local.storage.from(bucket).upload(path, body, {
    upsert: true, contentType
  });
  if (error) throw error;
  copied++;
}

/** Iz repoa — radi offline. */
async function fromRepo(bucket) {
  const dir = join(SEED_DIR, bucket);
  if (!existsSync(dir)) return false;

  const files = readdirSync(dir).filter(f => !f.startsWith('.'));
  if (files.length === 0) return false;

  process.stdout.write(`\n${bucket}  (iz repoa)\n`);
  for (const name of files) {
    await put(bucket, name, readFileSync(join(dir, name)), mimeOf(name));
    process.stdout.write(`  ✓ ${name}\n`);
  }
  return true;
}

/** Iz produkcije — za bucket-e koji nisu u repou. */
async function fromCloud(bucket, cloud) {
  process.stdout.write(`\n${bucket}  (iz produkcije)\n`);

  const listAll = async (prefix = '') => {
    const { data, error } = await cloud.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error) throw error;
    const out = [];
    for (const e of data ?? []) {
      const full = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.id) out.push(full);
      else out.push(...await listAll(full));   // folder
    }
    return out;
  };

  for (const path of await listAll()) {
    const { data: blob, error } = await cloud.storage.from(bucket).download(path);
    if (error) throw error;
    const buf = Buffer.from(await blob.arrayBuffer());
    await put(bucket, path, buf, blob.type || mimeOf(path));
    process.stdout.write(`  ✓ ${path} (${(buf.length / 1024).toFixed(0)} kB)\n`);
  }
}

const cloud = cloudClient();

for (const bucket of BUCKETS) {
  if (await fromRepo(bucket)) continue;

  if (!cloud) {
    process.stdout.write(`\n${bucket}  — preskočeno (nema podataka o produkciji)\n`);
    skipped++;
    continue;
  }

  try {
    await fromCloud(bucket, cloud);
  } catch (err) {
    // Namjerno nije fatalno: produkcijski projekat na besplatnom planu se
    // uspava nakon nekoliko dana neaktivnosti. Aplikacija radi i bez ovih
    // slika — prikažu se prazna mjesta umjesto avatara.
    process.stdout.write(`  ⚠ preskočeno: ${err.message}\n`);
    skipped++;
  }
}

console.log(`\nPreneseno ${copied} fajlova${skipped ? `, ${skipped} bucket(a) preskočeno` : ''}.`);
if (skipped) {
  console.log('Preskočeni bucket-i drže lične fotografije i nisu u repou.');
  console.log('Aplikacija radi i bez njih.');
}
