// Whale Scopes – automatic update from SEC 13F filings.
// Reads config/investors.json, compares each investor's two latest 13F filings,
// finds the biggest buy and sell above that investor's threshold, and updates
// docs/trades.json. A card is only replaced by a move from a NEWER quarter that
// also clears the threshold – otherwise the old big move stays.
//
// Needs Node 18+ (built-in fetch). No packages to install.
// Env: SEC_USER_AGENT (required, e.g. "Whale Scopes you@example.com")
//      OPENFIGI_KEY   (optional, only makes ticker lookups faster)

import { readFile, writeFile } from 'node:fs/promises';

const ROOT = process.env.WS_ROOT ? new URL('file://' + process.env.WS_ROOT.replace(/\/?$/, '/')) : new URL('..', import.meta.url);
const CONFIG = new URL('config/investors.json', ROOT);
const OUT = new URL('docs/trades.json', ROOT);
const UA = process.env.SEC_USER_AGENT;
const BIG_MULTIPLE = 5; // an increase/reduction this many times the threshold is labelled BIG BUY / BIG SELL

if (!UA) {
  console.error('SEC_USER_AGENT is missing. Set it to e.g. "Whale Scopes you@example.com".');
  process.exit(1);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const pad = cik => String(cik).replace(/^0+/, '').padStart(10, '0');
const strip = cik => String(cik).replace(/^0+/, '');

async function sec(url, as = 'json') {
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(200); // SEC allows max 10 requests/second
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return as === 'json' ? res.json() : res.text();
    if (res.status === 429 || res.status >= 500) { await sleep(3000 * (attempt + 1)); continue; }
    throw new Error(`SEC ${res.status} for ${url}`);
  }
  throw new Error(`SEC kept failing for ${url}`);
}

// ---------- reading filings ----------
async function listFilings(cik) {
  const sub = await sec(`https://data.sec.gov/submissions/CIK${pad(cik)}.json`);
  const r = sub.filings.recent;
  const out = [];
  for (let i = 0; i < r.form.length; i++) {
    if (r.form[i] === '13F-HR') out.push({ cik: strip(cik), acc: r.accessionNumber[i], filed: r.filingDate[i], period: r.reportDate[i] });
  }
  return out;
}

function tag(block, name) {
  const m = block.match(new RegExp(`<(?:\\w+:)?${name}>([\\s\\S]*?)</(?:\\w+:)?${name}>`, 'i'));
  return m ? m[1].trim() : '';
}
const unescapeXml = s => s.replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

export function parseInfoTable(xml) {
  const rows = [];
  const re = /<(?:\w+:)?infoTable>([\s\S]*?)<\/(?:\w+:)?infoTable>/gi;
  let m;
  while ((m = re.exec(xml))) {
    const b = m[1];
    if (tag(b, 'sshPrnamtType').toUpperCase() !== 'SH') continue; // skip bonds
    rows.push({
      issuer: unescapeXml(tag(b, 'nameOfIssuer')),
      cusip: tag(b, 'cusip').toUpperCase(),
      value: Number(tag(b, 'value').replace(/,/g, '')) || 0,     // US$ (filings since 2023)
      shares: Number(tag(b, 'sshPrnamt').replace(/,/g, '')) || 0,
      putCall: tag(b, 'putCall').toLowerCase()                    // '', 'put' or 'call'
    });
  }
  return rows;
}

async function holdings(f) {
  const dir = f.acc.replace(/-/g, '');
  const base = `https://www.sec.gov/Archives/edgar/data/${f.cik}/${dir}/`;
  const idx = await sec(base + 'index.json');
  const xmls = idx.directory.item.map(i => i.name).filter(n => /\.xml$/i.test(n) && !/primary_doc/i.test(n));
  for (const name of xmls) {
    const txt = await sec(base + name, 'text');
    if (/infoTable>/i.test(txt)) return parseInfoTable(txt);
  }
  return [];
}

// Combine all share classes of one company (e.g. Alphabet A + C); options stay separate.
const normName = s => s.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
function aggregate(rows) {
  const g = new Map();
  for (const r of rows) {
    const k = r.cusip.slice(0, 6) + '|' + (r.putCall || 'sh');
    const x = g.get(k) || { issuer: r.issuer, putCall: r.putCall, cusips: new Set(), value: 0, shares: 0 };
    x.cusips.add(r.cusip); x.value += r.value; x.shares += r.shares;
    g.set(k, x);
  }
  return g;
}

async function portfolioFor(inv, filings, period) {
  // latest filing per CIK for that quarter, all CIKs added together
  const latest = new Map();
  for (const f of filings.filter(f => f.period === period)) {
    const cur = latest.get(f.cik);
    if (!cur || f.filed > cur.filed) latest.set(f.cik, f);
  }
  const rows = [];
  for (const f of latest.values()) rows.push(...await holdings(f));
  const filedList = [...latest.values()];
  return { groups: aggregate(rows), filing: filedList.sort((a, b) => b.filed.localeCompare(a.filed))[0] };
}

// ---------- turning two quarters into moves ----------
const fmtShares = n => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M'
  : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n);

export function findMoves(inv, curG, prevG) {
  const best = { buy: null, sell: null };
  for (const k of new Set([...curG.keys(), ...prevG.keys()])) {
    const c = curG.get(k), p = prevG.get(k);
    const cs = c ? c.shares : 0, ps = p ? p.shares : 0, d = cs - ps;
    if (!d) continue;
    const pc = (c || p).putCall;
    if (pc && !inv.options) continue;

    let side;
    if (!pc) side = d > 0 ? 'buy' : 'sell';
    else if (d > 0) side = pc === 'put' ? 'sell' : 'buy'; // only new/added options count
    else continue;

    const price = cs > 0 ? c.value / cs : p.value / ps;   // exits use last known price
    const amount = ps === 0 && !pc ? c.value : Math.abs(d) * price;
    const pct = ps ? Math.round((d / ps) * 100) : null;

    let label, note, valueType = pc ? 'notional' : 'estimate';
    if (pc === 'put') {
      label = 'BET AGAINST';
      note = `Put options on ${fmtShares(cs)} shares — a bet the stock falls. Value is notional, not money paid.`;
    } else if (ps === 0) {
      label = 'NEW POSITION';
      note = pc ? `New call options on ${fmtShares(cs)} shares. Value is notional, not money paid.` : `A brand-new stake of ${fmtShares(cs)} shares.`;
      if (!pc) valueType = 'position';
    } else if (cs === 0) {
      label = 'BIG SELL';
      note = `Entire stake sold (${fmtShares(ps)} shares).`;
    } else if (d > 0) {
      label = amount >= BIG_MULTIPLE * inv.threshold ? 'BIG BUY' : 'POSITION INCREASE';
      note = `Reported holdings up ${pct}% (+${fmtShares(d)} shares).` + (pc ? ' Value is notional, not money paid.' : '');
    } else {
      label = amount >= BIG_MULTIPLE * inv.threshold ? 'BIG SELL' : 'POSITION REDUCTION';
      note = `Reported holdings cut by ${-pct}% (−${fmtShares(-d)} shares).`;
    }

    if (amount < inv.threshold) continue;
    if (!best[side] || amount > best[side].value) {
      best[side] = { side, label, issuer: (c || p).issuer, putCall: pc, cusips: [...(c || p).cusips], value: Math.round(amount), valueType, note };
    }
  }
  return best;
}

// ---------- names and tickers ----------
const SMALL = { INC: 'Inc.', CORP: 'Corp.', CO: 'Co.', LTD: 'Ltd.', PLC: 'plc', HLDGS: 'Holdings', HLDG: 'Holding', GRP: 'Group', INTL: 'International', TECHNOLOGIES: 'Technologies' };
function prettyName(s) {
  return s.split(/\s+/).map(w => {
    const u = w.toUpperCase().replace(/[.,]/g, '');
    if (SMALL[u]) return SMALL[u];
    if (/^[A-Z]{1,3}$/.test(u) && !/[AEIOU]/.test(u)) return u; // abbreviations like "NY", "JPM"
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ').replace(/\s*&\s*/g, ' & ');
}

async function lookupTickers(cusips) {
  const out = {};
  for (let i = 0; i < cusips.length; i += 10) {
    const batch = cusips.slice(i, i + 10);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (process.env.OPENFIGI_KEY) headers['X-OPENFIGI-APIKEY'] = process.env.OPENFIGI_KEY;
      const res = await fetch('https://api.openfigi.com/v3/mapping', {
        method: 'POST', headers,
        body: JSON.stringify(batch.map(c => ({ idType: 'ID_CUSIP', idValue: c, exchCode: 'US' })))
      });
      if (!res.ok) throw new Error('OpenFIGI ' + res.status);
      const data = await res.json();
      data.forEach((d, j) => { const t = d.data && d.data[0] && d.data[0].ticker; if (t) out[batch[j]] = t; });
    } catch (e) { console.warn('Ticker lookup failed (names are still shown):', e.message); }
    await sleep(2500);
  }
  return out;
}

// ---------- main ----------
async function main() {
  const { investors } = JSON.parse(await readFile(CONFIG, 'utf8'));
  let state = { trades: [] };
  try { state = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* first run */ }
  const now = new Date().toISOString();
  const candidates = [];
  const errors = [];

  for (const inv of investors) {
    try {
      const filings = [];
      for (const cik of inv.ciks) {
        try { filings.push(...await listFilings(cik)); }
        catch (e) { console.warn(`${inv.name}: CIK ${cik} skipped (${e.message})`); }
      }
      if (!filings.length) throw new Error('no filings found for any CIK');
      const periods = [...new Set(filings.map(f => f.period))].sort().reverse();
      if (periods.length < 2) { console.log(`${inv.name}: not enough filings yet`); continue; }
      const cur = await portfolioFor(inv, filings, periods[0]);
      const prev = await portfolioFor(inv, filings, periods[1]);
      const moves = findMoves(inv, cur.groups, prev.groups);
      for (const m of Object.values(moves)) {
        if (!m) continue;
        const dir = cur.filing.acc.replace(/-/g, '');
        candidates.push(Object.assign(m, {
          investor: inv.id, disclosed: cur.filing.filed, asOf: periods[0],
          source: `https://www.sec.gov/Archives/edgar/data/${cur.filing.cik}/${dir}/`
        }));
      }
      console.log(`${inv.name}: quarter ${periods[0]} vs ${periods[1]} → buy ${moves.buy ? moves.buy.issuer : '–'}, sell ${moves.sell ? moves.sell.issuer : '–'}`);
    } catch (e) {
      console.error(`${inv.name}: ${e.message} (keeping old data)`);
      errors.push(inv.id);
    }
  }

  // tickers for the chosen moves only
  const tickers = await lookupTickers([...new Set(candidates.flatMap(c => c.cusips))]);
  for (const c of candidates) {
    const t = [...new Set(c.cusips.map(x => tickers[x]).filter(Boolean))];
    c.ticker = t.join(' · ') + (c.putCall ? ` (${c.putCall} options)` : '');
    c.company = prettyName(c.issuer) + (c.putCall ? ` (${c.putCall} options)` : '');
    delete c.issuer; delete c.cusips; delete c.putCall;
  }

  // the rule: newer quarter AND above threshold replaces; same quarter refreshes quietly; else keep
  const byId = Object.fromEntries(investors.map(i => [i.id, i]));
  const cards = new Map();
  for (const t of state.trades || []) {
    if (byId[t.investor] && t.value >= byId[t.investor].threshold) cards.set(t.investor + ':' + t.side, t);
  }
  let changed = 0;
  for (const c of candidates) {
    const key = c.investor + ':' + c.side;
    const cur = cards.get(key);
    if (!cur || c.asOf > cur.asOf) { cards.set(key, Object.assign(c, { addedAt: now, auto: true })); changed++; }
    else if (c.asOf === cur.asOf) cards.set(key, Object.assign(c, { addedAt: cur.addedAt || null, auto: true }));
  }

  const out = {
    lastChecked: now,
    investors: investors.map(({ id, name, sub, initials, threshold }) => ({ id, name, sub, initials, threshold })),
    trades: [...cards.values()]
  };
  await writeFile(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log(`Done. ${changed} new big move(s). ${errors.length ? 'Errors for: ' + errors.join(', ') : ''}`);
  if (errors.length === investors.length) process.exit(1);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) main();
