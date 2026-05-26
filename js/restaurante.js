(function () {
  'use strict';

  let allRestaurants = [];
  let map = null;
  let markers = {};
  let markerCluster = null;
  let activeId = null;
  let activeFilters = new Set(); /* gol = toate */
  let searchQuery = '';

  var BANNER_GRADIENTS = [
    'linear-gradient(135deg, #6b0109 0%, #c4031b 100%)',
    'linear-gradient(135deg, #0a3d6b 0%, #1565c0 100%)',
    'linear-gradient(135deg, #1b4a1e 0%, #2e7d32 100%)',
    'linear-gradient(135deg, #4a1a42 0%, #7b1fa2 100%)',
    'linear-gradient(135deg, #5c2a00 0%, #bf6000 100%)',
  ];

  function getBannerStyle(id) {
    return BANNER_GRADIENTS[(id - 1) % BANNER_GRADIENTS.length];
  }

  /* ---- DOM refs ---- */
  const listEl        = document.getElementById('restList');
  const countEl       = document.getElementById('restCount');
  const searchEl      = document.getElementById('restSearch');
  const tabBtns       = document.querySelectorAll('.rest-tab');
  const panelEl       = document.getElementById('restPanel');
  const mapWrap       = document.getElementById('restMapWrap');
  const filterBtn     = document.getElementById('restFilterBtn');
  const filterCount   = document.getElementById('restFilterCount');
  const filterOverlay = document.getElementById('restFilterOverlay');
  const filterClose   = document.getElementById('restFilterClose');
  const filterBackdrop= document.getElementById('restFilterBackdrop');
  const filterReset   = document.getElementById('restFilterReset');
  const checkboxes    = filterOverlay ? filterOverlay.querySelectorAll('input[type="checkbox"]') : [];

  /* ================================================
     1. INIT HARTA
  ================================================ */
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

    /* Ctrl/Cmd + scroll pentru zoom */
    const mapEl     = document.getElementById('restMap');
    const overlayEl = document.getElementById('mapLockOverlay');
    const hintSpan  = document.getElementById('mapScrollHint');
    const hintIcon  = document.getElementById('mapHintIcon');
    const isMac     = /Mac|iPhone|iPod|iPad/.test(navigator.platform);
    if (hintSpan) hintSpan.textContent = 'Folosește ' + (isMac ? '⌘ Cmd' : 'Ctrl') + ' + Scroll pentru zoom pe hartă';
    let hintTimer   = null;

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
        showHint(
          'fa-solid fa-computer-mouse',
          'Folosește ' + (isMac ? '⌘ Cmd' : 'Ctrl') + ' + Scroll pentru zoom pe hartă'
        );
      }
    }, { passive: false });

    /* Touch: 2 degete pentru drag pe mobile */
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
        if (e.touches.length < 2) {
          map.dragging.disable();
        }
      }, { passive: true });
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
     3. POPUP CONTENT
  ================================================ */
  function makePopup(r) {
    let badges = '';
    if (r.features.mesoCafe)   badges += '<span class="rest-badge rest-badge--cafe"><i class="fa-solid fa-mug-hot"></i> Meso Cafe</span>';
    if (r.features.mesoKids)   badges += '<span class="rest-badge rest-badge--kids"><i class="fa-solid fa-child"></i> Meso Kids</span>';
    if (r.delivery.glovo)      badges += '<span class="rest-badge rest-badge--glovo">Glovo</span>';
    if (r.delivery.boltFood)   badges += '<span class="rest-badge rest-badge--bolt">Bolt Food</span>';
    if (r.delivery.wolt)       badges += '<span class="rest-badge rest-badge--wolt">Wolt</span>';

    return '<div class="map-popup__name">' + r.name + '</div>' +
      '<div class="map-popup__row"><i class="fa-solid fa-location-dot"></i>' + r.address + '</div>' +
      '<div class="map-popup__row"><i class="fa-regular fa-clock"></i>' + r.hours + '</div>' +
      '<div class="map-popup__row"><i class="fa-solid fa-phone"></i>' + r.phone + '</div>' +
      (badges ? '<div class="map-popup__badges">' + badges + '</div>' : '');
  }

  /* ================================================
     4. ADAUGĂ MARKERI
  ================================================ */
  function buildMarkers(restaurants) {
    markerCluster.clearLayers();
    markers = {};

    restaurants.forEach(function (r) {
      const marker = L.marker([r.lat, r.lng], { icon: makeIcon(false) });
      marker.bindPopup(makePopup(r), { maxWidth: 260, autoPan: false });

      marker.on('click', function () {
        setActive(r.id, false);
        scrollToCard(r.id);
      });

      markers[r.id] = marker;
      markerCluster.addLayer(marker);
    });
  }

  /* ================================================
     5. RENDER LISTA
  ================================================ */
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

      let badges = '';
      if (r.features.mesoCafe)  badges += '<span class="rest-badge rest-badge--cafe"><i class="fa-solid fa-mug-hot"></i> Cafe</span>';
      if (r.features.mesoKids)  badges += '<span class="rest-badge rest-badge--kids"><i class="fa-solid fa-child"></i> Kids</span>';
      if (r.delivery.glovo)     badges += '<span class="rest-badge rest-badge--glovo">Glovo</span>';
      if (r.delivery.boltFood)  badges += '<span class="rest-badge rest-badge--bolt">Bolt Food</span>';
      if (r.delivery.wolt)      badges += '<span class="rest-badge rest-badge--wolt">Wolt</span>';

      card.innerHTML =
        '<div class="rest-card__banner">' +
          '<div class="rest-card__img-placeholder" style="background:' + getBannerStyle(r.id) + '">' +
            '<i class="fa-solid fa-store"></i>' +
          '</div>' +
        '</div>' +
        '<div class="rest-card__body">' +
          '<div class="rest-card__name">' + r.name + '</div>' +
          '<div class="rest-card__meta"><i class="fa-solid fa-location-dot"></i>' + r.city + ', ' + r.county + '</div>' +
          '<div class="rest-card__meta"><i class="fa-regular fa-clock"></i>' + r.hours + '</div>' +
          '<div class="rest-card__meta"><i class="fa-solid fa-phone"></i>' + r.phone + '</div>' +
          (badges ? '<div class="rest-card__badges">' + badges + '</div>' : '') +
        '</div>';

      card.addEventListener('click', function () {
        setActive(r.id, true);
      });

      frag.appendChild(card);
    });
    listEl.appendChild(frag);
  }

  /* ================================================
     6. ACTIVE STATE
  ================================================ */
  function setActive(id, panMap) {
    // Reset marker anterior
    if (activeId && markers[activeId]) {
      markers[activeId].setIcon(makeIcon(false));
    }

    activeId = id;

    // Activează marker
    if (markers[id]) {
      markers[id].setIcon(makeIcon(true));
      if (panMap) {
        const r = allRestaurants.find(function (x) { return x.id === id; });
        if (r) {
          markerCluster.zoomToShowLayer(markers[id], function () {
            map.setView([r.lat, r.lng], 14, { animate: true });
            markers[id].openPopup();
          });
        }
      }
    }

    // Activează card
    document.querySelectorAll('.rest-card').forEach(function (c) {
      c.classList.toggle('is-active', Number(c.dataset.id) === id);
    });
  }

  function scrollToCard(id) {
    const card = listEl.querySelector('[data-id="' + id + '"]');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ================================================
     7. FILTRARE
  ================================================ */
  function getFiltered() {
    return allRestaurants.filter(function (r) {
      const q = searchQuery.toLowerCase();
      const matchSearch = !q ||
        r.name.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q) ||
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

  function update() {
    const filtered = getFiltered();
    renderList(filtered);
    buildMarkers(filtered);

    if (filtered.length && map) {
      const bounds = filtered.map(function (r) { return [r.lat, r.lng]; });
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
  }

  /* ================================================
     8. EVENTS
  ================================================ */
  searchEl.addEventListener('input', function () {
    searchQuery = searchEl.value.trim();
    update();
  });

  /* ---- Filter modal ---- */
  function updateFilterBadge() {
    const n = activeFilters.size;
    filterBtn.classList.toggle('has-filters', n > 0);
    filterCount.hidden = n === 0;
    filterCount.textContent = n;
  }

  function openFilterModal() {
    filterOverlay.classList.add('is-open');
    filterOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeFilterModal() {
    filterOverlay.classList.remove('is-open');
    filterOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  filterBtn.addEventListener('click', openFilterModal);
  filterClose.addEventListener('click', closeFilterModal);
  filterBackdrop.addEventListener('click', closeFilterModal);

  /* Swipe-down to close (mobile) */
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
      if (cb.checked) {
        activeFilters.add(cb.value);
      } else {
        activeFilters.delete(cb.value);
      }
      updateFilterBadge();
      update();
    });
  });

  /* Tabs (tablet) */
  if (tabBtns.length) {
    tabBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        tabBtns.forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        const target = btn.dataset.tab;
        panelEl.classList.toggle('is-visible', target === 'list');
        mapWrap.classList.toggle('is-visible', target === 'map');
        if (target === 'map') {
          setTimeout(function () { map.invalidateSize(); }, 320);
        }
      });
    });
  }

  /* ================================================
     9. ÎNCĂRCARE DATE
  ================================================ */
  fetch('data/restaurants.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      allRestaurants = data.restaurants;
      initMap();
      update();

      // Pe desktop panel + map ambele vizibile by default
      if (window.innerWidth > 1024) {
        panelEl.classList.add('is-visible');
        mapWrap.classList.add('is-visible');
      } else if (window.innerWidth > 768) {
        // Tablet: lista vizibilă by default
        panelEl.classList.add('is-visible');
        const firstTab = document.querySelector('.rest-tab[data-tab="list"]');
        if (firstTab) firstTab.classList.add('is-active');
      } else {
        // Mobile: ambele vizibile (harta sus, lista jos)
        panelEl.classList.add('is-visible');
        mapWrap.classList.add('is-visible');
      }

      setTimeout(function () { map.invalidateSize(); }, 100);
    })
    .catch(function (err) {
      console.error('Eroare la încărcarea restaurantelor:', err);
      listEl.innerHTML = '<div class="rest-empty"><i class="fa-solid fa-triangle-exclamation"></i><span>Eroare la încărcarea locațiilor.</span></div>';
    });

})();
