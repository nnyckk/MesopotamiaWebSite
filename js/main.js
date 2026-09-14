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
  initInstaMarquee();
  initBtCarousel();
  initLocMarquee();
  initTiltCards();
  initTeamFloats();
  initTogetherAlbum();
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
      /* Butoanele cu iconiță Font Awesome (<i>) — comută clasa.
         Butonul din footer folosește SVG-uri moon/sun comutate din CSS, deci sărim. */
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

      /* Cand animatia se termina, o oprim: altfel `forwards` tine
         `transform` blocat si hover-ul elementului nu mai are efect. */
      el.addEventListener('animationend', function onEnd(ev) {
        if (ev.animationName !== 'revealIn') return;
        el.classList.add('reveal-done');
        el.removeEventListener('animationend', onEnd);
      });

      observer.unobserve(el);
    });
  }, { threshold: 0.1 });

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

  var N       = track.children.length;    /* numarul de poze */
  var pos     = 0;                        /* indexul logic al pozei active */
  var slides  = [];
  var W       = 0;                        /* latimea unui pas (poza + gap) */
  var settle  = null;

  /* Cloneaza setul de doua ori, ca sa existe mereu poze si in stanga si in
     dreapta. Randarea se face prin transform, nu prin mutari in DOM —
     asa miscarea nu se mai intrerupe intre pasi. */
  function build() {
    var originals = Array.prototype.slice.call(track.children);

    /* Setul dinainte: inserat in ORDINE, inaintea primului original.
       (insertBefore(firstChild) intr-un forEach ar inversa ordinea
       si ar face ca aceeași poza sa apara de doua ori langa original.) */
    var first = originals[0];
    originals.forEach(function (el) {
      track.insertBefore(el.cloneNode(true), first);
    });

    /* Setul de dupa: adaugat la final, tot in ordine */
    originals.forEach(function (el) {
      track.appendChild(el.cloneNode(true));
    });

    slides = Array.prototype.slice.call(track.children);
  }

  function measure() {
    if (!slides.length) return;
    var a = slides[0].getBoundingClientRect();
    var b = slides[1] ? slides[1].getBoundingClientRect() : null;
    W = b ? (b.left - a.left) : a.width;
  }

  /* Redeseneaza: centreaza poza de la indexul logic `pos`.
     `pos` NU se normalizeaza aici — altfel trecerea de la ultima
     la prima poza ar sari inapoi in loc sa continue inainte. */
  function render(animate) {
    if (!W) measure();

    /* pornim din setul din mijloc si ne deplasam cu pos (poate fi negativ
       sau mai mare decat N — de-aia avem seturi clonate de o parte si de alta) */
    var idx = N + pos;
    var vp  = track.parentNode.offsetWidth;
    var el  = slides[idx];
    if (!el) return;

    var offset = vp / 2 - (el.offsetLeft + el.offsetWidth / 2);

    track.style.transition = animate ? '' : 'none';
    track.style.setProperty('--shift', offset.toFixed(1) + 'px');
    if (!animate) void track.offsetWidth;

    slides.forEach(function (s, i) {
      s.classList.toggle('is-active', i === idx);
    });
  }

  /* Un pas. Click-urile repetate schimba doar `pos`, iar tranzitia
     CSS interpoleaza din poziția curenta — deci nu sacadeaza. */
  function step(dir) {
    /* Setul clonat are N poze in fiecare parte. Daca s-au adunat prea multe
       click-uri, normalizam din mers ca sa nu ieșim din lista. */
    if (pos + dir >= N - 1 || pos + dir <= -(N - 1)) {
      pos = ((pos % N) + N) % N;
      render(false);
    }

    pos += dir;
    render(true);

    /* Dupa ce miscarea s-a oprit, readucem pos in [0, N) si redesenam
       instant. Setul e triplat, deci poza centrata arata identic —
       saltul e invizibil, iar bucla poate continua la infinit. */
    clearTimeout(settle);
    settle = setTimeout(function () {
      var norm = ((pos % N) + N) % N;
      if (norm !== pos) {
        pos = norm;
        render(false);
      }
    }, 620);
  }

  /* ---- Avans automat ---- */
  var AUTO_MS = 5000;
  var timer   = null;

  function startAuto() {
    stopAuto();
    timer = setInterval(function () { step(1); }, AUTO_MS);
  }

  function stopAuto() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  /* orice interactiune reporneste cronometrul, ca sa nu sara
     imediat dupa ce userul a dat click */
  function nudge(dir) {
    step(dir);
    startAuto();
  }

  if (nextBtn) nextBtn.addEventListener('click', function () { nudge(1); });
  if (prevBtn) prevBtn.addEventListener('click', function () { nudge(-1); });

  /* Click pe o poza secundara → o aducem in centru.
     Delegare pe track, ca sa functioneze si pe clone. */
  track.addEventListener('click', function (e) {
    var slide = e.target.closest('.bt-slide');
    if (!slide || slide.classList.contains('is-active')) return;

    var items   = Array.prototype.slice.call(track.children);
    var clicked = items.indexOf(slide);
    var active  = items.indexOf(track.querySelector('.bt-slide.is-active'));
    if (clicked < 0 || active < 0) return;

    nudge(clicked - active);
  });

  /* pauza cat timp mouse-ul e pe carusel */
  root.addEventListener('pointerenter', stopAuto);
  root.addEventListener('pointerleave', startAuto);

  track.querySelectorAll('img').forEach(function (img) {
    if (img.complete) return;
    img.addEventListener('load', function () { measure(); render(false); });
  });

  window.addEventListener('resize', function () {
    measure();
    render(false);
  }, { passive: true });

  build();
  measure();
  render(false);

  /* pornim avansul automat, daca userul nu a cerut miscare redusa */
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

  /* doar pe pointer fin (mouse), nu pe touch */
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var PULL  = 42;    /* cati px se deplaseaza poza cea mai apropiata */
  var RANGE = 620;   /* peste distanta asta atractia e aproape zero */
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
        /* 1 lipit de cursor → 0 la marginea razei */
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
  /* cardurile de categorii + CTA-urile care urmaresc mouse-ul */
  var cards = document.querySelectorAll('.cat-card, .loc__cta, .app__btn, .team__cta');
  if (!cards.length) return;

  /* doar pe pointer fin (mouse), nu pe touch */
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var PULL = 10;   /* cati px maxim se deplaseaza spre cursor */

  cards.forEach(function (card) {
    var frame = null;

    card.addEventListener('pointermove', function (e) {
      if (frame) return;
      frame = requestAnimationFrame(function () {
        frame = null;
        var r = card.getBoundingClientRect();
        /* -1 .. 1 fata de centrul cardului */
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

    /* Pe linkuri, navigarea taie `:active` aproape instant. Marcam apasarea
       cu o clasa, ca efectul sa se vada cat timp butonul e tinut apasat. */
    card.addEventListener('pointerdown', function () {
      card.classList.add('is-pressed');
    });

    card.addEventListener('pointerup', function () {
      card.classList.remove('is-pressed');
    });
  });
}


/* ------------------------------------------------
   2b. ALBUM "BETTER TOGETHER"
   Pozele cad una cate una, pe masura ce se deruleaza
   prin coloana inalta care tine albumul sticky.
------------------------------------------------ */
function initTogetherAlbum() {
  var col    = document.querySelector('.together__album-col');
  var photos = document.querySelectorAll('.together__photo');
  if (!col || !photos.length) return;

  /* Fara animatie daca userul a cerut miscare redusa */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    photos.forEach(function (p) { p.classList.add('is-visible'); });
    return;
  }

  var ticking = false;

  function update() {
    ticking = false;

    var rect = col.getBoundingClientRect();
    var vh   = window.innerHeight;

    /* Cat s-a derulat prin coloana, de la 0 (sus) la 1 (jos) */
    var total    = rect.height - vh;
    var scrolled = -rect.top;
    var progress = total > 0 ? scrolled / total : 0;
    progress = Math.max(0, Math.min(1, progress));   /* limitat la [0, 1] */

    /* Prima poza e deja asezata la intrare (dreapta, in centru);
       celelalte cad peste ea pe masura ce se deruleaza. */
    var END = 0.85;
    var t = progress / END;
    var shown = Math.floor(t * (photos.length - 1)) + 1;

    photos.forEach(function (photo, i) {
      if (i < shown) photo.classList.add('is-visible');
      else           photo.classList.remove('is-visible');
    });

    /* Cand a cazut si ultima, celelalte se misca putin — impactul */
    var album = photos[0].parentNode;
    if (shown >= photos.length) album.classList.add('is-settled');
    else                        album.classList.remove('is-settled');
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
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


/* ------------------------------------------------
   3b. INSTAGRAM MARQUEE
   Dublează imaginile (2× setul) ca bucla CSS (-50%)
   să fie continuă, fără salt vizibil.
   Sursa e locală acum; la trecerea pe Behold se va
   popula #igTrack din feed înainte de duplicare.
------------------------------------------------ */
function initInstaMarquee() {
  const track = document.getElementById('igTrack');
  if (!track) return;

  const items = Array.from(track.children);
  if (!items.length) return;

  // Clonează setul o dată pentru bucla infinită
  items.forEach(function (el) {
    const clone = el.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
  });
}


