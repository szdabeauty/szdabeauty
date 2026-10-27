(function () {
  // Animated scrolling for every in-page link (nav, buttons, logo)
  var header = document.querySelector('.top');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var raf = 0;
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function scrollToY(y, ms, done) {
    cancelAnimationFrame(raf);
    var from = window.pageYOffset, delta = y - from, t0 = null;
    if (!delta) { if (done) done(); return; }
    function step(now) {
      if (t0 === null) t0 = now;
      var p = Math.min((now - t0) / ms, 1);
      window.scrollTo(0, from + delta * ease(p));
      if (p < 1) raf = requestAnimationFrame(step); else if (done) done();
    }
    raf = requestAnimationFrame(step);
  }
  ['wheel', 'touchstart', 'keydown'].forEach(function (ev) {
    window.addEventListener(ev, function () { cancelAnimationFrame(raf); }, { passive: true });
  });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var id = a.getAttribute('href').slice(1);
    var target = id ? document.getElementById(decodeURIComponent(id)) : document.body;
    if (!target) return;
    e.preventDefault();
    var offset = header ? header.offsetHeight : 0;
    var y = id ? Math.max(0, target.getBoundingClientRect().top + window.pageYOffset - offset - 8) : 0;
    var dist = Math.abs(y - window.pageYOffset);
    var ms = Math.min(1100, Math.max(450, dist * 0.35));
    if (reduce) ms = 250;
    scrollToY(y, ms, function () {
      if (id) {
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
        if (history.pushState) history.pushState(null, '', '#' + id);
      } else if (history.pushState) {
        history.pushState(null, '', window.location.pathname);
      }
    });
  });

  // Gallery filter
  var chips = document.querySelectorAll('.chip');
  var items = document.querySelectorAll('#grid li');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var f = chip.getAttribute('data-f');
      chips.forEach(function (c) { c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'); });
      items.forEach(function (li) { li.hidden = f !== 'all' && li.getAttribute('data-c') !== f; });
    });
  });

  // Lightbox
  var dlg = document.getElementById('lb');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  var big = dlg.querySelector('img');
  document.getElementById('grid').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-full]');
    if (!b) return;
    big.src = b.getAttribute('data-full');
    big.alt = b.querySelector('img').alt;
    dlg.showModal();
  });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
})();
