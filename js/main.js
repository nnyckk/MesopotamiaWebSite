/* Mesopotamia — shared behaviour for all pages */

/* Service worker: offline shell plus a runtime cache. Registered after load so
   it never competes with the page's own requests. Skipped on file:// and on
   Live Server, where a stale cache would hide the edits you just made. */
if ('serviceWorker' in navigator &&
    location.protocol.indexOf('http') === 0 &&
    location.hostname !== 'localhost' &&
    location.hostname !== '127.0.0.1') {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}

function ready(fn) {
  if (document.readyState !== 'loading') fn();
  else document.addEventListener('DOMContentLoaded', fn);
}

ready(function () {
  initNavHamburger();
  initBottomNav();
  initSidebarOffset();
  initThemeToggle();
  initHeroSlider();
  initBtCarousel();
  initLocMarquee();
  initTiltCards();
  initTeamFloats();
  initScrollReveal();
  /* Menu products render async, so reveal must run again on their markup. */
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
      /* Icon buttons (<i>) swap their class here. The footer button uses
         moon/sun SVGs toggled from CSS, so it has no <i> and is skipped. */
      var icon = b.querySelector('i');
      if (icon) icon.className = theme === 'light' ? 'ph-bold ph-sun' : 'ph-bold ph-moon';
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
   1. NAV — hamburger
------------------------------------------------ */
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

  /* Close the menu when a link is followed */
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

  /* Mark the active tab from the URL */
  var page = window.location.pathname.split('/').pop() || 'index.html';
  nav.querySelectorAll('a.nav-bottom__item').forEach(function (item) {
    if (item.getAttribute('href') === page) item.classList.add('is-active');
  });

  /* Hide the bar when the keyboard opens; on Android it would otherwise
     sit on top of it. */
  if (window.visualViewport) {
    var vv = window.visualViewport;
    var baseH = vv.height;
    vv.addEventListener('resize', function () {
      /* A large viewport shrink means the keyboard is open */
      var keyboardOpen = vv.height < baseH - 120;
      nav.classList.toggle('is-hidden', keyboardOpen);
      if (!keyboardOpen) baseH = vv.height;
    });
  } else {
    /* Fallback for browsers without visualViewport */
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

  function reveal(entries, obs) {
    /* Only elements entering now, in document order, so stagger is automatic. */
    var revealed = entries
      .filter(function (e) { return e.isIntersecting; })
      .map(function (e) { return e.target; })
      .sort(function (a, b) {
        var pos = a.compareDocumentPosition(b);
        return (pos & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
      });

    revealed.forEach(function (el, i) {
      /* Explicit data-delay wins; otherwise derive it from position. */
      var delay = el.dataset.delay !== undefined
        ? parseFloat(el.dataset.delay)
        : Math.min(i, STAGGER_MAX) * STAGGER_STEP;

      el.style.animationDelay = delay + 's';
      el.classList.add('is-visible');

      /* Stop the animation once done: `forwards` would otherwise pin
         `transform` and kill the element's hover effect. */
      el.addEventListener('animationend', function onEnd(ev) {
        if (ev.animationName !== 'revealIn') return;
        el.classList.add('reveal-done');
        el.removeEventListener('animationend', onEnd);
      });

      obs.unobserve(el);
    });
  }

  /* Negative rootMargin narrows detection toward mid-screen so elements
     don't fire the instant they peek in from below. The bottom margin is
     the smaller one: it triggers once the element is properly on screen
     but before it reaches the centre. */
  var observer = new IntersectionObserver(reveal, {
    threshold: 0,
    rootMargin: '-30% 0px -15% 0px'
  });

  elements.forEach(function (el) {
    el.classList.add('is-observed');
    observer.observe(el);
  });
}


/* ------------------------------------------------
   2. CARUSEL "BETTER TOGETHER"
   Bucla infinita: poza activa e centrata si mai mare,
   vecinele mai mici si stinse. La capat, mutam elementul
   din DOM la celalalt capat — asa nu se termina niciodata.
------------------------------------------------ */
function initBtCarousel() {
  var root  = document.getElementById('btCarousel');
  var track = document.getElementById('btTrack');
  if (!root || !track) return;

  var prevBtn = document.getElementById('btPrev');
  var nextBtn = document.getElementById('btNext');

  var N       = track.children.length;
  var pos     = 0;    /* logical index of the active slide */
  var slides  = [];
  var offsets = [];   /* each slide's centre, measured once per layout */
  var vpHalf  = 0;    /* half the viewport width */
  var settle  = null;
  var activeIdx = -1; /* which slide currently carries .is-active */

  /* Clone the set on both sides so there are always slides left and right.
     Rendering moves a transform rather than DOM nodes, which keeps the
     motion continuous between steps. */
  function build() {
    var originals = Array.prototype.slice.call(track.children);

    /* Leading set, inserted in order before the first original.
       insertBefore(firstChild) inside a forEach would reverse the order and
       place the same image twice next to its original. */
    var first = originals[0];
    originals.forEach(function (el) {
      track.insertBefore(el.cloneNode(true), first);
    });

    /* Trailing set, appended in order */
    originals.forEach(function (el) {
      track.appendChild(el.cloneNode(true));
    });

    slides = Array.prototype.slice.call(track.children);
  }

  /* All layout reads happen here, batched, and never during a transition.
     render() then only writes, so changing slides cannot force a reflow. */
  function measure() {
    if (!slides.length) return;
    vpHalf = track.parentNode.offsetWidth / 2;
    offsets = slides.map(function (el) {
      return el.offsetLeft + el.offsetWidth / 2;
    });
  }

  /* Centre the slide at logical index `pos`. `pos` is deliberately NOT
     normalised here: doing so would make the last-to-first transition jump
     backwards instead of continuing forward. */
  function render(animate) {
    if (!offsets.length) measure();

    /* Start from the middle set and offset by pos, which may be negative or
       exceed N — that is what the cloned sides are for. */
    var idx = N + pos;
    if (offsets[idx] === undefined) return;

    track.style.setProperty('--shift', (vpHalf - offsets[idx]).toFixed(1) + 'px');

    if (animate) {
      track.style.transition = '';
    } else {
      /* Suppress the transition for this frame only, then restore it: leaving
         `none` in the inline style would make the next step jump without
         animating. Reading offsetWidth commits the jump as its own frame. */
      track.style.transition = 'none';
      void track.offsetWidth;
      track.style.transition = '';
    }

    /* Touch only the two slides that change, not all 24 */
    if (activeIdx !== idx) {
      if (activeIdx >= 0 && slides[activeIdx]) {
        slides[activeIdx].classList.remove('is-active');
      }
      slides[idx].classList.add('is-active');
      activeIdx = idx;
    }
  }

  /* One step. Repeated clicks only change `pos`; the CSS transition
     interpolates from the current position, so motion stays smooth. */
  function step(dir) {
    /* Each cloned side holds N slides; normalise mid-flight if enough
       clicks piled up to run past them. */
    if (pos + dir >= N - 1 || pos + dir <= -(N - 1)) {
      pos = ((pos % N) + N) % N;
      render(false);
    }

    pos += dir;
    render(true);

    /* Once motion settles, bring pos back into [0, N) and redraw instantly.
       The set is tripled, so the centred slide looks identical — the jump is
       invisible and the loop can run forever. Driven by transitionend rather
       than a guessed timeout, so it can never land mid-animation. */
    clearTimeout(settle);
    settle = setTimeout(normalise, 900);
  }

  function normalise() {
    clearTimeout(settle);
    var norm = ((pos % N) + N) % N;
    if (norm !== pos) {
      pos = norm;
      render(false);
    }
  }

  track.addEventListener('transitionend', function (e) {
    if (e.target === track && e.propertyName === 'transform') normalise();
  });

  var AUTO_MS = 5000;
  var timer   = null;

  function startAuto() {
    stopAuto();
    timer = setInterval(function () { step(1); }, AUTO_MS);
  }

  function stopAuto() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  /* Any interaction restarts the timer so it doesn't advance right after
     the user acted. */
  function nudge(dir) {
    step(dir);
    startAuto();
  }

  if (nextBtn) nextBtn.addEventListener('click', function () { nudge(1); });
  if (prevBtn) prevBtn.addEventListener('click', function () { nudge(-1); });

  /* Click a side slide to centre it. Delegated on the track so clones
     work too. */
  track.addEventListener('click', function (e) {
    var slide = e.target.closest('.bt-slide');
    if (!slide || slide.classList.contains('is-active')) return;

    /* activeIdx is the source of truth: normalise() moves the active slide
       without the DOM order changing, so re-querying could be stale. */
    var clicked = slides.indexOf(slide);
    if (clicked < 0 || activeIdx < 0) return;

    nudge(clicked - activeIdx);
  });

  /* Swipe on touch, where the arrows are hidden (hover: none). Goes through
     nudge, so step and timer behave exactly as on click. */
  var touchStartX = 0;
  var touchStartY = 0;

  track.addEventListener('touchstart', function (e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    stopAuto();
  }, { passive: true });

  track.addEventListener('touchend', function (e) {
    var dx = touchStartX - e.changedTouches[0].clientX;
    var dy = touchStartY - e.changedTouches[0].clientY;

    /* Only gestures more horizontal than vertical, so page scrolling
       isn't hijacked. */
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
      nudge(dx > 0 ? 1 : -1);
    } else {
      startAuto();
    }
  }, { passive: true });

  /* Pause while the mouse rests on the carousel */
  root.addEventListener('pointerenter', stopAuto);
  root.addEventListener('pointerleave', startAuto);

  /* Images now carry width/height, so layout is stable before they load and
     a single re-measure on the last one is enough. */
  var pending = 0;
  track.querySelectorAll('img').forEach(function (img) {
    if (img.complete) return;
    pending++;
    img.addEventListener('load', function () {
      if (--pending === 0) { measure(); render(false); }
    }, { once: true });
  });

  /* Throttled: measure() reads layout for every slide, so running it on each
     resize event would thrash during a window drag or an orientation change. */
  var resizeFrame = null;
  window.addEventListener('resize', function () {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(function () {
      resizeFrame = null;
      measure();
      render(false);
    });
  }, { passive: true });

  build();
  measure();
  render(false);

  /* Auto-advance unless the user asked for reduced motion */
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    startAuto();
  }
}


/* ------------------------------------------------
   2c. BANDA DE ORASE — dubleaza setul pentru bucla continua
------------------------------------------------ */
function initLocMarquee() {
  var track = document.getElementById('locTrack');
  if (!track) return;

  var items = Array.prototype.slice.call(track.children);
  if (!items.length) return;

  items.forEach(function (el) {
    var clone = el.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
  });
}


/* ------------------------------------------------
   2a-bis. POZELE DIN "ECHIPA TE CHEAMA"
   Cat timp mouse-ul e pe butonul de aplicare, pozele
   se deplaseaza spre cursor. Atractia scade cu distanta,
   deci cele apropiate reactioneaza mai mult — pare atragere,
   nu cinci poze care aluneca la unison.
------------------------------------------------ */
function initTeamFloats() {
  var btn    = document.querySelector('.team__cta');
  var floats = document.querySelectorAll('.team__float');
  if (!btn || !floats.length) return;

  /* Fine pointer (mouse) only, never touch */
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var PULL  = 42;    /* px the nearest image travels */
  var RANGE = 620;   /* beyond this distance the pull is ~zero */
  var frame = null;

  btn.addEventListener('pointermove', function (e) {
    if (frame) return;
    frame = requestAnimationFrame(function () {
      frame = null;
      floats.forEach(function (img) {
        var r  = img.getBoundingClientRect();
        var cx = r.left + r.width  / 2;
        var cy = r.top  + r.height / 2;
        var dx = e.clientX - cx;
        var dy = e.clientY - cy;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        /* 1 at the cursor, 0 at the edge of RANGE */
        var force = Math.max(0, 1 - dist / RANGE);
        img.classList.add('is-tracking');
        img.style.setProperty('--fx', (dx / dist * PULL * force).toFixed(2) + 'px');
        img.style.setProperty('--fy', (dy / dist * PULL * force).toFixed(2) + 'px');
      });
    });
  });

  btn.addEventListener('pointerleave', function () {
    if (frame) { cancelAnimationFrame(frame); frame = null; }
    floats.forEach(function (img) {
      img.classList.remove('is-tracking');
      img.style.setProperty('--fx', '0px');
      img.style.setProperty('--fy', '0px');
    });
  });
}


/* ------------------------------------------------
   2a. CARDURI CARE URMARESC MOUSE-UL
   Cardul se deplaseaza cu cativa px spre cursor,
   ca si cum s-ar lipi usor de el.
------------------------------------------------ */
function initTiltCards() {
  /* Category cards plus the CTAs that follow the mouse */
  var cards = document.querySelectorAll('.cat-card, .loc__cta, .app__btn, .team__cta, .contact-cta__btn');
  if (!cards.length) return;

  /* Fine pointer (mouse) only, never touch */
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var PULL = 10;   /* max px of travel toward the cursor */

  cards.forEach(function (card) {
    var frame = null;

    card.addEventListener('pointermove', function (e) {
      if (frame) return;
      frame = requestAnimationFrame(function () {
        frame = null;
        var r = card.getBoundingClientRect();
        /* -1 .. 1 relative to the card centre */
        var dx = (e.clientX - r.left) / r.width  * 2 - 1;
        var dy = (e.clientY - r.top)  / r.height * 2 - 1;
        card.classList.add('is-tracking');
        card.style.setProperty('--tx', (dx * PULL).toFixed(2) + 'px');
        card.style.setProperty('--ty', (dy * PULL).toFixed(2) + 'px');
      });
    });

    card.addEventListener('pointerleave', function () {
      if (frame) { cancelAnimationFrame(frame); frame = null; }
      card.classList.remove('is-tracking');
      card.classList.remove('is-pressed');
      card.style.setProperty('--tx', '0px');
      card.style.setProperty('--ty', '0px');
    });

    /* On links, navigation cuts `:active` almost instantly. A class marks the
       press so the effect lasts while the button is held. */
    card.addEventListener('pointerdown', function () {
      card.classList.add('is-pressed');
    });

    card.addEventListener('pointerup', function () {
      card.classList.remove('is-pressed');
    });
  });
}


/* ------------------------------------------------
   3. HERO SLIDER
------------------------------------------------ */
function initHeroSlider() {
  const slider    = document.getElementById('heroSlider');
  const btnPrev   = document.getElementById('heroPrev');
  const btnNext   = document.getElementById('heroNext');
  if (!slider) return;

  const slides    = Array.from(slider.querySelectorAll('.hero__slide'));
  let current     = 0;
  let autoTimer   = null;
  const INTERVAL  = 7000;

  function goTo(index) {
    slides[current].classList.remove('is-active');
    current = (index + slides.length) % slides.length;
    slides[current].classList.add('is-active');
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

  function startAuto() {
    stopAuto();
    autoTimer = setInterval(next, INTERVAL);
  }

  function stopAuto() {
    clearInterval(autoTimer);
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


