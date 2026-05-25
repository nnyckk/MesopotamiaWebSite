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
  initHeroSlider();
  initScrollReveal();
});


/* ------------------------------------------------
   1. NAV — clasa scrolled + hamburger
------------------------------------------------ */
function initNavScroll() {
  const header = document.getElementById('header');
  if (!header) return;

  let lastY = window.scrollY;

  function onScroll() {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 20);
    const hiding = y > lastY && y > 80;
    header.classList.toggle('is-hidden', hiding);
    document.body.classList.toggle('header-hidden', hiding);
    lastY = y;
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

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        var el = entry.target;
        var delay = el.dataset.delay || 0;
        el.style.transitionDelay = delay + 's';
        el.classList.add('is-visible');
        observer.unobserve(el);
        setTimeout(function () {
          el.style.transitionDelay = '0s';
        }, (parseFloat(delay) + 0.65) * 1000);
      }
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


