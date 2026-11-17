/* Whale Scopes – gemeinsame Funktionen für Investoren- und Politiker-Seite.
   Läuft im Browser und im Prerender-Skript (Node). */

if (typeof document !== 'undefined') document.documentElement.classList.add('js');

const WS = {
  esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  },

  money(v) {
    if (v >= 1e9) return (v / 1e9).toLocaleString('de-DE', { maximumFractionDigits: v >= 1e10 ? 1 : 2 }) + ' Mrd. $';
    return Math.round(v / 1e6).toLocaleString('de-DE') + ' Mio. $';
  },

  // Spanne wie "5–25 Mio. $" oder "100–250 Tsd. $"
  range(low, high) {
    const r = n => n.toLocaleString('de-DE', { maximumFractionDigits: 1 });
    if (high > 1e6) return r(Math.round(low / 1e5) / 10) + '–' + r(Math.round(high / 1e5) / 10) + ' Mio. $';
    return r(Math.round(low / 1e3)) + '–' + r(Math.round(high / 1e3)) + ' Tsd. $';
  },

  short(v) {
    if (v >= 1e9) return WS.money(v);
    if (v >= 1e6) return (v / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' Mio. $';
    return Math.round(v / 1e3).toLocaleString('de-DE') + ' Tsd. $';
  },

  date(d) {
    if (!d) return '–';
    const [y, m, day] = d.split('-').map(Number);
    const opts = day ? { day: 'numeric', month: 'short', year: 'numeric' } : { month: 'long', year: 'numeric' };
    return new Date(y, m - 1, day || 1).toLocaleDateString('de-DE', opts);
  },

  async getJson(url) {
    const res = await fetch(url + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status);
    return res.json();
  },

  // Broker-Buttons, gekennzeichnet als Werbung
  brokerBox(brokers, isin) {
    const list = ((brokers && brokers.brokers) || []).filter(b => b.active !== false && b.url);
    if (!list.length) return '';
    const buttons = list.map(b => {
      const href = b.deeplink && isin ? b.deeplink.replace('{isin}', encodeURIComponent(isin)) : b.url;
      return `<a class="broker-btn" href="${WS.esc(href)}" target="_blank" rel="sponsored noopener">${WS.esc(b.name)}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="M7 17L17 7M8 7h9v9"/></svg></a>`;
    }).join('');
    return `<div class="brokers">
        <div class="brokers-head"><span>${WS.esc(brokers.heading || 'Diese Aktie handeln bei')}</span><span class="ad">${WS.esc((brokers.adLabel || 'Werbung').toUpperCase())}</span></div>
        <div class="brokers-row">${buttons}</div>
      </div>`;
  },

  // Sanftes Einblenden beim Scrollen
  observer: null,
  reveal(root) {
    const els = (root || document).querySelectorAll('.reveal:not(.in)');
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    if (!WS.observer) {
      WS.observer = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); WS.observer.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    }
    els.forEach(e => WS.observer.observe(e));
  }
};

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => WS.reveal());
