(function () {
  'use strict';

  /* ── State global ───────────────────────────────────────── */
  let allRestaurants = [];
  let map            = null;
  let markers        = {};
  let markerCluster  = null;
  let activeId       = null;
  let activeFilters  = new Set();
  let searchQuery    = '';
  let userLocation   = null; // { lat, lng } când locația e activă
  let userMarker     = null; // marker Leaflet pentru "Tu ești aici"

  /* ── Bottom sheet ───────────────────────────────────────── */
  var sheetEl    = document.getElementById('restPanel');
  var handleEl   = document.getElementById('restSheetHandle');
  var closeBtn   = document.getElementById('restSheetClose');
  var sheetState = 'hidden'; // 'hidden' | 'half' | 'full'

  /* Sub 900px = mobile (hartă full + card peste hartă); de la 900px = desktop
     (hartă/listă + panou). Mobile se împarte în telefon (sheet cu swipe) și
     tabletă (modal centrat, fără swipe). */
  function isMobile() { return window.innerWidth < 900; }
  function isDesktop() { return window.innerWidth >= 900; }

  /* Telefon: bottom-sheet cu swipe (sub 641px). */
  function isPhone() { return window.innerWidth < 641; }

  /* Tabletă: modal centrat, fără swipe (641–899px). */
  function isTablet() { return window.innerWidth >= 641 && window.innerWidth < 900; }

  /* Schimbă starea bottom sheet-ului și aplică clasa CSS corespunzătoare. */
  function setSheet(state) {
    sheetState = state;
    sheetEl.classList.remove('sheet--half', 'sheet--full');
    if (state === 'half') sheetEl.classList.add('sheet--half');
    if (state === 'full') sheetEl.classList.add('sheet--full');
    var navEl = document.getElementById('navBottom');
    // Umbra has-sheet doar pe telefon (sheet lipit de nav); pe tabletă e modal centrat.
    if (navEl) navEl.classList.toggle('has-sheet', state !== 'hidden' && isPhone());
    if (state === 'hidden') {
      // Pe tabletă, lasă cardul vizibil pe durata fade-out-ului, apoi curăță
      // (altfel cardul devine display:none instant și modalul „se strânge").
      if (isTablet()) {
        setTimeout(clearActive, 250);
      } else {
        clearActive();
      }
    }
  }

  /* Dezactivează restaurantul activ: pinul redevine normal, cardul își pierde is-active. */
  function clearActive() {
    if (activeId && markers[activeId]) {
      setMarkerActive(markers[activeId], false);
    }
    activeId = null;
    document.querySelectorAll('.rest-card.is-active').forEach(function (c) {
      c.classList.remove('is-active');
    });
    // Desktop: revino la placeholderul „Alege o locație".
    if (isDesktop()) renderDetail(null);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', function () { setSheet('hidden'); });
  }

  /* Tabletă: click pe fundalul întunecat (overlay) închide modalul. */
  var tabletBackdrop = document.getElementById('restTabletBackdrop');
  if (tabletBackdrop) {
    tabletBackdrop.addEventListener('click', function () {
      if (isTablet()) setSheet('hidden');
    });
  }

  /* ── Swipe state ────────────────────────────────────────── */
  var swipeStartY = 0;
  var swipeBaseY  = 0;
  var peekHeight  = 325;
  var gestureType = null; // 'sheet' | 'card' | null

  /*
   * Recalculează înălțimea vizibilă a sheet-ului în starea "half"
   * măsurând elementele reale din DOM și setează variabilele CSS aferente.
   */
  function updatePeekHeight() {
    var handleH   = handleEl ? handleEl.offsetHeight : 0;
    var listPadT  = listEl   ? parseInt(getComputedStyle(listEl).paddingTop) || 0 : 0;
    var sticky    = sheetEl.querySelector('.rest-card.is-active .rest-card__sticky-header');
    var stickyH   = sticky ? sticky.offsetHeight : 0;
    var body      = sheetEl.querySelector('.rest-card.is-active .rest-card__body');
    var bodyPadT  = body ? parseInt(getComputedStyle(body).paddingTop) || 0 : 0;
    var allMeta   = sheetEl.querySelectorAll('.rest-card.is-active .rest-card__meta');
    var metaH     = allMeta.length > 0 ? allMeta[0].offsetHeight : 0;
    var meta2H    = allMeta.length > 1 ? Math.round(allMeta[1].offsetHeight * 0.45) : 30;
    peekHeight    = handleH + listPadT + stickyH + bodyPadT + metaH + meta2H;
    if (!sticky && isMobile()) {
      var countH    = countEl ? countEl.offsetHeight : 0;
      var firstCard = listEl  ? listEl.querySelector('.rest-card') : null;
      var cardPeek  = firstCard ? Math.round(firstCard.offsetHeight * 0.35) : 80;
      peekHeight   += countH + cardPeek;
    }
    sheetEl.style.setProperty('--sheet-peek',  'calc(100% - ' + peekHeight + 'px)');
    sheetEl.style.setProperty('--peek-height', peekHeight + 'px');

    // Offset de sus pentru starea full: marginea de jos a searchbar + gap egal cu
    // distanța searchbar↔header (padding-top toolbar). Astfel spațiul de sub searchbar
    // până la panoul full e identic cu cel de deasupra searchbar-ului.
    if (isMobile()) {
      var toolbar = document.querySelector('.rest-toolbar');
      if (toolbar) {
        var tb  = toolbar.getBoundingClientRect();
        var gap = parseInt(getComputedStyle(toolbar).paddingTop) || 8;
        sheetEl.style.setProperty('--sheet-top', (tb.bottom + gap) + 'px');
      }
    }
  }

  /* Returnează offsetul translateY curent al sheet-ului în pixeli. */
  function getBaseTranslatePx() {
    var h = sheetEl.offsetHeight;
    if (sheetState === 'half') return h - peekHeight;
    if (sheetState === 'full') return 0;
    return h;
  }

  /* ── Touch handlers pentru bottom sheet ─────────────────── */
  sheetEl.addEventListener('touchstart', function (e) {
    if (!isPhone()) return; // swipe doar pe telefon; tabletă = modal centrat
    swipeStartY = e.touches[0].clientY;
    swipeBaseY  = getBaseTranslatePx();
    sheetEl.style.transition = 'none';
    sheetEl.classList.add('is-swiping');
    gestureType = null;
  }, { passive: true });

  sheetEl.addEventListener('touchmove', function (e) {
    if (!isPhone()) return;
    var delta         = e.touches[0].clientY - swipeStartY;
    var activeCard    = listEl ? listEl.querySelector('.rest-card.is-active') : null;
    var cardScrollTop = activeCard ? activeCard.scrollTop : 0;

    // Determină tipul gestului o singură dată per touch-sequence
    if (gestureType === null) {
      if (sheetState === 'half') {
        gestureType = 'sheet'; // half: orice swipe expandează/închide sheet-ul
      } else if (Math.abs(delta) > 3) {
        // full: swipe jos din vârf = colapsare; altfel = scroll card
        gestureType = (delta > 0 && cardScrollTop === 0) ? 'sheet' : 'card';
      }
    }

    if (gestureType !== 'sheet') return;

    e.preventDefault(); // blochează scroll nativ cât timp mutăm sheet-ul
    var newY = Math.max(0, swipeBaseY + delta);
    sheetEl.style.transform = 'translateY(' + newY + 'px)';
  }, { passive: false });

  sheetEl.addEventListener('touchend', function (e) {
    if (!isPhone()) return;
    var delta = e.changedTouches[0].clientY - swipeStartY;
    sheetEl.style.transform = '';
    sheetEl.style.transition = '';
    sheetEl.classList.remove('is-swiping');
    if (gestureType === 'sheet') {
      if (delta > 80)                            setSheet(sheetState === 'full' ? 'half' : 'hidden');
      else if (delta < -80 && sheetState === 'half') setSheet('full');
    }
  }, { passive: true });

  /* ── Gradiente fallback pentru bannere fără imagine ─────── */
  var BANNER_GRADIENTS = [
    'linear-gradient(135deg, #6b0109 0%, #c4031b 100%)',
    'linear-gradient(135deg, #0a3d6b 0%, #1565c0 100%)',
    'linear-gradient(135deg, #1b4a1e 0%, #2e7d32 100%)',
    'linear-gradient(135deg, #4a1a42 0%, #7b1fa2 100%)',
    'linear-gradient(135deg, #5c2a00 0%, #bf6000 100%)',
  ];

  /* Returnează un gradient CSS ciclic bazat pe id-ul restaurantului. */
  function getBannerStyle(id) {
    return BANNER_GRADIENTS[(id - 1) % BANNER_GRADIENTS.length];
  }

  /* ── Toast ──────────────────────────────────────────────── */
  var toastTimer = null;

  /* Afișează un mesaj toast care dispare automat după `duration` ms. */
  function showToast(message, duration, type) {
    var el = document.getElementById('restToast');
    if (!el) return;
    clearTimeout(toastTimer);
    el.textContent = message;
    el.classList.toggle('is-error', type === 'error');
    el.classList.add('is-visible');
    toastTimer = setTimeout(function () {
      el.classList.remove('is-visible', 'is-error');
    }, duration || 3000);
  }

  /* ── DOM refs ───────────────────────────────────────────── */
  const listEl         = document.getElementById('restList');
  const countEl        = document.getElementById('restCount');
  const searchEl       = document.getElementById('restSearch');
  const mapWrap        = document.getElementById('restMapWrap');
  const shellEl        = document.querySelector('.rest-shell');
  const detailEl       = document.getElementById('restDetail');
  const viewToggleBtns = document.querySelectorAll('.rest-viewtoggle__btn');
  const filterBtn      = document.getElementById('restFilterBtn');
  const filterCount    = document.getElementById('restFilterCount');
  const filterOverlay  = document.getElementById('restFilterOverlay');
  const filterClose    = document.getElementById('restFilterClose');
  const filterBackdrop = document.getElementById('restFilterBackdrop');
  const filterReset    = document.getElementById('restFilterReset');
  const checkboxes     = filterOverlay ? filterOverlay.querySelectorAll('input[type="checkbox"]') : [];

  /* ================================================
     1. INIT HARTĂ
  ================================================ */
  /* Inițializează harta Leaflet cu tile-uri OSM, cluster de markeri și control zoom. */
  function initMap() {
    map = L.map('restMap', {
      center: [45.9432, 24.9668],
      zoom: 9,
      zoomControl: false,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const mapEl     = document.getElementById('restMap');
    const overlayEl = document.getElementById('mapLockOverlay');
    const hintSpan  = document.getElementById('mapScrollHint');
    const hintIcon  = document.getElementById('mapHintIcon');

    if (isMobile()) {
      map.dragging.enable();
      map.scrollWheelZoom.enable();
    } else {
      /* Desktop: Ctrl/Cmd + scroll pentru zoom, 2 degete pe touch */
      const isMac = /Mac|iPhone|iPod|iPad/.test(navigator.platform);
      if (hintSpan) hintSpan.textContent = 'Folosește ' + (isMac ? '⌘ Cmd' : 'Ctrl') + ' + Scroll pentru zoom pe hartă';
      let hintTimer = null;

      /* Afișează overlay-ul de hint și îl ascunde automat după 1.8s. */
      function showHint(icon, text) {
        if (!overlayEl) return;
        if (hintIcon) hintIcon.className = icon;
        if (hintSpan) hintSpan.textContent = text;
        overlayEl.classList.add('is-visible');
        clearTimeout(hintTimer);
        hintTimer = setTimeout(function () {
          overlayEl.classList.remove('is-visible');
        }, 1800);
      }

      mapEl.addEventListener('wheel', function (e) {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          map.scrollWheelZoom.enable();
        } else {
          map.scrollWheelZoom.disable();
          showHint('fa-solid fa-computer-mouse', 'Folosește ' + (isMac ? '⌘ Cmd' : 'Ctrl') + ' + Scroll pentru zoom pe hartă');
        }
      }, { passive: false });

      var isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      if (isTouchDevice) {
        map.dragging.disable();
        mapEl.addEventListener('touchstart', function (e) {
          if (e.touches.length >= 2) {
            map.dragging.enable();
            clearTimeout(hintTimer);
            overlayEl && overlayEl.classList.remove('is-visible');
          } else {
            map.dragging.disable();
            showHint('fa-solid fa-hand-pointer', 'Folosește 2 degete pentru a muta harta');
          }
        }, { passive: true });
        mapEl.addEventListener('touchend', function (e) {
          if (e.touches.length < 2) map.dragging.disable();
        }, { passive: true });
      }
    }

    markerCluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      iconCreateFunction: function (cluster) {
        return L.divIcon({
          html: '<div class="rest-cluster">' + cluster.getChildCount() + '</div>',
          className: '',
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });
      },
    });
    map.addLayer(markerCluster);
  }

  /* ================================================
     2. MARKER CUSTOM
  ================================================ */
  /* Creează un icon Leaflet custom (pin SVG). Pornește mereu inactiv;
     activarea se face ulterior prin setMarkerActive (toggle de clasă). */
  function makeIcon() {
    return L.divIcon({
      html: '<div class="rest-marker">' +
        '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>' +
        '</svg></div>',
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });
  }

  /* ================================================
     3. BADGE LIVRARE
  ================================================ */
  /*
   * Returnează HTML pentru un badge de livrare.
   * Dacă valoarea e un URL string, badge-ul devine link către acea platformă.
   */
  function deliveryBadge(value, cls, label) {
    if (!value) return '';
    const badge = '<span class="rest-badge rest-badge--' + cls + '">' + label + '</span>';
    return typeof value === 'string'
      ? '<a href="' + value + '" target="_blank" rel="noopener" class="rest-badge-link">' + badge + '</a>'
      : badge;
  }

  /* ================================================
     4. CENTRARE HARTĂ PE PIN (MOBILE)
  ================================================ */
  /*
   * Centrează harta pe coordonatele date, ținând cont de zona vizibilă:
   * header (sus) și bottom sheet (jos). Utilizat exclusiv pe mobile.
   */
  function panToPin(lat, lng) {
    var headerH       = (document.querySelector('.header') || { offsetHeight: 60 }).offsetHeight;
    var navEl         = document.getElementById('navBottom');
    var navH          = navEl ? navEl.offsetHeight : 0;
    var visibleBottom = window.innerHeight - navH - peekHeight;
    var desiredPinY   = headerH + (visibleBottom - headerH) * 0.5;
    var screenOffsetY = desiredPinY - window.innerHeight / 2;
    var zoom          = Math.max(map.getZoom(), 14);
    var pinPx         = map.project([lat, lng], zoom);
    var centerPx      = pinPx.subtract(L.point(0, screenOffsetY));
    map.setView(map.unproject(centerPx, zoom), zoom, { animate: true });
  }

  /* ================================================
     5. MARKERI
  ================================================ */
  /* Șterge toți markerii și îi reconstruiește din lista filtrată de restaurante. */
  function buildMarkers(restaurants) {
    markerCluster.clearLayers();
    markers = {};

    restaurants.forEach(function (r) {
      const marker = L.marker([r.lat, r.lng], { icon: makeIcon() });

      marker.on('click', function () {
        // Desktop: re-click pe pinul activ îl deselectează (revine la placeholder).
        if (isDesktop() && activeId === r.id) {
          clearActive();
          return;
        }
        // Dacă restaurantul nu e în lista curentă (filtrat de search), golește
        // search-ul ca să apară cardul lui — altfel sheet-ul ar fi gol.
        if (searchQuery && !matchesSearch(r)) {
          searchEl.value = '';
          searchQuery = '';
          updateSearchClear();
          update();
        }
        // Desktop mod Hartă: centrează pe pin + arată cardul în panoul de detaliu.
        setActive(r.id, isDesktop());
        scrollToCard(r.id);
        if (isPhone()) {
          updatePeekHeight();
          setSheet('half');
          panToPin(r.lat, r.lng);
        } else if (isTablet()) {
          // Tabletă: modal centrat complet, fără swipe.
          setSheet('full');
        }
      });

      markers[r.id] = marker;
      markerCluster.addLayer(marker);
    });
  }

  /* ================================================
     6. STATUS PROGRAM
  ================================================ */
  var DAY_MAP = { 'Lun': 1, 'Mar': 2, 'Mie': 3, 'Joi': 4, 'Vin': 5, 'Sâm': 6, 'Dum': 0 };

  /*
   * Parsează string-ul de ore (ex: "Lun–Vin 10:00–22:00 | Sâm–Dum 10:00–23:00")
   * și returnează statusul curent: { cls, label }.
   */
  function getStatus(hoursStr) {
    var now      = new Date();
    var today    = now.getDay();
    var nowMin   = now.getHours() * 60 + now.getMinutes();
    var segments = hoursStr.split('|').map(function (s) { return s.trim(); });

    for (var i = 0; i < segments.length; i++) {
      var m = segments[i].match(/^(\w+)(?:[–\-](\w+))?\s+(\d{1,2}):(\d{2})[–\-](\d{1,2}):(\d{2})$/);
      if (!m) continue;

      var dStart = DAY_MAP[m[1]];
      var dEnd   = m[2] ? DAY_MAP[m[2]] : dStart;
      if (dStart === undefined || dEnd === undefined) continue;

      var days = [];
      var d = dStart;
      for (var k = 0; k < 8; k++) {
        days.push(d);
        if (d === dEnd) break;
        d = (d + 1) % 7;
      }
      if (days.indexOf(today) === -1) continue;

      var openMin  = parseInt(m[3]) * 60 + parseInt(m[4]);
      var closeMin = parseInt(m[5]) * 60 + parseInt(m[6]);

      if (nowMin >= openMin && nowMin < closeMin) {
        if (closeMin - nowMin <= 30) return { cls: 'closing-soon', label: 'Închide în curând' };
        return { cls: 'open', label: 'Deschis' };
      }
      if (nowMin < openMin && openMin - nowMin <= 30) return { cls: 'opening-soon', label: 'Deschide în curând' };
    }

    return { cls: 'closed', label: 'Închis' };
  }

  /* Generează HTML-ul pentru rândul de ore al unui card, cu badge de status la final. */
  function renderHours(hoursStr) {
    var segments = hoursStr.split('|').map(function (s) { return s.trim(); });
    var status   = getStatus(hoursStr);
    var badge    = '<span class="rest-status rest-status--' + status.cls + '">' + status.label + '</span>';
    var lines    = segments.map(function (seg) {
      return '<span class="rest-card__hours-line">' + seg + '</span>';
    });
    return '<div class="rest-card__meta rest-card__hours">' +
      '<i class="fa-regular fa-clock"></i>' +
      '<span class="rest-card__hours-lines">' + lines.join('') + badge + '</span>' +
    '</div>';
  }

  /* ================================================
     7. RENDER LISTĂ
  ================================================ */
  /* Construiește HTML-ul interior al unui card de restaurant (reutilizat de listă
     și de panoul de detaliu desktop). */
  function buildCardHTML(r) {
    let featureBadges = '';
    if (r.features.mesoCafe) featureBadges += '<span class="rest-badge rest-badge--cafe"><i class="fa-solid fa-mug-hot"></i> Meso Cafe</span>';
    if (r.features.mesoKids) featureBadges += '<span class="rest-badge rest-badge--kids"><i class="fa-solid fa-child"></i> Meso Kids</span>';
    if (r.features.terasa)   featureBadges += '<span class="rest-badge rest-badge--terasa"><i class="fa-solid fa-umbrella-beach"></i> Terasă</span>';

    let deliveryBadges = '';
    deliveryBadges += deliveryBadge(r.delivery.glovo,    'glovo', 'Glovo');
    deliveryBadges += deliveryBadge(r.delivery.boltFood, 'bolt',  'Bolt Food');
    deliveryBadges += deliveryBadge(r.delivery.wolt,     'wolt',  'Wolt');

    var bannerContent = r.image
      ? '<img class="rest-card__img" src="' + r.image + '" alt="' + r.name + '" loading="lazy">'
      : '<div class="rest-card__img-placeholder" style="background:' + getBannerStyle(r.id) + '"><i class="fa-solid fa-store"></i></div>';

    var dirUrl  = 'https://www.google.com/maps/dir/?api=1&destination=' +
      (r.lat != null && r.lng != null ? r.lat + ',' + r.lng : encodeURIComponent(r.address));

    return '<div class="rest-card__sticky-header">' +
        '<div class="rest-card__banner">' + bannerContent + '</div>' +
        '<div class="rest-card__name">' + r.name + '</div>' +
      '</div>' +
      '<div class="rest-card__body">' +
        renderHours(r.hours) +
        '<a class="rest-card__meta rest-card__address" href="' + dirUrl + '" target="_blank" rel="noopener" aria-label="Direcții către ' + r.name + ' – ' + r.address + '"><i class="fa-solid fa-location-dot"></i><span>' + r.address + '</span><i class="fa-solid fa-diamond-turn-right rest-card__address-go" aria-hidden="true"></i></a>' +
        '<a class="rest-card__meta rest-card__tel" href="tel:' + r.phone.replace(/\s/g, '') + '"><i class="fa-solid fa-phone"></i>' + r.phone + '</a>' +
        (r.email ? '<a class="rest-card__meta rest-card__email" href="mailto:' + r.email + '"><i class="fa-regular fa-envelope"></i>' + r.email + '</a>' : '') +
        (featureBadges || deliveryBadges
          ? '<div class="rest-card__badge-groups">' +
              (featureBadges ? '<div class="rest-card__badge-row"><span class="rest-card__badge-label">Facilități</span><div class="rest-card__badge-wrap">' + featureBadges + '</div></div>' : '') +
              (deliveryBadges ? '<div class="rest-card__badge-row"><span class="rest-card__badge-label">Livrare</span><div class="rest-card__badge-wrap">' + deliveryBadges + '</div></div>' : '') +
            '</div>'
          : '') +
      '</div>';
  }

  /* Randează lista de carduri în DOM folosind DocumentFragment pentru performanță. */
  function renderList(restaurants) {
    listEl.innerHTML = '';
    countEl.textContent = restaurants.length + ' locații';

    if (!restaurants.length) {
      listEl.innerHTML = '<div class="rest-empty"><i class="fa-solid fa-store-slash"></i><span>Nicio locație găsită.</span><span>Încearcă un alt termen de căutare.</span></div>';
      return;
    }

    const frag = document.createDocumentFragment();
    restaurants.forEach(function (r) {
      const card = document.createElement('div');
      card.className = 'rest-card' + (r.id === activeId ? ' is-active' : '');
      card.dataset.id = r.id;

      card.innerHTML = buildCardHTML(r);

      card.addEventListener('click', function (e) {
        if (e.target.closest('a')) return;
        // Desktop (mod Listă): re-click pe cardul selectat îl deselectează.
        if (isDesktop() && activeId === r.id) {
          clearActive();
          return;
        }
        // Centrează harta pe pin doar când sheet-ul e pe jumătate deschis
        setActive(r.id, isMobile() && sheetState === 'half');
        var rect     = card.getBoundingClientRect();
        var listRect = listEl.getBoundingClientRect();
        if (rect.top < listRect.top || rect.bottom > listRect.bottom) {
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });

      frag.appendChild(card);
    });
    listEl.appendChild(frag);
  }

  /* Randează cardul unui restaurant în panoul de detaliu desktop (mod Hartă).
     Cu r === null afișează placeholderul „Alege o locație". */
  /* Construiește HTML-ul placeholderului „Alege o locație" (după mod). */
  function detailPlaceholderHTML() {
    var listMode = shellEl && shellEl.dataset.view === 'list';
    var icon  = listMode ? 'fa-store' : 'fa-map-location-dot';
    var title = listMode ? 'Alege un restaurant' : 'Alege o locație de pe hartă';
    var hint  = listMode
      ? 'Apasă pe un card ca să vezi detaliile restaurantului.'
      : 'Apasă pe un pin ca să vezi detaliile restaurantului.';
    return '<div class="rest-detail__placeholder">' +
      '<i class="fa-solid ' + icon + '" aria-hidden="true"></i>' +
      '<span>' + title + '</span>' +
      '<span class="rest-detail__placeholder-hint">' + hint + '</span>' +
    '</div>';
  }

  function renderDetail(r) {
    if (!detailEl) return;
    if (!r) {
      // Deselectare: dacă există un card, fade-out înainte de placeholder.
      var existing = detailEl.querySelector('.rest-card');
      if (existing) {
        detailEl.classList.add('is-leaving');
        setTimeout(function () {
          detailEl.classList.remove('is-leaving');
          detailEl.innerHTML = detailPlaceholderHTML();
        }, 200);
      } else {
        detailEl.innerHTML = detailPlaceholderHTML();
      }
      return;
    }
    detailEl.classList.remove('is-leaving'); // anulează un fade-out în curs
    const card = document.createElement('div');
    card.className = 'rest-card is-active';
    card.dataset.id = r.id;
    card.innerHTML = buildCardHTML(r);

    // Desktop: poza rămâne fixă sus, restul (titlu + info) într-o zonă scrollabilă
    // cu scrollbar propriu — ca la modalul de produs din meniu.
    var banner = card.querySelector('.rest-card__banner');
    var name   = card.querySelector('.rest-card__name');
    var body   = card.querySelector('.rest-card__body');
    if (banner && name && body) {
      var scroller = document.createElement('div');
      scroller.className = 'rest-detail__scroll';
      scroller.appendChild(name);
      scroller.appendChild(body);
      // Buton de închidere (deselectare) peste poză
      var closeDetail = document.createElement('button');
      closeDetail.className = 'rest-detail__close';
      closeDetail.setAttribute('aria-label', 'Închide');
      closeDetail.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
      closeDetail.addEventListener('click', clearActive);
      card.innerHTML = '';
      card.appendChild(banner);
      card.appendChild(closeDetail);
      card.appendChild(scroller);
    }

    detailEl.innerHTML = '';
    detailEl.appendChild(card);
    var scroller2 = card.querySelector('.rest-detail__scroll');
    if (scroller2) scroller2.scrollTop = 0;
    updateDetailScrolled();
  }

  /* Marchează panoul de detaliu cu .is-scrolled doar dacă zona de sub poză
     are conținut scrollabil și a fost derulată (controlează umbra sub poză). */
  function updateDetailScrolled() {
    if (!detailEl) return;
    var sc = detailEl.querySelector('.rest-detail__scroll');
    var scrolled = sc && (sc.scrollHeight - sc.clientHeight > 4) && sc.scrollTop > 4;
    detailEl.classList.toggle('is-scrolled', !!scrolled);
  }

  /* ================================================
     8. ACTIVE STATE
  ================================================ */
  /* Comută clasa is-active pe elementul DOM al markerului (păstrează nodul
     ca să se vadă tranziția CSS, în loc să recreeze iconul cu setIcon). */
  function setMarkerActive(marker, active) {
    if (!marker) return;
    var el = marker.getElement();
    var dot = el && el.querySelector('.rest-marker');
    if (dot) dot.classList.toggle('is-active', active);
  }

  /*
   * Setează restaurantul activ: actualizează markerul pe hartă, cardul din listă
   * și starea bottom sheet-ului.
   * panMap=true → centrează harta pe pin (când sheet e half și se dă click pe card).
   */
  function setActive(id, panMap) {
    if (activeId && markers[activeId]) {
      setMarkerActive(markers[activeId], false);
    }

    activeId = id;

    if (markers[id]) {
      setMarkerActive(markers[id], true);
      if (panMap) {
        const r = getRestaurantById(id);
        if (r) {
          markerCluster.zoomToShowLayer(markers[id], function () {
            // Pinul tocmai a fost scos din cluster și randat → re-aplică starea activă
            // (getElement() era null cât timp pinul era ascuns/clusterizat).
            setMarkerActive(markers[id], true);
            if (isMobile()) {
              panToPin(r.lat, r.lng);
            } else {
              // Zoom mai aproape pe desktop ca pinul să iasă din cluster și să fie izolat.
              map.setView([r.lat, r.lng], 16, { animate: true });
            }
          });
        }
      }
    }

    document.querySelectorAll('.rest-card').forEach(function (c) {
      c.classList.toggle('is-active', Number(c.dataset.id) === id);
    });

    // Desktop: umple panoul de detaliu cu restaurantul activ.
    if (isDesktop()) {
      const r = getRestaurantById(id);
      if (r) renderDetail(r);
    }
  }

  /* Găsește un restaurant după id în lista încărcată. */
  function getRestaurantById(id) {
    return allRestaurants.find(function (x) { return x.id === id; });
  }

  /* Scroll-ează lista până la cardul cu id-ul dat (desktop/tablet). */
  function scrollToCard(id) {
    const card = listEl.querySelector('[data-id="' + id + '"]');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ================================================
     9. FILTRARE + CĂUTARE
  ================================================ */
  function normalize(str) {
    return str.toLowerCase()
      .replace(/[ăâ]/g, 'a')
      .replace(/[î]/g,  'i')
      .replace(/[șş]/g, 's')
      .replace(/[țţ]/g, 't');
  }

  /* True dacă restaurantul trece de filtrele active (checkbox-uri). */
  function matchesFilters(r) {
    return activeFilters.size === 0 || Array.from(activeFilters).every(function (f) {
      if (f === 'openNow')   { var cls = getStatus(r.hours).cls; return cls === 'open' || cls === 'closing-soon'; }
      if (f === 'mesoCafe')  return r.features.mesoCafe;
      if (f === 'mesoKids')  return r.features.mesoKids;
      if (f === 'terasa')    return r.features.terasa;
      if (f === 'glovo')     return r.delivery.glovo;
      if (f === 'boltFood')  return r.delivery.boltFood;
      if (f === 'wolt')      return r.delivery.wolt;
      return true;
    });
  }

  /* True dacă restaurantul se potrivește textului de căutare. */
  function matchesSearch(r) {
    const q = normalize(searchQuery);
    return !q || normalize(r.name).includes(q) || normalize(r.city).includes(q);
  }

  /* Lista (filtre + search) — ce se afișează în panoul cu carduri. */
  function getListResults() {
    return allRestaurants.filter(function (r) {
      return matchesFilters(r) && matchesSearch(r);
    });
  }

  /* Harta (doar filtre) — search-ul nu ascunde pinii, doar mută harta pe
     rezultate. Astfel locațiile din jur rămân vizibile când cauți un oraș. */
  function getMapResults() {
    return allRestaurants.filter(matchesFilters);
  }

  /* Rerenderează lista și markerii, apoi ajustează bounds hărții. */
  function update() {
    const listResults = getListResults();
    const mapResults  = getMapResults();

    // Dacă restaurantul activ nu mai trece filtrele, deselectează-l ca să nu
    // rămână un card gol în sheet (mobile) / panou (desktop).
    if (activeId != null && !mapResults.some(function (r) { return r.id === activeId; })) {
      if (isMobile()) {
        setSheet('hidden'); // setSheet('hidden') apelează clearActive()
      } else {
        clearActive();
      }
    }

    renderList(listResults);
    buildMarkers(mapResults);

    if (map && !userLocation) {
      // Zoom pe rezultatele căutate dacă există; altfel pe tot ce e pe hartă.
      const focusList = listResults.length ? listResults : mapResults;
      if (focusList.length) {
        const bounds = focusList.map(function (r) { return [r.lat, r.lng]; });
        map.fitBounds(bounds, { padding: [10, 10], maxZoom: 13 });
      }
    }
  }

  /* ================================================
     10. LOCAȚIE
  ================================================ */

  /* Dezactivează modul "lângă mine": șterge markerul, state-ul și starea
     activă de pe butoane. NU re-randează (apelantul decide când). */
  function clearLocation() {
    if (!userLocation) return;
    userLocation = null;
    if (userMarker) { map.removeLayer(userMarker); userMarker = null; }
    [document.getElementById('restLocationBtn'), document.getElementById('restLocationBtnMap')]
      .forEach(function (b) { if (b) b.classList.remove('is-active'); });
  }

  /*
   * Activează sau dezactivează modul "lângă mine".
   * Dacă locația e deja activă, o resetează. Altfel solicită permisiunea.
   */
  function toggleLocation() {
    var btn = document.getElementById('restLocationBtn');

    var allBtns = [document.getElementById('restLocationBtn'), document.getElementById('restLocationBtnMap')];

    if (userLocation) {
      clearLocation();
      update();
      return;
    }

    if (!navigator.geolocation) {
      showToast('Browserul tău nu suportă localizarea.', 3000, 'error');
      return;
    }

    btn.classList.add('is-loading');

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        allBtns.forEach(function (b) { if (b) b.classList.remove('is-loading'); });
        allBtns.forEach(function (b) { if (b) b.classList.add('is-active'); });

        // Marker "Tu ești aici"
        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.marker([userLocation.lat, userLocation.lng], {
          icon: L.divIcon({
            html: '<div class="rest-user-marker"><i class="fa-solid fa-person"></i></div>',
            className: '',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          }),
          zIndexOffset: 1000,
        }).addTo(map);

        update();
        map.setView([userLocation.lat, userLocation.lng], 13, { animate: true });
      },
      function () {
        allBtns.forEach(function (b) { if (b) b.classList.remove('is-loading'); });
        showToast('Nu s-a putut obține locația. Verifică permisiunile.', 3000, 'error');
      },
      { timeout: 8000 }
    );
  }

  /* ================================================
     11. EVENTS
  ================================================ */
  searchEl.addEventListener('focus', function () {
    if (isMobile()) setSheet('hidden');
  });

  var searchClearBtn = document.getElementById('restSearchClear');

  /* Arată butonul X doar când există text în câmpul de căutare. */
  function updateSearchClear() {
    if (searchClearBtn) searchClearBtn.hidden = searchEl.value.length === 0;
  }

  searchEl.addEventListener('input', function () {
    searchQuery = searchEl.value.trim();
    // Căutarea oprește modul "lângă mine": altfel harta ar rămâne pe locația ta,
    // nu pe rezultatele căutate.
    if (searchQuery && userLocation) clearLocation();
    updateSearchClear();
    update();
  });

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', function () {
      searchEl.value = '';
      searchQuery = '';
      updateSearchClear();
      update();
      searchEl.focus();
    });
  }

  /* ── Filter modal ───────────────────────────────────────── */

  /* Actualizează badge-ul numeric de pe butonul de filtrare. */
  function updateFilterBadge() {
    const n = activeFilters.size;
    filterBtn.classList.toggle('has-filters', n > 0);
    filterCount.hidden     = n === 0;
    filterCount.textContent = n;
  }

  /* Deschide modalul/sheet-ul de filtrare. */
  function openFilterModal() {
    filterOverlay.classList.add('is-open');
    filterOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  /* Închide modalul/sheet-ul de filtrare. */
  function closeFilterModal() {
    filterOverlay.classList.remove('is-open');
    filterOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  filterBtn.addEventListener('click', openFilterModal);
  filterClose.addEventListener('click', closeFilterModal);
  filterBackdrop.addEventListener('click', closeFilterModal);

  /* Swipe-down pentru a închide filter sheet pe mobile */
  const filterSheet = filterOverlay ? filterOverlay.querySelector('.rest-filter-modal') : null;
  const filterBody  = filterOverlay ? filterOverlay.querySelector('.rest-filter-modal__body') : null;
  if (filterSheet) {
    let swipeStartY = 0;

    filterSheet.addEventListener('touchstart', function (e) {
      swipeStartY = e.touches[0].clientY;
      filterSheet.style.transition = 'none';
    }, { passive: true });

    filterSheet.addEventListener('touchmove', function (e) {
      const delta = e.touches[0].clientY - swipeStartY;
      if (delta > 0 && (!filterBody || filterBody.scrollTop === 0)) {
        filterSheet.style.transform = 'translateY(' + delta + 'px)';
      }
    }, { passive: true });

    filterSheet.addEventListener('touchend', function (e) {
      const delta = e.changedTouches[0].clientY - swipeStartY;
      filterSheet.style.transform = '';
      filterSheet.style.transition = '';
      if (delta > 80) closeFilterModal();
    }, { passive: true });
  }

  filterReset.addEventListener('click', function () {
    activeFilters.clear();
    checkboxes.forEach(function (cb) { cb.checked = false; });
    updateFilterBadge();
    update();
  });

  checkboxes.forEach(function (cb) {
    cb.addEventListener('change', function () {
      if (cb.checked) activeFilters.add(cb.value);
      else            activeFilters.delete(cb.value);
      updateFilterBadge();
      update();
    });
  });

  /* Comutator Hartă / Listă (desktop) — schimbă data-view pe shell. */
  if (viewToggleBtns.length && shellEl) {
    viewToggleBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const view = btn.dataset.view;
        if (shellEl.dataset.view === view) return;
        viewToggleBtns.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        shellEl.dataset.view = view;
        if (view === 'map') {
          // Harta a fost ascunsă în mod Listă → recalculează dimensiunea,
          // apoi centrează pe restaurantul selectat din listă (dacă există).
          setTimeout(function () {
            map.invalidateSize();
            if (activeId != null && markers[activeId]) {
              setActive(activeId, true);
            }
          }, 320);
        } else {
          // Mod Listă: sincronizează panoul de detaliu cu selecția curentă.
          var ar = activeId != null ? getRestaurantById(activeId) : null;
          renderDetail(ar || null);
        }
      });
    });
  }

  /* Umbra de sub poză apare la scroll-ul zonei de info (capture, scroll nu face bubble) */
  if (detailEl) {
    detailEl.addEventListener('scroll', updateDetailScrolled, true);
  }

  /* Escape deselectează restaurantul activ (desktop) */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isDesktop() && activeId != null) {
      clearActive();
    }
  });

  var locationBtn    = document.getElementById('restLocationBtn');
  var locationBtnMap = document.getElementById('restLocationBtnMap');
  if (locationBtn)    locationBtn.addEventListener('click', toggleLocation);
  if (locationBtnMap) locationBtnMap.addEventListener('click', toggleLocation);

  /* Recalculează înălțimile dinamice la resize / rotire ecran. */
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (isMobile()) updatePeekHeight();
    }, 150);
  });

  /* ================================================
     12. ÎNCĂRCARE DATE
  ================================================ */
  fetch('data/restaurants.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      allRestaurants = data.restaurants;
      initMap();
      update();

      sheetEl.classList.add('is-visible');
      mapWrap.classList.add('is-visible');
      if (isDesktop()) {
        // Desktop: panou + hartă simultan; mod Hartă implicit
        if (shellEl) shellEl.dataset.view = 'map';
        renderDetail(null); // placeholder „Alege o locație"
      }
      // Mobile (<900px): harta fullscreen + bottom sheet (clasele de mai sus)

      // Calculează înălțimile dinamice (--sheet-top / --sheet-peek) din DOM-ul real,
      // ca să nu se folosească valorile fallback hardcodate din CSS.
      updatePeekHeight();

      setTimeout(function () { map.invalidateSize(); }, 100);
    })
    .catch(function (err) {
      console.error('Eroare la încărcarea restaurantelor:', err);
      listEl.innerHTML = '<div class="rest-empty"><i class="fa-solid fa-triangle-exclamation"></i><span>Eroare la încărcarea locațiilor.</span></div>';
    });

})();
