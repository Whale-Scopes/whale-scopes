# Whale Scopes – automatisch aktualisieren

Einmal einrichten (ca. 10 Minuten), danach läuft alles von selbst und kostenlos.

## Was passiert automatisch?

1. Jeden Tag um 06:17 UTC startet GitHub das Skript `scripts/update.mjs`.
2. Das Skript liest bei der SEC die zwei neuesten 13F-Meldungen jeder Person und vergleicht sie.
3. Es sucht den größten Kauf und den größten Verkauf **über dem Schwellenwert** der Person.
4. Eine Karte wird nur ersetzt, wenn der neue Trade **aus einem neueren Quartal** stammt **und** über der Schwelle liegt. Sonst bleibt der alte große Trade stehen – auch wenn er lange her ist.
5. Das Ergebnis landet in `docs/trades.json`. Die Website liest diese Datei.

Neue 13F-Meldungen kommen 4× im Jahr (bis Mitte Feb, Mai, Aug, Nov). Dazwischen ändert sich nichts – das ist normal.

## Einrichten

1. **GitHub-Account** anlegen: https://github.com/signup
2. **Neues Repository** erstellen (oben rechts „+“ → „New repository“), Name z. B. `whale-scopes`, auf **Public** stellen, „Create repository“.
3. **Dateien hochladen:** „uploading an existing file“ anklicken und den **Inhalt** dieses Ordners hineinziehen (die Ordner `docs`, `scripts`, `config` und `.github`). → „Commit changes“.
   - Tipp: Der Ordner `.github` ist auf dem Mac/PC oft versteckt (Mac: `Cmd + Shift + .` zeigt ihn). Er muss mit hoch, sonst läuft der Zeitplan nicht.
4. **Deine Kennung für die SEC eintragen** (die SEC verlangt Name + E-Mail bei jedem Abruf):
   Settings → Secrets and variables → Actions → Tab **Variables** → „New repository variable“
   - Name: `SEC_USER_AGENT`
   - Wert: `Whale Scopes deine@email.de`
5. **Website einschalten:** Settings → Pages → Source: „Deploy from a branch“ → Branch `main`, Ordner `/docs` → Save.
   Nach 1–2 Minuten ist die Seite online unter `https://DEINNAME.github.io/whale-scopes/`.
6. **Ersten Lauf starten:** Tab „Actions“ → „Update big moves“ → „Run workflow“. Nach ca. 1 Minute ist ein grüner Haken da.

Fertig.

## Anpassen

Alles steht in `config/investors.json`:

- `threshold` – Schwellenwert in US-Dollar (z. B. `1000000000` = 1 Mrd.).
- `ciks` – die SEC-Nummer des Fonds. Finden: https://www.sec.gov/edgar/search → Fondsname suchen → die Zahl hinter „CIK“.
- `options` – `true` zählt auch Optionen (Calls/Puts) mit. Achtung: deren Wert ist „notional“, nicht das eingesetzte Geld.
- Neue Person: einfach einen weiteren Eintrag nach demselben Muster hinzufügen.

Wird ein Schwellenwert erhöht, verschwinden Karten, die darunter liegen, beim nächsten Lauf.

## Gut zu wissen

- **Beträge sind Schätzungen:** geänderte Aktienzahl × Kurs zum Quartalsende. Kaufpreise stehen nicht in den Meldungen.
- **Michael Burry** meldet seit Ende 2025 nicht mehr an die SEC. Seine Karten bleiben auf dem letzten Stand, bis du ihn ersetzt.
- **Fehler?** Im Tab „Actions“ den roten Lauf anklicken und das Protokoll lesen. Bei Problemen mit einer Person bleiben deren alte Daten erhalten.
- **Tickersymbole** kommen von OpenFIGI (kostenlos, ohne Schlüssel). Optional: einen kostenlosen Schlüssel bei https://www.openfigi.com/api holen und als Secret `OPENFIGI_KEY` eintragen.
- Das Skript speichert bei jedem Lauf das Prüfdatum. Dadurch gibt es täglich eine kleine Änderung, und GitHub pausiert den Zeitplan nicht wegen Inaktivität. Falls er doch mal pausiert wird, schickt GitHub eine E-Mail – dann im Tab „Actions“ einmal „Enable workflow“ klicken.
- Keine Anlageberatung.

## Broker-Links ändern

Alle Broker-Buttons kommen aus **`docs/brokers.json`**:

- `url` – der Link hinter dem Button. Hier deinen **Affiliate-Link** eintragen, sobald du ihn hast.
- `deeplink` – später für Links direkt zur Aktie, mit `{isin}` als Platzhalter (z. B. `https://…?isin={isin}`). Solange `null`, wird `url` genommen.
- `active` – `false` blendet einen Broker aus.
- Neuer Broker: einen weiteren Eintrag nach demselben Muster hinzufügen.

Die Buttons sind automatisch mit „Werbung“ gekennzeichnet.

## Impressum und Datenschutz

`docs/impressum.html` und `docs/datenschutz.html` enthalten Platzhalter. Ersetze den Bereich zwischen `<!-- START -->` und `<!-- ENDE -->` durch den Text aus deinem Generator und lösche den gelben Kasten. In `datenschutz.html` steht als Kommentar, was du im Generator ankreuzen musst.

## Design

Farben, Schriften und Abstände für alle Seiten stehen in **`docs/styles.css`**. Die Schriften liegen in `docs/fonts/` (lokal, keine Verbindung zu Google).

## Politiker-Seite

`docs/politiker.html` zeigt die größten gemeldeten Käufe von Politikern im dunkelblauen Design. Die Daten stehen in **`docs/politicians.json`** und werden **von Hand** gepflegt (keine Automatik):

- `politicians` – Personen mit Untertitel, Initialen und Schwellenwert (`threshold`, US-Dollar).
- `trades` – pro Person der aktuell gezeigte Kauf. `rangeLow`/`rangeHigh` = gemeldete Spanne in US-Dollar.
- Regel: Einen Eintrag nur ersetzen, wenn ein **neuerer** Kauf gemeldet wurde, dessen `rangeLow` mindestens so groß wie der Schwellenwert ist.
- Nach einer Änderung `lastUpdated` auf das heutige Datum setzen.

Quellen: Abgeordnete → disclosures-clerk.house.gov, Präsident → Ethikbehörde OGE (Form 278-T).

## SEO (Suchmaschinen)

- **Karten im HTML:** `scripts/prerender.mjs` schreibt die Karten täglich fertig in `docs/index.html` und `docs/politiker.html` (zwischen den `<!-- PRERENDER:… -->`-Markierungen – dort nichts von Hand ändern). So sieht Google die Inhalte sofort. Die Karten-Darstellung steht in `docs/cards.js` und wird vom Browser und vom Skript gemeinsam genutzt.
- Nach einer Änderung an `docs/politicians.json` aktualisiert der nächste tägliche Lauf auch die Politiker-Seite (oder sofort: Actions → Run workflow).
- **Sitemap:** `docs/sitemap.xml` (automatisch), **Robots:** `docs/robots.txt`.
- **Hauptadresse:** https://whale-scopes.com (Canonical-Tags).
- **Vorschaubilder beim Teilen:** `docs/og-image.png` und `docs/og-image-politiker.png`.
