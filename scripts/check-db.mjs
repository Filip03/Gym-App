/**
 * Provjera prije `npm start`: radi li lokalna baza.
 *
 * Bez ovoga se dev server digne normalno, aplikacija se učita, a svaki zahtjev
 * padne sa "Failed to fetch" — poruka koja ne govori ništa o uzroku. Najčešći
 * uzrok je da je neko pokrenuo `npm start` umjesto `npm run start:cloud`, ili
 * da Docker jednostavno nije upaljen.
 *
 * Bolje je stati odmah, sa uputstvom, nego servirati aplikaciju koja ne radi.
 */

const URL = 'http://127.0.0.1:54321/rest/v1/';
const TIMEOUT_MS = 2500;

function box(lines) {
  const width = Math.max(...lines.map(l => [...l].length)) + 2;
  const bar = '─'.repeat(width);
  console.error(`\n┌${bar}┐`);
  for (const l of lines) {
    const pad = ' '.repeat(width - [...l].length - 1);
    console.error(`│ ${l}${pad}│`);
  }
  console.error(`└${bar}┘\n`);
}

try {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  await fetch(URL, { signal: ctrl.signal });
  clearTimeout(timer);
  process.exit(0);
} catch {
  box([
    'Lokalna baza nije pokrenuta.',
    '',
    'Aplikacija bi se učitala, ali bi svaka prijava i svaki',
    'upit pali sa "Failed to fetch".',
    '',
    'Izaberi jedno:',
    '',
    '  npm run db:start      pokreni lokalnu bazu (traži Docker)',
    '  npm run start:cloud   radi protiv prave baze, bez Dockera',
    '',
    'Prvi put:  npm run setup'
  ]);
  process.exit(1);
}
