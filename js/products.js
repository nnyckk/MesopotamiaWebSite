(function () {
  const main = document.getElementById('meniuContent');
  if (!main) return;

  var _categories = [];

  fetch('data/products.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      _categories = data.categories;
      renderCategories(data.categories);
      document.dispatchEvent(new CustomEvent('products:rendered'));
      initModal();
    })
    .catch(function (err) {
      console.error('Nu s-a putut încărca products.json:', err);
    });

  function renderCategories(categories) {
    main.innerHTML = categories.map(function (cat, ci) {
      return renderSection(cat, ci);
    }).join('');
  }

  function renderSection(cat, ci) {
    var products = cat.products.map(function (p, pi) {
      return renderCard(p, ci, pi);
    }).join('');

    return '<section class="menu-section" id="' + cat.id + '" aria-labelledby="title-' + cat.id + '">' +
      '<h2 class="menu-section__title" id="title-' + cat.id + '">' + cat.title + '</h2>' +
      '<div class="product-grid">' + products + '</div>' +
      '</section>';
  }

  function renderCard(p, ci, pi) {
    var displayWeight, displayPrice;
    if (p.variants && p.variants.length) {
      displayWeight = p.variants[0].weight;
      displayPrice = p.variants[0].price;
    } else {
      displayWeight = p.weight;
      displayPrice = p.price;
    }
    return '<div class="product-card" data-cat="' + ci + '" data-prod="' + pi + '" role="button" tabindex="0" aria-label="' + p.name + '">' +
      '<div class="product-card__img-wrap">' +
      '<img src="' + p.img + '" alt="' + p.name + '" class="product-card__img" loading="lazy">' +
      (p.promotie ? '<span class="product-card__promo-tag">PROMOȚIE</span>' : '') +
      '</div>' +
      '<div class="product-card__info">' +
      '<h3 class="product-card__name">' + p.name + '</h3>' +
      '<p class="product-card__desc">' + p.desc + '</p>' +
      '<div class="product-card__meta">' +
      '<span class="product-card__weight">' + displayWeight + '</span>' +
      '<span class="product-card__price">' + displayPrice + '</span>' +
      '</div>' +
      '</div>' +
      '</div>';
  }


  /* ---- Modal ---- */

  function initModal() {
    var overlay = document.getElementById('productModal');
    if (!overlay) return;

    main.addEventListener('click', function (e) {
      var card = e.target.closest('.product-card');
      if (!card) return;
      openModal(getProduct(card));
    });

    main.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var card = e.target.closest('.product-card');
      if (!card) return;
      e.preventDefault();
      openModal(getProduct(card));
    });

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });

    document.getElementById('modalClose').addEventListener('click', closeModal);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeModal();
    });

    initSwipeToDismiss(overlay);
  }

  function initSwipeToDismiss(overlay) {
    var modal   = overlay.querySelector('.product-modal');
    var body    = overlay.querySelector('.product-modal__body');
    var imgWrap = overlay.querySelector('.product-modal__img-wrap');
    var handle  = overlay.querySelector('.product-modal__handle');
    var startY = 0;
    var currentY = 0;
    var dragging = false;
    var fromTop = false;

    modal.addEventListener('touchstart', function (e) {
      var t = e.target;
      fromTop = imgWrap.contains(t) || (handle && handle.contains(t));
      if (!fromTop && body.scrollTop > 0) return;
      startY = e.touches[0].clientY;
      currentY = startY;
      dragging = true;
      modal.style.transition = 'none';
    }, { passive: true });

    modal.addEventListener('touchmove', function (e) {
      if (!dragging) return;
      currentY = e.touches[0].clientY;
      var diff = Math.max(0, currentY - startY);
      modal.style.transform = 'translateY(' + diff + 'px)';
    }, { passive: true });

    modal.addEventListener('touchend', function () {
      if (!dragging) return;
      dragging = false;
      var diff = currentY - startY;
      modal.style.transition = '';
      if (diff > 100) {
        modal.style.transform = '';
        closeModal();
      } else {
        modal.style.transform = 'translateY(0)';
        setTimeout(function () { modal.style.transform = ''; }, 300);
      }
    });

    modal.addEventListener('touchcancel', function () {
      if (!dragging) return;
      dragging = false;
      modal.style.transition = '';
      modal.style.transform = 'translateY(0)';
      setTimeout(function () { modal.style.transform = ''; }, 300);
    });
  }

  function getProduct(card) {
    var ci = parseInt(card.dataset.cat, 10);
    var pi = parseInt(card.dataset.prod, 10);
    return _categories[ci].products[pi];
  }

  function openModal(p) {
    var overlay = document.getElementById('productModal');

    document.getElementById('modalImg').src = p.imgModal || p.img;
    document.getElementById('modalImg').alt = p.name;
    document.getElementById('modalName').textContent = p.name;

    var varSection = document.getElementById('modalVariants');
    if (p.variants && p.variants.length) {
      varSection.innerHTML = p.variants.map(function (v, i) {
        return '<button class="modal-variant' + (i === 0 ? ' is-active' : '') + '" data-weight="' + v.weight + '" data-price="' + v.price + '">' + v.label + '</button>';
      }).join('');
      varSection.hidden = false;
      varSection.querySelectorAll('.modal-variant').forEach(function (btn) {
        btn.addEventListener('click', function () {
          varSection.querySelectorAll('.modal-variant').forEach(function (b) { b.classList.remove('is-active'); });
          btn.classList.add('is-active');
          document.getElementById('modalWeight').textContent = btn.dataset.weight;
          document.getElementById('modalPrice').textContent = btn.dataset.price;
        });
      });
      document.getElementById('modalWeight').textContent = p.variants[0].weight;
      document.getElementById('modalPrice').textContent = p.variants[0].price;
    } else {
      varSection.hidden = true;
      varSection.innerHTML = '';
      document.getElementById('modalWeight').textContent = p.weight || '';
      document.getElementById('modalPrice').textContent = p.price || '';
    }

    var ingSection = document.getElementById('modalIngredientsSection');
    if (p.ingredients) {
      document.getElementById('modalIngredients').innerHTML = p.ingredients;
      ingSection.hidden = false;
    } else {
      ingSection.hidden = true;
    }

    var algSection = document.getElementById('modalAllergensSection');
    if (p.allergens && p.allergens.length) {
      document.getElementById('modalAllergens').textContent = p.allergens.join(', ');
      algSection.hidden = false;
    } else {
      algSection.hidden = true;
    }

    var nutSection = document.getElementById('modalNutritionalSection');
    var n = p.nutritional;
    if (n) {
      var rows = [
        { label: 'Valoare energetică', value: buildEnergy(n), sub: false },
        { label: 'Grăsimi', value: fmt(n.fat, 'g'), sub: false },
        { label: 'din care acizi grași saturați', value: fmt(n.saturated_fat, 'g'), sub: true },
        { label: 'Glucide', value: fmt(n.carbs, 'g'), sub: false },
        { label: 'din care zaharuri', value: fmt(n.sugars, 'g'), sub: true },
        { label: 'Fibre alimentare', value: fmt(n.fibre, 'g'), sub: false },
        { label: 'Proteine', value: fmt(n.protein, 'g'), sub: false },
        { label: 'Sare', value: fmt(n.salt, 'g'), sub: false }
      ];
      document.getElementById('modalNutriBody').innerHTML = rows.map(function (r) {
        return '<tr' + (r.sub ? ' class="nutri-subrow"' : '') + '>' +
          '<td>' + r.label + '</td><td>' + r.value + '</td></tr>';
      }).join('');
      nutSection.hidden = false;
    } else {
      nutSection.hidden = true;
    }

    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    var modalBody = overlay.querySelector('.product-modal__body');
    if (modalBody) {
      modalBody.scrollTop = 0;
      overlay.classList.remove('is-scrolled');
      modalBody._scrollHandler = function () {
        overlay.classList.toggle('is-scrolled', modalBody.scrollTop > 4);
      };
      modalBody.addEventListener('scroll', modalBody._scrollHandler);
    }

    setTimeout(function () { document.getElementById('modalClose').focus(); }, 50);
  }

  function buildEnergy(n) {
    if (n.energy_kj == null && n.energy_kcal == null) return '—';
    var parts = [];
    if (n.energy_kj != null) parts.push(n.energy_kj + ' kJ');
    if (n.energy_kcal != null) parts.push(n.energy_kcal + ' kcal');
    return parts.join(' / ');
  }

  function fmt(val, unit) {
    return val != null ? val + ' ' + unit : '—';
  }

  function closeModal() {
    var overlay = document.getElementById('productModal');
    overlay.classList.remove('is-open', 'is-scrolled');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    var modalBody = overlay.querySelector('.product-modal__body');
    if (modalBody && modalBody._scrollHandler) {
      modalBody.removeEventListener('scroll', modalBody._scrollHandler);
      modalBody._scrollHandler = null;
    }
  }

})();
