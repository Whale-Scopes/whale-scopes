/* „Auf Startbildschirm“-Button im Footer.
   - Chrome/Edge/Samsung (Android & Desktop): öffnet den echten Installieren-Dialog.
     Ist er gerade nicht verfügbar, zeigt der Button den Weg über das Browsermenü.
   - iPhone/iPad (Safari): Weg über „Teilen“ → „Zum Home-Bildschirm“.
   - Safari auf dem Mac: Weg über „Ablage“ → „Zum Dock hinzufügen“.
   - Firefox & Co. am Computer: Hinweis auf Lesezeichen.
   - Ist die Seite schon als App geöffnet, sagt der Button das statt einer Anleitung.
   Es werden keine Daten gespeichert oder verschickt. */
(function () {
  var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  var btns = document.querySelectorAll('#pin-btn, .pin-card');
  var hint = document.getElementById('pin-hint');
  if (!btns.length || !hint) return;
  for (var i = 0; i < btns.length; i++) btns[i].hidden = false;
  function markInstalled() {
    var cta = document.querySelector('.pin-card-cta');
    if (standalone && cta) cta.textContent = '✓ Installiert';
  }
  markInstalled();

  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; });
  window.addEventListener('appinstalled', function () { standalone = true; markInstalled(); });

  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  var isChromium = /Chrome|Chromium|CriOS|Edg\//.test(ua) && !/OPR\//.test(ua);
  var isEdge = /Edg\//.test(ua);
  var isFirefox = /Firefox|FxiOS/.test(ua);
  var isMac = /Macintosh/.test(ua);
  var isMacSafari = !isIOS && isMac && /Safari/.test(ua) && !isChromium && !isFirefox;

  var SHARE = '<svg class="pin-share" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M6 11v9h12v-9"/></svg>';

  function text() {
    if (standalone) return '✓ Whale Scopes ist bereits auf deinem Gerät angeheftet.';
    if (isIOS) return 'Tippe unten auf <strong>Teilen</strong> ' + SHARE + ' und dann auf <strong>„Zum Home-Bildschirm“</strong>.';
    if (isAndroid) return 'Öffne das <strong>Browsermenü ⋮</strong> und wähle <strong>„Zum Startbildschirm hinzufügen“</strong> bzw. <strong>„App installieren“</strong>.';
    if (isMacSafari) return 'Wähle oben in der Menüleiste <strong>Ablage → „Zum Dock hinzufügen“</strong>. Whale Scopes liegt dann als App in deinem Dock.';
    if (isEdge) return 'Öffne das <strong>Menü …</strong> und wähle <strong>Apps → „Diese Website als App installieren“</strong>.';
    if (isChromium) return 'Klicke rechts in der Adressleiste auf das <strong>Installieren-Symbol</strong> oder öffne das <strong>Menü ⋮</strong> → <strong>„Streamen, speichern und teilen“ → „Seite als App installieren“</strong>.';
    return 'Drücke <strong>' + (isMac ? '⌘ + D' : 'Strg + D') + '</strong>, um Whale Scopes als Lesezeichen zu speichern.';
  }

  function onClick() {
    if (deferred) {
      var ev = deferred; deferred = null;
      ev.prompt();
      return;
    }
    hint.innerHTML = text();
    hint.hidden = false;
  }
  for (var j = 0; j < btns.length; j++) btns[j].addEventListener('click', onClick);
})();
