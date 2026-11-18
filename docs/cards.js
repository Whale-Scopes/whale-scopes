/* Whale Scopes – Karten für Investoren- und Politiker-Seite.
   Wird im Browser genutzt UND vom Prerender-Skript (scripts/prerender.mjs),
   das die Karten täglich fertig ins HTML schreibt (gut für Google).
   Benötigt WS aus common.js. */

const WSCards = {
  NEW_BADGE_DAYS: 7,

  LABELS: {
    'BIG BUY': 'GROSSER KAUF',
    'NEW POSITION': 'NEUE POSITION',
    'POSITION INCREASE': 'AUFGESTOCKT',
    'BIG SELL': 'GROSSER VERKAUF',
    'POSITION REDUCTION': 'REDUZIERT',
    'BET AGAINST': 'WETTE GEGEN DIE AKTIE'
  },

  VALUE_NOTE: {
    estimate: { buy: 'gekauft (Schätzung)', sell: 'verkauft (Schätzung)' },
    position: { buy: 'gemeldeter Positionswert', sell: 'gemeldeter Positionswert' },
    notional: { buy: 'Nominalwert der Optionen', sell: 'Nominalwert der Optionen' },
    reported: { buy: 'gekauft (gemeldet)', sell: 'verkauft (gemeldet)' }
  },

  delay(i) { return `style="--delay:${(i % 3) * 90}ms"`; },

  head(person) {
    const esc = WS.esc;
    return `
    <div class="who">
      <div class="avatar" aria-hidden="true">${esc(person.initials)}</div>
      <div><h3 class="name">${esc(person.name)}</h3><div class="sub">${esc(person.sub)}</div></div>
    </div>`;
  },

  /* ---------- Investoren ---------- */
  investorCard(inv, t, side, isTop, i, brokers) {
    const esc = WS.esc;
    const thr = `<span class="threshold" title="Nur Trades ab dieser Größe werden angezeigt">Schwelle ≥ ${WS.money(inv.threshold)}</span>`;
    if (!t) {
      const word = side === 'buy' ? 'Kauf' : 'Verkauf';
      return `<article class="card empty reveal" ${this.delay(i)}>${this.head(inv)}<div class="row">${thr}</div>
      <p class="note">Noch kein ${word} über dieser Schwelle in den ausgewerteten Meldungen. Die Karte füllt sich, sobald einer gemeldet wird.</p></article>`;
    }
    const isNew = t.addedAt && (Date.now() - new Date(t.addedAt).getTime()) < this.NEW_BADGE_DAYS * 864e5;
    const approx = t.valueType === 'estimate' ? '≈ ' : '';
    const verb = side === 'buy' ? 'kauft' : 'verkauft';
    return `
    <article class="card reveal${isTop ? ' top' : ''}" ${this.delay(i)} aria-label="${esc(inv.name)} ${verb} ${esc(t.company)}">
      ${this.head(inv)}
      <div class="row">
        <span class="label ${side}">${esc(this.LABELS[t.label] || t.label)}</span>${thr}${isNew ? '<span class="new">NEU</span>' : ''}
      </div>
      <div><div class="company">${esc(t.company)}</div><div class="ticker">${esc(t.ticker)}</div></div>
      <div><div class="amount">${approx}${WS.money(t.value)}</div><div class="amount-note">${(this.VALUE_NOTE[t.valueType] || this.VALUE_NOTE.estimate)[side]}</div></div>
      <p class="note">${esc(t.note)}</p>
      ${t.label === 'BET AGAINST' ? '' : WS.brokerBox(brokers, t.isin)}
      <div class="meta">Veröffentlicht: ${WS.date(t.disclosed)} · Bestände vom ${WS.date(t.asOf)}<br>
        <a href="${esc(t.source)}" target="_blank" rel="noopener">Original-Meldung bei der SEC</a></div>
    </article>`;
  },

  investorGate(i) {
    return `
    <a class="gate reveal" href="politiker.html" ${this.delay(i)}>
      <div>
        <div class="gate-kicker">POLITIKER-TRADES</div>
        <div class="gate-title" style="margin-top:10px">Was kaufen Politiker?</div>
      </div>
      <div class="gate-avatars" aria-hidden="true"><span>DT</span><span>NP</span><span>RK</span></div>
      <div class="gate-text">Trump, Pelosi und Khanna – ihre größten gemeldeten Käufe, auf einer eigenen Seite.</div>
      <div class="gate-cta">Zu den Politikern
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
    </a>`;
  },

  investorSide(data, brokers, side) {
    const shown = {};
    for (const t of data.trades || []) shown[t.investor + ':' + t.side] = t;
    const rows = (data.investors || []).map(inv => ({ inv, t: shown[inv.id + ':' + side] }))
      .sort((a, b) => (b.t ? b.t.value : -1) - (a.t ? a.t.value : -1));
    let html = rows.map((r, i) => this.investorCard(r.inv, r.t, side, i === 0 && r.t, i, brokers)).join('');
    if (side === 'buy') html += this.investorGate(rows.length);
    return html;
  },

  investorStatus(data) {
    return data.lastChecked
      ? 'Datenstand: ' + new Date(data.lastChecked).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Eingebaute Daten';
  },

  /* ---------- Politiker ---------- */
  politicianCard(p, t, isTop, i, brokers) {
    const esc = WS.esc;
    const thr = `<span class="threshold" title="Nur Käufe, deren gemeldete Spanne bei mindestens diesem Betrag beginnt">Schwelle ≥ ${WS.short(p.threshold)}</span>`;
    if (!t) {
      return `<article class="card empty reveal" ${this.delay(i)}>${this.head(p)}<div class="row">${thr}</div>
      <p class="note">Noch kein Kauf über dieser Schwelle in den ausgewerteten Meldungen.</p></article>`;
    }
    return `
    <article class="card reveal${isTop ? ' top' : ''}" ${this.delay(i)} aria-label="${esc(p.name)} kauft ${esc(t.company)}">
      ${this.head(p)}
      <div class="row"><span class="label buy">${esc(t.label || 'KAUF')}</span>${thr}</div>
      <div><div class="company">${esc(t.company)}</div><div class="ticker">${esc(t.ticker)}</div></div>
      <div><div class="amount range">${WS.range(t.rangeLow, t.rangeHigh)}</div><div class="amount-note">gemeldete Spanne</div></div>
      <p class="note">${esc(t.note)}</p>
      ${WS.brokerBox(brokers, t.isin)}
      <div class="meta">Gekauft: ${WS.date(t.tradeDate)} · Gemeldet: ${WS.date(t.disclosed)}<br>
        <a href="${esc(t.source)}" target="_blank" rel="noopener">${esc(t.sourceLabel || 'Original-Meldung')}</a></div>
    </article>`;
  },

  politicianGate(i) {
    return `
    <a class="gate reveal" href="./" ${this.delay(i)}>
      <div>
        <div class="gate-kicker">INVESTOREN-TRADES</div>
        <div class="gate-title" style="margin-top:10px">Was kaufen die Investoren?</div>
      </div>
      <div class="gate-avatars" aria-hidden="true"><span>BH</span><span>BA</span><span>SD</span><span>MB</span><span>+1</span></div>
      <div class="gate-text">Berkshire, Ackman, Tepper, Druckenmiller und Burry – Käufe und Verkäufe aus den SEC-Meldungen.</div>
      <div class="gate-cta">Zu den Investoren
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
    </a>`;
  },

  politicianGrid(data, brokers) {
    const byPerson = {};
    for (const t of data.trades || []) byPerson[t.politician] = t;
    const rows = (data.politicians || []).map(p => ({ p, t: byPerson[p.id] }))
      .sort((a, b) => (b.t ? b.t.rangeLow : -1) - (a.t ? a.t.rangeLow : -1));
    return rows.map((r, i) => this.politicianCard(r.p, r.t, i === 0 && r.t, i, brokers)).join('') + this.politicianGate(rows.length);
  },

  politicianUpdated(data) {
    return data.lastUpdated ? 'Nach Größe sortiert · Stand: ' + WS.date(data.lastUpdated) : 'Nach Größe sortiert';
  }
};
