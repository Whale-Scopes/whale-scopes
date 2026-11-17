// Whale Scopes – schreibt die Karten fertig ins HTML (für Google & Co.)
// und aktualisiert die Sitemap. Läuft täglich nach update.mjs.
// Nutzt dieselben Karten-Funktionen wie der Browser (docs/common.js, docs/cards.js).
// Keine Pakete nötig, Node 18+.

import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';

const ROOT = process.env.WS_ROOT ? new URL('file://' + process.env.WS_ROOT.replace(/\/?$/, '/')) : new URL('..', import.meta.url);
const docs = name => new URL('docs/' + name, ROOT);
const SITE = 'https://whale-scopes.com/';

// Browser-Skripte in einer abgeschotteten Umgebung laden
const ctx = vm.createContext({ console });
for (const f of ['common.js', 'cards.js']) vm.runInContext(await readFile(docs(f), 'utf8'), ctx, { filename: f });
const { WSCards } = vm.runInContext('({ WSCards })', ctx);

const json = async f => JSON.parse(await readFile(docs(f), 'utf8'));
const trades = await json('trades.json');
const brokers = await json('brokers.json');
const politicians = await json('politicians.json');

// Inhalt zwischen <!-- PRERENDER:name --> und <!-- /PRERENDER:name --> ersetzen
function fill(html, name, content) {
  const re = new RegExp(`(<!-- PRERENDER:${name} -->)[\\s\\S]*?(<!-- /PRERENDER:${name} -->)`);
  if (!re.test(html)) throw new Error(`Marker PRERENDER:${name} fehlt`);
  return html.replace(re, (_, a, b) => a + content + b);
}

async function update(file, parts) {
  const before = await readFile(docs(file), 'utf8');
  let after = before;
  for (const [name, content] of Object.entries(parts)) after = fill(after, name, content);
  if (after !== before) { await writeFile(docs(file), after); console.log(`${file}: aktualisiert`); }
  else console.log(`${file}: unverändert`);
}

await update('index.html', {
  status: WSCards.investorStatus(trades),
  buys: WSCards.investorSide(trades, brokers, 'buy'),
  sells: WSCards.investorSide(trades, brokers, 'sell')
});

await update('politiker.html', {
  updated: WSCards.politicianUpdated(politicians),
  buys: WSCards.politicianGrid(politicians, brokers)
});

// Sitemap: "zuletzt geändert" = neueste Datenänderung
const day = d => (d || '').slice(0, 10);
const newestTrade = (trades.trades || []).map(t => day(t.addedAt)).filter(Boolean).sort().pop();
const indexMod = newestTrade || day(trades.lastChecked) || new Date().toISOString().slice(0, 10);
const polMod = day(politicians.lastUpdated) || indexMod;
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}</loc><lastmod>${indexMod}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>${SITE}politiker.html</loc><lastmod>${polMod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
</urlset>
`;
let old = '';
try { old = await readFile(docs('sitemap.xml'), 'utf8'); } catch {}
if (old !== sitemap) { await writeFile(docs('sitemap.xml'), sitemap); console.log('sitemap.xml: aktualisiert'); }
