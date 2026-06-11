/* ================================================
   MESOPOTAMIA — main.js
   Hero slider + Products slider + Nav scroll
   ================================================ */

/* ------------------------------------------------
   Utilitar: ruleaza dupa DOM gata
------------------------------------------------ */
function ready(fn) {
  if (document.readyState !== 'loading') fn();
  else document.addEventListener('DOMContentLoaded', fn);
}

ready(function () {
  initNavScroll();
  initNavHamburger();
  initBottomNav();
  initSidebarOffset();
  initThemeToggle();
  initHeroSlider();
  initScrollReveal();
  /* Produsele din meniu sunt randate asincron — pornește reveal și pe ele după render */
  document.addEventListener('products:rendered', function () {
    initScrollReveal();
  });
});

/*
 * Pe mobile/tablet: mută sidebar-ul între page-hero și wrapper (sticky funcționează corect).
 * Pe desktop: readuce sidebar-ul înăuntrul wrapper-ului ca flex child.
 * Setează scroll-margin-top pe secțiuni după ce produsele sunt randate asincron.
 */
function initSidebarOffset() {
  var track   = document.querySelector('.meniu-sidebar-track');
  var wrapper = document.querySelector('.meniu-wrapper');
  if (!track || !wrapper) return;

  var headerEl = document.querySelector('.header');
  var movedOut = false;

  function updateScrollMargins() {
    if (window.innerWidth > 1024) return;
    var total = (headerEl ? headerEl.offsetHeight : 60) + track.offsetHeight;
    document.querySelectorAll('.menu-section').forEach(function (s) {
      s.style.scrollMarginTop = total + 'px';
    });
  }

  function applyOffset() {
    if (window.innerWidth <= 1024) {
      if (!movedOut) {
        wrapper.parentNode.insertBefore(track, wrapper);
        movedOut = true;
      }
      updateScrollMargins();
    } else {
      if (movedOut) {
        wrapper.insertBefore(track, wrapper.querySelector('.meniu-layout'));
        movedOut = false;
      }
      document.querySelectorAll('.menu-section').forEach(function (s) {
        s.style.scrollMarginTop = '';
      });
    }
  }

  applyOffset();
  window.addEventListener('resize', applyOffset);
  // Secțiunile sunt randate asincron — aplică scroll-margin-top după render
  document.addEventListener('products:rendered', updateScrollMargins);
}


/* ------------------------------------------------
   2. TEMA DARK / LIGHT
------------------------------------------------ */
function initThemeToggle() {
  const btns = document.querySelectorAll('[data-theme-toggle]');
  if (!btns.length) return;

  function applyTheme(theme) {
    if (theme === 'light') {
      document.documentElement.dataset.theme = 'light';
    } else {
      delete document.documentElement.dataset.theme;
    }
    localStorage.setItem('theme', theme);
    btns.forEach(function(b) {
      b.querySelector('i').className = theme === 'light' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
      var span = b.querySelector('span');
      if (span) span.textContent = theme === 'light' ? 'Dark Mode' : 'Light Mode';
    });
  }

  const saved = localStorage.getItem('theme') || 'light';
  applyTheme(saved);

  btns.forEach(function(btn) {
    btn.addEventListener('click', function () {
      const isLight = document.documentElement.dataset.theme === 'light';
      applyTheme(isLight ? 'dark' : 'light');
    });
  });
}


/* ------------------------------------------------
   1. NAV — clasa scrolled + hamburger
------------------------------------------------ */
function initNavScroll() {
  const header = document.getElementById('header');
  if (!header) return;

  function onScroll() {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 20);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function initNavHamburger() {
  const btn   = document.getElementById('navHamburger');
  const links = document.getElementById('navLinks');
  if (!btn || !links) return;

  btn.addEventListener('click', function () {
    const open = links.classList.toggle('is-open');
    btn.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });

  /* Inchide meniul la click pe link */
  links.querySelectorAll('.nav__link').forEach(function (link) {
    link.addEventListener('click', function () {
      links.classList.remove('is-open');
      btn.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });
}

function initBottomNav() {
  var nav = document.getElementById('navBottom');
  if (!nav) return;

  /* Marcheaza tab-ul activ dupa URL */
  var page = window.location.pathname.split('/').pop() || 'index.html';
  nav.querySelectorAll('a.nav-bottom__item').forEach(function (item) {
    if (item.getAttribute('href') === page) item.classList.add('is-active');
  });

  /* Ascunde bara cand apare tastatura (altfel urca deasupra ei pe Android) */
  if (window.visualViewport) {
    var vv = window.visualViewport;
    var baseH = vv.height;
    vv.addEventListener('resize', function () {
      /* daca viewportul s-a micsorat semnificativ => tastatura deschisa */
      var keyboardOpen = vv.height < baseH - 120;
      nav.classList.toggle('is-hidden', keyboardOpen);
      if (!keyboardOpen) baseH = vv.height;
    });
  } else {
    /* Fallback: focus/blur pe campuri text */
    document.addEventListener('focusin', function (e) {
      if (e.target.matches('input, textarea, select')) nav.classList.add('is-hidden');
    });
    document.addEventListener('focusout', function () {
      nav.classList.remove('is-hidden');
    });
  }
}


/* ------------------------------------------------
   2. SCROLL REVEAL
------------------------------------------------ */
function initScrollReveal(root) {
  var elements = (root || document).querySelectorAll('.reveal:not(.is-observed)');
  if (!elements.length) return;

  if (!('IntersectionObserver' in window)) {
    elements.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }

  var STAGGER_STEP = 0.1;  // secunde între elementele dintr-un val
  var STAGGER_MAX  = 5;    // cap: max câte elemente primesc delay crescut

  var observer = new IntersectionObserver(function (entries) {
    /* Doar elementele care intră acum, în ordinea lor din pagină → stagger automat */
    var revealed = entries
      .filter(function (e) { return e.isIntersecting; })
      .map(function (e) { return e.target; })
      .sort(function (a, b) {
        var pos = a.compareDocumentPosition(b);
        return (pos & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
      });

    revealed.forEach(function (el, i) {
      /* data-delay explicit are prioritate; altfel calculăm din ordine */
      var delay = el.dataset.delay !== undefined
        ? parseFloat(el.dataset.delay)
        : Math.min(i, STAGGER_MAX) * STAGGER_STEP;

      el.style.animationDelay = delay + 's';
      el.classList.add('is-visible');
      observer.unobserve(el);
    });
  }, { threshold: 0.1 });

  elements.forEach(function (el) {
    el.classList.add('is-observed');
    observer.observe(el);
  });
}


/* ------------------------------------------------
   3. HERO SLIDER
------------------------------------------------ */
function initHeroSlider() {
  const slider    = document.getElementById('heroSlider');
  const btnPrev   = document.getElementById('heroPrev');
  const btnNext   = document.getElementById('heroNext');
  const progressBar = document.getElementById('heroProgressBar');
  if (!slider) return;

  const slides    = Array.from(slider.querySelectorAll('.hero__slide'));
  let current     = 0;
  let autoTimer   = null;
  const INTERVAL  = 7000;

  function resetProgress() {
    if (!progressBar) return;
    progressBar.classList.remove('is-running', 'is-paused');
    progressBar.style.cssText = '--hero-duration:' + INTERVAL + 'ms';
    void progressBar.offsetWidth;
    progressBar.classList.add('is-running');
  }

  function pauseProgress() {
    if (progressBar) progressBar.classList.add('is-paused');
  }

  function resumeProgress() {
    if (progressBar) progressBar.classList.remove('is-paused');
  }

  function goTo(index) {
    slides[current].classList.remove('is-active');
    current = (index + slides.length) % slides.length;
    slides[current].classList.add('is-active');
    resetProgress();
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

  function startAuto() {
    stopAuto();
    autoTimer = setInterval(next, INTERVAL);
    resumeProgress();
  }

  function stopAuto() {
    clearInterval(autoTimer);
    pauseProgress();
  }

  if (btnPrev) btnPrev.addEventListener('click', function () { prev(); startAuto(); });
  if (btnNext) btnNext.addEventListener('click', function () { next(); startAuto(); });

  /* Swipe pe mobil */
  let touchStartX = 0;
  slider.addEventListener('touchstart', function (e) {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  slider.addEventListener('touchend', function (e) {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      diff > 0 ? next() : prev();
    }
    startAuto();
  }, { passive: true });

  /* Pauza la hover — doar mouse, nu touch */
  slider.addEventListener('pointerenter', function (e) {
    if (e.pointerType === 'mouse') stopAuto();
  });
  slider.addEventListener('pointerleave', function (e) {
    if (e.pointerType === 'mouse') startAuto();
  });

  goTo(0);
  startAuto();
}


