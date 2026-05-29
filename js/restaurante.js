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

  /* ── Bottom sheet ───────────────────────────────────────── */
  var sheetEl    = document.getElementById('restPanel');
  var handleEl   = document.getElementById('restSheetHandle');
  var closeBtn   = document.getElementById('restSheetClose');
  var sheetState = 'hidden'; // 'hidden' | 'half' | 'full'

  /* Returnează true dacă viewport-ul e mobil (≤ 768px). */
  function isMobile() { return window.innerWidth <= 768; }

  /* Schimbă starea bottom sheet-ului și aplică clasa CSS corespunzătoare. */
  function setSheet(state) {
    sheetState = state;
    sheetEl.classList.remove('sheet--half', 'sheet--full');
    if (state === 'half') sheetEl.classList.add('sheet--half');
    if (state === 'full') sheetEl.classList.add('sheet--full');
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', function () { setSheet('hidden'); });
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
    var firstMeta = sheetEl.querySelector('.rest-card.is-active .rest-card__meta');
    var metaH     = firstMeta ? firstMeta.offsetHeight : 0;
    peekHeight    = handleH + listPadT + stickyH + bodyPadT + metaH;
    sheetEl.style.setProperty('--sheet-peek',  'calc(100% - ' + peekHeight + 'px)');
    sheetEl.style.setProperty('--peek-height', peekHeight + 'px');
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
    if (!isMobile()) return;
    swipeStartY = e.touches[0].clientY;
    swipeBaseY  = getBaseTranslatePx();
    sheetEl.style.transition = 'none';
    gestureType = null;
  }, { passive: true });

  sheetEl.addEventListener('touchmove', function (e) {
    if (!isMobile()) return;
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
    if (!isMobile()) return;
    var delta = e.changedTouches[0].clientY - swipeStartY;
    sheetEl.style.transform = '';
    sheetEl.style.transition = '';
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

  /* ── DOM refs ───────────────────────────────────────────── */
  const listEl         = document.getElementById('restList');
  const countEl        = document.getElementById('restCount');
  const searchEl       = document.getElementById('restSearch');
  const tabBtns        = document.querySelectorAll('.rest-tab');
  const mapWrap        = document.getElementById('restMapWrap');
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
  /* Creează un icon Leaflet custom (pin SVG) în stare activă sau inactivă. */
  function makeIcon(isActive) {
    return L.divIcon({
      html: '<div class="rest-marker' + (isActive ? ' is-active' : '') + '">' +
        '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>' +
        '</svg></div>',
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -34],
    });
  }

  /* ================================================
     3. POPUP HARTĂ
  ================================================ */
  /* Generează HTML-ul pentru popup-ul Leaflet al unui restaurant. */
  function makePopup(r) {
    let badges = '';
    if (r.features.mesoCafe) badges += '<span class="rest-badge rest-badge--cafe"><i class="fa-solid fa-mug-hot"></i> Meso Cafe</span>';
    if (r.features.mesoKids) badges += '<span class="rest-badge rest-badge--kids"><i class="fa-solid fa-child"></i> Meso Kids</span>';
    if (r.delivery.glovo)    badges += '<span class="rest-badge rest-badge--glovo">Glovo</span>';
    if (r.delivery.boltFood) badges += '<span class="rest-badge rest-badge--bolt">Bolt Food</span>';
    if (r.delivery.wolt)     badges += '<span class="rest-badge rest-badge--wolt">Wolt</span>';

    return '<div class="map-popup__name">' + r.name + '</div>' +
      '<div class="map-popup__row"><i class="fa-solid fa-location-dot"></i>' + r.address + '</div>' +
      '<div class="map-popup__row"><i class="fa-regular fa-clock"></i>' + r.hours + '</div>' +
      '<div class="map-popup__row"><i class="fa-solid fa-phone"></i>' + r.phone + '</div>' +
      (badges ? '<div class="map-popup__badges">' + badges + '</div>' : '');
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
    var visibleBottom = window.innerHeight - peekHeight;
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
      const marker = L.marker([r.lat, r.lng], { icon: makeIcon(false) });
      marker.bindPopup(makePopup(r), { maxWidth: 260, autoPan: false });

      marker.on('click', function () {
        setActive(r.id, false);
        scrollToCard(r.id);
        if (isMobile()) {
          marker.closePopup();
          panToPin(r.lat, r.lng);
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

      let featureBadges = '';
      if (r.features.mesoCafe) featureBadges += '<span class="rest-badge rest-badge--cafe"><i class="fa-solid fa-mug-hot"></i> Meso Cafe</span>';
      if (r.features.mesoKids) featureBadges += '<span class="rest-badge rest-badge--kids"><i class="fa-solid fa-child"></i> Meso Kids</span>';

      let deliveryBadges = '';
      if (r.delivery.glovo)    deliveryBadges += '<span class="rest-badge rest-badge--glovo">Glovo</span>';
      if (r.delivery.boltFood) deliveryBadges += '<span class="rest-badge rest-badge--bolt">Bolt Food</span>';
      if (r.delivery.wolt)     deliveryBadges += '<span class="rest-badge rest-badge--wolt">Wolt</span>';

      var bannerContent = r.image
        ? '<img class="rest-card__img" src="' + r.image + '" alt="' + r.name + '" loading="lazy">'
        : '<div class="rest-card__img-placeholder" style="background:' + getBannerStyle(r.id) + '"><i class="fa-solid fa-store"></i></div>';

      var mapsUrl = 'https://maps.google.com/?q=' + encodeURIComponent(r.address);

      card.innerHTML =
        '<div class="rest-card__sticky-header">' +
          '<div class="rest-card__banner">' + bannerContent + '</div>' +
          '<div class="rest-card__name">' + r.name + '</div>' +
        '</div>' +
        '<div class="rest-card__body">' +
          renderHours(r.hours) +
          '<a class="rest-card__meta rest-card__address" href="' + mapsUrl + '" target="_blank" rel="noopener"><i class="fa-solid fa-location-dot"></i>' + r.address + '</a>' +
          '<a class="rest-card__meta rest-card__tel" href="tel:' + r.phone.replace(/\s/g, '') + '"><i class="fa-solid fa-phone"></i>' + r.phone + '</a>' +
          (r.email ? '<a class="rest-card__meta rest-card__email" href="mailto:' + r.email + '"><i class="fa-regular fa-envelope"></i>' + r.email + '</a>' : '') +
          (featureBadges || deliveryBadges
            ? '<div class="rest-card__badge-groups">' +
                (featureBadges ? '<div class="rest-card__badge-row"><span class="rest-card__badge-label">Facilități</span><div class="rest-card__badge-wrap">' + featureBadges + '</div></div>' : '') +
                (deliveryBadges ? '<div class="rest-card__badge-row"><span class="rest-card__badge-label">Livrare</span><div class="rest-card__badge-wrap">' + deliveryBadges + '</div></div>' : '') +
              '</div>'
            : '') +
        '</div>';

      card.addEventListener('click', function (e) {
        if (e.target.closest('a')) return;
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

  /* ================================================
     8. ACTIVE STATE
  ================================================ */
  /*
   * Setează restaurantul activ: actualizează markerul pe hartă, cardul din listă
   * și starea bottom sheet-ului.
   * panMap=true → centrează harta pe pin (când sheet e half și se dă click pe card).
   */
  function setActive(id, panMap) {
    if (activeId && markers[activeId]) {
      markers[activeId].setIcon(makeIcon(false));
    }

    activeId = id;

    if (markers[id]) {
      markers[id].setIcon(makeIcon(true));
      if (panMap) {
        const r = allRestaurants.find(function (x) { return x.id === id; });
        if (r) {
          markerCluster.zoomToShowLayer(markers[id], function () {
            if (isMobile()) {
              panToPin(r.lat, r.lng);
            } else {
              map.setView([r.lat, r.lng], 14, { animate: true });
              markers[id].openPopup();
            }
          });
        }
      }
    }

    document.querySelectorAll('.rest-card').forEach(function (c) {
      c.classList.toggle('is-active', Number(c.dataset.id) === id);
    });

    // Click pe pin (panMap=false) → extinde sheet-ul la half pe mobile
    if (!panMap && isMobile()) {
      updatePeekHeight();
      setSheet('half');
    }
  }

  /* Scroll-ează lista până la cardul cu id-ul dat (desktop/tablet). */
  function scrollToCard(id) {
    const card = listEl.querySelector('[data-id="' + id + '"]');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ================================================
     9. FILTRARE + CĂUTARE
  ================================================ */
  /* Returnează lista filtrată după textul de search și filtrele active. */
  function getFiltered() {
    return allRestaurants.filter(function (r) {
      const q           = searchQuery.toLowerCase();
      const matchSearch = !q ||
        r.name.toLowerCase().includes(q)    ||
        r.city.toLowerCase().includes(q)    ||
        r.address.toLowerCase().includes(q) ||
        r.county.toLowerCase().includes(q);

      const matchFilter = activeFilters.size === 0 || Array.from(activeFilters).every(function (f) {
        if (f === 'mesoCafe')  return r.features.mesoCafe;
        if (f === 'mesoKids')  return r.features.mesoKids;
        if (f === 'glovo')     return r.delivery.glovo;
        if (f === 'boltFood')  return r.delivery.boltFood;
        if (f === 'wolt')      return r.delivery.wolt;
        return true;
      });

      return matchSearch && matchFilter;
    });
  }

  /* Rerenderează lista și markerii, apoi ajustează bounds hărții. */
  function update() {
    const filtered = getFiltered();
    renderList(filtered);
    buildMarkers(filtered);

    if (filtered.length && map) {
      const bounds = filtered.map(function (r) { return [r.lat, r.lng]; });
      map.fitBounds(bounds, { padding: [10, 10], maxZoom: 13 });
    }
  }

  /* ================================================
     10. EVENTS
  ================================================ */
  searchEl.addEventListener('focus', function () {
    if (isMobile()) setSheet('hidden');
  });

  searchEl.addEventListener('input', function () {
    searchQuery = searchEl.value.trim();
    update();
  });

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

  /* Tabs (tablet) — comută vizibilitatea între panoul cu lista și hartă */
  if (tabBtns.length) {
    tabBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        tabBtns.forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        const target = btn.dataset.tab;
        sheetEl.classList.toggle('is-visible', target === 'list');
        mapWrap.classList.toggle('is-visible', target === 'map');
        if (target === 'map') {
          setTimeout(function () { map.invalidateSize(); }, 320);
        }
      });
    });
  }

  /* ================================================
     11. ÎNCĂRCARE DATE
  ================================================ */
  fetch('data/restaurants.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      allRestaurants = data.restaurants;
      initMap();
      update();

      if (window.innerWidth > 1024) {
        // Desktop: panou stânga + hartă vizibile simultan
        sheetEl.classList.add('is-visible');
        mapWrap.classList.add('is-visible');
      } else if (window.innerWidth > 768) {
        // Tablet: lista vizibilă by default, harta la tab switch
        sheetEl.classList.add('is-visible');
        const firstTab = document.querySelector('.rest-tab[data-tab="list"]');
        if (firstTab) firstTab.classList.add('is-active');
      } else {
        // Mobile: harta fullscreen + bottom sheet
        sheetEl.classList.add('is-visible');
        mapWrap.classList.add('is-visible');
      }

      setTimeout(function () { map.invalidateSize(); }, 100);
    })
    .catch(function (err) {
      console.error('Eroare la încărcarea restaurantelor:', err);
      listEl.innerHTML = '<div class="rest-empty"><i class="fa-solid fa-triangle-exclamation"></i><span>Eroare la încărcarea locațiilor.</span></div>';
    });

})();
