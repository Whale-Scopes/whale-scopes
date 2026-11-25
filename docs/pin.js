/* „Auf Startbildschirm“-Button im Footer.
   - Chrome/Edge/Samsung (Android & Desktop): öffnet den echten Installieren-Dialog.
   - iPhone/iPad (Safari): zeigt kurz, wie es über „Teilen“ geht.
   - Andere Browser: kurzer Hinweis über das Browsermenü bzw. Lesezeichen.
   - Wenn die Seite schon als App geöffnet ist, bleibt der Button versteckt. */
(function () {
  var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  var btn = document.getElementById('pin-btn');
  var hint = document.getElementById('pin-hint');
  if (!btn || !hint || standalone) return;

  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; });
  window.addEventListener('appinstalled', function () { btn.hidden = true; hint.hidden = true; });

  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isMobile = isIOS || /Android|Mobi/i.test(ua);

  function show(text) { hint.innerHTML = text; hint.hidden = false; }

  btn.hidden = false;
  btn.addEventListener('click', function () {
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.finally(function () { deferred = null; });
      return;
    }
    if (isIOS) {
      show('Tippe unten auf <strong>Teilen</strong> <svg class="pin-share" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M6 11v9h12v-9"/></svg> und dann auf <strong>„Zum Home-Bildschirm“</strong>.');
    } else if (isMobile) {
      show('Öffne das <strong>Browsermenü ⋮</strong> und wähle <strong>„Zum Startbildschirm hinzufügen“</strong>.');
    } else {
      show('Drücke <strong>Strg + D</strong> (Mac: <strong>⌘ + D</strong>), um Whale Scopes als Lesezeichen zu speichern.');
    }
  });
})();
